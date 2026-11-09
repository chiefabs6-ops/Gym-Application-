import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client';
import { HISTORY_SQL, namesPreview, PLAN_DAY_LAST_SQL, strengthProgress, type HistorySession } from '../src/db/repositories/stats';
import { getSessionPRCount } from '../src/services/prEngine';
import { BENCH, SQUAT, freshApp, logWorkout } from './helpers';

beforeEach(async () => {
  await freshApp();
});

const setStart = (sessionId: string, t: number) =>
  db.runAsync('UPDATE workout_sessions SET start_time = ? WHERE id = ?', [t, sessionId]);

describe('History list', () => {
  it('totals each finished workout and lists its exercises', async () => {
    const a = await logWorkout(BENCH, [{ weight: 100, reps: 5 }, { weight: 60, reps: 10, type: 'warmup' }]);
    await logWorkout(SQUAT, [{ weight: 100, reps: 5 }], { finish: false }); // still open: not listed
    const rows = await db.getAllAsync<HistorySession>(HISTORY_SQL);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: a.sessionId, sets_done: 2, volume_kg: 500, distance_m: 0 });
    expect(rows[0]!.names!.split('\n')).toHaveLength(1);
  });

  it('previews the first names and counts the rest', () => {
    expect(namesPreview('A\nB\nC\nD\nE')).toBe('A · B · C · +2');
    expect(namesPreview('A\nB')).toBe('A · B');
    expect(namesPreview(null)).toBe('');
  });
});

describe('PR count per workout', () => {
  it('counts exercises that set a record, never on the first workout', async () => {
    const a = await logWorkout(BENCH, [{ weight: 100, reps: 5 }]);
    const b = await logWorkout(BENCH, [{ weight: 105, reps: 5 }, { weight: 110, reps: 5 }]);
    await setStart(a.sessionId, 1_000);
    await setStart(b.sessionId, 2_000);
    expect(await getSessionPRCount(a.sessionId)).toBe(0);
    expect(await getSessionPRCount(b.sessionId)).toBe(1); // two PR sets, one exercise
  });
});

describe('Strength progress', () => {
  it('gives each lift its best set and its best from before the window', async () => {
    const a = await logWorkout(BENCH, [{ weight: 90, reps: 3 }]);
    const b = await logWorkout(BENCH, [{ weight: 90, reps: 6 }, { weight: 80, reps: 5 }]);
    await setStart(a.sessionId, 1_000);
    await setStart(b.sessionId, 5_000);
    const [bench] = await strengthProgress(2_000);
    expect(bench).toMatchObject({ weight_kg: 90, reps: 6, best_at: 5_000, had_prior: 1 });
    expect(bench!.e1rm).toBeCloseTo(108);
    expect(bench!.before_e1rm).toBeCloseTo(99);

    const [first] = await strengthProgress(0);
    expect(first!.before_e1rm).toBeNull();
  });
});

describe('Plan day dates', () => {
  it('returns the latest finished workout per plan day', async () => {
    const a = await logWorkout(BENCH, [{ weight: 50, reps: 5 }]);
    const b = await logWorkout(BENCH, [{ weight: 50, reps: 5 }]);
    await db.runAsync("UPDATE workout_sessions SET plan_day_id = 'push', start_time = 1000 WHERE id = ?", [a.sessionId]);
    await db.runAsync("UPDATE workout_sessions SET plan_day_id = 'push', start_time = 3000 WHERE id = ?", [b.sessionId]);
    expect(await db.getAllAsync(PLAN_DAY_LAST_SQL(2), ['push', 'pull'])).toEqual([{ plan_day_id: 'push', last_at: 3000 }]);
  });
});
