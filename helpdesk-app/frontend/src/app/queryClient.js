import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // Don't retry client errors (403/404/validation) — only transient failures.
        retry: (count, error) => (error?.status === 0 || error?.status >= 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}
