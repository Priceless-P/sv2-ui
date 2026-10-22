import type { ReactNode } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuth } from './useAuth';

/**
 * Sends anyone without a session to the sign-in page, remembering where they
 * were headed via ?next so they land back there after signing in. The next
 * value is validated on the read side (readNextParam) to block open redirects.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, status } = useAuth();
  const [location] = useLocation();

  if (status === 'checking') return <p role="status" className="p-6">Checking your session…</p>;
  if (status === 'signing-out') return <p role="status" className="p-6">Signing out…</p>;

  if (!session) {
    return <Redirect to={`/signin?next=${encodeURIComponent(location)}`} replace />;
  }

  return <>{children}</>;
}
