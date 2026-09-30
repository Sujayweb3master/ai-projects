import { sql } from 'drizzle-orm';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createDb } from '../../src/db/client.js';
import { tickets, users } from '../../src/db/schema.js';
import { hashPassword } from '../../src/lib/password.js';
import { testDatabaseUrl } from './testDatabase.js';

export const TEST_ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'correct-horse-battery-staple';

export function buildEnv(overrides = {}) {
  return parseEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: testDatabaseUrl(),
    JWT_ACCESS_SECRET: 'test-secret-that-is-definitely-longer-than-32-chars',
    CORS_ORIGINS: TEST_ORIGIN,
    ...overrides,
  });
}

/**
 * One app + pool per test file.
 * @param {{ env?: Record<string, string>, rateLimits?: { credentials?: number, refresh?: number } }} [options]
 */
export function createTestContext({ env: envOverrides, rateLimits } = {}) {
  const env = buildEnv(envOverrides);
  const { db, pool } = createDb({ connectionString: env.DATABASE_URL, max: 5 });
  const state = { shuttingDown: false };
  const app = createApp({
    db,
    pool,
    env,
    state,
    logger: pino({ level: 'silent' }),
    rateLimits: { credentials: 1_000, refresh: 1_000, ...rateLimits },
  });
  return { app, db, pool, env, state, api: () => request(app) };
}

export const resetDatabase = (db) =>
  db.execute(
    sql`TRUNCATE users, refresh_tokens, tickets, comments, ticket_events RESTART IDENTITY CASCADE`,
  );

let passwordHashPromise;
const cachedHash = () => (passwordHashPromise ??= hashPassword(PASSWORD));

let counter = 0;
/** Insert a user directly (faster than going through /register). */
export async function createUser(db, { role = 'USER', isActive = true, name, email } = {}) {
  counter += 1;
  const [user] = await db
    .insert(users)
    .values({
      email: email ?? `user${counter}-${Date.now()}@example.com`,
      name: name ?? `${role === 'ADMIN' ? 'Admin' : 'User'} ${counter}`,
      role,
      isActive,
      passwordHash: await cachedHash(),
    })
    .returning();
  return user;
}

/** Insert a ticket directly with a given status. */
export async function createTicket(db, creator, overrides = {}) {
  const [ticket] = await db
    .insert(tickets)
    .values({
      title: 'Printer is on fire',
      description: 'Smoke everywhere',
      priority: 'MEDIUM',
      creatorId: creator.id,
      ...overrides,
    })
    .returning();
  return ticket;
}

/** Extract the raw refresh-token cookie from a response. */
export function refreshCookieFrom(res) {
  const header = [res.headers['set-cookie'] ?? []].flat().find((c) => c.startsWith('hd_rt='));
  return header ? header.split(';')[0] : undefined;
}

/** Log in through the API and return an Authorization header value plus the refresh cookie. */
export async function login(ctx, user) {
  const res = await ctx
    .api()
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: PASSWORD })
    .expect(200);
  return { auth: `Bearer ${res.body.accessToken}`, cookie: refreshCookieFrom(res), body: res.body };
}
