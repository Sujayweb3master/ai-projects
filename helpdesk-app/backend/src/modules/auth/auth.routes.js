import { Router } from 'express';
import { REFRESH_COOKIE, refreshCookieOptions } from '../../lib/cookies.js';
import { requireSameSiteRequest } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { toUserDto } from '../users/users.dto.js';
import { loginBody, registerBody } from './auth.schemas.js';
import { createAuthService } from './auth.service.js';

/**
 * @param {{
 *   db: import('../../db/client.js').Db,
 *   env: import('../../config/env.js').Env,
 *   logger?: import('pino').Logger,
 *   authenticate: import('express').RequestHandler,
 *   limiters: Record<'login' | 'register' | 'refresh', import('express').RequestHandler>,
 * }} deps
 */
export function authRouter({ db, env, logger, authenticate, limiters }) {
  const router = Router();
  const auth = createAuthService({ db, env, logger });
  const sameSite = requireSameSiteRequest(env.CORS_ORIGINS);

  const meta = (req) => ({ userAgent: req.get('user-agent') });

  /** Set the rotated refresh cookie and return only the in-memory access token + user. */
  const sendSession = (res, status, session) =>
    res
      .status(status)
      .cookie(
        REFRESH_COOKIE,
        session.refreshToken,
        refreshCookieOptions({ secure: env.COOKIE_SECURE, maxAgeMs: session.refreshTtlMs }),
      )
      .json({ user: session.user, accessToken: session.accessToken });

  const clearCookie = (res) =>
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions({ secure: env.COOKIE_SECURE }));

  router.post(
    '/register',
    limiters.register,
    validate({ body: registerBody }),
    async (req, res) => {
      sendSession(res, 201, await auth.register(req.valid.body, meta(req)));
    },
  );

  router.post('/login', limiters.login, validate({ body: loginBody }), async (req, res) => {
    sendSession(res, 200, await auth.login(req.valid.body, meta(req)));
  });

  router.post('/refresh', limiters.refresh, sameSite, async (req, res) => {
    try {
      sendSession(res, 200, await auth.refresh(req.cookies?.[REFRESH_COOKIE], meta(req)));
    } catch (error) {
      clearCookie(res);
      throw error;
    }
  });

  router.post('/logout', sameSite, async (req, res) => {
    await auth.logout(req.cookies?.[REFRESH_COOKIE]);
    clearCookie(res).status(204).end();
  });

  router.get('/me', authenticate, (req, res) => {
    res.json({ user: toUserDto(req.user) });
  });

  return router;
}
