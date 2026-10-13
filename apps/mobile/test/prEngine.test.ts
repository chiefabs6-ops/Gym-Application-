import { beforeEach, describe, expect, it } from 'vitest';
import { epley1RM } from '@gym/shared';
import { db } from '../src/db/client';
import { setCompleted, updateSet } from '../src/db/repositories/workouts';
import { evaluateCompletedSet } from '../src/services/prEngine';
import { BENCH, SQUAT, freshApp, logWorkout } from './helpers';

beforeEach(async () => {
  await freshApp();
});

describe('PR engine (on-device SQL)', () => {
  it("SQL e1RM expression matches the shared epley1RM formula", async () => {
    for (const [w, r] of [[100, 5], [62.5, 12], [20, 1], [140, 3]] as const) {
      const row = await db.getFirstAsync<{ v: number }>('SELECT ? * (1 + ? / 30.0) AS v', [w, r]);
      expect(row!.v).toBeCloseTo(epley1RM(w, r), 9);
    }
  });

  it('reports every record a heavier set beats', async () => {
    await logWorkout(BENCH, [{ weight: 100, reps: 5 }]);
    const { setIds } = await logWorkout(BENCH, [{ weight: 105, reps: 5 }], { finish: false });
    expect(await evaluateCompletedSet(setIds[0]!)).toEqual(['e1rm', 'max_weight', 'max_volume']);
  });

  it('counts earlier sets in the same workout, and ties are not PRs', async () => {
    await logWorkout(BENCH, [{ weight: 80, reps: 5 }]);
    // In the app the check runs the moment each set is ticked, so tick them one at a time.
    const { setIds } = await logWorkout(BENCH, [{ weight: 90, reps: 5 }, { weight: 90, reps: 5, done: false }], { finish: false });
    expect(await evaluateCompletedSet(setIds[0]!)).toContain('max_weight'); // beats last session's 80
    await setCompleted(setIds[1]!, true);
    expect(await evaluateCompletedSet(setIds[1]!)).toEqual([]); // only ties set 1
  });

  it('ignores warm-ups, other exercises, and gives no badge on the very first session', async () => {
    const first = await logWorkout(BENCH, [{ weight: 60, reps: 8 }], { finish: false });
    expect(await evaluateCompletedSet(first.setIds[0]!)).toEqual([]); // no history yet

    await logWorkout(SQUAT, [{ weight: 200, reps: 5 }]); // different exercise
    const { setIds } = await logWorkout(BENCH, [{ weight: 150, reps: 5, type: 'warmup' }], { finish: false });
    expect(await evaluateCompletedSet(setIds[0]!)).toEqual([]);
  });

  it('ignores sets from discarded (deleted) workouts', async () => {
    const old = await logWorkout(BENCH, [{ weight: 120, reps: 5 }]);
    await db.runAsync('UPDATE workout_sessions SET deleted_at = 1 WHERE id = ?', [old.sessionId]);
    await logWorkout(BENCH, [{ weight: 80, reps: 5 }]);
    const { setIds } = await logWorkout(BENCH, [{ weight: 90, reps: 5 }], { finish: false });
    expect(await evaluateCompletedSet(setIds[0]!)).toContain('max_weight'); // 90 > 80; 120 doesn't count
  });
});

describe('PR engine per tracking type', () => {
  const PUSH_UP = '00000000-0000-4000-8000-000000000004';
  const PLANK = '00000000-0000-4000-8000-000000000022';
  const RUNNING = '00000000-0000-4000-8000-000000000024';
  const PULL_UP = '00000000-0000-4000-8000-000000000008';

  it('push-ups (reps only) record most reps', async () => {
    await logWorkout(PUSH_UP, [{ weight: null, reps: 20 }]);
    const { setIds } = await logWorkout(PUSH_UP, [{ weight: null, reps: 25 }], { finish: false });
    expect(await evaluateCompletedSet(setIds[0]!)).toEqual(['max_reps']);
  });

  it('plank (time) records the longest hold', async () => {
    const a = await logWorkout(PLANK, [{ weight: null, reps: null }]);
    await updateSet(a.setIds[0]!, { duration_s: 60 });
    const b = await logWorkout(PLANK, [{ weight: null, reps: null, done: false }], { finish: false });
    await updateSet(b.setIds[0]!, { duration_s: 75 });
    await setCompleted(b.setIds[0]!, true);
    expect(await evaluateCompletedSet(b.setIds[0]!)).toEqual(['max_duration']);
  });

  it('running records furthest distance and best pace', async () => {
    const a = await logWorkout(RUNNING, [{ weight: null, reps: null }]);
    await updateSet(a.setIds[0]!, { distance_m: 5000, duration_s: 1500 }); // 5:00 /km
    const b = await logWorkout(RUNNING, [{ weight: null, reps: null, done: false }], { finish: false });
    await updateSet(b.setIds[0]!, { distance_m: 6000, duration_s: 1680 }); // 4:40 /km
    await setCompleted(b.setIds[0]!, true);
    expect(await evaluateCompletedSet(b.setIds[0]!)).toEqual(['max_distance', 'best_pace']);
  });

  it('pull-ups (bodyweight + weight): added weight and reps are separate records', async () => {
    await logWorkout(PULL_UP, [{ weight: 10, reps: 8 }]);
    const { setIds } = await logWorkout(PULL_UP, [{ weight: null, reps: 12 }], { finish: false });
    expect(await evaluateCompletedSet(setIds[0]!)).toEqual(['max_reps']);
  });
});
