import { Prisma } from '@prisma/client';
import { SYNC_TABLES, type PullChanges, type PullResponse } from '@gym/shared';
import { prisma } from '../../lib/prisma';
import { PRISMA_MODEL, toWireRow } from './mapping';

/**
 * Returns every row of the user's graph with server_version > cursor.
 * REPEATABLE READ gives one snapshot for the cursor read and all table reads, so a
 * concurrently committing push is either fully visible or fully invisible.
 *
 * TODO: paginate for very large first syncs (e.g. bootstrap via a per-table snapshot endpoint).
 */
export async function pullChanges(userId: string, cursor: number): Promise<PullResponse> {
  return prisma.$transaction(
    async (tx) => {
      const { syncVersion } = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { syncVersion: true },
      });

      const changes: PullChanges = {};
      for (const table of SYNC_TABLES) {
        const where =
          table === 'users'
            ? { id: userId, serverVersion: { gt: cursor } }
            : { userId, serverVersion: { gt: cursor } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: Record<string, unknown>[] = await (tx as any)[PRISMA_MODEL[table]].findMany({
          where,
          orderBy: { serverVersion: 'asc' },
        });
        if (rows.length > 0) {
          (changes as Record<string, unknown[]>)[table] = rows.map((r) => toWireRow(table, r));
        }
      }

      return { cursor: syncVersion, changes };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
