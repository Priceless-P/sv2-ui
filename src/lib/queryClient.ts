import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time - how long data is considered fresh
      staleTime: 1000, // 1 second
      // Cache time - how long to keep data in cache after it's no longer being used
      gcTime: 5 * 60 * 1000, // 5 minutes
      // The HTTP transport owns retries, including imperative fetchQuery calls.
      retry: false,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
    },
  },
});
