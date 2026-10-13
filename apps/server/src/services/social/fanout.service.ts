import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Social feed fan-out for a finished workout.
 *
 * Placeholder: the domain model has no follow graph yet. When it does, write one
 * feed entry per follower here (fan-out-on-write), chunked to keep jobs short.
 */
export async function fanOutWorkout(
  prisma: PrismaClient,
  log: Pick<FastifyBaseLogger, 'info'>,
  userId: string,
  sessionId: string,
): Promise<void> {
  const stats = await prisma.workoutSessionStats.findUnique({ where: { sessionId } });
  log.info({ userId, sessionId, volumeKg: stats?.totalVolumeKg }, 'fan-out: no follow graph yet, skipping');
}
