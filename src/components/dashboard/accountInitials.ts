/**
 * Two-letter initials from a company/account name, with email support for broker callers.
 */
export function accountInitials(name: string | undefined): string {
  const local = (name ?? '').split('@')[0]?.trim() ?? '';
  const parts = local.split(/[\s.\-_]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return (letters || '?').toUpperCase();
}

export function mainAccountName(companyName: string | null | undefined): string {
  return companyName?.trim() || 'Main account';
}
