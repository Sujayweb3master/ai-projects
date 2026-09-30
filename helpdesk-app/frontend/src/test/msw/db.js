/** Tiny in-memory backend state for MSW handlers; reset before every test. */
export const ids = {
  admin: '00000000-0000-4000-8000-00000000000a',
  alice: '00000000-0000-4000-8000-0000000000a1',
  bob: '00000000-0000-4000-8000-0000000000b0',
  t1: '10000000-0000-4000-8000-000000000001',
  t2: '10000000-0000-4000-8000-000000000002',
};

const at = '2026-09-01T10:00:00.000Z';
const user = (id, name, role, extra = {}) => ({
  id,
  name,
  email: `${name.split(' ')[0].toLowerCase()}@example.com`,
  role,
  isActive: true,
  createdAt: at,
  updatedAt: at,
  ...extra,
});

export function freshDb() {
  const users = [
    user(ids.admin, 'Ada Admin', 'ADMIN'),
    user(ids.alice, 'Alice Johnson', 'USER'),
    user(ids.bob, 'Bob Smith', 'USER'),
  ];
  const ticket = (id, title, status, priority, creatorId, assigneeId = null) => ({
    id,
    title,
    description: `${title} — details`,
    status,
    priority,
    creator: { id: creatorId, name: users.find((u) => u.id === creatorId).name },
    assignee: assigneeId ? { id: assigneeId, name: 'Ada Admin' } : null,
    resolvedAt: null,
    closedAt: null,
    createdAt: at,
    updatedAt: at,
  });
  return {
    users,
    tickets: [
      ticket(ids.t1, 'VPN drops every hour', 'OPEN', 'HIGH', ids.alice),
      ticket(ids.t2, 'Printer jam', 'IN_PROGRESS', 'LOW', ids.alice, ids.admin),
    ],
    comments: [],
    events: [],
    requests: [],
  };
}

export const db = { current: freshDb() };
export const resetDb = () => {
  db.current = freshDb();
};
