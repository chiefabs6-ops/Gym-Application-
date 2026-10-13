import type { Redis } from 'ioredis';

/**
 * Ephemeral snapshot of a user's in-progress workout (for live views / second devices).
 * The device remains the source of truth; this is a best-effort mirror with a TTL.
 */
const TTL_SECONDS = 12 * 60 * 60;
const key = (userId: string) => `active-workout:${userId}`;

export interface ActiveWorkoutSnapshot {
  session_id: string;
  started_at: number;
  current_exercise_id: string | null;
  rest_timer_ends_at: number | null;
  completed_sets: number;
  updated_at: number;
}

export function createActiveWorkoutCache(redis: Redis) {
  return {
    async get(userId: string): Promise<ActiveWorkoutSnapshot | null> {
      const raw = await redis.get(key(userId));
      return raw ? (JSON.parse(raw) as ActiveWorkoutSnapshot) : null;
    },
    async set(userId: string, snapshot: ActiveWorkoutSnapshot): Promise<void> {
      await redis.set(key(userId), JSON.stringify(snapshot), 'EX', TTL_SECONDS);
    },
    async clear(userId: string): Promise<void> {
      await redis.del(key(userId));
    },
  };
}

export type ActiveWorkoutCache = ReturnType<typeof createActiveWorkoutCache>;
