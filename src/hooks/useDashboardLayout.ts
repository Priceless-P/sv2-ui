import { useCallback, useEffect, useState } from 'react';
import {
  moveWidget,
  normalizeLayout,
  reorderWidget,
  toggleWidget,
  type DashboardLayout,
  type DashboardMode,
  type WidgetId,
} from '@/lib/dashboardLayout';

const STORAGE_KEYS: Record<DashboardMode, string> = {
  single: 'dmnd.dashboard.layout',
  aggregated: 'dmnd.dashboard.layout.aggregated',
};

function read(mode: DashboardMode): DashboardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[mode]);
    return normalizeLayout(mode, raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeLayout(mode, null);
  }
}

/**
 * The home dashboard layout (widget order + hidden set), persisted per browser and
 * always normalized so a stale stored value can never render a broken dashboard.
 * Mirrors the useTheme localStorage pattern.
 */
export function useDashboardLayout(mode: DashboardMode) {
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    typeof window === 'undefined' ? normalizeLayout(mode, null) : read(mode),
  );

  // Switching mode swaps in that mode's own stored layout.
  useEffect(() => {
    if (typeof window !== 'undefined') setLayout(read(mode));
  }, [mode]);

  const persist = useCallback(
    (next: DashboardLayout) => {
      setLayout(next);
      try {
        localStorage.setItem(STORAGE_KEYS[mode], JSON.stringify(next));
      } catch {
        /* ignore storage failures; the layout still applies for this session */
      }
    },
    [mode],
  );

  // Keep other tabs in sync when the layout changes elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS[mode]) setLayout(read(mode));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [mode]);

  return {
    layout,
    toggle: (id: WidgetId) => persist(toggleWidget(mode, layout, id)),
    move: (id: WidgetId, dir: 'up' | 'down') => persist(moveWidget(layout, id, dir)),
    reorder: (id: WidgetId, toIndex: number) => persist(reorderWidget(layout, id, toIndex)),
    reset: () => persist(normalizeLayout(mode, null)),
  };
}
