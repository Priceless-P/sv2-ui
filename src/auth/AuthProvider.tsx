import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getUser, subscribeToDmndAuthRejections } from '@/api';
import { queryClient } from '@/lib/queryClient';
import { revokeDashboardSessions } from './logout';
import type { Subaccount } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import { createAuthStore, type AuthStore, type SignOutReason } from './authStore';
import { isExpired, viewingAccountFromAuth, type Session, type ViewingAccountSession } from './session';
import { actionForRejectedRequest, shouldEndSessionAfterValidation } from './sessionValidation';

export type AuthStatus = 'checking' | 'signing-out' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  session: Session | null;
  signOutReason: SignOutReason | null;
  status: AuthStatus;
  /** The subaccount being viewed via the switcher, or null for the master account. */
  viewingAccountId: string | null;
  /** AuthResponse-derived identity for the selected subaccount. */
  viewingAccount: ViewingAccountSession | null;
  signIn: (session: Session) => void;
  signOut: (reason?: SignOutReason) => void | Promise<void>;
  setViewingAccount: (account: ViewingAccountSession | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVITY_DEBOUNCE_MS = 60 * 1000;
const EXPIRY_CHECK_INTERVAL_MS = 30 * 1000;

interface AuthProviderProps {
  children: ReactNode;
  store?: AuthStore;
}

export function AuthProvider({ children, store: injectedStore }: AuthProviderProps) {
  const toast = useToast();
  const logoutRef = useRef<Promise<void> | null>(null);
  const ownsStore = useRef(!injectedStore);
  const [store] = useState<AuthStore>(() => injectedStore ?? createAuthStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const [validating, setValidating] = useState(() => !!store.getSnapshot().session);
  const [signingOut, setSigningOut] = useState(false);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    const owns = ownsStore.current;
    // Connect the cross-tab channel here (not in the store constructor) so only
    // the mounted store listens; StrictMode's discarded initializer store never
    // does, which keeps a refresh from being seen as a duplicate-tab claim.
    if (owns) store.connect();
    return () => {
      if (owns) store.teardown();
    };
  }, [store]);

  // Listen for auth rejections from the backend. If the master session is rejected, sign out entirely.
  // If a subaccount session is rejected, drop the subaccount and return to the master account.
  useEffect(
    () =>
      subscribeToDmndAuthRejections(({ accountId: rejectedAccountId }) => {
        const action = actionForRejectedRequest(store.getSnapshot(), rejectedAccountId);
        if (action === 'sign-out') store.signOut('expired');
        else if (action === 'leave-subaccount') store.setViewingAccount(null);
      }),
    [store],
  );

  // Drop all cached account data when the master session changes or signs out. Queries
  // within a session are keyed by the active account id, so master/subaccount switches
  // remain isolated without discarding useful cached data. Keyed on the master id so
  // this does not run on every idle-activity session bump.
  const accountId = state.session?.accountId ?? null;
  const prevAccountIdRef = useRef(accountId);
  useEffect(() => {
    if (prevAccountIdRef.current !== null && prevAccountIdRef.current !== accountId) {
      queryClient.clear();
    }
    prevAccountIdRef.current = accountId;
  }, [accountId]);

  // On startup, validate a session restored from storage against the backend.
  // The auth cookie is HttpOnly so we can't inspect it here; check_auth confirms
  // it's still valid. If it isn't, drop the local session and route to sign-in.
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;
    const restored = store.getSnapshot().session;
    if (!restored) { setValidating(false); return; }
    const restoredViewing = store.getSnapshot().viewingAccount;
    const stillValidatingRestoredSession = () => {
      const current = store.getSnapshot().session;
      return current?.accountId === restored.accountId && current.expiresAt === restored.expiresAt;
    };
    const ownerValidation = queryClient.fetchQuery({
      queryKey: ['account', 'profile', restored.accountId],
      queryFn: ({ signal }) => getUser().checkAuth({ accountId: restored.accountId, signal }),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })
      .then((account) => {
        if (!stillValidatingRestoredSession()) return;
        store.updateSessionProfile({
          email: account.email,
          company_name: account.company_name,
          company_primary_location: account.company_primary_location,
          kyb_status: account.kyb_status,
        });
      })
      .catch((error: unknown) => {
        // A temporary network or service failure should leave the local session intact;
        // only an explicit authentication rejection proves that it has expired.
        if (stillValidatingRestoredSession() && shouldEndSessionAfterValidation(error)) {
          store.signOut('expired');
        }
      });

    const validations = [ownerValidation];
    if (restoredViewing) {
      validations.push(queryClient.fetchQuery({
        queryKey: ['account', 'profile', restoredViewing.accountId],
        queryFn: ({ signal }) => getUser().checkAuth({ accountId: restoredViewing.accountId, signal }),
        staleTime: 5 * 60 * 1000,
        retry: false,
      })
        .then((account) => {
          const current = store.getSnapshot();
          if (
            current.session?.accountId !== restored.accountId ||
            current.session.expiresAt !== restored.expiresAt ||
            current.viewingAccountId !== restoredViewing.accountId
          ) {
            return;
          }
          queryClient.setQueryData(['account', 'profile', String(account.id)], account);
          store.setViewingAccount(viewingAccountFromAuth(account));
        })
        .catch((error: unknown) => {
          const current = store.getSnapshot();
          if (
            current.session?.accountId === restored.accountId &&
            current.session.expiresAt === restored.expiresAt &&
            current.viewingAccountId === restoredViewing.accountId &&
            shouldEndSessionAfterValidation(error)
          ) {
            // The master login is still valid; only the selected subaccount cookie is
            // gone, so return to main instead of logging the user out entirely.
            store.setViewingAccount(null);
          }
        }));
    }
    void Promise.allSettled(validations).then(() => setValidating(false));
  }, [store]);

  const signOut = useCallback((reason: SignOutReason = 'user'): Promise<void> => {
    if (reason === 'duplicate_tab') {
      store.signOut(reason);
      queryClient.removeQueries({ queryKey: ['account'] });
      return Promise.resolve();
    }
    if (logoutRef.current) return logoutRef.current;
    const snapshot = store.getSnapshot();
    if (!snapshot.session) return Promise.resolve();
    const ownerId = snapshot.session.accountId;
    const subs = queryClient.getQueryData<Subaccount[]>(['account', 'subaccounts', 'list', ownerId]) ?? [];
    const knownIds = [...subs.map((sub) => sub.id), ...(snapshot.viewingAccountId ? [snapshot.viewingAccountId] : [])];
    setSigningOut(true);
    logoutRef.current = (async () => {
      await queryClient.cancelQueries({ queryKey: ['account'] });
      try {
        const complete = await revokeDashboardSessions(getUser(), ownerId, knownIds);
        if (!complete) toast({ type: 'error', message: 'Signed out on this device. Some server sessions could not be closed. Please sign in and sign out again when your connection is restored.' });
      } finally {
        store.signOut(reason);
        queryClient.clear();
        setSigningOut(false);
        logoutRef.current = null;
      }
    })();
    return logoutRef.current;
  }, [store, toast]);

  useEffect(() => {
    const expireIfNeeded = (now: number) => {
      const current = store.getSnapshot().session;
      if (!current || logoutRef.current) return true;
      if (!isExpired(current, now)) return false;
      void signOut('expired');
      return true;
    };
    const onActivity = () => {
      const now = Date.now();
      if (expireIfNeeded(now)) return;
      if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) return;
      lastActivityRef.current = now;
      store.bumpActivity(now);
    };
    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove'];
    for (const event of events) window.addEventListener(event, onActivity);
    document.addEventListener('visibilitychange', onActivity);
    const timer = window.setInterval(() => expireIfNeeded(Date.now()), EXPIRY_CHECK_INTERVAL_MS);
    return () => {
      for (const event of events) window.removeEventListener(event, onActivity);
      document.removeEventListener('visibilitychange', onActivity);
      window.clearInterval(timer);
    };
  }, [store, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: state.session,
      signOutReason: state.signOutReason,
      status: state.session ? (signingOut ? 'signing-out' : validating ? 'checking' : 'authenticated') : 'anonymous',
      viewingAccountId: state.viewingAccountId,
      viewingAccount: state.viewingAccount,
      signIn: store.signIn,
      signOut,
      setViewingAccount: store.setViewingAccount,
    }),
    [state, store, signOut, validating, signingOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
