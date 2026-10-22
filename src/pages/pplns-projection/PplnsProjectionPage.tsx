import { usePplnsProjection, useAggregatedPplnsProjection } from '@/hooks/usePplnsProjection';
import { PplnsProjectionPanel } from '@/components/pplns-projection/PplnsProjectionPanel';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';

export function PplnsProjectionPage() {
  const { aggregated } = useAggregatedModeContext();
  const single = usePplnsProjection(!aggregated);
  const combined = useAggregatedPplnsProjection(aggregated);

  return <PplnsProjectionPanel projection={aggregated ? undefined : single.data} dailyWork={aggregated ? combined.data : undefined}
    isLoading={aggregated ? combined.isLoading : single.isLoading} isError={aggregated ? combined.isError : single.isError} aggregated={aggregated} showStats />;
}
