import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import {
  accountForAddress,
  payoutFromApi,
  sortPayoutsByDateDesc,
  MAIN_ACCOUNT_LABEL,
  type Payout,
  type PayoutAccount,
} from '@/lib/payoutsTable';
import { useAccountProfile, userBitcoinAddresses } from '@/hooks/useAccountData';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { subaccountName } from '@/lib/subaccountsTable';
import { accountPayoutQueryOptions } from '@/lib/payoutQueries';

/** Confirmed payouts for exactly the account being viewed, shared by history and progress. */
export function usePayouts(enabled = true) {
  const { session, viewingAccountId } = useAuth();
  const accountId = viewingAccountId ?? session?.accountId;
  return useQuery({
    ...accountPayoutQueryOptions(getUser(), session?.accountId, accountId, false),
    select: (rows): Payout[] => sortPayoutsByDateDesc(rows.map(payoutFromApi)),
    enabled: enabled && !!session && !!accountId,
  });
}

/**
 * Confirmed payouts across the main account and every subaccount. The backend returns
 * the account tree in one paginated response; local address ownership is used only to
 * supply the account label required by the existing table and filter.
 */
export function useAggregatedPayouts(enabled = true) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const { data: profile } = useAccountProfile();
  const { data: subs } = useSubaccountList();
  return useQuery({
    ...accountPayoutQueryOptions(getUser(), ownerAccountId, ownerAccountId, true),
    select: (records): Payout[] => {
      const owners: PayoutAccount[] = [
        { name: MAIN_ACCOUNT_LABEL, addresses: userBitcoinAddresses(profile) },
        ...(subs ?? []).map((s) => ({
          name: subaccountName(s),
          addresses: new Set(Object.keys(s.bitcoin_addresses ?? {}).filter(Boolean)),
        })),
      ];
      return sortPayoutsByDateDesc(
        records.map((record) => ({
          ...payoutFromApi(record),
          account: accountForAddress(record.address, owners) ?? undefined,
        })),
      );
    },
    enabled: enabled && !!session && !!profile && subs !== undefined,
  });
}
