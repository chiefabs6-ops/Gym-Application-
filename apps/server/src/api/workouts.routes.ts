import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ActiveWorkoutCache } from '../services/activeWorkout.cache';

const snapshotSchema = z.object({
  session_id: z.string().uuid(),
  started_at: z.number().int().nonnegative(),
  current_exercise_id: z.string().uuid().nullable(),
  rest_timer_ends_at: z.number().int().nonnegative().nullable(),
  completed_sets: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});

/** Redis-backed live state of the active workout. Not durable; the sync protocol is. */
export const workoutRoutes: FastifyPluginAsync<{ activeWorkouts: ActiveWorkoutCache }> = async (
  app,
  { activeWorkouts },
) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/active', async (req) => ({ active: await activeWorkouts.get(req.user.sub) }));

  app.put('/active', async (req, reply) => {
    await activeWorkouts.set(req.user.sub, snapshotSchema.parse(req.body));
    return reply.code(204).send();
  });

  app.delete('/active', async (req, reply) => {
    await activeWorkouts.clear(req.user.sub);
    return reply.code(204).send();
  });
};
