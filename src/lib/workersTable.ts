import type { Worker } from '@/api/types';
import { deriveWorkerStats } from '@/lib/workerStats';
import { formatHashrate } from '@/lib/utils';

/** Health buckets matching the status badges (Online / Offline / Offline >24h). */
export type WorkerStatus = 'online' | 'offline' | 'offline_24h';
export type WorkersTab = 'all' | 'online' | 'offline';
export type WorkerSortKey = 'name' | 'hashrate' | 'rejection' | 'shares';
export type SortDir = 'asc' | 'desc';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `connected_at` normalised to ms, or null when absent. The spec says it is a "unix
 * timestamp" but not whether it's seconds or ms, and the production dashboard stores
 * it raw without converting (it doesn't render a relative time), so the unit isn't
 * confirmable without a live worker row. The 1e12 split handles both: a seconds
 * value only reaches 1e12 in the year ~33000, while a ms value has exceeded it since
 * 2001, so below 1e12 is treated as seconds, at or above as milliseconds.
 */
export function connectedAtMs(worker: Worker): number | null {
  const at = worker.connected_at;
  if (at == null || !Number.isFinite(at)) return null;
  return at < 1e12 ? at * 1000 : at;
}

/**
 *  The last-seen time in ms: the connection time if connected. Null when the no `connected_at`.
 */
export function lastSeenMs(worker: Worker, now: number): number | null {
  if (worker.is_connected) return now;
  return connectedAtMs(worker);
}

/** Online if connected; otherwise offline, escalated to offline_24h past a day. */
export function classifyWorker(worker: Worker, now: number): WorkerStatus {
  if (worker.is_connected) return 'online';
  const seen = lastSeenMs(worker, now);
  if (seen != null && now - seen > DAY_MS) return 'offline_24h';
  return 'offline';
}

/**
 * Which scheme the worker mines, read from the field the pool filled in: a rate in
 * `fpps_hashrate` means FPPS, one in `hashrate` means PPLNS. A worker is never both. Null
 * once a rig goes quiet, because the roster then reports figures in neither scheme and
 * nothing is left to tell the two apart.
 */
export function workerKind(worker: Worker): 'pplns' | 'fpps' | null {
  if (worker.fpps_hashrate != null) return 'fpps';
  if (worker.hashrate != null) return 'pplns';
  return null;
}

/** Uppercase scheme label for the table's Mode badge; null when the scheme is unknown. */
export function workerMode(worker: Worker): 'PPLNS' | 'FPPS' | null {
  const kind = workerKind(worker);
  return kind === null ? null : kind === 'fpps' ? 'FPPS' : 'PPLNS';
}

/**
  * The worker's FPPS or PPLNS hashrate
 */
export function workerHashrate(worker: Worker): number | null {
  return worker.fpps_hashrate ?? worker.hashrate ?? null;
}

/**
 * Whether the worker produced hashes in the pool's most recent 10-minute window. This is
 * the hashing signal, narrower than `is_connected`: a rig whose telemetry still arrives
 * but has stopped mining is connected and not hashing.
 */
export function isHashing(worker: Worker): boolean {
  return (workerHashrate(worker) ?? 0) > 0;
}

/** Accepted+rejected share count across both schemes. */
export function workerTotalShares(worker: Worker): number {
  return (worker.total_shares ?? 0) + (worker.fpps_total_shares ?? 0);
}

/** Rejected share count across both schemes. */
export function workerRejectedShares(worker: Worker): number {
  return (worker.rejected_shares ?? 0) + (worker.fpps_rejected_shares ?? 0);
}

/** Per-worker rejected/total share fraction (0..1), combining both schemes; null with no shares. */
export function workerRejection(worker: Worker): number | null {
  const total = workerTotalShares(worker);
  return total > 0 ? workerRejectedShares(worker) / total : null;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** "Just now" / "42 mins ago" / "1 day 18 hrs ago", matching the Last seen column. */
export function formatLastSeen(worker: Worker, now: number): string {
  const seen = connectedAtMs(worker);
  if (seen == null) return '--';
  const mins = Math.floor((now - seen) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${plural(mins, 'min')} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${plural(hrs, 'hr')} ago`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${plural(days, 'day')} ${plural(remHrs, 'hr')} ago` : `${plural(days, 'day')} ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * The worker's connection time as "18 Jun 2026, 08:24 UTC" (the details panel's
 * "Connected Since"). The pool sends no timestamp for a worker that is not currently
 * connected, so its absence means "not connected" and renders "--" rather than "Unknown".
 */
export function formatConnectedSince(worker: Worker): string {
  const ms = connectedAtMs(worker);
  if (ms == null) return '--';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '--';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

/**
 * How long an offline worker has been offline, spelled out for the details banner:
 * "less than a minute", "42 minutes", "3 hours", "1 day 18 hours", "2 days". Full
 * unit words, no trailing "ago" (unlike the table's formatLastSeen). Returns null
 * for a connected worker or when the last-seen time is unknown.
 */
export function formatOfflineDuration(worker: Worker, now: number): string | null {
  if (worker.is_connected) return null;
  const seen = lastSeenMs(worker, now);
  if (seen == null) return null;
  const mins = Math.floor((now - seen) / 60000);
  if (mins < 1) return 'less than a minute';
  if (mins < 60) return plural(mins, 'minute');
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return plural(hrs, 'hour');
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${plural(days, 'day')} ${plural(remHrs, 'hour')}` : plural(days, 'day');
}

export interface WorkersPageStats {
  total: number;
  active: number;
  offline: number;
  offline24h: number;
  rejectionRate: number | null;
}

/** Stat-card figures: extends the shared worker stats with the offline-over-24h count. */
export function deriveWorkersPageStats(workers: Worker[], now: number): WorkersPageStats {
  const base = deriveWorkerStats(workers);
  let offline24h = 0;
  for (const worker of workers) {
    if (classifyWorker(worker, now) === 'offline_24h') offline24h += 1;
  }
  return {
    total: base.totalCount,
    active: base.activeCount,
    offline: base.offlineCount,
    offline24h,
    rejectionRate: base.rejectionRate,
  };
}

/** All / Online / Offline (offline includes the >24h bucket). */
export function filterByTab(workers: Worker[], tab: WorkersTab): Worker[] {
  if (tab === 'all') return workers;
  const wantOnline = tab === 'online';
  return workers.filter((w) => w.is_connected === wantOnline);
}

// The advanced Filter popover (separate from the All/Online/Offline tabs). Status and
// Mode are multi-select (a worker matches if it is in ANY chosen bucket); Rejection is
// single-select. An empty facet does not constrain. Buckets are design-derived.
export type WorkerModeFilter = 'PPLNS' | 'FPPS';
export type WorkerRejectionFilter = 'lt1' | '1to3' | 'gt3';

export interface WorkerFilter {
  status: WorkerStatus[];
  mode: WorkerModeFilter[];
  rejection: WorkerRejectionFilter | null;
  // Subaccount names to keep, used only in aggregated mode where rows span accounts.
  // Empty means every account, matching how the other multi-select facets behave.
  accounts: string[];
}

export const EMPTY_WORKER_FILTER: WorkerFilter = { status: [], mode: [], rejection: null, accounts: [] };

/** True when any facet is set (drives the Filter button's active dot). */
export function isWorkerFilterActive(filter: WorkerFilter): boolean {
  return (
    filter.status.length > 0 || filter.mode.length > 0 || filter.rejection !== null || filter.accounts.length > 0
  );
}

/** Which rejection bucket a worker falls in; null when it has no shares yet (no rate). */
function rejectionBucket(worker: Worker): WorkerRejectionFilter | null {
  const rej = workerRejection(worker);
  if (rej === null) return null;
  if (rej < 0.01) return 'lt1';
  if (rej <= 0.03) return '1to3';
  return 'gt3';
}

/**
 * Apply the advanced filter to the roster. Facets combine with AND (a worker must pass
 * every set facet); within the multi-select Status and Mode facets the chosen options
 * combine with OR. A worker with no shares has no rejection rate, so it never matches a
 * rejection bucket.
 */
export function applyWorkerFilter(workers: Worker[], filter: WorkerFilter, now: number): Worker[] {
  return workers.filter((w) => {
    if (filter.status.length > 0 && !filter.status.includes(classifyWorker(w, now))) return false;
    // A worker of unknown scheme matches neither bucket, so a set Mode facet excludes it.
    const mode = workerMode(w);
    if (filter.mode.length > 0 && (mode === null || !filter.mode.includes(mode))) return false;
    if (filter.rejection !== null && rejectionBucket(w) !== filter.rejection) return false;
    if (filter.accounts.length > 0) {
      const sub = (w as TaggedWorker).subaccount;
      if (!sub || !filter.accounts.includes(sub)) return false;
    }
    return true;
  });
}

/** Display labels for the status column; single source of truth (also used by StatusBadge). */
export const STATUS_LABEL: Record<WorkerStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  offline_24h: 'Offline >24h',
};

/** Lowercased text of every displayed column, so search can match any of them. */
export function workerSearchText(worker: Worker, now: number): string {
  const rej = workerRejection(worker);
  const hr = workerHashrate(worker);
  return [
    worker.name,
    hr ? formatHashrate(hr) : '',
    workerMode(worker) ?? '',
    rej === null ? '' : `${(rej * 100).toFixed(1)}%`,
    STATUS_LABEL[classifyWorker(worker, now)],
    formatLastSeen(worker, now),
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Comma-separated search across ALL displayed columns (name, hashrate, mode,
 * rejection, status, last seen). A worker matches if its combined column text
 * contains ANY of the trimmed, non-empty terms; a blank or comma-only query
 * passes all.
 */
export function searchWorkers(workers: Worker[], query: string, now: number): Worker[] {
  const terms = query
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  if (terms.length === 0) return workers;
  return workers.filter((w) => {
    const text = workerSearchText(w, now);
    return terms.some((t) => text.includes(t));
  });
}

/**
 * Sort by the chosen column, breaking ties on name (always ascending, so the
 * secondary order doesn't flip with the column's direction). Nulls (e.g. no
 * rejection yet) sort last.
 */
export function sortWorkers(workers: Worker[], key: WorkerSortKey, dir: SortDir): Worker[] {
  const factor = dir === 'asc' ? 1 : -1;
  const value = (w: Worker): number | string => {
    switch (key) {
      case 'name':
        return w.name.toLowerCase();
      case 'hashrate':
        return workerHashrate(w) ?? 0;
      case 'rejection':
        return workerRejection(w) ?? -1;
      case 'shares':
        return workerTotalShares(w);
    }
  };
  return [...workers].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  });
}

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

/** Clamp the page into range and slice; totalPages is at least 1. */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, totalPages };
}

