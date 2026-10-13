import { SYNC_TABLES, TABLE_SPECS, resolveWrite, type PullResponse, type VersionedRow } from '@gym/shared';
import { db } from '../client';
import { setMeta } from '../meta';
import { upsertRow } from '../rows';

/**
 * Merges server changes into the local DB.
 *
 * - Rows with a pending local mutation are skipped: the device is the source of truth
 *   until its outbox drains; the server's LWW result comes back on a later pull.
 * - Otherwise the shared resolveWrite() rules apply (LWW, tombstones win).
 * - Cursor advances in the same transaction, so a crash can't skip changes.
 */
export async function applyPull(response: PullResponse): Promise<number> {
  let applied = 0;
  await db.withTransactionAsync(async () => {
    for (const table of SYNC_TABLES) {
      const rows = response.changes[table] as (VersionedRow & { id: string } & Record<string, unknown>)[] | undefined;
      if (!rows) continue;
      const { strategy } = TABLE_SPECS[table];

      for (const row of rows) {
        const pending = await db.getFirstAsync(
          `SELECT 1 FROM sync_queue WHERE record_id = ? AND status = 'pending' LIMIT 1`,
          [row.id],
        );
        if (pending) continue;

        const local = await db.getFirstAsync<VersionedRow>(
          `SELECT updated_at, deleted_at FROM ${table} WHERE id = ?`,
          [row.id],
        );
        const decision = resolveWrite({ strategy, op: 'update', existing: local, incoming: row });
        if (decision === 'insert' || decision === 'update') {
          await upsertRow(db, table, row);
          applied++;
        }
      }
    }
    await setMeta('pull_cursor', String(response.cursor));
  });
  return applied;
}
