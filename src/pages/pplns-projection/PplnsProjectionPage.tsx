import { usePplnsProjection } from '@/hooks/usePplnsProjection';
import { PplnsProjectionPanel } from '@/components/pplns-projection/PplnsProjectionPanel';

export function PplnsProjectionPage() {
  const { data, isLoading, isError } = usePplnsProjection();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-heading">PPLNS projection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See how the accepted work still retained in the PPLNS window contributes to a modeled
          block subsidy.
        </p>
      </div>

      <PplnsProjectionPanel projection={data} isLoading={isLoading} isError={isError} />
    </div>
  );
}
