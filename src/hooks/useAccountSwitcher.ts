import { useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth, viewingAccountFromAuth } from '@/auth';
import { isSubaccountRestrictedRoute } from '@/components/dashboard/nav';

// The subaccount list belongs to the master and is required to keep the switcher
// usable while a subaccount is selected.
function isMasterSubaccountListKey(key: QueryKey): boolean {
  return key[0] === 'account' && key[1] === 'subaccounts' && key[2] === 'list';
}

function shouldClearOnAccountSwitch(key: QueryKey, masterAccountId: string): boolean {
  const isMasterProfile = key[0] === 'account' && key[1] === 'profile' && key[2] === masterAccountId;
  return key[0] === 'account' && !isMasterSubaccountListKey(key) && !isMasterProfile;
}

/**
 * Switching which account the dashboard reads. Selecting a subaccount issues a
 * subaccount session first (the pool scopes reads by that cookie plus the account
 * header), then points the client at it; returning to the main account just drops the
 * override, since the master session was never replaced. Account-specific queries are cleared after each switch so
 * prior-account results cannot remain on screen.
 */
export function useAccountSwitcher() {
  const { session, viewingAccountId, setViewingAccount } = useAuth();
  const queryClient = useQueryClient();
  // Always read the owner's profile using the owner's cookie, even after a refresh
  // inside a subaccount. This keeps direct subaccount-to-subaccount switching working.
  const { data: ownerProfile } = useQuery({
    queryKey: ['account', 'profile', session?.accountId ?? null],
    queryFn: ({ signal }) => getUser().checkAuth({ signal, accountId: session?.accountId }),
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const [location, navigate] = useLocation();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The page being viewed belongs to the account that was active when it opened, so a
  // switch that lands on a page the new scope cannot use returns to the dashboard home
  // instead of leaving a permission-denied screen on screen.
  const leaveRestrictedRoute = useCallback(() => {
    if (isSubaccountRestrictedRoute(location)) navigate('/home');
  }, [location, navigate]);

  const switchToSubaccount = useCallback(
    async (subaccount: { id: string; token: string }) => {
      // Ignore a second pick while one is in flight, so two rapid clicks cannot leave
      // the client pointed at one account while the cache holds another's data.
      if (!session || switching) return;
      const ownerToken = ownerProfile?.token;
      if (!ownerToken) {
        setError("Couldn't open that subaccount");
        return;
      }
      setSwitching(true);
      setError(null);
      try {
        const account = await getUser().logSubaccount(ownerToken, subaccount.token, {
          accountId: session.accountId,
        });
        const viewingAccount = viewingAccountFromAuth(account);
        // log_subaccount is the authentication source of truth. Its AuthResponse.id
        // names the cookie that normal account routes must select; the list row id is
        // only the requested target and is deliberately not used for request scope.
        queryClient.removeQueries({
          predicate: (query) => shouldClearOnAccountSwitch(query.queryKey, session.accountId),
        });
        queryClient.setQueryData(['account', 'profile', viewingAccount.accountId], account);
        setViewingAccount(viewingAccount);
        // Only ever narrows access, so this is the direction that can strand the miner
        // on a page the subaccount is not allowed to open.
        leaveRestrictedRoute();
      } catch {
        // Stay on the current account rather than showing an empty or mismatched
        // dashboard when the subaccount session could not be issued.
        setError("Couldn't open that subaccount");
      } finally {
        setSwitching(false);
      }
    },
    [session, switching, ownerProfile?.token, setViewingAccount, queryClient, leaveRestrictedRoute],
  );

  const switchToMain = useCallback(() => {
    if (!session) return;
    queryClient.removeQueries({
      predicate: (query) => shouldClearOnAccountSwitch(query.queryKey, session.accountId),
    });
    setViewingAccount(null);
  }, [session, setViewingAccount, queryClient]);

  return { viewingAccountId, switching, error, switchToSubaccount, switchToMain };
}
