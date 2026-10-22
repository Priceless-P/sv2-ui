import type { DmndSession } from '@/api/types';

export const STORAGE_KEY = 'dmnd_session';

/** Where the email of a remembered sign-in is kept, so the form can pre-fill it. */
export const REMEMBER_EMAIL_KEY = 'dmnd_remember_email';

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
 * Lives in sessionStorage (per tab, gone on tab close) unless the miner ticked
 * "Remember me", which moves it to localStorage so it survives closing the browser.
 * Only backend authentication responses determine expiry. The login id identifies
 * this sign-in for cache isolation and asynchronous validation; it is not a credential.
 */
export interface Session {
  accountId: string;
  email: string;
  company_name: string | null;
  company_primary_location: string | null;
  kyb_status: KybStatus;
  /** Whether display metadata is kept in localStorage; this never extends backend expiry. */
  remember: boolean;
  loginId: string;
}

export interface CreateSessionInput {
  accountId: string;
  email: string;
  company_name: string | null;
  company_primary_location: string | null;
  kyb_status: KybStatus;
  remember?: boolean;
}

export function createSession(input: CreateSessionInput): Session {
  return {
    accountId: input.accountId,
    email: input.email,
    company_name: input.company_name,
    company_primary_location: input.company_primary_location,
    kyb_status: input.kyb_status,
    remember: input.remember ?? false,
    loginId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}

export function readSession(storage: Storage = sessionStorage): Session | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const session = parseSession(parsed);
    if (!session) {
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
    typeof s.loginId !== 'string' ||
    s.loginId.length === 0
  ) {
    return null;
  }
  return {
    accountId: s.accountId,
    email: s.email,
    company_name: typeof s.company_name === 'string' ? s.company_name : null,
    company_primary_location: typeof s.company_primary_location === 'string' ? s.company_primary_location : null,
    kyb_status: s.kyb_status as KybStatus,
    remember: s.remember === true,
    loginId: s.loginId,
  };
}

/** localStorage where the browser has it; undefined under SSR and in tests. */
export function persistentStorage(): Storage | undefined {
  return typeof localStorage !== 'undefined' ? localStorage : undefined;
}

/**
 * The email left behind by a remembered sign-in, for pre-filling the form. It says
 * nothing about whether that session is still valid -- only which address to offer.
 */
export function readRememberedEmail(storage = persistentStorage()): string | null {
  const raw = storage?.getItem(REMEMBER_EMAIL_KEY);
  return raw && raw.trim() ? raw : null;
}

export function writeRememberedEmail(email: string, storage = persistentStorage()): void {
  storage?.setItem(REMEMBER_EMAIL_KEY, email);
}

export function clearRememberedEmail(storage = persistentStorage()): void {
  storage?.removeItem(REMEMBER_EMAIL_KEY);
}
