import type { PrismaClient } from '@prisma/client';

/** Computes and stores aggregate stats for a finished session. Idempotent. */
export async function aggregateSessionVolume(prisma: PrismaClient, userId: string, sessionId: string): Promise<void> {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId, deletedAt: null },
    select: { startTime: true, endTime: true },
  });
  if (!session) return;

  const sets = await prisma.workoutSet.findMany({
    where: {
      userId,
      isCompleted: true,
      deletedAt: null,
      setType: { not: 'warmup' },
      sessionExercise: { sessionId, deletedAt: null },
    },
    select: { weightKg: true, reps: true },
  });

  const totals = sets.reduce(
    (acc, s) => {
      const reps = s.reps ?? 0;
      acc.totalReps += reps;
      acc.totalVolumeKg += (s.weightKg ?? 0) * reps;
      return acc;
    },
    { totalVolumeKg: 0, totalReps: 0 },
  );

  const durationS = session.endTime
    ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)
    : null;

  const data = { ...totals, totalSets: sets.length, durationS, computedAt: new Date() };
  await prisma.workoutSessionStats.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });
}
