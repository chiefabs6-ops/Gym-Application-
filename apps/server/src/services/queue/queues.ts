import { Queue, type ConnectionOptions } from 'bullmq';

export const QUEUE = {
  analytics: 'analytics',
  social: 'social',
} as const;

export interface AnalyticsJobs {
  'recompute-prs': { userId: string; setIds: string[] };
  'session-finished': { userId: string; sessionId: string };
}

export interface SocialJobs {
  'fanout-workout': { userId: string; sessionId: string };
}

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
};

export function createQueues(connection: ConnectionOptions) {
  return {
    analytics: new Queue(QUEUE.analytics, { connection, defaultJobOptions }),
    social: new Queue(QUEUE.social, { connection, defaultJobOptions }),
  };
}

export type Queues = ReturnType<typeof createQueues>;
