import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/authStore.js';
import { renderApp, signIn } from '../test/render.jsx';

describe('query cache isolation between sessions', () => {
  it('drops cached data when the session ends for any reason (e.g. expiry)', async () => {
    signIn('alice');
    const { queryClient } = renderApp('/tickets');
    await screen.findByRole('link', { name: 'VPN drops every hour' });
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    // Session expiry path (api() → clear('expired')), not the Sign out button.
    useAuthStore.getState().clear('expired');
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('keeps the cache when the same user’s token is merely rotated', async () => {
    const user = signIn('alice');
    const { queryClient } = renderApp('/tickets');
    await screen.findByRole('link', { name: 'VPN drops every hour' });
    const before = queryClient.getQueryCache().getAll().length;
    useAuthStore.getState().setSession({ user, accessToken: 'rotated' });
    expect(queryClient.getQueryCache().getAll().length).toBe(before);
  });
});
