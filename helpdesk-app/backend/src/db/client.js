import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

/**
 * Create a pg pool + Drizzle instance. All Drizzle queries are parameterized.
 * @param {{ connectionString: string, ssl?: boolean, max?: number }} options
 */
export function createDb({ connectionString, ssl = false, max = 10 }) {
  const pool = new pg.Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Azure PostgreSQL uses certificates signed by a public CA, so verification stays on.
    ssl: ssl ? { rejectUnauthorized: true } : undefined,
  });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool };
}

/** @typedef {ReturnType<typeof createDb>['db']} Db */
