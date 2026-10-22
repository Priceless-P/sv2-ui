import type { QueryClient } from '@tanstack/react-query';
import type { DmndClient, Subaccount } from '@/api/types';
import { enrichSubaccount } from './subaccountsTable';
import { mapConcurrent } from './concurrency';

export const ACCOUNT_POLL_MS = 5 * 60 * 1000;

/** Share reads within a polling period, but refresh at the next chart/live tick. */
function accountPollStaleTime() {
  return Math.max(1, Date.now() % ACCOUNT_POLL_MS);
}

export function subaccountWorkersQuery(cache: QueryClient, client: DmndClient, ownerId: string, id: string) {
  return cache.fetchQuery({
    queryKey: ['account', 'workers-all', id],
    queryFn: async ({ signal }) => (await client.getSubaccountWorkers(id, { signal, accountId: ownerId })).workers,
    staleTime: accountPollStaleTime,
    retry: false,
  });
}

/** Subaccounts only requires summaries; full rosters are opt-in for aggregate Home. */
export async function loadSubaccountRows(
  cache: QueryClient, client: DmndClient, ownerId: string, includeWorkers: boolean, signal: AbortSignal,
) {
  const list = await cache.fetchQuery({
    queryKey: ['account', 'subaccounts', 'list', ownerId],
    queryFn: ({ signal }) => client.getSubaccounts({ signal, accountId: ownerId }),
    staleTime: accountPollStaleTime,
    retry: false,
  });
  return mapConcurrent(list, async (row) => {
    signal.throwIfAborted();
    const summary = await cache.fetchQuery({
      queryKey: ['account', 'subaccount-summary', ownerId, row.id],
      queryFn: ({ signal }) => client.getSubaccountSummary(row.id, { signal, accountId: ownerId }),
      staleTime: accountPollStaleTime,
      retry: false,
    });
    const workers = includeWorkers ? await subaccountWorkersQuery(cache, client, ownerId, row.id) : [];
    return enrichSubaccount(row, summary, workers);
  });
}

/** Workers pages read only rosters, without fees, shares, generated BTC, or history. */
export function loadSubaccountWorkerGroups(
  cache: QueryClient, client: DmndClient, ownerId: string, subs: Subaccount[], signal: AbortSignal,
) {
  return mapConcurrent(subs, async (sub) => {
    signal.throwIfAborted();
    return { sub, workers: await subaccountWorkersQuery(cache, client, ownerId, sub.id) };
  });
}
