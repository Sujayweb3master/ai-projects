import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../../db/schema.js';
import { paginationQuery } from '../../lib/pagination.js';

/** Accept `?status=OPEN&status=CLOSED` and `?status=OPEN,CLOSED`. */
const multiEnum = (values) =>
  z.preprocess(
    (value) =>
      value === undefined
        ? undefined
        : (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(',')),
    z.array(z.enum(values)).max(values.length).optional(),
  );

export const TICKET_SORTS = /** @type {const} */ ([
  'createdAt',
  '-createdAt',
  'updatedAt',
  '-updatedAt',
  'priority',
  '-priority',
]);

export const listTicketsQuery = z
  .object({
    ...paginationQuery,
    status: multiEnum(TICKET_STATUSES),
    priority: multiEnum(TICKET_PRIORITIES),
    q: z.string().trim().min(1).max(200).optional(),
    assigneeId: z.union([z.uuid(), z.literal('unassigned')]).optional(),
    sort: z.enum(TICKET_SORTS).default('-createdAt'),
  })
  .strict();

const title = z.string().trim().min(3, 'must be at least 3 characters').max(200);
const description = z.string().trim().min(1, 'is required').max(10_000);
const priority = z.enum(TICKET_PRIORITIES);

export const createTicketBody = z
  .object({ title, description, priority: priority.default('MEDIUM') })
  .strict();

export const updateTicketBody = z
  .object({
    title: title.optional(),
    description: description.optional(),
    priority: priority.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'at least one field is required' });

export const changeStatusBody = z.object({ status: z.enum(TICKET_STATUSES) }).strict();

export const changeAssigneeBody = z.object({ assigneeId: z.uuid().nullable() }).strict();

export const listCommentsQuery = z.object({ ...paginationQuery }).strict();

export const createCommentBody = z
  .object({ body: z.string().trim().min(1, 'is required').max(5_000) })
  .strict();
