import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('parseEnv', () => {
  it('applies safe defaults', () => {
    const env = parseEnv(valid);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL_DAYS: 7,
      COOKIE_SECURE: true,
      DB_SSL: false,
      CORS_ORIGINS: [],
      TRUST_PROXY_HOPS: 0,
    });
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('parses a comma-separated CORS allowlist', () => {
    const env = parseEnv({ ...valid, CORS_ORIGINS: 'https://a.example, https://b.example' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  it('normalises origins so trailing slashes and paths still match the Origin header', () => {
    const env = parseEnv({
      ...valid,
      CORS_ORIGINS: 'https://a.example/, http://localhost:5173/app',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'http://localhost:5173']);
  });

  it('lists every problem at once', () => {
    expect(() =>
      parseEnv({ DATABASE_URL: 'mysql://x', JWT_ACCESS_SECRET: 'short', CORS_ORIGINS: 'nope' }),
    ).toThrow(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET[\s\S]*CORS_ORIGINS/);
  });

  it('rejects malformed durations and booleans', () => {
    expect(() => parseEnv({ ...valid, ACCESS_TOKEN_TTL: '15 minutes' })).toThrow(
      /ACCESS_TOKEN_TTL/,
    );
    expect(() => parseEnv({ ...valid, COOKIE_SECURE: 'yes' })).toThrow(/COOKIE_SECURE/);
  });
});
