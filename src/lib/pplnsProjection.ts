import type { PplnsProjection } from '@/api/types';

/** Horizon 0 is where the payout window stands now; 1..8 are what-if scenarios. */
const SNAPSHOT_HORIZON = 0;

/** A model-v2 payload carries the snapshot plus eight days of projected pool work. */
const HORIZON_COUNT = 9;

/**
 * Whether the account still has accepted work inside the modeled payout window. With
 * nothing retained every row of the projection reads zero, so the sidebar entry is
 * hidden and the page says as much instead of showing a table of zeroes.
 */
export function hasPayablePplnsWork(projection: PplnsProjection | null | undefined): boolean {
  const snapshot = projection?.horizons?.find((h) => h.horizon === SNAPSHOT_HORIZON);
  return snapshot ? snapshot.retained_difficulty > 0 : false;
}

/**
 * Whether a payload is one the page can read: model v2, with horizons 0..8 in order.
 * Anything else is refused rather than displayed, because rendering another model's
 * numbers under these labels would misstate the reward share.
 */
export function isSupportedPplnsProjection(projection: PplnsProjection): boolean {
  return (
    projection.model_version === 2 &&
    Array.isArray(projection.horizons) &&
    projection.horizons.length === HORIZON_COUNT &&
    projection.horizons.every((h, i) => h.horizon === i)
  );
}
