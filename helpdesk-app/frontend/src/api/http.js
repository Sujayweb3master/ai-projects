import { useAuthStore } from '../stores/authStore.js';
import { ApiError } from './errors.js';

const BASE = '/api/v1';
const REFRESH_LOCK = 'helpdesk-token-refresh';

/** Build a query string; arrays become repeated keys, empty values are dropped. */
export function toQueryString(query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function toApiError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error (e.g. proxy 502 page) — fall through to a generic error.
  }
  const error = body?.error;
  return new ApiError({
    status: response.status,
    code: error?.code ?? (response.status >= 500 ? 'INTERNAL' : 'HTTP_ERROR'),
    message: error?.message ?? `Request failed (${response.status})`,
    details: error?.details,
    requestId: error?.requestId ?? response.headers.get('x-request-id') ?? undefined,
  });
}

async function send(path, { method = 'GET', body, query, headers = {}, accessToken }) {
  let response;
  try {
    response = await fetch(`${BASE}${path}${toQueryString(query)}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection.',
    });
  }
  if (response.status === 204) return { response, data: null };
  if (!response.ok) throw await toApiError(response);
  return { response, data: await response.json() };
}

/**
 * Serialise refreshes across tabs with the Web Locks API. Two tabs replaying the same
 * refresh token would trip the server's reuse detection and log the user out (ADR-003);
 * with the lock, the second tab waits and then uses the already-rotated cookie.
 */
const withCrossTabLock = (fn) =>
  typeof navigator !== 'undefined' && navigator.locks?.request
    ? navigator.locks.request(REFRESH_LOCK, fn)
    : fn();

let refreshInFlight = null;

/**
 * Exchange the httpOnly refresh cookie for a new access token. Concurrent callers in this
 * tab share one request (single flight). Resolves to the new session or throws ApiError.
 */
export function refreshSession() {
  refreshInFlight ??= withCrossTabLock(async () => {
    const { data } = await send('/auth/refresh', {
      method: 'POST',
      headers: { 'X-Requested-With': 'fetch' },
    });
    useAuthStore.getState().setSession(data);
    return data;
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * Call the API. Attaches the access token; on 401 refreshes once and retries.
 * If the refresh fails, the session is cleared (route guards then redirect to /login).
 * @param {string} path
 * @param {{ method?: string, body?: unknown, query?: Record<string, unknown>, auth?: boolean, headers?: Record<string, string> }} [options]
 */
export async function api(path, { auth = true, ...options } = {}) {
  const token = () => (auth ? useAuthStore.getState().accessToken : undefined);
  try {
    return (await send(path, { ...options, accessToken: token() })).data;
  } catch (error) {
    if (!(auth && error instanceof ApiError && error.status === 401)) throw error;
  }

  try {
    await refreshSession();
  } catch {
    useAuthStore.getState().clear('expired');
    throw new ApiError({
      status: 401,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Sign in again to continue.',
    });
  }
  return (await send(path, { ...options, accessToken: token() })).data;
}
