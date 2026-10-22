import type { DmndClient } from '@/api/types';
import { PAYOUT_QUERY_OPTIONS } from './payoutsTable';

/** Share the same cached records across Home, payout history, and payout progress. */
export function accountPayoutQueryOptions(client: DmndClient, ownerId: string | null | undefined, accountId: string | null | undefined, aggregated: boolean) {
  return {
    queryKey: ['account', 'payout-records', ownerId, aggregated ? 'tree' : 'single', aggregated ? ownerId : accountId],
    queryFn: ({ signal }: { signal: AbortSignal }) => aggregated
      ? client.getPayouts({}, { signal, accountId: ownerId! })
      : client.getSubaccountPayouts(accountId!, {}, { signal, accountId: ownerId! }),
    ...PAYOUT_QUERY_OPTIONS,
  };
}
