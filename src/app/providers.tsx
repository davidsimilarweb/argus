'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
import { useEffect, useState } from 'react';
import { setApiEnvHeader } from '../lib/api';

function AxiosEnvSync() {
  const { apiEnv } = useSettings();
  useEffect(() => {
    setApiEnvHeader(apiEnv);
  }, [apiEnv]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AxiosEnvSync />
        {children}
      </SettingsProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
