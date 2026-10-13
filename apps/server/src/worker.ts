/**
 * BullMQ worker process. Run separately from the API: `npm run dev:worker`.
 */
import { Worker, type Job } from 'bullmq';
import pino from 'pino';
import { prisma } from './lib/prisma';
import { createRedis } from './lib/redis';
import { QUEUE, type AnalyticsJobs, type SocialJobs } from './services/queue/queues';
import { recomputePersonalRecords } from './services/pr/prAnalytics.service';
import { aggregateSessionVolume } from './services/analytics/volume.service';
import { fanOutWorkout } from './services/social/fanout.service';

const log = pino({ name: 'worker' });
const connection = createRedis();

type JobOf<M> = { [K in keyof M]: Job<M[K], void, K & string> }[keyof M];

const analytics = new Worker(
  QUEUE.analytics,
  async (job: JobOf<AnalyticsJobs>) => {
    switch (job.name) {
      case 'recompute-prs':
        return recomputePersonalRecords(prisma, job.data.userId, job.data.setIds);
      case 'session-finished':
        return aggregateSessionVolume(prisma, job.data.userId, job.data.sessionId);
    }
  },
  { connection, concurrency: 8 },
);

const social = new Worker(
  QUEUE.social,
  async (job: JobOf<SocialJobs>) => {
    switch (job.name) {
      case 'fanout-workout':
        return fanOutWorkout(prisma, log, job.data.userId, job.data.sessionId);
    }
  },
  { connection, concurrency: 4 },
);

for (const worker of [analytics, social]) {
  worker.on('failed', (job, err) => log.error({ queue: worker.name, job: job?.name, id: job?.id, err }, 'job failed'));
}
log.info('workers started');

const shutdown = async () => {
  await Promise.all([analytics.close(), social.close()]);
  await Promise.all([prisma.$disconnect(), connection.quit()]);
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
