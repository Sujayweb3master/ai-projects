import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { refreshTokens, users } from '../../db/schema.js';
import { AppError, conflict, unauthenticated } from '../../lib/errors.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../lib/password.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../../lib/tokens.js';
import { toUserDto } from '../users/users.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PG_UNIQUE_VIOLATION = '23505';

const invalidCredentials = () => new AppError(401, 'UNAUTHENTICATED', 'Invalid email or password');
const invalidSession = () => unauthenticated('Session expired, please log in again');

/**
 * @param {{ db: import('../../db/client.js').Db, env: import('../../config/env.js').Env, logger?: import('pino').Logger }} deps
 */
export function createAuthService({ db, env, logger }) {
  const refreshTtlMs = env.REFRESH_TOKEN_TTL_DAYS * DAY_MS;

  /**
   * Create a refresh token row (in the given family) and a matching access token.
   * @param {any} tx
   * @param {{ id: string, role: string }} user
   * @param {{ familyId?: string, userAgent?: string }} [options]
   */
  async function issueSession(tx, user, { familyId = randomUUID(), userAgent } = {}) {
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + refreshTtlMs);
    const [row] = await tx
      .insert(refreshTokens)
      .values({
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt,
        userAgent: userAgent?.slice(0, 255),
      })
      .returning({ id: refreshTokens.id });
    const accessToken = signAccessToken(user, {
      secret: env.JWT_ACCESS_SECRET,
      ttl: env.ACCESS_TOKEN_TTL,
    });
    return { accessToken, refreshToken, refreshTokenId: row.id, refreshTtlMs };
  }

  const revokeFamily = (tx, familyId) =>
    tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));

  return {
    /** @param {{ email: string, name: string, password: string }} input @param {{ userAgent?: string }} meta */
    async register(input, meta) {
      const passwordHash = await hashPassword(input.password);
      try {
        return await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({ email: input.email, name: input.name, passwordHash, role: 'USER' })
            .returning();
          const session = await issueSession(tx, user, meta);
          return { user: toUserDto(user), ...session };
        });
      } catch (error) {
        if (error?.cause?.code === PG_UNIQUE_VIOLATION || error?.code === PG_UNIQUE_VIOLATION) {
          throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
        }
        throw error;
      }
    },

    /** @param {{ email: string, password: string }} input @param {{ userAgent?: string }} meta */
    async login(input, meta) {
      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (!user) {
        await verifyAgainstDummy(input.password);
        throw invalidCredentials();
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials();
      if (!user.isActive) {
        throw new AppError(403, 'FORBIDDEN', 'This account has been deactivated');
      }
      const session = await db.transaction((tx) => issueSession(tx, user, meta));
      return { user: toUserDto(user), ...session };
    },

    /**
     * Rotate a refresh token. Presenting an already-rotated token is treated as theft:
     * the whole token family is revoked and the caller must log in again.
     * @param {string | undefined} rawToken
     * @param {{ userAgent?: string }} meta
     */
    async refresh(rawToken, meta) {
      if (!rawToken) throw invalidSession();
      const tokenHash = hashToken(rawToken);

      const outcome = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, tokenHash))
          .limit(1);
        if (!existing) return { error: 'unknown' };

        // Atomically claim the token: only one concurrent request can win this update.
        const claimed = await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.id, existing.id), isNull(refreshTokens.revokedAt)))
          .returning({ id: refreshTokens.id });

        if (claimed.length === 0) {
          await revokeFamily(tx, existing.familyId);
          return { error: 'reuse', familyId: existing.familyId, userId: existing.userId };
        }
        if (existing.expiresAt.getTime() <= Date.now()) return { error: 'expired' };

        const [user] = await tx.select().from(users).where(eq(users.id, existing.userId)).limit(1);
        if (!user || !user.isActive) {
          await revokeFamily(tx, existing.familyId);
          return { error: 'inactive' };
        }

        const session = await issueSession(tx, user, { ...meta, familyId: existing.familyId });
        await tx
          .update(refreshTokens)
          .set({ replacedById: session.refreshTokenId })
          .where(eq(refreshTokens.id, existing.id));
        return { user: toUserDto(user), ...session };
      });

      if ('error' in outcome) {
        if (outcome.error === 'reuse') {
          logger?.warn(
            { userId: outcome.userId, familyId: outcome.familyId },
            'Refresh token reuse detected; token family revoked',
          );
        }
        throw invalidSession();
      }
      return outcome;
    },

    /** Revoke the whole family of the presented token. Idempotent. @param {string | undefined} rawToken */
    async logout(rawToken) {
      if (!rawToken) return;
      const [existing] = await db
        .select({ familyId: refreshTokens.familyId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashToken(rawToken)))
        .limit(1);
      if (existing) await revokeFamily(db, existing.familyId);
    },
  };
}

/**
 * Revoke every active refresh token of a user (used when an admin deactivates them).
 * @param {any} tx
 * @param {string} userId
 */
export const revokeAllUserTokens = (tx, userId) =>
  tx
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
