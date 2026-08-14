/**
 * Aggregated dashboard mode: a per-browser flag that switches the dashboard to sum
 * data across every subaccount. Persisted in localStorage alongside the other
 * dashboard preferences; the value is stored as the literal "true" so any stale or
 * unexpected value reads back as off rather than a broken state.
 */
export const AGG_STORAGE_KEY = 'dmnd.dashboard.aggregated';

/** Parse a stored value into the boolean flag; anything but "true" is off. */
export function readAggregated(raw: string | null): boolean {
  return raw === 'true';
}

/**
 * Which login has already had the one-time combined-mode default applied.
 */
export const AGG_DEFAULTED_KEY = 'dmnd.dashboard.aggregated.defaulted';

/** A stable id for one sign-in, so the default applies once per login rather than per render. */
export function loginMarker(accountId: string, expiresAt: number): string {
  return `${accountId}:${expiresAt}`;
}

/**
 * Claim the one-time default for this login: true the first time it is called for a
 * marker, false afterwards.
 */
export function claimAggregatedDefault(marker: string, storage: Storage | null): boolean {
  if (!storage) return true;
  try {
    if (storage.getItem(AGG_DEFAULTED_KEY) === marker) return false;
    storage.setItem(AGG_DEFAULTED_KEY, marker);
    return true;
  } catch {
    return true;
  }
}