/**
 * Restrict the roster to workers whose last connection falls inside an inclusive
 * [startSec, endSec] window, for the CSV export's date range. `/api/workers/all` takes
 * no date parameter (verified live and in the spec: it returns every worker ever
 * connected), so the range is applied here over `connected_at`, i.e. "workers that
 * were connected during this period". A worker with no timestamp cannot be placed in
 * time and is excluded from a ranged export rather than silently included.
 */
export function filterWorkersByRange(workers: Worker[], startSec: number, endSec: number, now: number): Worker[] {
  return workers.filter((w) => {
    const seen = lastSeenMs(w, now);
    if (seen == null) return false;
    const sec = Math.floor(seen / 1000);
    return sec >= startSec && sec <= endSec;
  });
}

// Matches the production dashboard's workers CSV export: the raw API fields, not
// the formatted table columns. Verified against the production bundle's CSV
// builder: `kind` is the lowercase scheme, `is_connected` is "true"/"false", the
// numeric fields and `connected_at` are raw, and nulls render as empty cells.
const CSV_HEADER = ['name', 'kind', 'hashrate', 'total_shares', 'rejected_shares', 'is_connected', 'connected_at'];

function csvCell(value: string): string {
  // Guard against spreadsheet formula injection: a cell starting with =,+,-,@,
  // tab, or CR is prefixed with a quote so Excel/Sheets treat it as text.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  // Quote when the value contains a comma, quote, or newline; double inner quotes.
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Raw numeric cell: the value as-is, or an empty cell when null (as production does). */
function numCell(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

/**
 * CSV of the given (already filtered/sorted) rows, in the production export schema. The
 * figure columns carry whichever scheme's numbers the worker has, which `kind` names —
 * taking the PPLNS fields alone would leave every FPPS row's figures blank.
 */
export function workersToCsv(workers: Worker[]): string {
  const rows = workers.map((w) => {
    const fpps = workerKind(w) === 'fpps';
    return [
      w.name,
      workerKind(w) ?? '',
      numCell(workerHashrate(w)),
      numCell(fpps ? w.fpps_total_shares : w.total_shares),
      numCell(fpps ? w.fpps_rejected_shares : w.rejected_shares),
      w.is_connected ? 'true' : 'false',
      numCell(w.connected_at),
    ].map(csvCell);
  });
  return [CSV_HEADER.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/** A worker paired with the subaccount it belongs to, for the aggregated workers table. */
export interface TaggedWorker extends Worker {
  subaccount: string;
  /**
   * The owning subaccount's id. Row identity keys off this, not the display name:
   * subaccount names are user-chosen and not guaranteed unique, so two subaccounts
   * named the same would otherwise collide into one row and one selection state.
   */
  subaccountId: string;
}

/**
 * Flatten per-subaccount worker rosters into one list, tagging each worker with
 * the subaccount it came from. Group order is preserved, then worker order within
 * each group; a group with no workers contributes nothing. Workers are not deduped,
 * so two subaccounts can each contribute a worker of the same name.
 */
export function tagWorkersBySubaccount(
  perSub: { sub: string; subaccountId: string; workers: Worker[] }[],
): TaggedWorker[] {
  return perSub.flatMap((group) =>
    group.workers.map((w) => ({ ...w, subaccount: group.sub, subaccountId: group.subaccountId })),
  );
}

/**
 * A stable identity for a worker row. Worker names are only unique within one account,
 * so an aggregated table (which spans subaccounts) qualifies the name with the owning
 * subaccount's id (not its display name, which can collide across subaccounts);
 * without this two accounts' same-named rigs would collide as one row and select
 * together.
 */
export function workerRowId(worker: Worker): string {
  const id = (worker as TaggedWorker).subaccountId;
  return id ? `${id}/${worker.name}` : worker.name;
}
