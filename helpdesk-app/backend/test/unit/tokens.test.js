import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/lib/tokens.js';

const secret = 's'.repeat(40);
const user = { id: '11111111-1111-4111-8111-111111111111', role: 'USER' };

describe('access tokens', () => {
  it('round-trips subject and role', () => {
    const claims = verifyAccessToken(signAccessToken(user, { secret, ttl: '5m' }), secret);
    expect(claims).toMatchObject({ sub: user.id, role: 'USER' });
  });

  it('rejects a token signed with another secret', () => {
    const token = signAccessToken(user, { secret: 'o'.repeat(40), ttl: '5m' });
    expect(() => verifyAccessToken(token, secret)).toThrow();
  });

  it('rejects the "none" algorithm', () => {
    const token = jwt.sign({ role: 'ADMIN' }, '', {
      algorithm: 'none',
      subject: user.id,
      issuer: 'helpdesk-api',
      audience: 'helpdesk-web',
    });
    expect(() => verifyAccessToken(token, secret)).toThrow();
  });

  it('rejects expired tokens', () => {
    const token = jwt.sign({ role: 'USER' }, secret, {
      subject: user.id,
      issuer: 'helpdesk-api',
      audience: 'helpdesk-web',
      expiresIn: -10,
    });
    expect(() => verifyAccessToken(token, secret)).toThrow(/expired/);
  });
});

describe('refresh tokens', () => {
  it('are 256-bit random URL-safe strings', () => {
    const a = generateRefreshToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateRefreshToken()).not.toBe(a);
  });

  it('hash deterministically to 64 hex chars', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});
