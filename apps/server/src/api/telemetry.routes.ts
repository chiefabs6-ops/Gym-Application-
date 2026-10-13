import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const paramsSchema = z.object({ sessionId: z.string().uuid() });

const ingestSchema = z.object({
  points: z
    .array(
      z.object({
        t: z.number().int().nonnegative(),
        lat: z.number().min(-90).max(90).nullable(),
        lng: z.number().min(-180).max(180).nullable(),
        altitude_m: z.number().nullable(),
        heart_rate: z.number().int().min(20).max(260).nullable(),
      }),
    )
    .min(1)
    .max(5_000),
});

const seriesQuerySchema = z.object({ bucket_s: z.coerce.number().int().min(1).max(3600).default(10) });

/**
 * Telemetry bypasses the row-level sync protocol: it is append-only, high-volume,
 * and keyed by (session_id, recorded_at), so batches are idempotent via skipDuplicates.
 */
export const telemetryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  const assertOwnsSession = async (userId: string, sessionId: string) =>
    (await prisma.workoutSession.count({ where: { id: sessionId, userId } })) > 0;

  app.post('/:sessionId', { bodyLimit: 10 * 1024 * 1024 }, async (req, reply) => {
    const { sessionId } = paramsSchema.parse(req.params);
    const { points } = ingestSchema.parse(req.body);
    const userId = req.user.sub;
    if (!(await assertOwnsSession(userId, sessionId))) return reply.code(404).send({ error: 'unknown_session' });

    const { count } = await prisma.telemetryPoint.createMany({
      data: points.map((p) => ({
        sessionId,
        userId,
        recordedAt: new Date(p.t),
        lat: p.lat,
        lng: p.lng,
        altitudeM: p.altitude_m,
        heartRate: p.heart_rate,
      })),
      skipDuplicates: true,
    });
    return { inserted: count };
  });

  /** Downsampled series using TimescaleDB time_bucket. */
  app.get('/:sessionId', async (req, reply) => {
    const { sessionId } = paramsSchema.parse(req.params);
    const { bucket_s } = seriesQuerySchema.parse(req.query);
    if (!(await assertOwnsSession(req.user.sub, sessionId))) return reply.code(404).send({ error: 'unknown_session' });

    const rows = await prisma.$queryRaw<
      { bucket: Date; lat: number | null; lng: number | null; heart_rate: number | null }[]
    >`
      SELECT time_bucket(make_interval(secs => ${bucket_s}), recorded_at) AS bucket,
             last(lat, recorded_at) AS lat,
             last(lng, recorded_at) AS lng,
             avg(heart_rate)::float AS heart_rate
      FROM telemetry_points
      WHERE session_id = ${sessionId}::uuid
      GROUP BY bucket
      ORDER BY bucket`;
    return { points: rows.map((r) => ({ ...r, bucket: r.bucket.getTime() })) };
  });
};
