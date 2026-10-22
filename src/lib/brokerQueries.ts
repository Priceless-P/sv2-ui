import type { QueryClient } from '@tanstack/react-query';
import type { DmndClient } from '@/api/types';

export function clearBrokerQueries(cache: QueryClient): void {
  // removeQueries cancels running requests as well as dropping their data.
  cache.removeQueries({ queryKey: ['broker'] });
}

export function brokerMinersQueryOptions(client: DmndClient, brokerId: string | null, fromBlockHeight: number) {
  return {
    queryKey: ['broker', brokerId, 'miners', fromBlockHeight],
    queryFn: ({ signal }: { signal: AbortSignal }) => client.brokerMiners(fromBlockHeight, { signal, brokerId: brokerId! }),
    enabled: !!brokerId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  } as const;
}
