import { z } from 'zod';
import { USER_ROLES } from '../../db/schema.js';
import { paginationQuery } from '../../lib/pagination.js';

export const listUsersQuery = z
  .object({
    ...paginationQuery,
    q: z.string().trim().min(1).max(254).optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

export const changeRoleBody = z.object({ role: z.enum(USER_ROLES) }).strict();

export const changeStatusBody = z.object({ isActive: z.boolean() }).strict();
