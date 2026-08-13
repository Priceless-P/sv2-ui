import type { DmndSession } from '@/api/types';

export const FIXED_TTL_MS = 8 * 60 * 60 * 1000;
export const IDLE_TTL_MS = 30 * 60 * 1000;
export const STORAGE_KEY = 'dmnd_session';

export type KybStatus = 'NotStarted' | 'InReview' | 'Approved' | 'Rejected';

export interface ViewingAccountSession {
  accountId: string;
  email: string;
  company_name: string | null;
  company_primary_location: string | null;
  kyb_status: KybStatus;
}

/** Preserve the identity/profile returned by log_subaccount; its id selects its cookie. */
export function viewingAccountFromAuth(account: DmndSession): ViewingAccountSession {
  return {
    accountId: String(account.id),
    email: account.email,
    company_name: account.company_name,
    company_primary_location: account.company_primary_location,
    kyb_status: account.kyb_status,
  };
}

/**
 * The browser-side session. Auth itself lives in the backend's HttpOnly cookie,
 * which JS can't read, so we keep only lightweight, non-sensitive data from the
 * auth response: account/company display fields and the id sent as X-Account-ID.
 * Lives in sessionStorage (per tab, gone on tab close). The two timestamps are a
 * UX convenience; real expiry is enforced server-side (the cookie + check_auth),
 * so the user is sent back to sign-in promptly rather than discovering a dead
 * session mid-action.
 */
export interface Session {
  accountId: string;
  email: string;
  company_name: string | null;
  company_primary_location: string | null;
  kyb_status: KybStatus;
  expiresAt: number;
  idleExpiresAt: number;
}

export interface CreateSessionInput {
  accountId: string;
  email: string;
  company_name: string | null;
  company_primary_location: string | null;
  kyb_status: KybStatus;
  now?: number;
}

export function createSession(input: CreateSessionInput): Session {
  const now = input.now ?? Date.now();
  return {
    accountId: input.accountId,
    email: input.email,
    company_name: input.company_name,
    company_primary_location: input.company_primary_location,
    kyb_status: input.kyb_status,
    expiresAt: now + FIXED_TTL_MS,
    idleExpiresAt: now + IDLE_TTL_MS,
  };
}

export function isExpired(s: Session, now: number = Date.now()): boolean {
  return now >= s.expiresAt || now >= s.idleExpiresAt;
}

export function refreshIdle(s: Session, now: number = Date.now()): Session {
  return { ...s, idleExpiresAt: now + IDLE_TTL_MS };
}

export function readSession(storage: Storage = sessionStorage): Session | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const session = parseSession(parsed);
    if (!session || isExpired(session)) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function writeSession(s: Session, storage: Storage = sessionStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSession(storage: Storage = sessionStorage): void {
  storage.removeItem(STORAGE_KEY);
}

export const KYB_STATUSES: KybStatus[] = ['NotStarted', 'InReview', 'Approved', 'Rejected'];

export function isKybStatus(v: unknown): v is KybStatus {
  return typeof v === 'string' && KYB_STATUSES.includes(v as KybStatus);
}

/** A stored value is a session only if it matches the shape the backend sends today. */
function parseSession(v: unknown): Session | null {
  if (typeof v !== 'object' || v === null) return null;
  const s = v as Record<string, unknown>;
  if (
    typeof s.accountId !== 'string' ||
    s.accountId.length === 0 ||
    typeof s.email !== 'string' ||
    !isKybStatus(s.kyb_status) ||
    typeof s.expiresAt !== 'number' ||
    !Number.isFinite(s.expiresAt) ||
    typeof s.idleExpiresAt !== 'number' ||
    !Number.isFinite(s.idleExpiresAt)
  ) {
    return null;
  }
  return {
    accountId: s.accountId,
    email: s.email,
    company_name: typeof s.company_name === 'string' ? s.company_name : null,
    company_primary_location: typeof s.company_primary_location === 'string' ? s.company_primary_location : null,
    kyb_status: s.kyb_status,
    expiresAt: s.expiresAt,
    idleExpiresAt: s.idleExpiresAt,
  };
}
