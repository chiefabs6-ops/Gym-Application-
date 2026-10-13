import { TABLE_SPECS, type MutationOp, type SyncRow, type SyncTable } from '@gym/shared';
import { db } from './client';
import { newId } from './ids';
import { fromSqlite, upsertRow } from './rows';
import { CLOUD_SYNC_ENABLED } from '../config';
import { requestSync } from './sync/syncManager';

/**
 * THE ONLY WAY TO WRITE SYNCED DATA ON DEVICE.
 *
 * Each mutation writes the row AND appends a full-row snapshot to the sync_queue outbox
 * in one SQLite transaction (optimistic, instant UI), then nudges the sync manager.
 * Never INSERT/UPDATE synced tables directly, or the change will never reach the server.
 */

type SystemColumns = 'id' | 'created_at' | 'updated_at' | 'deleted_at';
export type NewRow<T extends SyncTable> = Omit<SyncRow<T>, SystemColumns> & { id?: string };
export type RowPatch<T extends SyncTable> = Partial<Omit<SyncRow<T>, SystemColumns>>;

export interface StagedMutation {
  table: SyncTable;
  op: MutationOp;
  row: { id: string; updated_at: number } & Record<string, unknown>;
}

/** updated_at must strictly increase per row, even if the wall clock jumps backwards. */
const nextUpdatedAt = (previous: number) => Math.max(Date.now(), previous + 1);

export async function getRecord<T extends SyncTable>(table: T, id: string): Promise<SyncRow<T> | null> {
  const raw = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return raw ? fromSqlite(table, raw) : null;
}

export function stageCreate<T extends SyncTable>(table: T, fields: NewRow<T>): StagedMutation & { row: SyncRow<T> } {
  const now = Date.now();
  const row = { ...fields, id: fields.id ?? newId(), created_at: now, updated_at: now, deleted_at: null } as SyncRow<T>;
  return { table, op: 'create', row: row as StagedMutation['row'] & SyncRow<T> };
}

export async function stageUpdate<T extends SyncTable>(table: T, id: string, patch: RowPatch<T>): Promise<StagedMutation> {
  const current = await getRecord(table, id);
  if (!current) throw new Error(`${table}/${id} not found`);
  return { table, op: 'update', row: { ...current, ...patch, updated_at: nextUpdatedAt(current.updated_at) } };
}

export async function stageDelete(table: SyncTable, id: string): Promise<StagedMutation | null> {
  const current = await getRecord(table, id);
  if (!current || current.deleted_at !== null) return null;
  const ts = nextUpdatedAt(current.updated_at);
  return { table, op: 'delete', row: { ...current, deleted_at: ts, updated_at: ts } };
}

let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Serialises every read-modify-write. stageUpdate/stageDelete read the current row, so two
 * concurrent writes to one row (e.g. a weight edit on blur + tapping ✓) would otherwise
 * lose an update. `build` runs under the lock and must not call write() itself.
 */
export function write(build: () => Promise<(StagedMutation | null)[]> | (StagedMutation | null)[]): Promise<void> {
  const run = writeChain.then(async () => commitUnlocked(await build()));
  writeChain = run.catch(() => undefined);
  return run;
}

/** Commits mutations that need no read (pure creates). Prefer write() when staging reads rows. */
export const commit = (mutations: (StagedMutation | null)[]) => write(() => mutations);

/** Atomically applies staged mutations locally and enqueues them for sync. */
async function commitUnlocked(mutations: (StagedMutation | null)[]): Promise<void> {
  const list = mutations.filter((m): m is StagedMutation => m !== null);
  if (list.length === 0) return;
  // Fail fast: the outbox must only ever contain payloads the server will accept.
  for (const m of list) TABLE_SPECS[m.table].schema.parse(m.row);

  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const m of list) {
      await upsertRow(db, m.table, m.row);
      // Offline-only mode (ROADMAP 1.3): no outbox entries, so it can't grow without a server to drain it.
      if (CLOUD_SYNC_ENABLED) {
        await db.runAsync(
          `INSERT INTO sync_queue (mutation_id, table_name, op, record_id, payload, client_ts) VALUES (?, ?, ?, ?, ?, ?)`,
          [newId(), m.table, m.op, m.row.id, JSON.stringify(m.row), now],
        );
      }
    }
  });
  if (CLOUD_SYNC_ENABLED) requestSync();
}

export async function createRecord<T extends SyncTable>(table: T, fields: NewRow<T>): Promise<SyncRow<T>> {
  const staged = stageCreate(table, fields);
  await commit([staged]);
  return staged.row;
}

export const updateRecord = <T extends SyncTable>(table: T, id: string, patch: RowPatch<T>): Promise<void> =>
  write(async () => [await stageUpdate(table, id, patch)]);

export const deleteRecord = (table: SyncTable, id: string): Promise<void> =>
  write(async () => [await stageDelete(table, id)]);
