import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));
// Arbitrary constant: every migration runner takes this lock so two deploys can't migrate at once.
const ADVISORY_LOCK_KEY = 727_001;

/**
 * Apply pending SQL migrations inside a session holding a Postgres advisory lock.
 * @param {{ connectionString: string, ssl?: boolean, log?: (msg: string) => void }} options
 */
export async function runMigrations({ connectionString, ssl = false, log = console.log }) {
  const client = new pg.Client({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    log('Waiting for migration lock...');
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    log(`Applying migrations from ${path.relative(process.cwd(), MIGRATIONS_FOLDER)}`);
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    log('Migrations complete');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
    await client.end();
  }
}

// CLI entry point: `node src/db/migrate.js`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  runMigrations({ connectionString, ssl: process.env.DB_SSL === 'true' }).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
