import { API_ERROR_MESSAGES, DmndApiError } from '@/api';

/**
 * Turns a failed DMND call into a short, user-facing line. The unauthorized
 * copy differs by screen (a bad login versus an unexpected 401 elsewhere), so
 * the caller passes the wording that fits.
 */
export function authErrorMessage(error: unknown, unauthorized = 'Not authorized.'): string {
  if (error instanceof DmndApiError) {
    if (error.code === 'unauthorized') return unauthorized;
    if (error.code === 'network') return API_ERROR_MESSAGES.network;
    if (error.code === 'server') return API_ERROR_MESSAGES.server;
    // 'other' carries the server's own message (e.g. a password-strength hint).
    if (error.code === 'other' && error.message) return error.message;
  }
  return 'Something went wrong. Please try again.';
}
