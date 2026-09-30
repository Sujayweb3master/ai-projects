import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ticketEvents, tickets, users } from '../../src/db/schema.js';
import {
  createTestContext,
  createTicket,
  createUser,
  login,
  resetDatabase,
} from '../setup/context.js';

const ctx = createTestContext();
afterAll(() => ctx.pool.end());

let admin, alice, bob, adminAuth, aliceAuth, bobAuth;
beforeEach(async () => {
  await resetDatabase(ctx.db);
  admin = await createUser(ctx.db, { role: 'ADMIN', name: 'Ada Admin' });
  alice = await createUser(ctx.db, { name: 'Alice' });
  bob = await createUser(ctx.db, { name: 'Bob' });
  [adminAuth, aliceAuth, bobAuth] = (
    await Promise.all([login(ctx, admin), login(ctx, alice), login(ctx, bob)])
  ).map((s) => s.auth);
});

const as = (auth) => ({
  get: (url) => ctx.api().get(url).set('Authorization', auth),
  post: (url, body) => ctx.api().post(url).set('Authorization', auth).send(body),
  patch: (url, body) => ctx.api().patch(url).set('Authorization', auth).send(body),
});

const eventsOf = (ticketId) =>
  ctx.db.select().from(ticketEvents).where(eq(ticketEvents.ticketId, ticketId));

describe('creating tickets', () => {
  it('creates an OPEN ticket owned by the caller and records a CREATED event', async () => {
    const res = await as(aliceAuth)
      .post('/api/v1/tickets', { title: 'VPN down', description: 'Cannot connect' })
      .expect(201);
    expect(res.body).toMatchObject({
      title: 'VPN down',
      priority: 'MEDIUM',
      status: 'OPEN',
      creator: { id: alice.id, name: 'Alice' },
      assignee: null,
    });
    const events = await eventsOf(res.body.id);
    expect(events).toMatchObject([{ type: 'CREATED', actorId: alice.id, toValue: 'OPEN' }]);
  });

  it('rejects unknown fields such as status or creatorId (strict schema)', async () => {
    const res = await as(aliceAuth)
      .post('/api/v1/tickets', {
        title: 'Sneaky',
        description: 'x',
        status: 'CLOSED',
        creatorId: bob.id,
      })
      .expect(400);
    expect(res.body.error.details.map((d) => d.message).join(' ')).toMatch(/Unrecognized key/);
  });

  it('validates title length and priority', async () => {
    const res = await as(aliceAuth)
      .post('/api/v1/tickets', { title: 'x', description: 'ok', priority: 'URGENT' })
      .expect(400);
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual([
      'body.priority',
      'body.title',
    ]);
  });
});

