import type { EnrichedSubaccount } from '@/lib/subaccountsTable';

export interface AggregatedStats {
  totalWorkers: number;
  activeWorkers: number;
  offlineWorkers: number;
  combinedHashrate: number;
  todayEarnings: number;
  rejectionRate: number | null;
}

/**
 * Roll every account (the main account and each subaccount) into one account-wide set
 * of stat-card numbers.
 * The combined rejection rate is recomputed from the summed raw accepted/rejected
 * counts rather than by averaging each sub's rate, so subaccounts with very
 * different share volumes are weighted correctly. The rate is null when there are
 * no shares at all (a 0/0 denominator), and an empty list yields all zeros with a
 * null rate.
 */
export function sumAccountStats(subs: EnrichedSubaccount[]): AggregatedStats {
  let activeWorkers = 0;
  let offlineWorkers = 0;
  let combinedHashrate = 0;
  let todayEarnings = 0;
  let accepted = 0;
  let rejected = 0;
  for (const s of subs) {
    activeWorkers += s.active;
    offlineWorkers += s.offline;
    combinedHashrate += s.hashrate;
    todayEarnings += s.todayEarnings;
    accepted += s.accepted;
    rejected += s.rejected;
  }
  const totalShares = accepted + rejected;
  return {
    totalWorkers: activeWorkers + offlineWorkers,
    activeWorkers,
    offlineWorkers,
    combinedHashrate,
    todayEarnings,
    rejectionRate: totalShares > 0 ? rejected / totalShares : null,
  };
}

export interface DonutSlice {
  id: string;
  name: string;
  hashrate: number;
}

/**
 * One donut slice per account that is currently contributing hashrate, in input order,
 * carrying only what the chart needs.
 */
export function donutSlices(subs: EnrichedSubaccount[]): DonutSlice[] {
  return subs
    .filter((s) => s.hashrate > 0)
    .map((s) => ({ id: s.id, name: s.name, hashrate: s.hashrate }));
}

// The first four slices use the hues the design picked, so the common case looks
// exactly as drawn. Past those, colors are generated rather than cycled.
const DESIGN_SLICE_COLORS = ['#d946ef', '#3b82f6', '#22c55e',  '#f97316'];


const GENERATED_HUE_START = 212;

// The golden angle. The hue of each generated slice is the previous hue plus this angle, modulo 360.
const GOLDEN_ANGLE = 137.508;

/**
 * A distinct color for the slice at `index`, for any number of accounts. Lightness
 * alternates across three levels as well as hue, so even neighbouring hues stay
 * separable, and every value is a fixed function of the index -- the same account in
 * the same position keeps its color across renders and between the donut and legend.
 */
export function sliceColor(index: number): string {
  if (index < DESIGN_SLICE_COLORS.length) return DESIGN_SLICE_COLORS[index];
  const step = index - DESIGN_SLICE_COLORS.length + 1;
  const hue = (GENERATED_HUE_START + step * GOLDEN_ANGLE) % 360;
  const lightness = [58, 45, 68][step % 3];
  return `hsl(${hue.toFixed(1)}, 72%, ${lightness}%)`;
}
