import type { Prisma } from '@prisma/client';
import {
  TABLE_SPECS,
  resolveWrite,
  type Mutation,
  type MutationResult,
  type PushResponse,
} from '@gym/shared';
import { prisma } from '../../lib/prisma';
import { PRISMA_MODEL, toPrismaData } from './mapping';

type Tx = Prisma.TransactionClient;
// Generic access to a delegate chosen at runtime; table names come from the trusted spec, never the client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delegate = (tx: Tx, table: keyof typeof PRISMA_MODEL): any => (tx as any)[PRISMA_MODEL[table]];

export interface PushSideEffects {
  /** Sets that were written; their exercises need PR recomputation. */
  setIds: Set<string>;
  /** Sessions whose end_time was written (workout finished). */
  finishedSessionIds: Set<string>;
}

/**
 * Applies a client outbox batch in one transaction.
 *
 * Bumping users.sync_version first takes a row lock, so a user's pushes are serialised and
 * every row written here gets the same server_version. /sync/pull reads under REPEATABLE READ,
 * which makes `server_version > cursor` a gap-free change feed.
 */
export async function pushMutations(
  userId: string,
  mutations: Mutation[],
): Promise<{ response: PushResponse; effects: PushSideEffects }> {
  const effects: PushSideEffects = { setIds: new Set(), finishedSessionIds: new Set() };

  const response = await prisma.$transaction(
    async (tx) => {
      const { syncVersion } = await tx.user.update({
        where: { id: userId },
        data: { syncVersion: { increment: 1 } },
        select: { syncVersion: true },
      });

      const results: MutationResult[] = [];
      for (const m of mutations) {
        results.push(await applyMutation(tx, userId, syncVersion, m, effects));
      }
      return { results, server_version: syncVersion };
    },
    { timeout: 20_000 },
  );

  return { response, effects };
}

async function applyMutation(
  tx: Tx,
  userId: string,
  version: number,
  m: Mutation,
  effects: PushSideEffects,
): Promise<MutationResult> {
  const reject = (reason: string): MutationResult => ({ mutation_id: m.mutation_id, status: 'rejected', reason });
  const spec = TABLE_SPECS[m.table];

  const parsed = spec.schema.safeParse(m.payload);
  if (!parsed.success) return reject(`invalid_payload: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  const row = parsed.data as Record<string, unknown> & { id: string; updated_at: number; deleted_at: number | null };

  if (row.id !== m.record_id) return reject('record_id_mismatch');
  if (row[spec.ownerColumn] !== userId) return reject('forbidden');

  const existing = await delegate(tx, m.table).findUnique({ where: { id: row.id } });
  if (existing) {
    const owner = spec.ownerColumn === 'id' ? existing.id : existing.userId;
    if (owner !== userId) return reject('forbidden');
  } else if (m.table === 'users') {
    return reject('user_missing');
  }

  for (const ref of spec.refs) {
    const refId = row[ref.column];
    if (refId == null) {
      if (ref.nullable) continue;
      return reject(`missing_${ref.column}`);
    }
    const target = await delegate(tx, ref.table).findUnique({ where: { id: refId }, select: { userId: true } });
    const ok = target && (target.userId === userId || (ref.allowGlobal && target.userId === null));
    if (!ok) return reject(`unknown_${ref.column}`);
  }

  const decision = resolveWrite({
    strategy: spec.strategy,
    op: m.op,
    existing: existing
      ? { updated_at: existing.updatedAt.getTime(), deleted_at: existing.deletedAt?.getTime() ?? null }
      : null,
    incoming: row,
  });

  const data = { ...toPrismaData(m.table, row), serverVersion: version };
  switch (decision) {
    case 'insert':
      await delegate(tx, m.table).create({ data });
      break;
    case 'update':
      await delegate(tx, m.table).update({ where: { id: row.id }, data });
      break;
    case 'skip_exists':
      // Append-only replay of a create we already have: idempotent success.
      return { mutation_id: m.mutation_id, status: 'applied' };
    default:
      return { mutation_id: m.mutation_id, status: 'stale', reason: decision };
  }

  if (m.table === 'sets') effects.setIds.add(row.id);
  if (m.table === 'workout_sessions' && row.end_time != null && row.deleted_at == null) {
    effects.finishedSessionIds.add(row.id);
  }
  return { mutation_id: m.mutation_id, status: 'applied' };
}
