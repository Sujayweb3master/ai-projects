import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Providers } from '../app/providers.jsx';
import { routes } from '../app/router.jsx';
import { useAuthStore } from '../stores/authStore.js';
import { db, ids } from './msw/db.js';

export const signIn = (who = 'alice') => {
  const user = db.current.users.find((u) => u.id === ids[who]);
  useAuthStore.setState({ status: 'authenticated', user, accessToken: 'token-1' });
  return user;
};

/** Render the real route tree at `route` with fresh query cache. */
export function renderApp(route = '/tickets') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const utils = render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...utils, router, user: userEvent.setup(), queryClient };
}
