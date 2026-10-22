import type { ReactNode } from 'react';

/** Actions apply to the checked rows in the filtered table, across every page. */
export function SelectionActions({ count, onExport, onClear, children }: {
  count: number;
  onExport: () => void;
  onClear: () => void;
  children?: ReactNode;
}) {
  if (!count) return null;
  return <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
    <span className="text-sm text-body-alt" role="status">{count} selected</span>
    <button type="button" onClick={onExport} className="rounded-full bg-info px-4 py-1.5 text-sm text-info-foreground transition-opacity hover:opacity-90">Export selected CSV</button>
    {children}
    <button type="button" onClick={onClear} className="ml-auto text-sm text-body-alt underline underline-offset-2 hover:text-foreground">Clear selection</button>
  </div>;
}
