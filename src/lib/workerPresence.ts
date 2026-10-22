import type { QueryClient } from '@tanstack/react-query';
import type { DmndClient, Worker } from '@/api/types';
import { ACCOUNT_POLL_MS } from './accountQueries';
import { msUntilNextTick } from './utils';

/** Setup needs worker existence, reusing a full roster when another widget loads it. */
export function workerPresenceQueryOptions(cache: QueryClient, client: DmndClient, accountId: string | null) {
  return {
    queryKey: ['account', 'worker-presence', accountId],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const key = ['account', 'workers-all', accountId];
      const cached = cache.getQueryData<Worker[]>(key);
      if (cached && cached.length > 0) return true;
      const updatedAt = cache.getQueryState(key)?.dataUpdatedAt ?? 0;
      if (cached !== undefined && Date.now() - updatedAt < ACCOUNT_POLL_MS) return false;
      if (cache.getQueryState(key)?.fetchStatus === 'fetching') {
        const workers = await cache.fetchQuery<Worker[]>({ queryKey: key, staleTime: ACCOUNT_POLL_MS, retry: false });
        return workers.length > 0;
      }
      return client.hasWorkers({ signal, accountId: accountId! });
    },
    staleTime: (query: { state: { data: unknown } }) => query.state.data === true ? Infinity : ACCOUNT_POLL_MS,
    refetchInterval: (query: { state: { data: unknown } }) => query.state.data === true ? false as const : msUntilNextTick(ACCOUNT_POLL_MS),
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  };
}
