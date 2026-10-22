import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

// Required for taproot (P2TR) address validation
bitcoin.initEccLib(ecc);

/**
 * Combines class names with Tailwind merge support.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decimal places every BTC amount is shown to. Amounts are rounded to this and then
 * trimmed of trailing zeros, so the display is "up to" 8 dp rather than padded.
 */
/**
 * Returns the number of milliseconds until the next tick of a periodic timer with the given period. 
 */
export function msUntilNextTick(periodMs: number, now: number = Date.now()): number {
  const remainder = now % periodMs;
  return remainder === 0 ? periodMs : periodMs - remainder;
}

export const BTC_DISPLAY_DP = 8;

/**
 * Formats hashrate with appropriate unit (H/s, KH/s, MH/s, GH/s, TH/s, PH/s, EH/s).
 */
export function formatHashrate(hashrate: number | null): string {
  if (hashrate === null || hashrate === 0) return '0 H/s';
  
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
  const k = 1000;
  const i = Math.floor(Math.log(hashrate) / Math.log(k));
  const index = Math.min(i, units.length - 1);
  
  return `${(hashrate / Math.pow(k, index)).toFixed(2)} ${units[index]}`;
}

/**
 * Formats a number with thousands separators.
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Validates a Bitcoin address against the specified network.
 * Supports P2PKH, P2SH, P2WPKH, P2WSH, and P2TR address formats.
 */
export function isValidBitcoinAddress(addr: string, network: 'mainnet' | 'testnet4'): boolean {
  if (!addr) return false;
  const btcNetwork = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  try {
    bitcoin.address.toOutputScript(addr, btcNetwork);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns an error message if the address is invalid for the given network,
 * distinguishing between a wrong network address and a completely invalid one.
 */
export function getBitcoinAddressError(addr: string, network: 'mainnet' | 'testnet4'): string | null {
  if (!addr || isValidBitcoinAddress(addr, network)) return null;
  const otherNetwork = network === 'mainnet' ? 'testnet4' : 'mainnet';
  return isValidBitcoinAddress(addr, otherNetwork) ? 'Wrong network' : 'Invalid Bitcoin address';
}

/**
 * The DOM node to portal overlays (drawers, slide-overs) into. The DMND design
 * tokens are scoped to `.dmnd-app` rather than `:root`, so an overlay portalled to
 * `document.body` would lose them (e.g. a transparent button). Targeting the shell
 * keeps the tokens in scope while still escaping any page-level layout wrapper, such
 * as the `space-y-6` container whose child margin was offsetting fixed overlays.
 */
/**
 * A timestamped CSV filename, e.g. `workers_report_2026-08-13T14-32-05Z.csv`. The stamp
 * is UTC to the second so two exports taken minutes apart never overwrite each other.
 */
export function exportFilename(prefix: string, now: number): string {
  const stamp = new Date(now).toISOString().slice(0, 19).replace(/:/g, '-');
  return `${prefix}_${stamp}Z.csv`;
}

export function overlayContainer(): HTMLElement {
  return document.querySelector<HTMLElement>('.dmnd-app, .dmnd-auth') ?? document.body;
}

/** Shared downloader for generated CSVs and worker setup text files. */
export function downloadTextFile(content: string, filename: string, type = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export function downloadCsv(content: string, filename: string): void {
  downloadTextFile(content, filename, 'text/csv;charset=utf-8;');
}

/** Escape a CSV field and prevent a displayed value from becoming a spreadsheet formula. */
export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Format a YYYY-MM-DD work day in the same long UTC form used by the canonical table. */
export function formatUtcDay(workDay: string): string {
  const iso = (workDay ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return workDay || '—';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return iso;
  return `${WEEKDAYS[date.getUTCDay()]} ${day} ${MONTHS[month - 1]} ${year}`;
}
