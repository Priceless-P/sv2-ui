import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/api';
import { isSupportedPplnsProjection } from '@/lib/pplnsProjection';
import { useActiveAccountId } from './useActiveAccountId';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function usePplnsProjection() {
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'pplns-projection', accountId],
    queryFn: async ({ signal }) => {
      if (!accountId) throw new Error('No account');
      const projection = await getUser().getPplnsProjection(accountId, { signal });
      if (projection && !isSupportedPplnsProjection(projection)) {
        throw new Error('Unsupported PPLNS projection model');
      }
      return projection;
    },
    enabled: !!accountId,
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
