import { http as mswHttp, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/authStore.js';
import { server } from '../test/msw/server.js';
import { ApiError, fieldErrorsFrom } from './errors.js';
import { api, toQueryString } from './http.js';

const session = (token) => ({
  user: { id: 'u1', name: 'Alice', email: 'a@example.com', role: 'USER' },
  accessToken: token,
});

describe('http client', () => {
  it('serialises arrays as repeated keys and drops empty values', () => {
    expect(toQueryString({ status: ['OPEN', 'CLOSED'], q: '', page: 2, x: undefined })).toBe(
      '?status=OPEN&status=CLOSED&page=2',
    );
  });

  it('attaches the in-memory access token', async () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 'abc' });
    let seen;
    server.use(
      mswHttp.get('/api/v1/ping', ({ request }) => {
        seen = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(api('/ping')).resolves.toEqual({ ok: true });
    expect(seen).toBe('Bearer abc');
  });

  it('parses the standard error shape into ApiError with field details', async () => {
    server.use(
      mswHttp.post('/api/v1/tickets', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: [{ path: 'body.title', message: 'too short' }],
              requestId: 'r-1',
            },
          },
          { status: 400 },
        ),
      ),
    );
    const error = await api('/tickets', { method: 'POST', body: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', requestId: 'r-1' });
    expect(fieldErrorsFrom(error)).toEqual({ title: 'too short' });
  });

  it('refreshes once for concurrent 401s, then retries each request', async () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 'expired' });
    let refreshCalls = 0;
    server.use(
      mswHttp.post('/api/v1/auth/refresh', async ({ request }) => {
        expect(request.headers.get('x-requested-with')).toBe('fetch');
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json(session('fresh'));
      }),
      mswHttp.get('/api/v1/data/:n', ({ request, params }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ n: params.n })
          : HttpResponse.json(
              { error: { code: 'UNAUTHENTICATED', message: 'x' } },
              { status: 401 },
            ),
      ),
    );
    const results = await Promise.all([api('/data/1'), api('/data/2'), api('/data/3')]);
    expect(results.map((r) => r.n)).toEqual(['1', '2', '3']);
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('fresh');
  });

  it('clears the session with reason "expired" when refresh fails', async () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 'expired', user: { id: 'u1' } });
    server.use(
      mswHttp.get('/api/v1/data', () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 }),
      ),
    );
    const error = await api('/data').catch((e) => e);
    expect(error.code).toBe('SESSION_EXPIRED');
    expect(useAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      signOutReason: 'expired',
    });
  });

  it('turns network failures into a NETWORK_ERROR ApiError', async () => {
    server.use(mswHttp.get('/api/v1/down', () => HttpResponse.error()));
    const error = await api('/down', { auth: false }).catch((e) => e);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
