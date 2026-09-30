import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createLimiter } from './middleware/rateLimiters.js';
import { requestId } from './middleware/requestContext.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { ticketsRouter } from './modules/tickets/tickets.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

/**
 * Build the Express app. Pure factory: no listening, no process handlers, so tests can use it.
 * @param {{
 *   db: import('./db/client.js').Db,
 *   pool: import('pg').Pool,
 *   env: import('./config/env.js').Env,
 *   logger: import('pino').Logger,
 *   state?: { shuttingDown: boolean },
 *   rateLimits?: { login?: number, register?: number, refresh?: number },
 * }} deps
 */
export function createApp({
  db,
  pool,
  env,
  logger,
  state = { shuttingDown: false },
  rateLimits = {},
}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => /** @type {any} */ (req).id,
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
    }),
  );
  app.use(
    helmet({
      // JSON-only API: lock the CSP down completely.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) =>
        // Same-origin and non-browser requests have no Origin header.
        callback(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const health = healthRouter({ pool, state });
  app.use(health);
  app.use('/api/v1', health);

  const requireAuth = authenticate({ db, secret: env.JWT_ACCESS_SECRET });
  const limiters = {
    login: createLimiter({ limit: rateLimits.login ?? 10 }),
    register: createLimiter({ limit: rateLimits.register ?? 10 }),
    refresh: createLimiter({ limit: rateLimits.refresh ?? 60 }),
  };

  app.use('/api/v1/auth', authRouter({ db, env, logger, authenticate: requireAuth, limiters }));
  app.use('/api/v1/tickets', requireAuth, ticketsRouter({ db }));
  app.use('/api/v1/users', requireAuth, usersRouter({ db }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
