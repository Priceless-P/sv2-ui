import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { subscribeToBrokerAuthRejections } from '@/api';
import { queryClient } from '@/lib/queryClient';
import { clearBrokerQueries } from '@/lib/brokerQueries';
import { type BrokerSession, readBrokerSession, writeBrokerSession, clearBrokerSession, parseBrokerSession } from './brokerSession';

export interface BrokerAuthContextValue {
  session: BrokerSession | null;
  signIn: (session: BrokerSession) => void;
  signOut: () => void;
}

const BrokerAuthContext = createContext<BrokerAuthContextValue | null>(null);

/** The existing API has no broker check-auth route; protected reads validate the cookie. */
export function BrokerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<BrokerSession | null>(() => readBrokerSession());
  const current = useRef(session);
  const channel = useRef<BroadcastChannel | null>(null);
  const clear = useCallback(() => {
    clearBrokerQueries(queryClient);
    clearBrokerSession();
    current.current = null;
    setSession(null);
  }, []);
  const signOut = useCallback(() => {
    const brokerId = current.current?.brokerId;
    clear();
    channel.current?.postMessage({ type: 'signed-out', brokerId });
  }, [clear]);
  const signIn = useCallback((next: BrokerSession) => {
    clearBrokerQueries(queryClient);
    writeBrokerSession(next);
    current.current = next;
    setSession(next);
    // One broker cookie is shared across tabs. Keep their display identity aligned
    // with the successful login instead of forcing another local logout.
    channel.current?.postMessage({ type: 'signed-in', session: next });
  }, []);

  useEffect(() => {
    const connection = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('dmnd_broker_auth');
    channel.current = connection;
    if (connection) connection.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (!data || typeof data !== 'object') return;
      const message = data as { type?: unknown; brokerId?: unknown; session?: unknown };
      if (message.type === 'signed-out' && current.current?.brokerId === message.brokerId) clear();
      if (message.type === 'signed-in') {
        const next = parseBrokerSession(message.session);
        if (!next) return;
        clearBrokerQueries(queryClient);
        writeBrokerSession(next);
        current.current = next;
        setSession(next);
      }
    };
    const unsubscribe = subscribeToBrokerAuthRejections((id) => {
      if (current.current?.brokerId === id) clear();
    });
    return () => {
      unsubscribe();
      connection?.close();
      channel.current = null;
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
