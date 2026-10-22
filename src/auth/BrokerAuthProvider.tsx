import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { subscribeToBrokerAuthRejections } from '@/api';
import { queryClient } from '@/lib/queryClient';
import { clearBrokerQueries } from '@/lib/brokerQueries';
import { IDLE_TTL_MS } from './session';
import { type BrokerSession, readBrokerSession, writeBrokerSession, clearBrokerSession, isBrokerSessionExpired } from './brokerSession';

export interface BrokerAuthContextValue {
  session: BrokerSession | null;
  signIn: (session: BrokerSession) => void;
  signOut: () => void;
}

const BrokerAuthContext = createContext<BrokerAuthContextValue | null>(null);

/** The existing API has no broker logout/check-auth route. Local state expires and protected reads validate the cookie. */
export function BrokerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<BrokerSession | null>(() => readBrokerSession());
  const current = useRef(session);
  const channel = useRef<BroadcastChannel | null>(null);
  const lastActivity = useRef(0);
  const clear = useCallback(() => {
    clearBrokerQueries(queryClient);
    clearBrokerSession();
    current.current = null;
    setSession(null);
  }, []);
  const signOut = useCallback(() => {
    clear();
    channel.current?.postMessage('identity-changed');
  }, [clear]);
  const signIn = useCallback((next: BrokerSession) => {
    clearBrokerQueries(queryClient);
    writeBrokerSession(next);
    current.current = next;
    setSession(next);
    // One broker cookie is shared across tabs, even when their local identities differ.
    channel.current?.postMessage('identity-changed');
  }, []);

  useEffect(() => {
    const connection = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('dmnd_broker_auth');
    channel.current = connection;
    if (connection) connection.onmessage = () => clear();
    const unsubscribe = subscribeToBrokerAuthRejections((id) => {
      if (current.current?.brokerId === id) clear();
    });
    const checkExpiry = () => {
      if (current.current && isBrokerSessionExpired(current.current)) clear();
    };
    const onActivity = () => {
      checkExpiry();
      const now = Date.now();
      if (!current.current || now - lastActivity.current < 60_000) return;
      lastActivity.current = now;
      const next = { ...current.current, idleExpiresAt: now + IDLE_TTL_MS };
      current.current = next;
      writeBrokerSession(next);
      setSession(next);
    };
    const interval = window.setInterval(checkExpiry, 30_000);
    for (const event of ['click', 'keydown', 'mousemove']) window.addEventListener(event, onActivity);
    document.addEventListener('visibilitychange', checkExpiry);
    return () => {
      unsubscribe();
      connection?.close();
      channel.current = null;
      window.clearInterval(interval);
      for (const event of ['click', 'keydown', 'mousemove']) window.removeEventListener(event, onActivity);
      document.removeEventListener('visibilitychange', checkExpiry);
    };
  }, [clear]);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <BrokerAuthContext.Provider value={value}>{children}</BrokerAuthContext.Provider>;
}

export function useBrokerAuth(): BrokerAuthContextValue {
  const ctx = useContext(BrokerAuthContext);
  if (!ctx) throw new Error('useBrokerAuth must be used within a BrokerAuthProvider');
  return ctx;
}
