import { useAuth } from '@/auth';

/** The account whose data the dashboard is currently displaying. */
export function useActiveAccountId(): string | null {
  const { session, viewingAccountId } = useAuth();
  return viewingAccountId ?? session?.accountId ?? null;
}
