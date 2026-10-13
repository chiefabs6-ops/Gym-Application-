import type { UserRow } from '@gym/shared';
import { db } from '../client';
import { newId } from '../ids';
import { getMeta, setMeta } from '../meta';
import { fromSqlite, upsertRow } from '../rows';
import { SYNC_TABLES } from '@gym/shared';

let cachedUserId: string | null = null;

/**
 * Guarantees a local user exists so the app is fully usable offline before sign-in.
 * The guest id is sent as `id` on /auth/register, so data logged as a guest keeps its owner.
 * The local users row is NOT enqueued: the server creates it on registration.
 */
export async function ensureLocalUser(): Promise<string> {
  const existing = await getMeta('user_id');
  if (existing) return (cachedUserId = existing);

  const id = newId();
  const now = Date.now();
  const row: UserRow = {
    id,
    display_name: null,
    unit_system: 'metric',
    preferences: { default_rest_seconds: 90 },
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  await upsertRow(db, 'users', row);
  await setMeta('user_id', id);
  return (cachedUserId = id);
}

export async function getUserId(): Promise<string> {
  return cachedUserId ?? ensureLocalUser();
}

export async function getLocalUser(): Promise<UserRow | null> {
  const raw = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [await getUserId()]);
  return raw ? fromSqlite('users', raw) : null;
}

/**
 * Signing in to an existing account from a device that logged data as a guest:
 * re-own all local rows and queued payloads, then force a full pull.
 */
export async function adoptServerUser(server: UserRow): Promise<void> {
  const localId = await getUserId();
  await db.withTransactionAsync(async () => {
    if (localId !== server.id) {
      for (const table of SYNC_TABLES) {
        if (table === 'users') continue;
        await db.runAsync(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`, [server.id, localId]);
      }
      await db.runAsync(
        `UPDATE sync_queue SET payload = json_set(payload, '$.user_id', ?) WHERE json_extract(payload, '$.user_id') = ?`,
        [server.id, localId],
      );
      await db.runAsync(`DELETE FROM sync_queue WHERE table_name = 'users'`);
      await db.runAsync(`DELETE FROM users WHERE id = ?`, [localId]);
    }
    await upsertRow(db, 'users', server);
    await setMeta('user_id', server.id);
    await setMeta('pull_cursor', '0');
  });
  cachedUserId = server.id;
}
