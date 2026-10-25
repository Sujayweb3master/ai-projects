import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestContext,
  createTicket,
  createUser,
  login,
  resetDatabase,
} from '../setup/context.js';

/**
 * Route x role matrix. Every protected route must reject anonymous callers (401),
 * and admin-only routes must reject USERs (403) before touching any data.
 */
const ctx = createTestContext();
afterAll(() => ctx.pool.end());

let ids;
let tokens;
beforeAll(async () => {
  await resetDatabase(ctx.db);
  const admin = await createUser(ctx.db, { role: 'ADMIN' });
  const user = await createUser(ctx.db);
  const ticket = await createTicket(ctx.db, user);
  ids = { ticket: ticket.id, user: user.id };
  tokens = { ADMIN: (await login(ctx, admin)).auth, USER: (await login(ctx, user)).auth };
});

const ROUTES = [
  // [method, path, body, minimum role]
  ['get', '/api/v1/auth/me', undefined, 'USER'],
  ['get', '/api/v1/tickets', undefined, 'USER'],
  ['post', '/api/v1/tickets', { title: 'Title', description: 'Body' }, 'USER'],
  ['get', '/api/v1/tickets/:ticket', undefined, 'USER'],
  ['patch', '/api/v1/tickets/:ticket', { priority: 'HIGH' }, 'USER'],
  ['get', '/api/v1/tickets/:ticket/comments', undefined, 'USER'],
  ['post', '/api/v1/tickets/:ticket/comments', { body: 'Hi' }, 'USER'],
  ['get', '/api/v1/tickets/:ticket/events', undefined, 'USER'],
  ['patch', '/api/v1/tickets/:ticket/status', { status: 'IN_PROGRESS' }, 'ADMIN'],
  ['patch', '/api/v1/tickets/:ticket/assignee', { assigneeId: null }, 'ADMIN'],
  ['get', '/api/v1/users', undefined, 'ADMIN'],
  ['patch', '/api/v1/users/:user/role', { role: 'USER' }, 'ADMIN'],
  ['patch', '/api/v1/users/:user/status', { isActive: true }, 'ADMIN'],
];

const resolve = (path) => path.replace(':ticket', ids.ticket).replace(':user', ids.user);
const call = (method, path, body, auth) => {
  let req = ctx.api()[method](resolve(path));
  if (auth) req = req.set('Authorization', auth);
  return body ? req.send(body) : req;
};

describe.each(ROUTES)('%s %s', (method, path, body, minRole) => {
  it('rejects anonymous callers with 401', async () => {
    const res = await call(method, path, body);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  if (minRole === 'ADMIN') {
    it('rejects USER with 403', async () => {
      const res = await call(method, path, body, tokens.USER);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  }

  it(`allows ${minRole === 'ADMIN' ? 'ADMIN' : 'USER and ADMIN'}`, async () => {
    const roles = minRole === 'ADMIN' ? ['ADMIN'] : ['USER', 'ADMIN'];
    for (const role of roles) {
      const res = await call(method, path, body, tokens[role]);
      expect(res.status, `${role} ${method.toUpperCase()} ${path}`).toBeLessThan(400);
    }
  });
});
