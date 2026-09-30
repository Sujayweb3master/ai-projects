import { and, asc, count, desc, eq, ilike, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { comments, ticketEvents, tickets, users } from '../../db/schema.js';
import { canTransition, transitionTimestamps } from '../../domain/ticketStatus.js';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors.js';
import { escapeLike, paginated, toOffset } from '../../lib/pagination.js';

const creator = alias(users, 'creator');
const assignee = alias(users, 'assignee');

const ticketColumns = {
  id: tickets.id,
  title: tickets.title,
  description: tickets.description,
  priority: tickets.priority,
  status: tickets.status,
  creatorId: tickets.creatorId,
  creatorName: creator.name,
  assigneeId: tickets.assigneeId,
  assigneeName: assignee.name,
  resolvedAt: tickets.resolvedAt,
  closedAt: tickets.closedAt,
  createdAt: tickets.createdAt,
  updatedAt: tickets.updatedAt,
};

const toTicketDto = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  priority: row.priority,
  status: row.status,
  creator: { id: row.creatorId, name: row.creatorName },
  assignee: row.assigneeId ? { id: row.assigneeId, name: row.assigneeName } : null,
  resolvedAt: row.resolvedAt,
  closedAt: row.closedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const SORTS = {
  createdAt: [asc(tickets.createdAt)],
  '-createdAt': [desc(tickets.createdAt)],
  updatedAt: [asc(tickets.updatedAt)],
  '-updatedAt': [desc(tickets.updatedAt)],
  priority: [asc(tickets.priority), desc(tickets.createdAt)],
  '-priority': [desc(tickets.priority), desc(tickets.createdAt)],
};

const isAdmin = (actor) => actor.role === 'ADMIN';
const notEditable = (message) => conflict('TICKET_NOT_EDITABLE', message);

/** @param {{ db: import('../../db/client.js').Db }} deps */
export function createTicketsService({ db }) {
  const selectTickets = (executor = db) =>
    executor
      .select(ticketColumns)
      .from(tickets)
      .innerJoin(creator, eq(creator.id, tickets.creatorId))
      .leftJoin(assignee, eq(assignee.id, tickets.assigneeId));

  const findTicket = async (id, executor = db) => {
    const [row] = await selectTickets(executor).where(eq(tickets.id, id)).limit(1);
    return row ? toTicketDto(row) : null;
  };

  /**
   * Object-level authorization: a USER may only see their own tickets.
   * Returns 404 (not 403) so ticket IDs of other users can't be probed.
   */
  const getAccessibleTicket = async (actor, id, executor = db) => {
    const ticket = await findTicket(id, executor);
    if (!ticket || (!isAdmin(actor) && ticket.creator.id !== actor.id)) {
      throw notFound('Ticket not found');
    }
    return ticket;
  };

  const recordEvent = (tx, values) => tx.insert(ticketEvents).values(values);

  return {
    getAccessibleTicket,

    async list(actor, query) {
      const conditions = [];
      if (!isAdmin(actor)) conditions.push(eq(tickets.creatorId, actor.id));
      if (query.status?.length) conditions.push(inArray(tickets.status, query.status));
      if (query.priority?.length) conditions.push(inArray(tickets.priority, query.priority));
      if (query.q) conditions.push(ilike(tickets.title, `%${escapeLike(query.q)}%`));
      if (query.assigneeId === 'unassigned') conditions.push(isNull(tickets.assigneeId));
      else if (query.assigneeId) conditions.push(eq(tickets.assigneeId, query.assigneeId));
      const where = conditions.length ? and(...conditions) : undefined;

      const { limit, offset } = toOffset(query);
      const [rows, [{ total }]] = await Promise.all([
        selectTickets()
          .where(where)
          .orderBy(...SORTS[query.sort], asc(tickets.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(tickets).where(where),
      ]);
      return paginated(rows.map(toTicketDto), total, query);
    },

    async create(actor, input) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(tickets)
          .values({ ...input, creatorId: actor.id })
          .returning({ id: tickets.id });
        await recordEvent(tx, {
          ticketId: row.id,
          actorId: actor.id,
          type: 'CREATED',
          toValue: 'OPEN',
        });
        return findTicket(row.id, tx);
      });
    },

    async update(actor, id, input) {
      const ticket = await getAccessibleTicket(actor, id);
      if (isAdmin(actor)) {
        if (ticket.status === 'CLOSED') throw notEditable('Closed tickets cannot be edited');
      } else if (ticket.status !== 'OPEN') {
        throw notEditable('You can only edit a ticket while it is open');
      }
      // The status guard in WHERE prevents editing a ticket whose status changed concurrently.
      const updated = await db
        .update(tickets)
        .set(input)
        .where(and(eq(tickets.id, id), eq(tickets.status, ticket.status)))
        .returning({ id: tickets.id });
      if (updated.length === 0) throw notEditable('Ticket was modified, please reload');
      return findTicket(id);
    },

    async changeStatus(actor, id, status) {
      return db.transaction(async (tx) => {
        const ticket = await getAccessibleTicket(actor, id, tx);
        if (!canTransition(ticket.status, status)) {
          throw conflict(
            'INVALID_STATUS_TRANSITION',
            `Cannot change status from ${ticket.status} to ${status}`,
          );
        }
        const updated = await tx
          .update(tickets)
          .set({ status, ...transitionTimestamps(status, new Date()) })
          .where(and(eq(tickets.id, id), eq(tickets.status, ticket.status)))
          .returning({ id: tickets.id });
        if (updated.length === 0) {
          throw conflict(
            'INVALID_STATUS_TRANSITION',
            'Ticket status changed concurrently, please reload',
          );
        }
        await recordEvent(tx, {
          ticketId: id,
          actorId: actor.id,
          type: 'STATUS_CHANGED',
          fromValue: ticket.status,
          toValue: status,
        });
        return findTicket(id, tx);
      });
    },

    async changeAssignee(actor, id, assigneeId) {
      return db.transaction(async (tx) => {
        const ticket = await getAccessibleTicket(actor, id, tx);
        if (ticket.status === 'CLOSED') throw notEditable('Closed tickets cannot be reassigned');
        if (assigneeId) {
          const [candidate] = await tx
            .select({ role: users.role, isActive: users.isActive })
            .from(users)
            .where(eq(users.id, assigneeId))
            .limit(1);
          if (!candidate || candidate.role !== 'ADMIN' || !candidate.isActive) {
            throw badRequest('Assignee must be an active admin', [
              { path: 'body.assigneeId', message: 'must reference an active admin' },
            ]);
          }
        }
        const previous = ticket.assignee?.id ?? null;
        if (previous === assigneeId) return ticket;

        await tx.update(tickets).set({ assigneeId }).where(eq(tickets.id, id));
        await recordEvent(tx, {
          ticketId: id,
          actorId: actor.id,
          type: 'ASSIGNEE_CHANGED',
          fromValue: previous,
          toValue: assigneeId,
        });
        return findTicket(id, tx);
      });
    },

    async listComments(actor, id, query) {
      await getAccessibleTicket(actor, id);
      const { limit, offset } = toOffset(query);
      const where = eq(comments.ticketId, id);
      const [rows, [{ total }]] = await Promise.all([
        db
          .select({
            id: comments.id,
            body: comments.body,
            createdAt: comments.createdAt,
            authorId: users.id,
            authorName: users.name,
            authorRole: users.role,
          })
          .from(comments)
          .innerJoin(users, eq(users.id, comments.authorId))
          .where(where)
          .orderBy(asc(comments.createdAt), asc(comments.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(comments).where(where),
      ]);
      return paginated(
        rows.map((r) => ({
          id: r.id,
          body: r.body,
          author: { id: r.authorId, name: r.authorName, role: r.authorRole },
          createdAt: r.createdAt,
        })),
        total,
        query,
      );
    },

    async addComment(actor, id, body) {
      const ticket = await getAccessibleTicket(actor, id);
      if (!isAdmin(actor) && ticket.status === 'CLOSED') {
        throw new AppError(409, 'TICKET_CLOSED', 'You cannot comment on a closed ticket');
      }
      const [row] = await db
        .insert(comments)
        .values({ ticketId: id, authorId: actor.id, body })
        .returning();
      return {
        id: row.id,
        body: row.body,
        author: { id: actor.id, name: actor.name, role: actor.role },
        createdAt: row.createdAt,
      };
    },

    async listEvents(actor, id) {
      await getAccessibleTicket(actor, id);
      const rows = await db
        .select({
          id: ticketEvents.id,
          type: ticketEvents.type,
          fromValue: ticketEvents.fromValue,
          toValue: ticketEvents.toValue,
          createdAt: ticketEvents.createdAt,
          actorId: users.id,
          actorName: users.name,
        })
        .from(ticketEvents)
        .innerJoin(users, eq(users.id, ticketEvents.actorId))
        .where(eq(ticketEvents.ticketId, id))
        .orderBy(asc(ticketEvents.createdAt), asc(ticketEvents.id));

      // Resolve assignee IDs stored in the audit trail to display names.
      const userIds = [
        ...new Set(
          rows
            .filter((r) => r.type === 'ASSIGNEE_CHANGED')
            .flatMap((r) => [r.fromValue, r.toValue])
            .filter(Boolean),
        ),
      ];
      const names = new Map(
        userIds.length
          ? (
              await db
                .select({ id: users.id, name: users.name })
                .from(users)
                .where(inArray(users.id, userIds))
            ).map((u) => [u.id, u.name])
          : [],
      );
      const userRef = (value) => (value ? { id: value, name: names.get(value) ?? null } : null);

      return {
        data: rows.map((r) => ({
          id: r.id,
          type: r.type,
          fromValue: r.fromValue,
          toValue: r.toValue,
          ...(r.type === 'ASSIGNEE_CHANGED'
            ? { fromUser: userRef(r.fromValue), toUser: userRef(r.toValue) }
            : {}),
          actor: { id: r.actorId, name: r.actorName },
          createdAt: r.createdAt,
        })),
      };
    },
  };
}
