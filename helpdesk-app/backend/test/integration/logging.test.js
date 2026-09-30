import { Writable } from 'node:stream';
import pino from 'pino';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db/client.js';
import { buildEnv } from '../setup/context.js';

/** App whose request logs are captured, with a configurable number of trusted proxies. */
function appWithCapturedLogs(trustProxyHops) {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const env = buildEnv({ TRUST_PROXY_HOPS: String(trustProxyHops) });
  const { db, pool } = createDb({ connectionString: env.DATABASE_URL, max: 1 });
  const app = createApp({ db, pool, env, logger: pino({ level: 'info' }, stream) });
  return { app, pool, lines };
}

const pools = [];
afterAll(() => Promise.all(pools.map((p) => p.end())));

const requestLog = (lines) => lines.find((l) => l.msg === 'request completed');

describe('request logging: clientIp', () => {
  it('uses the socket address when no proxy is trusted (spoofed headers ignored)', async () => {
    const { app, pool, lines } = appWithCapturedLogs(0);
    pools.push(pool);
    await request(app).get('/api/v1/nope').set('X-Forwarded-For', '203.0.113.9');
    expect(requestLog(lines).clientIp).toEqual(expect.any(String));
    expect(requestLog(lines).clientIp).not.toBe('203.0.113.9');
  });

  it('resolves the real client behind 3 proxies (web ingress → nginx → api ingress)', async () => {
    const { app, pool, lines } = appWithCapturedLogs(3);
    pools.push(pool);
    // XFF as it arrives at the API: client, then each proxy hop except the last (socket peer).
    await request(app)
      .get('/api/v1/nope')
      .set('X-Forwarded-For', '203.0.113.9, 10.0.0.1, 10.0.0.2');
    expect(requestLog(lines).clientIp).toBe('203.0.113.9');
  });
});
