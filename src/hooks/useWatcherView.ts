import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { watcherQueryPolicy } from '@/lib/watcherQueries';
import { cachedHashrateHistory } from '@/lib/hashrateHistory';
import { createWatcherClient } from '@/api/watcherClient';
import type { HashrateRange } from '@/api/types';
import { rangeToWindow } from '@/lib/hashrateHistory';
import { payoutFromApi, sortPayoutsByDateDesc } from '@/lib/payoutsTable';
import { PAYOUT_QUERY_OPTIONS } from '@/lib/payoutsTable';

// Visible live resources match the dashboard cadence. Hidden resources only probe access.
const WATCHER_POLL_MS = 5 * 60 * 1000;

// The projection is recomputed only when the cache crosses a PPLNS boundary, so it is
// polled on the same five-minute (+5s) cadence the owner's dashboard uses for it.
const PROJECTION_POLL_MS = 5 * 61 * 1000;

/** A memoised token-only client for one watcher token. */
export function useWatcherTokenRevoked(token: string) {
  return useQuery({ queryKey: ['watcher', token, 'revoked'], initialData: false, enabled: false }).data;
}

function useClient(token: string) {
  const cache = useQueryClient();
  const revoked = useWatcherTokenRevoked(token);
  const client = useMemo(() => createWatcherClient(token, {
    onUnauthorized: () => cache.setQueryData(['watcher', token, 'revoked'], true),
    isRevoked: () => cache.getQueryData(['watcher', token, 'revoked']) === true,
  }), [token, cache]);
  return { client, revoked };
}

/** Live hashrate snapshot for the watcher token (null-safe; gated on hashrate scope by the caller). */
export function useWatcherHashrate(token: string, enabled = true, active = true) {
  const { client, revoked } = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'hashrate'],
    queryFn: ({ signal }) => client.getHashrate(signal),
    refetchInterval: WATCHER_POLL_MS,
    staleTime: WATCHER_POLL_MS,
    ...watcherQueryPolicy(enabled, revoked, active),
  });
}

/** An explicit chart window (ms epoch) for the Custom range. */
export interface CustomWindow {
  fromMs: number;
  toMs: number;
}

/**
 * Historical hashrate series for the chart. When `custom` is set it takes precedence
 * over the preset range (the Custom calendar selection); otherwise the preset maps to a
 * rolling window ending now.
 */
export function useWatcherHashrateHistory(token: string, range: HashrateRange, custom?: CustomWindow | null, enabled = true) {
  const { client, revoked } = useClient(token);
  const cache = useQueryClient();
  const rawKey = ['watcher', token, 'history-raw', custom ? `custom:${custom.fromMs}-${custom.toMs}` : range];
  return useQuery({
    queryKey: ['watcher', token, 'history', custom ? `custom:${custom.fromMs}-${custom.toMs}` : range],
    queryFn: () => {
      const { from, to } = custom
        ? { from: new Date(custom.fromMs).toISOString(), to: new Date(custom.toMs).toISOString() }
        : rangeToWindow(range, Date.now());
      return cachedHashrateHistory(cache, rawKey, { from, to }, (start, end, signal) => client.getHashrateHistory(start, end, signal), !!custom);
    },
    staleTime: custom ? Infinity : 5 * 60 * 1000,
    refetchInterval: custom ? false : 5 * 60 * 1000,
    ...watcherQueryPolicy(enabled, revoked),
  });
}

/** Complete paginated roster, fetched with the watcher token rather than a dashboard session. */
export function useWatcherWorkers(token: string, enabled = true, active = true) {
  const { client, revoked } = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'workers'],
    queryFn: ({ signal }) => client.getAllWorkers(signal),
    refetchInterval: WATCHER_POLL_MS,
    staleTime: WATCHER_POLL_MS,
    ...watcherQueryPolicy(enabled, revoked, active),
  });
}

/** Daily generated-BTC entries for the watcher token (gated on the earnings scope). */
export function useWatcherGeneratedBtc(token: string, enabled: boolean, accountId: string, active = true) {
  const { client, revoked } = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'generated-btc', accountId],
    queryFn: ({ signal }) => client.getGeneratedBtc(accountId, signal),
    refetchInterval: 5 * 60 * 1000,
    staleTime: WATCHER_POLL_MS,
    ...watcherQueryPolicy(enabled, revoked, active),
  });
}

/** Confirmed on-chain payouts exposed by the same earnings-scoped watcher token. */
export function useWatcherPayouts(token: string, enabled: boolean, accountId: string, active = true) {
  const { client, revoked } = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'payouts', accountId],
    queryFn: ({ signal }) => client
      .getPayouts(accountId, signal)
      .then((rows) => sortPayoutsByDateDesc(rows.map(payoutFromApi))),
    ...PAYOUT_QUERY_OPTIONS,
    ...watcherQueryPolicy(enabled, revoked, active),
  });
}

/** Current pool + broker fee rates for the watcher token (gated on the fees scope). */
export function useWatcherFees(token: string, enabled: boolean, active = true) {
  const { client, revoked } = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'fees'],
    queryFn: ({ signal }) => client.getFees(signal),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
    ...watcherQueryPolicy(enabled, revoked, active),
  });
}

/** Aggregate 24-hour share counts exposed by the rejects scope. */
export function useWatcherShareStats(token: string, enabled: boolean, active = true) {
  const { client, revoked } = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'share-stats'],
    queryFn: ({ signal }) => client.getShareStats(signal),
    staleTime: WATCHER_POLL_MS,
    refetchInterval: WATCHER_POLL_MS,
    ...watcherQueryPolicy(enabled, revoked, active),
  });
}

export function useWatcherPplnsProjection(accountId: string, token: string, enabled: boolean, active = true) {
  const { client, revoked } = useClient(token);
  return useQuery({
    queryKey: ['watcher', token, 'pplns-projection', accountId],
    queryFn: ({ signal }) => client.getPplnsProjection(accountId, signal),
    staleTime: PROJECTION_POLL_MS,
    refetchInterval: PROJECTION_POLL_MS,
    ...watcherQueryPolicy(enabled, revoked, active),
  });
}
