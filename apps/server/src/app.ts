import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import type { Redis } from 'ioredis';
import { env } from './lib/env';
import { authPlugin } from './plugins/auth';
import { authRoutes } from './api/auth.routes';
import { syncRoutes } from './api/sync.routes';
import { telemetryRoutes } from './api/telemetry.routes';
import { workoutRoutes } from './api/workouts.routes';
import { createQueues } from './services/queue/queues';
import { createActiveWorkoutCache } from './services/activeWorkout.cache';

export async function buildApp(redis: Redis) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { level: 'debug', transport: { target: 'pino-pretty' } }
        : { level: 'info' },
  });

  const queues = createQueues(redis);
  const activeWorkouts = createActiveWorkoutCache(redis);
  app.addHook('onClose', async () => {
    await Promise.all([queues.analytics.close(), queues.social.close()]);
  });

  app.setErrorHandler<FastifyError>((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'validation_error', issues: err.issues });
    }
    req.log.error({ err }, 'request failed');
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    return reply.code(status).send({ error: status === 500 ? 'internal_error' : err.message });
  });

  await app.register(cors, { origin: true });
  await app.register(authPlugin);

  app.get('/health', async () => ({ ok: true }));
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(syncRoutes, { prefix: '/sync', queues });
  await app.register(telemetryRoutes, { prefix: '/telemetry' });
  await app.register(workoutRoutes, { prefix: '/workouts', activeWorkouts });

  return app;
}
