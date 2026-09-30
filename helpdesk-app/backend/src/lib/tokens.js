import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

const ISSUER = 'helpdesk-api';
const AUDIENCE = 'helpdesk-web';

/**
 * @param {{ id: string, role: string }} user
 * @param {{ secret: string, ttl: string }} options
 */
export const signAccessToken = (user, { secret, ttl }) =>
  jwt.sign({ role: user.role }, secret, {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: /** @type {any} */ (ttl),
    issuer: ISSUER,
    audience: AUDIENCE,
  });

/**
 * Verify signature, algorithm, issuer, audience and expiry. Throws on any failure.
 * @param {string} token
 * @param {string} secret
 * @returns {{ sub: string, role: string }}
 */
export const verifyAccessToken = (token, secret) =>
  /** @type {any} */ (
    jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE })
  );

/** 256 bits of randomness, URL-safe. This is what the browser holds in the httpOnly cookie. */
export const generateRefreshToken = () => randomBytes(32).toString('base64url');

/** Refresh tokens are high-entropy, so a fast SHA-256 is sufficient (no need for argon2). */
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
