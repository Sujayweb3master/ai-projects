import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { users } from '../../db/schema.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { escapeLike, paginated, toOffset } from '../../lib/pagination.js';
import { revokeAllUserTokens } from '../auth/auth.service.js';
import { toUserDto } from './users.dto.js';

/** @param {{ db: import('../../db/client.js').Db }} deps */
export function createUsersService({ db }) {
  const preventSelfChange = (actor, id, what) => {
    if (actor.id === id) throw forbidden(`You cannot change your own ${what}`);
  };

  const updateUser = async (executor, id, values) => {
    const [row] = await executor.update(users).set(values).where(eq(users.id, id)).returning();
    if (!row) throw notFound('User not found');
    return toUserDto(row);
  };

  return {
    async list(query) {
      const conditions = [];
      if (query.q) {
        const pattern = `%${escapeLike(query.q)}%`;
        conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern)));
      }
      if (query.role) conditions.push(eq(users.role, query.role));
      if (query.isActive !== undefined) conditions.push(eq(users.isActive, query.isActive));
      const where = conditions.length ? and(...conditions) : undefined;
      const { limit, offset } = toOffset(query);

      const [rows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(users)
          .where(where)
          .orderBy(asc(users.name), asc(users.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(users).where(where),
      ]);
      return paginated(rows.map(toUserDto), total, query);
    },

    async changeRole(actor, id, role) {
      preventSelfChange(actor, id, 'role');
      return updateUser(db, id, { role });
    },

    async changeStatus(actor, id, isActive) {
      preventSelfChange(actor, id, 'account status');
      return db.transaction(async (tx) => {
        const user = await updateUser(tx, id, { isActive });
        if (!isActive) await revokeAllUserTokens(tx, id);
        return user;
      });
    },
  };
}
