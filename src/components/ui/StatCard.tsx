import type { ReactNode } from 'react';
import { InfoHint } from './InfoHint';
import { Reading } from './Reading';
import { cn } from '@/lib/utils';

/** Shared metric shell; variants preserve the existing home and page spacing. */
export function StatCard({
  title,
  value,
  unit,
  unitSize = 'lg',
  caption,
  captionTone = 'muted',
  meter,
  hint,
  tour,
  children,
  variant = 'home',
}: {
  title: string;
  value?: string | number;
  unit?: string;
  unitSize?: 'base' | 'lg';
  caption?: ReactNode;
  captionTone?: 'muted' | 'strong';
  meter?: ReactNode;
  hint?: string;
  tour?: string;
  children?: ReactNode;
  variant?: 'home' | 'workers' | 'generated';
}) {
  const reading = children ?? <Reading value={value ?? '--'} unit={unit} size="md" unitSize={unitSize} />;
  const description = caption !== undefined && caption !== null && (
    <p className={cn('text-sm leading-5', captionTone === 'strong' ? 'text-foreground' : 'text-body-alt')}>
      {caption}
    </p>
  );
  return (
    <div data-tour={tour} className={cn(
      'flex flex-col justify-between border-[0.5px] border-border bg-card',
      variant === 'home' ? 'gap-1.5 p-3 lg:p-4' : variant === 'workers' ? 'gap-2 p-4 lg:p-5' : 'gap-3 p-4 lg:p-5',
    )}>
      <div className="flex items-center gap-2">
        <span className="text-sm leading-5 text-body-alt">{title}</span>
        {hint && <InfoHint text={hint} />}
      </div>
      {variant === 'generated' ? (
        <div className="flex flex-col gap-1">{reading}{description}</div>
      ) : (
        <>
          {reading}
          {(meter || description) && <div className="flex flex-col gap-2">{meter}{description}</div>}
        </>
      )}
    </div>
  );
}