describe('listing tickets', () => {
  beforeEach(async () => {
    await createTicket(ctx.db, alice, { title: 'Alice printer jam', priority: 'LOW' });
    await createTicket(ctx.db, alice, {
      title: 'Alice VPN issue',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
    });
    await createTicket(ctx.db, bob, {
      title: 'Bob 100% CPU',
      priority: 'HIGH',
      assigneeId: admin.id,
    });
  });

  it('USER only sees their own tickets', async () => {
    const res = await as(aliceAuth).get('/api/v1/tickets').expect(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
    expect(res.body.data.every((t) => t.creator.id === alice.id)).toBe(true);
  });

  it('USER cannot widen scope with filters', async () => {
    const res = await as(aliceAuth).get(`/api/v1/tickets?assigneeId=${admin.id}`).expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('ADMIN sees all tickets', async () => {
    const res = await as(adminAuth).get('/api/v1/tickets').expect(200);
    expect(res.body.meta.total).toBe(3);
  });

  it('filters by repeated and comma-separated status/priority values', async () => {
    const byStatus = await as(adminAuth).get('/api/v1/tickets?status=OPEN&status=IN_PROGRESS');
    expect(byStatus.body.meta.total).toBe(3);
    const byPriority = await as(adminAuth).get('/api/v1/tickets?priority=HIGH,LOW&status=OPEN');
    expect(byPriority.body.data.map((t) => t.title).sort()).toEqual([
      'Alice printer jam',
      'Bob 100% CPU',
    ]);
  });

  it('searches titles case-insensitively and treats wildcards literally', async () => {
    const res = await as(adminAuth).get('/api/v1/tickets?q=vpn').expect(200);
    expect(res.body.data.map((t) => t.title)).toEqual(['Alice VPN issue']);
    const literal = await as(adminAuth).get(`/api/v1/tickets?q=${encodeURIComponent('%')}`);
    expect(literal.body.data.map((t) => t.title)).toEqual(['Bob 100% CPU']);
  });

  it('filters unassigned tickets and sorts by priority', async () => {
    const res = await as(adminAuth)
      .get('/api/v1/tickets?assigneeId=unassigned&sort=-priority')
      .expect(200);
    expect(res.body.data.map((t) => t.priority)).toEqual(['HIGH', 'LOW']);
  });

  it('paginates', async () => {
    const res = await as(adminAuth).get('/api/v1/tickets?page=2&pageSize=2').expect(200);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(res.body.data).toHaveLength(1);
  });

  it('rejects out-of-range pagination and unknown query params', async () => {
    await as(adminAuth).get('/api/v1/tickets?pageSize=101').expect(400);
    await as(adminAuth).get('/api/v1/tickets?page=0').expect(400);
    await as(adminAuth).get('/api/v1/tickets?status=DONE').expect(400);
    await as(adminAuth).get('/api/v1/tickets?creatorId=x').expect(400);
  });
});

describe('object-level access', () => {
  it("returns 404 (not 403) for another user's ticket on every ticket route", async () => {
    const ticket = await createTicket(ctx.db, alice);
    const base = `/api/v1/tickets/${ticket.id}`;
    await as(bobAuth).get(base).expect(404);
    await as(bobAuth).patch(base, { title: 'Hijacked' }).expect(404);
    await as(bobAuth).get(`${base}/comments`).expect(404);
    await as(bobAuth).post(`${base}/comments`, { body: 'hi' }).expect(404);
    await as(bobAuth).get(`${base}/events`).expect(404);

    const [unchanged] = await ctx.db.select().from(tickets).where(eq(tickets.id, ticket.id));
    expect(unchanged.title).toBe('Printer is on fire');
  });

  it('returns 400 for a malformed id and 404 for an unknown one', async () => {
    await as(adminAuth).get('/api/v1/tickets/not-a-uuid').expect(400);
    await as(adminAuth).get('/api/v1/tickets/00000000-0000-4000-8000-000000000000').expect(404);
  });
});

describe('editing tickets', () => {
  it('owner can edit while OPEN', async () => {
    const ticket = await createTicket(ctx.db, alice);
    const res = await as(aliceAuth)
      .patch(`/api/v1/tickets/${ticket.id}`, { title: 'Printer fixed?', priority: 'HIGH' })
      .expect(200);
    expect(res.body).toMatchObject({ title: 'Printer fixed?', priority: 'HIGH' });
    expect(new Date(res.body.updatedAt) >= new Date(ticket.updatedAt)).toBe(true);
  });

  it.each(['IN_PROGRESS', 'RESOLVED', 'CLOSED'])('owner cannot edit when %s', async (status) => {
    const ticket = await createTicket(ctx.db, alice, { status });
    const res = await as(aliceAuth)
      .patch(`/api/v1/tickets/${ticket.id}`, { title: 'Nope' })
      .expect(409);
    expect(res.body.error.code).toBe('TICKET_NOT_EDITABLE');
  });

  it('admin can edit any non-closed ticket but not a closed one', async () => {
    const inProgress = await createTicket(ctx.db, alice, { status: 'IN_PROGRESS' });
    await as(adminAuth).patch(`/api/v1/tickets/${inProgress.id}`, { priority: 'HIGH' }).expect(200);
    const closed = await createTicket(ctx.db, alice, { status: 'CLOSED' });
    await as(adminAuth).patch(`/api/v1/tickets/${closed.id}`, { priority: 'HIGH' }).expect(409);
  });

  it('requires at least one field and forbids changing status through PATCH /:id', async () => {
    const ticket = await createTicket(ctx.db, alice);
    await as(aliceAuth).patch(`/api/v1/tickets/${ticket.id}`, {}).expect(400);
    await as(aliceAuth).patch(`/api/v1/tickets/${ticket.id}`, { status: 'CLOSED' }).expect(400);
  });
});

describe('status changes', () => {
  const change = (auth, id, status) => as(auth).patch(`/api/v1/tickets/${id}/status`, { status });

  it('only ADMIN may change status (403 for the owner)', async () => {
    const ticket = await createTicket(ctx.db, alice);
    const res = await change(aliceAuth, ticket.id, 'IN_PROGRESS').expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('walks the full lifecycle, stamping timestamps and auditing every hop', async () => {
    const ticket = await createTicket(ctx.db, alice);
    await change(adminAuth, ticket.id, 'IN_PROGRESS').expect(200);
    const resolved = await change(adminAuth, ticket.id, 'RESOLVED').expect(200);
    expect(resolved.body.resolvedAt).not.toBeNull();
    const reopened = await change(adminAuth, ticket.id, 'IN_PROGRESS').expect(200);
    expect(reopened.body.resolvedAt).toBeNull();
    await change(adminAuth, ticket.id, 'RESOLVED').expect(200);
    const closed = await change(adminAuth, ticket.id, 'CLOSED').expect(200);
    expect(closed.body).toMatchObject({ status: 'CLOSED', closedAt: expect.any(String) });

    const events = await eventsOf(ticket.id);
    expect(events.map((e) => `${e.fromValue}->${e.toValue}`)).toEqual([
      'OPEN->IN_PROGRESS',
      'IN_PROGRESS->RESOLVED',
      'RESOLVED->IN_PROGRESS',
      'IN_PROGRESS->RESOLVED',
      'RESOLVED->CLOSED',
    ]);
    expect(events.every((e) => e.type === 'STATUS_CHANGED' && e.actorId === admin.id)).toBe(true);
  });

  it.each([
    ['OPEN', 'RESOLVED'],
    ['OPEN', 'OPEN'],
    ['IN_PROGRESS', 'CLOSED'],
    ['RESOLVED', 'OPEN'],
    ['CLOSED', 'OPEN'],
    ['CLOSED', 'IN_PROGRESS'],
  ])('rejects %s -> %s with 409 and leaves no audit event', async (from, to) => {
    const ticket = await createTicket(ctx.db, alice, { status: from });
    const res = await change(adminAuth, ticket.id, to).expect(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(await eventsOf(ticket.id)).toHaveLength(0);
    const [row] = await ctx.db.select().from(tickets).where(eq(tickets.id, ticket.id));
    expect(row.status).toBe(from);
  });

  it('allows OPEN -> CLOSED directly', async () => {
    const ticket = await createTicket(ctx.db, alice);
    await change(adminAuth, ticket.id, 'CLOSED').expect(200);
  });
});

describe('assignment', () => {
  const assign = (auth, id, assigneeId) =>
    as(auth).patch(`/api/v1/tickets/${id}/assignee`, { assigneeId });

  it('admin assigns and unassigns, recording both events', async () => {
    const ticket = await createTicket(ctx.db, alice);
    const assigned = await assign(adminAuth, ticket.id, admin.id).expect(200);
    expect(assigned.body.assignee).toEqual({ id: admin.id, name: 'Ada Admin' });
    const unassigned = await assign(adminAuth, ticket.id, null).expect(200);
    expect(unassigned.body.assignee).toBeNull();

    const events = await as(adminAuth).get(`/api/v1/tickets/${ticket.id}/events`).expect(200);
    expect(events.body.data).toMatchObject([
      { type: 'ASSIGNEE_CHANGED', fromUser: null, toUser: { id: admin.id, name: 'Ada Admin' } },
      { type: 'ASSIGNEE_CHANGED', fromUser: { id: admin.id }, toUser: null },
    ]);
  });

  it('is a no-op (no event) when the assignee does not change', async () => {
    const ticket = await createTicket(ctx.db, alice, { assigneeId: admin.id });
    await assign(adminAuth, ticket.id, admin.id).expect(200);
    expect(await eventsOf(ticket.id)).toHaveLength(0);
  });

  it('rejects non-admin, inactive or unknown assignees', async () => {
    const ticket = await createTicket(ctx.db, alice);
    const inactiveAdmin = await createUser(ctx.db, { role: 'ADMIN', isActive: false });
    await assign(adminAuth, ticket.id, bob.id).expect(400);
    await assign(adminAuth, ticket.id, inactiveAdmin.id).expect(400);
    await assign(adminAuth, ticket.id, '00000000-0000-4000-8000-000000000000').expect(400);
  });

  it('USER cannot assign, and closed tickets cannot be reassigned', async () => {
    const ticket = await createTicket(ctx.db, alice);
    await assign(aliceAuth, ticket.id, admin.id).expect(403);
    const closed = await createTicket(ctx.db, alice, { status: 'CLOSED' });
    await assign(adminAuth, closed.id, admin.id).expect(409);
  });

  it('keeps tickets when an assigned admin is deleted (assignee set to null)', async () => {
    const other = await createUser(ctx.db, { role: 'ADMIN' });
    const ticket = await createTicket(ctx.db, alice, { assigneeId: other.id });
    await ctx.db.delete(users).where(eq(users.id, other.id));
    const res = await as(adminAuth).get(`/api/v1/tickets/${ticket.id}`).expect(200);
    expect(res.body.assignee).toBeNull();
  });
});

describe('comments', () => {
  it('owner and admin can comment; comments are listed oldest first with authors', async () => {
    const ticket = await createTicket(ctx.db, alice);
    const url = `/api/v1/tickets/${ticket.id}/comments`;
    await as(aliceAuth).post(url, { body: 'First' }).expect(201);
    const reply = await as(adminAuth).post(url, { body: '  Second  ' }).expect(201);
    expect(reply.body).toMatchObject({ body: 'Second', author: { id: admin.id, role: 'ADMIN' } });

    const res = await as(aliceAuth).get(url).expect(200);
    expect(res.body.data.map((c) => c.body)).toEqual(['First', 'Second']);
    expect(res.body.meta.total).toBe(2);
  });

  it('owner cannot comment on a closed ticket but admin can', async () => {
    const ticket = await createTicket(ctx.db, alice, { status: 'CLOSED' });
    const url = `/api/v1/tickets/${ticket.id}/comments`;
    const res = await as(aliceAuth).post(url, { body: 'Hello?' }).expect(409);
    expect(res.body.error.code).toBe('TICKET_CLOSED');
    await as(adminAuth).post(url, { body: 'Closing note' }).expect(201);
  });

  it('rejects empty and oversized comments', async () => {
    const ticket = await createTicket(ctx.db, alice);
    const url = `/api/v1/tickets/${ticket.id}/comments`;
    await as(aliceAuth).post(url, { body: '   ' }).expect(400);
    await as(aliceAuth)
      .post(url, { body: 'x'.repeat(5001) })
      .expect(400);
  });
});
