import type { PrismaClient } from '@prisma/client';
import { LOWER_IS_BETTER, RECORD_KINDS, countsTowardRecords, setMetrics, type PRKind, type TrackingType } from '@gym/shared';

/**
 * Authoritative server-side PR computation (the device computes optimistic PRs locally).
 * Recomputes from full history for every exercise touched by `setIds`, so it is
 * idempotent and self-heals after deletes or out-of-order syncs.
 */
export async function recomputePersonalRecords(prisma: PrismaClient, userId: string, setIds: string[]): Promise<void> {
  const touched = await prisma.workoutSet.findMany({
    where: { id: { in: setIds }, userId },
    select: { sessionExercise: { select: { exerciseId: true } } },
  });
  const exerciseIds = [...new Set(touched.map((s) => s.sessionExercise.exerciseId))];

  for (const exerciseId of exerciseIds) {
    const exercise = await prisma.exerciseDefinition.findUnique({ where: { id: exerciseId }, select: { trackingType: true } });
    const type = (exercise?.trackingType ?? 'weight_reps') as TrackingType;
    const kinds = RECORD_KINDS[type];
    const sets = await prisma.workoutSet.findMany({
      where: {
        userId,
        isCompleted: true,
        deletedAt: null,
        sessionExercise: { exerciseId, deletedAt: null, session: { deletedAt: null } },
      },
      select: { id: true, weightKg: true, reps: true, durationS: true, distanceM: true, setType: true, completedAt: true, updatedAt: true },
    });

    const best = new Map<PRKind, { value: number; setId: string; achievedAt: Date }>();
    for (const s of sets) {
      const perf = { weight_kg: s.weightKg, reps: s.reps, duration_s: s.durationS, distance_m: s.distanceM, set_type: s.setType };
      if (!countsTowardRecords(perf, type)) continue;
      const metrics = setMetrics(perf);
      for (const kind of kinds) {
        const value = metrics[kind];
        if (value === null) continue;
        const current = best.get(kind);
        const better = current && (LOWER_IS_BETTER.has(kind) ? value < current.value : value > current.value);
        if (!current || better) {
          best.set(kind, { value, setId: s.id, achievedAt: s.completedAt ?? s.updatedAt });
        }
      }
    }

    for (const kind of kinds) {
      const record = best.get(kind);
      const key = { userId_exerciseId_kind: { userId, exerciseId, kind } };
      if (!record) {
        await prisma.personalRecord.deleteMany({ where: { userId, exerciseId, kind } });
        continue;
      }
      await prisma.personalRecord.upsert({
        where: key,
        create: { userId, exerciseId, kind, ...record },
        update: record,
      });
    }
  }
}
