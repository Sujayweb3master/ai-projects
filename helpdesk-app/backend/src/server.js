import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { createLogger } from './lib/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let env;
try {
  env = getEnv();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const { db, pool } = createDb({
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL,
  max: env.DB_POOL_MAX,
});
pool.on('error', (err) => logger.error({ err }, 'Unexpected idle PostgreSQL client error'));

const state = { shuttingDown: false };
const app = createApp({ db, pool, env, logger, state });
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'helpdesk-api listening');
});
// Must exceed the load balancer's idle timeout to avoid races on reused connections.
server.keepAliveTimeout = 65_000;

/** @param {string} signal */
async function shutdown(signal) {
  if (state.shuttingDown) return;
  state.shuttingDown = true; // /readyz now returns 503 so traffic drains away
  logger.info({ signal }, 'Shutting down gracefully');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async (err) => {
    if (err) logger.error({ err }, 'Error while closing HTTP server');
    await pool.end().catch((poolErr) => logger.error({ err: poolErr }, 'Error closing DB pool'));
    logger.info('Shutdown complete');
    process.exit(err ? 1 : 0);
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception, exiting');
  process.exit(1);
});
