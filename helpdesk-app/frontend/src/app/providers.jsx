import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryClient } from './queryClient.js';

export function Providers({ children, queryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
