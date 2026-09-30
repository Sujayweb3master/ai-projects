import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext } from '../setup/context.js';

const ctx = createTestContext();
afterAll(() => ctx.pool.end());

describe('health and cross-cutting behaviour', () => {
  it('serves liveness and readiness at the root and under /api/v1', async () => {
    await ctx.api().get('/healthz').expect(200, { status: 'ok' });
    await ctx.api().get('/readyz').expect(200, { status: 'ready' });
    await ctx.api().get('/api/v1/readyz').expect(200, { status: 'ready' });
  });

  it('reports not ready while shutting down', async () => {
    ctx.state.shuttingDown = true;
    try {
      await ctx.api().get('/readyz').expect(503);
      await ctx.api().get('/healthz').expect(200);
    } finally {
      ctx.state.shuttingDown = false;
    }
  });

  it('echoes a safe X-Request-Id and replaces an unsafe one', async () => {
    const echoed = await ctx.api().get('/healthz').set('X-Request-Id', 'abc-123');
    expect(echoed.headers['x-request-id']).toBe('abc-123');
    const replaced = await ctx.api().get('/healthz').set('X-Request-Id', '<script>');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets security headers and hides the framework', async () => {
    const res = await ctx.api().get('/healthz');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/);
  });

  it('only reflects allow-listed origins in CORS responses', async () => {
    const allowed = await ctx
      .api()
      .options('/api/v1/tickets')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await ctx.api().options('/api/v1/tickets').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the standard error shape for unknown routes and oversized bodies', async () => {
    const missing = await ctx.api().get('/api/v1/nope').expect(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });
    const big = await ctx
      .api()
      .post('/api/v1/auth/login')
      .send({ email: 'a@example.com', password: 'x'.repeat(200_000) })
      .expect(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('reports not ready when the database is unreachable', async () => {
    const broken = createTestContext({
      env: { DATABASE_URL: 'postgres://nobody:nothing@127.0.0.1:1/none_test' },
    });
    try {
      await broken.api().get('/readyz').expect(503);
    } finally {
      await broken.pool.end();
    }
  });
});
