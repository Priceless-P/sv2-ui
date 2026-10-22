import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mapConcurrent } from '@/lib/concurrency';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import type { GeneratedBtcEntry } from '@/api/types';
import { dedupeGeneratedBtc, sortGeneratedByDateDesc } from '@/lib/generatedBtcTable';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { subaccountName } from '@/lib/subaccountsTable';
import { useActiveAccountId } from './useActiveAccountId';

// Daily data is checked every five minutes
const CLOUD_POLL_MS = 5 * 60 * 1000;

/**
 * The account's daily generated-BTC entries (GET /api/generated_btc).
 */
export function useGeneratedBtc(enabled = true) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'generated-btc', accountId],
    queryFn: ({ signal }): Promise<GeneratedBtcEntry[]> =>
      getUser().getGeneratedBtc({ signal, accountId: accountId ?? undefined }),
    enabled: !!session && enabled,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Generated-BTC entries across the main account and every subaccount, each row tagged
 * with the account it belongs to. Each owner has its own dedicated endpoint (unlike
 * Payouts, which scans one shared pool wallet), so this fetches the main account's own
 * entries plus every subaccount's in parallel and tags each result with that owner's
 * name itself — never trusting an embedded field, since `GeneratedBtcEntry` carries
 * none. A failed subaccount fetch rejects the whole query (Promise.all), so the page
 * shows its error state rather than a total that is silently missing an account's BTC.
 */
export function useAggregatedGeneratedBtc(enabled = true, includeMain = true) {
  const cache = useQueryClient();
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const { data: subs } = useSubaccountList();
  return useQuery({
    queryKey: ['account', 'generated-btc', 'aggregated', ownerAccountId, includeMain, (subs ?? []).map((sub) => [sub.id, subaccountName(sub)])],
    queryFn: async ({ signal }): Promise<GeneratedBtcEntry[]> => {
      const client = getUser();
      const owners = subs ?? [];
      const [mainRows, subResults] = await Promise.all([
        includeMain ? cache.fetchQuery({
          queryKey: ['account', 'generated-btc', ownerAccountId],
          queryFn: ({ signal }) => client.getGeneratedBtc({ signal, accountId: ownerAccountId! }),
          staleTime: CLOUD_POLL_MS, retry: false,
        }) : Promise.resolve([]),
        mapConcurrent(owners, (s) => {
          signal.throwIfAborted();
          return cache.fetchQuery({
            queryKey: ['account', 'generated-btc', s.id],
            queryFn: ({ signal }) => client.getSubaccountGeneratedBtc(s.id, { signal, accountId: ownerAccountId! }),
            staleTime: CLOUD_POLL_MS, retry: false,
          });
        }),
      ]);
      const tagged: GeneratedBtcEntry[] = [
        ...mainRows.map((r) => ({ ...r, account: MAIN_ACCOUNT_LABEL, accountId: ownerAccountId ?? undefined })),
        ...subResults.flatMap((rows, i) => rows.map((r) => ({ ...r, account: subaccountName(owners[i]), accountId: owners[i].id }))),
      ];
      return sortGeneratedByDateDesc(dedupeGeneratedBtc(tagged));
    },
    enabled: enabled && !!session && subs !== undefined,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
