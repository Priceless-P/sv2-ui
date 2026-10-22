import { DmndApiError, type DmndClient } from '@/api/types';
import { mapConcurrent } from '@/lib/concurrency';

/** The server revokes one cookie at a time; owner revocation does not revoke delegated cookies. */
export async function revokeDashboardSessions(
  client: Pick<DmndClient, 'getSubaccounts' | 'logout'>,
  ownerId: string,
  knownIds: string[] = [],
): Promise<boolean> {
  const ids = new Set(knownIds.filter((id) => id !== ownerId));
  let complete = true;
  try {
    const subs = await client.getSubaccounts({ accountId: ownerId, suppressAuthRejection: true });
    for (const sub of subs) ids.add(sub.id);
  } catch {
    // Still revoke every known cookie, including the owner, when discovery fails.
    complete = false;
  }
  const revoke = async (id: string) => {
    try { await client.logout({ accountId: id, suppressAuthRejection: true }); }
    catch (error) {
      // Missing/expired cookies are already logged out on the server.
      if (!(error instanceof DmndApiError && error.status === 401)) complete = false;
    }
  };
  await mapConcurrent([...ids], revoke);
  await revoke(ownerId);
  return complete;
}
