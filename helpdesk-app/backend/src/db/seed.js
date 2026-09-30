/**
 * Idempotent development seed: 1 admin, 3 users, a dozen tickets with comments and history.
 * Usage: npm run db:seed        (refuses to run with NODE_ENV=production unless --force)
 */
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../lib/password.js';
import { createDb } from './client.js';
import { comments, ticketEvents, tickets, users } from './schema.js';

const required = (name) => {
  const value = process.env[name];
  if (!value || value.length < 12) {
    console.error(`${name} must be set to at least 12 characters (see .env.example)`);
    process.exit(1);
  }
  return value;
};

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error(
    'Refusing to seed a production database. Re-run with --force if you really mean it.',
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
const adminPassword = required('SEED_ADMIN_PASSWORD');
const userPassword = required('SEED_USER_PASSWORD');

const SAMPLE_USERS = [
  { email: 'alice@example.com', name: 'Alice Johnson' },
  { email: 'bob@example.com', name: 'Bob Smith' },
  { email: 'carol@example.com', name: 'Carol Diaz' },
];

// [title, description, priority, final status, creator index, assigned to admin?]
const SAMPLE_TICKETS = [
  [
    'Cannot connect to VPN from home',
    'VPN client times out after the MFA prompt.',
    'HIGH',
    'IN_PROGRESS',
    0,
    true,
  ],
  ['Request: second monitor', 'Please order a 27" monitor for my desk.', 'LOW', 'OPEN', 0, false],
  [
    'Outlook keeps asking for password',
    'Started after the Windows update yesterday.',
    'MEDIUM',
    'RESOLVED',
    0,
    true,
  ],
  ['Printer on floor 3 jams constantly', 'Paper jams every 5-6 pages.', 'MEDIUM', 'OPEN', 1, false],
  [
    'Access to finance shared drive',
    'Need read access to \\\\fs01\\finance for Q3 reporting.',
    'MEDIUM',
    'CLOSED',
    1,
    true,
  ],
  ['Laptop battery drains fast', 'Battery lasts under 2 hours now.', 'LOW', 'IN_PROGRESS', 1, true],
  [
    'Slack notifications not working',
    'No desktop notifications on macOS.',
    'LOW',
    'OPEN',
    2,
    false,
  ],
  [
    'Phishing email reported',
    'Received a suspicious email asking to reset my password.',
    'HIGH',
    'RESOLVED',
    2,
    true,
  ],
  [
    'New hire onboarding: accounts',
    'Create accounts for new hire starting Monday.',
    'HIGH',
    'OPEN',
    2,
    true,
  ],
  [
    'Wi-Fi drops in meeting room B',
    'Connection drops every few minutes.',
    'MEDIUM',
    'OPEN',
    0,
    false,
  ],
  [
    'Software install: Figma',
    'Need Figma desktop app for design reviews.',
    'LOW',
    'CLOSED',
    1,
    true,
  ],
  ['Keyboard missing keys', 'The E and R keys are stuck.', 'LOW', 'OPEN', 2, false],
];

// Walk a legal path from OPEN to the target status, recording each hop in the audit log.
const PATHS = {
  OPEN: [],
  IN_PROGRESS: ['IN_PROGRESS'],
  RESOLVED: ['IN_PROGRESS', 'RESOLVED'],
  CLOSED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
};

const { db, pool } = createDb({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true',
});

async function upsertUser(tx, { email, name, role, password }) {
  const [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await tx
    .insert(users)
    .values({ email, name, role, passwordHash: await hashPassword(password) })
    .returning();
  return created;
}

try {
  await db.transaction(async (tx) => {
    const admin = await upsertUser(tx, {
      email: adminEmail,
      name: 'Helpdesk Admin',
      role: 'ADMIN',
      password: adminPassword,
    });
    const people = [];
    for (const user of SAMPLE_USERS) {
      people.push(await upsertUser(tx, { ...user, role: 'USER', password: userPassword }));
    }

    const [{ existing }] = await tx
      .select({ existing: sql`count(*)::int` })
      .from(tickets)
      .where(sql`${tickets.creatorId} in ${people.map((p) => p.id)}`);
    if (existing > 0) {
      console.log('Sample tickets already present; skipping ticket seed.');
      return;
    }

    let offsetMinutes = SAMPLE_TICKETS.length * 180;
    for (const [title, description, priority, status, creatorIndex, assign] of SAMPLE_TICKETS) {
      const creator = people[creatorIndex];
      let at = new Date(Date.now() - offsetMinutes * 60_000);
      offsetMinutes -= 180;
      const tick = () => (at = new Date(at.getTime() + 20 * 60_000));

      const [ticket] = await tx
        .insert(tickets)
        .values({
          title,
          description,
          priority,
          creatorId: creator.id,
          createdAt: at,
          updatedAt: at,
        })
        .returning();
      const events = [{ type: 'CREATED', actorId: creator.id, toValue: 'OPEN', createdAt: at }];

      if (assign) {
        events.push({
          type: 'ASSIGNEE_CHANGED',
          actorId: admin.id,
          fromValue: null,
          toValue: admin.id,
          createdAt: tick(),
        });
      }
      let current = 'OPEN';
      const stamps = {};
      for (const next of PATHS[status]) {
        const when = tick();
        events.push({
          type: 'STATUS_CHANGED',
          actorId: admin.id,
          fromValue: current,
          toValue: next,
          createdAt: when,
        });
        if (next === 'RESOLVED') stamps.resolvedAt = when;
        if (next === 'CLOSED') stamps.closedAt = when;
        current = next;
      }
      await tx
        .update(tickets)
        .set({ status, assigneeId: assign ? admin.id : null, ...stamps, updatedAt: at })
        .where(eq(tickets.id, ticket.id));
      await tx.insert(ticketEvents).values(events.map((e) => ({ ...e, ticketId: ticket.id })));
      await tx.insert(comments).values([
        {
          ticketId: ticket.id,
          authorId: creator.id,
          body: 'Any update on this?',
          createdAt: tick(),
        },
        ...(assign
          ? [
              {
                ticketId: ticket.id,
                authorId: admin.id,
                body: 'Looking into it now.',
                createdAt: tick(),
              },
            ]
          : []),
      ]);
    }
    console.log(`Seeded ${SAMPLE_TICKETS.length} tickets.`);
  });
  console.log(
    `Seed complete. Admin: ${adminEmail} | Users: ${SAMPLE_USERS.map((u) => u.email).join(', ')}`,
  );
} catch (error) {
  console.error('Seed failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
