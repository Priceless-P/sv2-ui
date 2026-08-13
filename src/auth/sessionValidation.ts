import { DmndApiError } from '@/api';

/** Only a 401/403 response proves the stored login is no longer valid. */
export function shouldEndSessionAfterValidation(error: unknown): boolean {
  return error instanceof DmndApiError && error.code === 'unauthorized';
}
