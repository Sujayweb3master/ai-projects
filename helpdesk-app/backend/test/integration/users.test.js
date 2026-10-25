import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, createUser, login, PASSWORD, resetDatabase } from '../setup/context.js';

const ctx = createTestContext();
afterAll(() => ctx.pool.end());

let admin, alice, adminAuth, aliceAuth;
beforeEach(async () => {
  await resetDatabase(ctx.db);
  admin = await createUser(ctx.db, { role: 'ADMIN', name: 'Ada', email: 'ada@example.com' });
  alice = await createUser(ctx.db, { name: 'Alice', email: 'alice@example.com' });
  ({ auth: adminAuth } = await login(ctx, admin));
  ({ auth: aliceAuth } = await login(ctx, alice));
});

const patch = (auth, url, body) => ctx.api().patch(url).set('Authorization', auth).send(body);

describe('admin user management', () => {
  it('lists users without password hashes, with search and filters', async () => {
    await createUser(ctx.db, { name: 'Zed', email: 'zed@example.com', isActive: false });
    const res = await ctx.api().get('/api/v1/users').set('Authorization', adminAuth).expect(200);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data.map((u) => u.name)).toEqual(['Ada', 'Alice', 'Zed']);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

    const search = await ctx
      .api()
      .get('/api/v1/users?q=ALICE@&isActive=true&role=USER')
      .set('Authorization', adminAuth)
      .expect(200);
    expect(search.body.data.map((u) => u.email)).toEqual(['alice@example.com']);
  });

  it('changes a role, which takes effect on the next request', async () => {
    await ctx.api().get('/api/v1/users').set('Authorization', aliceAuth).expect(403);
    const res = await patch(adminAuth, `/api/v1/users/${alice.id}/role`, { role: 'ADMIN' }).expect(
      200,
    );
    expect(res.body.role).toBe('ADMIN');
    // Same access token as before: role is loaded from the DB per request.
    await ctx.api().get('/api/v1/users').set('Authorization', aliceAuth).expect(200);
  });

  it('deactivation blocks access immediately and revokes refresh tokens', async () => {
    const { cookie } = await login(ctx, alice);
    const res = await patch(adminAuth, `/api/v1/users/${alice.id}/status`, {
      isActive: false,
    }).expect(200);
    expect(res.body.isActive).toBe(false);

    await ctx.api().get('/api/v1/tickets').set('Authorization', aliceAuth).expect(401);
    await ctx
      .api()
      .post('/api/v1/auth/refresh')
      .set('X-Requested-With', 'fetch')
      .set('Cookie', cookie)
      .expect(401);
    await ctx
      .api()
      .post('/api/v1/auth/login')
      .send({ email: alice.email, password: PASSWORD })
      .expect(403);

    await patch(adminAuth, `/api/v1/users/${alice.id}/status`, { isActive: true }).expect(200);
    await ctx.api().get('/api/v1/tickets').set('Authorization', aliceAuth).expect(200);
  });

  it('prevents admins from changing their own role or status', async () => {
    const role = await patch(adminAuth, `/api/v1/users/${admin.id}/role`, { role: 'USER' }).expect(
      403,
    );
    expect(role.body.error.code).toBe('FORBIDDEN');
    await patch(adminAuth, `/api/v1/users/${admin.id}/status`, { isActive: false }).expect(403);
  });

  it('validates input and returns 404 for unknown users', async () => {
    await patch(adminAuth, `/api/v1/users/${alice.id}/role`, { role: 'ROOT' }).expect(400);
    await patch(adminAuth, `/api/v1/users/${alice.id}/status`, { isActive: 'no' }).expect(400);
    await patch(adminAuth, '/api/v1/users/00000000-0000-4000-8000-000000000000/role', {
      role: 'USER',
    }).expect(404);
  });
});
