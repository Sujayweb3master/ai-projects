import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const USER_ROLES = /** @type {const} */ (['ADMIN', 'USER']);
export const TICKET_PRIORITIES = /** @type {const} */ (['LOW', 'MEDIUM', 'HIGH']);
export const TICKET_STATUSES = /** @type {const} */ (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
export const TICKET_EVENT_TYPES = /** @type {const} */ ([
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNEE_CHANGED',
]);

export const userRole = pgEnum('user_role', USER_ROLES);
export const ticketPriority = pgEnum('ticket_priority', TICKET_PRIORITIES);
export const ticketStatus = pgEnum('ticket_status', TICKET_STATUSES);
export const ticketEventType = pgEnum('ticket_event_type', TICKET_EVENT_TYPES);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Always stored lowercased by the application; unique constraint enforces one account per email.
  email: varchar('email', { length: 254 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('USER'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // SHA-256 hex of the opaque token; the raw token is never stored.
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_family_id_idx').on(table.familyId),
  ],
);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    priority: ticketPriority('priority').notNull().default('MEDIUM'),
    status: ticketStatus('status').notNull().default('OPEN'),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('tickets_creator_created_idx').on(table.creatorId, table.createdAt.desc()),
    index('tickets_assignee_id_idx').on(table.assigneeId),
    index('tickets_status_idx').on(table.status),
    index('tickets_priority_idx').on(table.priority),
    index('tickets_created_at_idx').on(table.createdAt.desc()),
    index('tickets_title_trgm_idx').using('gin', sql`${table.title} gin_trgm_ops`),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('comments_ticket_created_idx').on(table.ticketId, table.createdAt)],
);

export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: ticketEventType('type').notNull(),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ticket_events_ticket_created_idx').on(table.ticketId, table.createdAt)],
);
