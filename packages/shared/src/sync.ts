import { z } from 'zod';
import { SYNC_TABLES, type MergeStrategy, type SyncRowMap } from './tables';

export const MAX_PUSH_BATCH = 200;

export const MUTATION_OPS = ['create', 'update', 'delete'] as const;
export type MutationOp = (typeof MUTATION_OPS)[number];

/**
 * One entry of the client outbox. `payload` is always a full row snapshot
 * (including updated_at / deleted_at), never a partial patch.
 */
export const mutationSchema = z.object({
  mutation_id: z.string().uuid(),
  table: z.enum(SYNC_TABLES),
  op: z.enum(MUTATION_OPS),
  record_id: z.string().uuid(),
  payload: z.record(z.unknown()),
  client_ts: z.number().int().nonnegative(),
});
export type Mutation = z.infer<typeof mutationSchema>;

export const pushRequestSchema = z.object({
  mutations: z.array(mutationSchema).min(1).max(MAX_PUSH_BATCH),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

/**
 * applied  – written (or an idempotent replay). Remove from the outbox.
 * stale    – server already holds a newer / tombstoned version. Remove; the next pull reconciles.
 * rejected – permanently invalid (validation, ownership, missing parent). Dead-letter it.
 */
export type MutationStatus = 'applied' | 'stale' | 'rejected';

export interface MutationResult {
  mutation_id: string;
  status: MutationStatus;
  reason?: string;
}

export interface PushResponse {
  results: MutationResult[];
  server_version: number;
}

export type PullChanges = { [K in keyof SyncRowMap]?: SyncRowMap[K][] };

export interface PullResponse {
  /** Opaque per-user monotonically increasing version. Send it back as ?cursor= next time. */
  cursor: number;
  /** Deleted rows are included with deleted_at set. */
  changes: PullChanges;
}

export interface VersionedRow {
  updated_at: number;
  deleted_at: number | null;
}

export type WriteDecision = 'insert' | 'update' | 'skip_stale' | 'skip_exists' | 'skip_deleted';

/**
 * Single source of truth for conflict resolution. Used by the server when applying
 * pushed mutations and by the client when applying pulled rows.
 *
 * Rules:
 *  1. Unknown row          → insert (a delete of an unknown row inserts the tombstone).
 *  2. Existing tombstone   → skip; deletes win and are never resurrected.
 *  3. append_only + create → skip; a create never overwrites an existing row.
 *  4. Otherwise LWW        → apply if incoming.updated_at >= existing.updated_at
 *                            (>= so retried/replayed writes are idempotent).
 */
export function resolveWrite(args: {
  strategy: MergeStrategy;
  op: 'create' | 'update' | 'delete';
  existing: VersionedRow | null;
  incoming: VersionedRow;
}): WriteDecision {
  const { strategy, op, existing, incoming } = args;
  if (!existing) return 'insert';
  if (existing.deleted_at !== null) return 'skip_deleted';
  if (strategy === 'append_only' && op === 'create') return 'skip_exists';
  return incoming.updated_at >= existing.updated_at ? 'update' : 'skip_stale';
}
