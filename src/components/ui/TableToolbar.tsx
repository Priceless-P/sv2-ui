import { useState, type ReactNode } from 'react';
import { LiMagnifer, LiSort, LiAltArrowDown, LiFilter } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';

/** Shared search/filter layout. Feature modules own tabs, filter state and filter panels. */
export function TableToolbar({
  title,
  query,
  onQuery,
  searchPlaceholder,
  searchLabel = searchPlaceholder,
  filterActive,
  renderFilter,
  tabs,
  variant = 'plain',
}: {
  title: string;
  query: string;
  onQuery: (query: string) => void;
  searchPlaceholder: string;
  searchLabel?: string;
  filterActive: boolean;
  renderFilter: (onClose: () => void) => ReactNode;
  tabs?: ReactNode;
  variant?: 'plain' | 'framed' | 'tabs';
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const plain = variant === 'plain';
  const framed = variant === 'framed';
  const FilterIcon = variant === 'tabs' ? LiFilter : LiSort;
  const panel = filterOpen ? renderFilter(() => setFilterOpen(false)) : null;

  return (
    <div className={cn(
      'relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
      variant === 'tabs' ? 'p-4' : 'p-3 sm:p-4',
      !plain && 'rounded-t-3xl border-[0.5px] border-b-0 border-border bg-card',
    )}>
      <h3 className={plain ? 'text-base font-semibold text-heading' : '!font-body text-lg font-bold leading-7 text-foreground'}>{title}</h3>
      <div className={cn('flex gap-3', variant === 'tabs' ? 'flex-col sm:flex-row sm:items-center' : 'items-center')}>
        {tabs}
        <div className="relative min-w-0 flex-1 sm:flex-none">
          <LiMagnifer className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2', plain ? 'left-3 h-4 w-4 text-placeholder' : 'left-4 h-3.5 w-3.5 text-body-alt')} />
          {!plain && <span aria-hidden className="pointer-events-none absolute left-[42px] top-1/2 h-6 w-px -translate-y-1/2 bg-border" />}
          <input
            type="text"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className={cn(
              'w-full bg-muted py-2 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring',
              plain ? 'rounded-2xl border border-border pl-9 pr-3 sm:w-64' : 'h-10 rounded-xl pl-[54px] pr-4 leading-5 sm:w-[252px]',
            )}
          />
        </div>
        <div className={framed ? undefined : 'relative'}>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            className={cn(
              'inline-flex shrink-0 items-center transition-opacity hover:opacity-80',
              framed ? 'h-9 gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground' :
                variant === 'tabs' ? 'gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium' : 'gap-2 rounded-full border px-5 py-2 text-sm font-medium',
              !framed && (filterActive ? 'border-foreground text-foreground' : 'border-border text-body-alt hover:text-foreground'),
              framed && filterActive && 'font-medium',
            )}
          >
            <FilterIcon className={variant === 'tabs' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
            Filter
            {filterActive ? <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]" aria-hidden /> :
              variant !== 'tabs' && <LiAltArrowDown className="h-3.5 w-3.5" />}
          </button>
          {!framed && panel}
        </div>
      </div>
      {framed && panel}
    </div>
  );
}
