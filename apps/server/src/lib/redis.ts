import { Redis } from 'ioredis';
import { env } from './env';

/** BullMQ requires maxRetriesPerRequest: null on its connections. */
export function createRedis(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
