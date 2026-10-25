import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { useAuthStore } from '../stores/authStore.js';
import { useToastStore } from '../stores/toastStore.js';
import { resetDb } from './msw/db.js';
import { server } from './msw/server.js';

// jsdom lacks <dialog> modal support; emulate the parts ConfirmDialog relies on.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  // The app calls fetch('/api/...'); Node's fetch needs absolute URLs.
  const mswFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    mswFetch(
      typeof input === 'string' && input.startsWith('/')
        ? new URL(input, window.location.origin)
        : input,
      init,
    );
});

beforeEach(() => {
  resetDb();
  useAuthStore.setState({
    status: 'anonymous',
    user: null,
    accessToken: null,
    signOutReason: null,
  });
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
