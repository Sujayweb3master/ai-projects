import { forbidden } from '../lib/errors.js';

/**
 * Defence in depth for the cookie-authenticated endpoints (/auth/refresh, /auth/logout).
 * SameSite=Strict already blocks cross-site sends; additionally require a custom header
 * (which a cross-site form cannot set without a CORS preflight) and an allow-listed Origin.
 * @param {string[]} allowedOrigins
 */
export function requireSameSiteRequest(allowedOrigins) {
  return (req, _res, next) => {
    if (req.get('x-requested-with') !== 'fetch') {
      return next(forbidden('Missing X-Requested-With header'));
    }
    const origin = req.get('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      return next(forbidden('Origin not allowed'));
    }
    next();
  };
}
