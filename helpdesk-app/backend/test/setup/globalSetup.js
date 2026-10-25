import pg from 'pg';
import { runMigrations } from '../../src/db/migrate.js';
import { testDatabaseUrl } from './testDatabase.js';

/** Recreate the test schema from scratch and apply all migrations once per test run. */
export default async function setup() {
  const connectionString = testDatabaseUrl();
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
  await runMigrations({ connectionString, log: () => {} });
}
