import { http, HttpResponse } from 'msw';
import { db, ids } from './db.js';

const error = (status, code, message, details) =>
  HttpResponse.json({ error: { code, message, details, requestId: 'test-req' } }, { status });

const page = (items, url) => {
  const p = Number(url.searchParams.get('page') ?? 1);
  const size = Number(url.searchParams.get('pageSize') ?? 20);
  return {
    data: items.slice((p - 1) * size, p * size),
    meta: {
      page: p,
      pageSize: size,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / size)),
    },
  };
};

const TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

export const handlers = [
  http.post('/api/v1/auth/refresh', () => error(401, 'UNAUTHENTICATED', 'Session expired')),
  http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json();
    const user = db.current.users.find((u) => u.email === body.email);
    if (!user || body.password !== 'correct-password') {
      return error(401, 'UNAUTHENTICATED', 'Invalid email or password');
    }
    return HttpResponse.json({ user, accessToken: 'token-1' });
  }),

  http.get('/api/v1/tickets', ({ request }) => {
    const url = new URL(request.url);
    db.current.requests.push(url.search);
    const status = url.searchParams.getAll('status');
    const priority = url.searchParams.getAll('priority');
    const q = url.searchParams.get('q')?.toLowerCase();
    const items = db.current.tickets.filter(
      (t) =>
        (!status.length || status.includes(t.status)) &&
        (!priority.length || priority.includes(t.priority)) &&
        (!q || t.title.toLowerCase().includes(q)),
    );
    return HttpResponse.json(page(items, url));
  }),
  http.post('/api/v1/tickets', async ({ request }) => {
    const body = await request.json();
    if (body.title === 'server says no') {
      return error(400, 'VALIDATION_ERROR', 'Request validation failed', [
        { path: 'body.title', message: 'Title is not allowed by the server' },
      ]);
    }
    const ticket = {
      ...db.current.tickets[0],
      ...body,
      id: '10000000-0000-4000-8000-0000000000ff',
      status: 'OPEN',
      assignee: null,
    };
    db.current.tickets.push(ticket);
    return HttpResponse.json(ticket, { status: 201 });
  }),
  http.get('/api/v1/tickets/:id', ({ params }) => {
    const ticket = db.current.tickets.find((t) => t.id === params.id);
    return ticket ? HttpResponse.json(ticket) : error(404, 'NOT_FOUND', 'Ticket not found');
  }),
  http.patch('/api/v1/tickets/:id/status', async ({ params, request }) => {
    const ticket = db.current.tickets.find((t) => t.id === params.id);
    const { status } = await request.json();
    if (status === 'RESOLVED' && ticket.title.includes('conflict')) {
      return error(
        409,
        'INVALID_STATUS_TRANSITION',
        'Ticket status changed concurrently, please reload',
      );
    }
    if (!TRANSITIONS[ticket.status].includes(status)) {
      return error(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot change status from ${ticket.status} to ${status}`,
      );
    }
    ticket.status = status;
    return HttpResponse.json(ticket);
  }),
  http.patch('/api/v1/tickets/:id/assignee', async ({ params, request }) => {
    const ticket = db.current.tickets.find((t) => t.id === params.id);
    const { assigneeId } = await request.json();
    const admin = db.current.users.find((u) => u.id === assigneeId);
    ticket.assignee = admin ? { id: admin.id, name: admin.name } : null;
    return HttpResponse.json(ticket);
  }),
  http.get('/api/v1/tickets/:id/comments', ({ request }) =>
    HttpResponse.json(page(db.current.comments, new URL(request.url))),
  ),
  http.get('/api/v1/tickets/:id/events', () => HttpResponse.json({ data: db.current.events })),

  http.get('/api/v1/users', ({ request }) => {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    return HttpResponse.json(
      page(
        db.current.users.filter((u) => !role || u.role === role),
        url,
      ),
    );
  }),
  http.patch('/api/v1/users/:id/role', async ({ params, request }) => {
    const user = db.current.users.find((u) => u.id === params.id);
    user.role = (await request.json()).role;
    return HttpResponse.json(user);
  }),
  http.patch('/api/v1/users/:id/status', async ({ params, request }) => {
    const user = db.current.users.find((u) => u.id === params.id);
    user.isActive = (await request.json()).isActive;
    return HttpResponse.json(user);
  }),
];

export { ids };
