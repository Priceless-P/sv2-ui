import { WatcherRequestError } from '@/api/watcherClient';

export function isWatcherAccessDenied(error: unknown): boolean {
  return error instanceof WatcherRequestError && (error.status === 401 || error.status === 403);
}

/** A 403 stops this scope; a 401 stops every resource using the token. */
export function watcherQueryPolicy(enabled: boolean, revoked: boolean, active = true) {
  return {
    enabled: (query: { state: { error: unknown; dataUpdatedAt?: number; errorUpdatedAt?: number } }) =>
      enabled && !revoked && !isWatcherAccessDenied(query.state.error) &&
      (active || (query.state.dataUpdatedAt === 0 && query.state.errorUpdatedAt === 0)),
    retry: false,
    refetchOnWindowFocus: false,
  } as const;
}
