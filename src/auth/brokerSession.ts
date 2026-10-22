export const BROKER_STORAGE_KEY = 'dmnd_broker_session';

/** Display metadata only. The backend's HttpOnly cookie determines session validity. */
export interface BrokerSession {
  brokerId: string;
  email: string;
  referenceCode: string;
}

export interface CreateBrokerSessionInput {
  brokerId: string;
  email: string;
  referenceCode: string;
}

export function createBrokerSession(input: CreateBrokerSessionInput): BrokerSession {
  return {
    brokerId: input.brokerId,
    email: input.email,
    referenceCode: input.referenceCode,
  };
}

export function readBrokerSession(storage: Storage = sessionStorage): BrokerSession | null {
  try {
    const raw = storage.getItem(BROKER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parseBrokerSession(parsed);
  } catch {
    return null;
  }
}

export function writeBrokerSession(s: BrokerSession, storage: Storage = sessionStorage): void {
  storage.setItem(BROKER_STORAGE_KEY, JSON.stringify(s));
}

export function clearBrokerSession(storage: Storage = sessionStorage): void {
  storage.removeItem(BROKER_STORAGE_KEY);
}

export function parseBrokerSession(v: unknown): BrokerSession | null {
  if (typeof v !== 'object' || v === null) return null;
  const s = v as Record<string, unknown>;
  if (!(
    typeof s.brokerId === 'string' &&
    s.brokerId.length > 0 &&
    typeof s.email === 'string' &&
    typeof s.referenceCode === 'string'
  )) return null;
  return { brokerId: s.brokerId, email: s.email, referenceCode: s.referenceCode };
}
