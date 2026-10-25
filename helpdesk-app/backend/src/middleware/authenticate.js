import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { forbidden, unauthenticated } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

/**
 * Verify the Bearer access token, then load the user so role changes and
 * deactivation take effect immediately rather than when the token expires.
 * @param {{ db: import('../db/client.js').Db, secret: string }} deps
 */
export function authenticate({ db, secret }) {
  return async (req, _res, next) => {
    try {
      const header = req.get('authorization') ?? '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) throw unauthenticated();

      let claims;
      try {
        claims = verifyAccessToken(token, secret);
      } catch {
        throw unauthenticated('Invalid or expired access token');
      }

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, claims.sub))
        .limit(1);
      if (!user || !user.isActive) throw unauthenticated('Account not found or deactivated');

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** @param {...('ADMIN' | 'USER')} roles */
export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(forbidden());
