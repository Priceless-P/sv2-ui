import { useAuth } from '@/auth';
import { usePermissions } from './useSubaccounts';

/**
 * What the account currently in view is allowed to do.
 *
 * The capability flags come from `GET /api/user/permissions`, which the pool scopes to
 * the active account: a subaccount is returned `view_sub_accounts: false` and
 * `edit_btc_address: false` (verified live), so these are the backend's own rules
 * rather than an assumption made here. Switching accounts drops the cached permissions
 * along with the rest of the account's data, so they are refetched for the new scope.
 *
 * Permission-dependent controls remain disabled until the backend confirms access.
 * `viewingSubaccount` is the session-level fact (are we drilled into a subaccount at
 * all), used for the restrictions the API exposes no flag for.
 */
export function useAccountScope() {
  const { viewingAccountId } = useAuth();
  const { data: permissions, isSuccess } = usePermissions();
  return {
    viewingSubaccount: viewingAccountId !== null,
    canViewSubaccounts: !viewingAccountId && isSuccess && permissions.view_sub_accounts,
    canEditBitcoinAddress: !viewingAccountId && isSuccess && permissions.edit_btc_address,
  };
}
