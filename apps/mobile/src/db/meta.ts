import { db } from './client';

export type MetaKey =
  | 'user_id'
  | 'pull_cursor'
  /** epoch ms of the last successful backup (manual share or automatic). */
  | 'last_backup_at'
  | 'last_backup_kind'
  /** Persisted SAF tree URI of the auto-backup folder. */
  | 'auto_backup_dir'
  | 'auto_backup_enabled'
  | 'auto_backup_error'
  /** Version of the bundled built-in food list last loaded into builtin_foods. */
  | 'builtin_foods_version';

export async function deleteMeta(key: MetaKey): Promise<void> {
  await db.runAsync('DELETE FROM sync_meta WHERE key = ?', [key]);
}

export async function getMeta(key: MetaKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(key: MetaKey, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
