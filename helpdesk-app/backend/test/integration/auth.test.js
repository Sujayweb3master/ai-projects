import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { refreshTokens, users } from '../../src/db/schema.js';
import {
  createTestContext,
  createUser,
  login,
  PASSWORD,
  refreshCookieFrom,
  resetDatabase,
  TEST_ORIGIN,
} from '../setup/context.js';

const ctx = createTestContext();
afterAll(() => ctx.pool.end());
beforeEach(() => resetDatabase(ctx.db));

const refresh = (cookie) => {
  const req = ctx.api().post('/api/v1/auth/refresh').set('X-Requested-With', 'fetch');
  return cookie ? req.set('Cookie', cookie) : req;
};

describe('POST /api/v1/auth/register', () => {
  const body = { email: '  New.User@Example.COM ', name: 'New User', password: PASSWORD };

  it('creates a USER, lowercases the email and starts a session', async () => {
    const res = await ctx.api().post('/api/v1/auth/register').send(body).expect(201);

    expect(res.body.user).toMatchObject({
      email: 'new.user@example.com',
      role: 'USER',
      isActive: true,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.accessToken).toEqual(expect.any(String));

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^hd_rt=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const [stored] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.email, 'new.user@example.com'));
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('only stores a hash of the refresh token', async () => {
    const res = await ctx.api().post('/api/v1/auth/register').send(body).expect(201);
    const raw = refreshCookieFrom(res).split('=')[1];
    const rows = await ctx.db.select().from(refreshTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].tokenHash).not.toBe(raw);
  });

  it('rejects attempts to self-assign a role (strict schema)', async () => {
    const res = await ctx
      .api()
      .post('/api/v1/auth/register')
      .send({ ...body, role: 'ADMIN' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await ctx.api().post('/api/v1/auth/register').send(body).expect(201);
    const res = await ctx
      .api()
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'NEW.USER@example.com' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates input and returns field details', async () => {
    const res = await ctx
      .api()
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', name: '', password: 'short' })
      .expect(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      requestId: expect.any(String),
    });
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual([
      'body.email',
      'body.name',
      'body.password',
    ]);
  });

  it('rejects malformed JSON with the standard error shape', async () => {
    const res = await ctx
      .api()
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with valid credentials', async () => {
    const user = await createUser(ctx.db);
    const { body, cookie } = await login(ctx, user);
    expect(body.user.id).toBe(user.id);
    expect(cookie).toMatch(/^hd_rt=/);
  });

  it('returns the same 401 for unknown email and wrong password', async () => {
    const user = await createUser(ctx.db);
    const wrongPassword = await ctx
      .api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'wrong-password!!' })
      .expect(401);
    const unknownEmail = await ctx
      .api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password!!' })
      .expect(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });

  it('rejects deactivated accounts', async () => {
    const user = await createUser(ctx.db, { isActive: false });
    const res = await ctx
      .api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const user = await createUser(ctx.db);
    const first = await login(ctx, user);

    const res = await refresh(first.cookie).expect(200);
    const second = refreshCookieFrom(res);
    expect(second).toBeDefined();
    expect(second).not.toBe(first.cookie);
    expect(res.body.accessToken).toEqual(expect.any(String));

    const rows = await ctx.db.select().from(refreshTokens);
    const old = rows.find((r) => r.revokedAt !== null);
    const current = rows.find((r) => r.revokedAt === null);
    expect(old.replacedById).toBe(current.id);
    expect(old.familyId).toBe(current.familyId);
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const user = await createUser(ctx.db);
    const { cookie: stolen } = await login(ctx, user);
    const rotated = refreshCookieFrom(await refresh(stolen).expect(200));

    // Attacker replays the old token...
    await refresh(stolen).expect(401);
    // ...which also kills the legitimate user's current token.
    await refresh(rotated).expect(401);

    const active = (await ctx.db.select().from(refreshTokens)).filter((r) => !r.revokedAt);
    expect(active).toHaveLength(0);
  });

  it('rejects expired refresh tokens', async () => {
    const user = await createUser(ctx.db);
    const { cookie } = await login(ctx, user);
    await ctx.db.update(refreshTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    await refresh(cookie).expect(401);
  });

  it('rejects refresh for a user deactivated after login', async () => {
    const user = await createUser(ctx.db);
    const { cookie } = await login(ctx, user);
    await ctx.db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    await refresh(cookie).expect(401);
  });

  it('requires the X-Requested-With header (CSRF defence)', async () => {
    const user = await createUser(ctx.db);
    const { cookie } = await login(ctx, user);
    await ctx.api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(403);
  });

  it('rejects requests from origins outside the allowlist', async () => {
    const user = await createUser(ctx.db);
    const { cookie } = await login(ctx, user);
    await refresh(cookie).set('Origin', 'https://evil.example').expect(403);
    await refresh(cookie).set('Origin', TEST_ORIGIN).expect(200);
  });

  it('returns 401 and clears the cookie when no token is sent', async () => {
    const res = await refresh().expect(401);
    expect(res.headers['set-cookie'][0]).toMatch(/hd_rt=;/);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the session so the refresh token no longer works', async () => {
    const user = await createUser(ctx.db);
    const { cookie } = await login(ctx, user);
    const res = await ctx
      .api()
      .post('/api/v1/auth/logout')
      .set('X-Requested-With', 'fetch')
      .set('Cookie', cookie)
      .expect(204);
    expect(res.headers['set-cookie'][0]).toMatch(/hd_rt=;/);
    await refresh(cookie).expect(401);
  });

  it('is idempotent without a cookie', async () => {
    await ctx.api().post('/api/v1/auth/logout').set('X-Requested-With', 'fetch').expect(204);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the current user', async () => {
    const user = await createUser(ctx.db);
    const { auth } = await login(ctx, user);
    const res = await ctx.api().get('/api/v1/auth/me').set('Authorization', auth).expect(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['garbage token', 'Bearer not.a.jwt'],
  ])('rejects %s with 401', async (_label, header) => {
    const req = ctx.api().get('/api/v1/auth/me');
    const res = await (header ? req.set('Authorization', header) : req).expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a valid token once the user is deactivated', async () => {
    const user = await createUser(ctx.db);
    const { auth } = await login(ctx, user);
    await ctx.db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    await ctx.api().get('/api/v1/auth/me').set('Authorization', auth).expect(401);
  });
});

describe('rate limiting', () => {
  it('limits login attempts per IP and returns 429 in the standard shape', async () => {
    const limited = createTestContext({ rateLimits: { login: 3 } });
    try {
      const attempt = () =>
        limited.api().post('/api/v1/auth/login').send({ email: 'x@example.com', password: 'nope' });
      for (let i = 0; i < 3; i += 1) await attempt().expect(401);
      const res = await attempt().expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.headers.ratelimit).toBeDefined();
    } finally {
      await limited.pool.end();
    }
  });

  it('cannot be bypassed by changing path case or adding a trailing slash', async () => {
    const limited = createTestContext({ rateLimits: { login: 2 } });
    try {
      const body = { email: 'x@example.com', password: 'nope' };
      await limited.api().post('/api/v1/auth/login').send(body).expect(401);
      await limited.api().post('/api/v1/auth/LOGIN').send(body).expect(401);
      await limited.api().post('/api/v1/auth/login/').send(body).expect(429);
      await limited.api().post('/api/v1/auth/Login').send(body).expect(429);
    } finally {
      await limited.pool.end();
    }
  });

  it('ignores spoofed X-Forwarded-For when no proxy is trusted (default)', async () => {
    const limited = createTestContext({ rateLimits: { login: 1 } });
    try {
      const body = { email: 'x@example.com', password: 'nope' };
      await limited
        .api()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '1.1.1.1')
        .send(body)
        .expect(401);
      await limited
        .api()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '2.2.2.2')
        .send(body)
        .expect(429);
    } finally {
      await limited.pool.end();
    }
  });
});
