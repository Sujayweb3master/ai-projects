import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore.js';
import { createQueryClient } from './queryClient.js';

export function Providers({ children, queryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  // Cached server data belongs to one user. Whenever the signed-in user changes — sign out,
  // session expiry, or a different account signing in — drop it so nothing from the previous
  // session can flash on screen (cache keys don't include the user). Token rotation for the
  // same user keeps the cache.
  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        if (state.user?.id !== previous.user?.id) client.clear();
      }),
    [client],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
