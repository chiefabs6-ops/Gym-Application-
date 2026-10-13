import type { FastifyBaseLogger } from 'fastify';
import type { PushSideEffects } from '../sync/push';
import type { Queues } from './queues';

/**
 * Fire-and-forget fan-out after a successful push. Failures are logged, never surfaced
 * to the client: the push is already committed and jobs are recomputable.
 */
export async function enqueuePushEffects(
  queues: Queues,
  userId: string,
  version: number,
  effects: PushSideEffects,
  log: FastifyBaseLogger,
): Promise<void> {
  try {
    if (effects.setIds.size > 0) {
      await queues.analytics.add(
        'recompute-prs',
        { userId, setIds: [...effects.setIds] },
        { jobId: `prs-${userId}-${version}` },
      );
    }
    for (const sessionId of effects.finishedSessionIds) {
      await queues.analytics.add('session-finished', { userId, sessionId }, { jobId: `finished-${sessionId}-${version}` });
      // Stable jobId: a workout is fanned out to followers at most once.
      await queues.social.add('fanout-workout', { userId, sessionId }, { jobId: `fanout-${sessionId}` });
    }
  } catch (err) {
    log.error({ err, userId }, 'failed to enqueue push side effects');
  }
}
