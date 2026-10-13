import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client';
import * as workouts from '../src/db/repositories/workouts';
import { getSessionPRs } from '../src/services/prEngine';
import { BENCH, SQUAT, freshApp, logWorkout } from './helpers';

beforeEach(async () => {
  await freshApp();
});

/** Session start times are Date.now(); tests log several in the same ms, so space them out explicitly. */
const setStart = (sessionId: string, t: number) =>
  db.runAsync('UPDATE workout_sessions SET start_time = ? WHERE id = ?', [t, sessionId]);

describe('History detail: PRs per past session', () => {
  it('badges a set that beat everything logged before that workout', async () => {
    const a = await logWorkout(BENCH, [{ weight: 100, reps: 5 }]);
    const b = await logWorkout(BENCH, [{ weight: 105, reps: 5 }, { weight: 60, reps: 5 }]);
    await setStart(a.sessionId, 1_000);
    await setStart(b.sessionId, 2_000);

    expect(await getSessionPRs(a.sessionId)).toEqual({}); // first ever session: no badge
    expect(await getSessionPRs(b.sessionId)).toEqual({ [b.setIds[0]!]: ['e1rm', 'max_weight', 'max_volume'] });
  });

  it('ignores later workouts, so an old PR stays a PR', async () => {
    const a = await logWorkout(BENCH, [{ weight: 100, reps: 5 }]);
    const b = await logWorkout(BENCH, [{ weight: 110, reps: 5 }]);
    const c = await logWorkout(BENCH, [{ weight: 120, reps: 5 }]);
    await setStart(a.sessionId, 1_000);
    await setStart(b.sessionId, 2_000);
    await setStart(c.sessionId, 3_000);
    expect(Object.keys(await getSessionPRs(b.sessionId))).toEqual([b.setIds[0]]);
  });

  it('recomputes after editing a past set or deleting an earlier workout', async () => {
    const a = await logWorkout(BENCH, [{ weight: 100, reps: 5 }]);
    const b = await logWorkout(BENCH, [{ weight: 95, reps: 5 }]);
    await setStart(a.sessionId, 1_000);
    await setStart(b.sessionId, 2_000);
    expect(await getSessionPRs(b.sessionId)).toEqual({});

    await workouts.updateSet(b.setIds[0]!, { weight_kg: 102.5 }); // fix a typo in the old log
    expect(await getSessionPRs(b.sessionId)).toEqual({ [b.setIds[0]!]: ['e1rm', 'max_weight', 'max_volume'] });

    const c = await logWorkout(BENCH, [{ weight: 50, reps: 5 }]);
    await setStart(c.sessionId, 500); // oldest workout
    await workouts.discardSession(a.sessionId);
    expect(Object.keys(await getSessionPRs(b.sessionId))).toEqual([b.setIds[0]]); // still beats c
  });

  it('within one workout only earlier-ticked sets count; warm-ups, unticked and other lifts never', async () => {
    const a = await logWorkout(BENCH, [{ weight: 80, reps: 5 }]);
    await logWorkout(SQUAT, [{ weight: 200, reps: 5 }]);
    const b = await logWorkout(BENCH, [
      { weight: 90, reps: 5 },
      { weight: 90, reps: 5 }, // tie with set 1: not a PR
      { weight: 150, reps: 5, type: 'warmup' },
      { weight: 150, reps: 5, done: false },
    ]);
    await setStart(a.sessionId, 1_000);
    await setStart(b.sessionId, 3_000);
    expect(await getSessionPRs(b.sessionId)).toEqual({ [b.setIds[0]!]: ['e1rm', 'max_weight', 'max_volume'] });
  });
});

describe('History detail: edit and repeat', () => {
  it('edits title, notes, RPE and duration through mutate.ts', async () => {
    const { sessionId } = await logWorkout(BENCH, [{ weight: 100, reps: 5 }]);
    await setStart(sessionId, 1_000_000);
    await workouts.updateSessionDetails(sessionId, {
      title: '  Push day ',
      notes: '   ',
      rpe: 8,
      end_time: 1_000_000 + 45 * 60_000,
    });
    const s = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM workout_sessions WHERE id = ?', [sessionId]);
    expect(s).toMatchObject({ title: 'Push day', notes: null, rpe: 8, start_time: 1_000_000, end_time: 1_000_000 + 2_700_000 });
  });

  it('repeat copies exercises and done sets as a new open session', async () => {
    const src = await logWorkout(BENCH, [
      { weight: 40, reps: 10, type: 'warmup' },
      { weight: 100, reps: 5 },
      { weight: 100, reps: 4, done: false }, // skipped: not copied
    ]);
    await workouts.updateSessionExerciseNotes(src.sessionExerciseId, 'Seat 4');

    const id = await workouts.startSession({ repeatOf: src.sessionId });
    expect(id).not.toBe(src.sessionId);
    const session = await db.getFirstAsync<{ title: string; end_time: number | null }>(
      'SELECT title, end_time FROM workout_sessions WHERE id = ?',
      [id],
    );
    expect(session).toEqual({ title: 'Test', end_time: null });

    const sets = await db.getAllAsync<Record<string, unknown>>(
      `SELECT s.set_type, s.weight_kg, s.reps, s.is_completed, se.exercise_id, se.notes FROM sets s
       JOIN session_exercises se ON se.id = s.session_exercise_id WHERE se.session_id = ? ORDER BY s.order_index`,
      [id],
    );
    expect(sets).toEqual([
      { set_type: 'warmup', weight_kg: 40, reps: 10, is_completed: 0, exercise_id: BENCH, notes: null },
      { set_type: 'working', weight_kg: 100, reps: 5, is_completed: 0, exercise_id: BENCH, notes: null },
    ]);
  });

  it('repeating a workout with nothing ticked keeps the planned sets', async () => {
    const src = await logWorkout(SQUAT, [{ weight: 140, reps: 3, done: false }]);
    const id = await workouts.startSession({ repeatOf: src.sessionId });
    const sets = await db.getAllAsync<{ weight_kg: number; reps: number }>(
      `SELECT s.weight_kg, s.reps FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
       WHERE se.session_id = ?`,
      [id],
    );
    expect(sets).toEqual([{ weight_kg: 140, reps: 3 }]);
  });
});

describe('in-session editing (2.6)', () => {
  const order = (sessionId: string) =>
    db.getAllAsync<{ exercise_id: string; g: string | null }>(
      `SELECT exercise_id, superset_group AS g FROM session_exercises
       WHERE session_id = ? AND deleted_at IS NULL ORDER BY order_index`,
      [sessionId],
    );
  const ROW = '00000000-0000-4000-8000-000000000006';

  it('moves exercises up and down, dissolving a superset it leaves', async () => {
    const sessionId = await workouts.startSession();
    for (const ex of [BENCH, SQUAT, ROW]) await workouts.addExerciseToSession(sessionId, ex);
    await workouts.setSessionSupersets(sessionId, ['a', 'a', null]);

    await workouts.moveSessionExercise(sessionId, 2, -1); // Row moves between Bench and Squat
    expect(await order(sessionId)).toEqual([
      { exercise_id: BENCH, g: null },
      { exercise_id: ROW, g: null },
      { exercise_id: SQUAT, g: null },
    ]);
    await workouts.moveSessionExercise(sessionId, 0, -1); // already first: no-op
    expect((await order(sessionId))[0]!.exercise_id).toBe(BENCH);
  });

  it('replaces an exercise but keeps its sets', async () => {
    const { sessionExerciseId, setIds } = await logWorkout(BENCH, [{ weight: 60, reps: 10 }], { finish: false });
    await workouts.replaceSessionExercise(sessionExerciseId, SQUAT);
    const row = await db.getFirstAsync<{ exercise_id: string; n: number }>(
      `SELECT se.exercise_id, (SELECT COUNT(*) FROM sets WHERE session_exercise_id = se.id AND deleted_at IS NULL) AS n
       FROM session_exercises se WHERE se.id = ?`,
      [sessionExerciseId],
    );
    expect(row).toEqual({ exercise_id: SQUAT, n: setIds.length });
  });

  it('saves and clears per-set notes', async () => {
    const { setIds } = await logWorkout(BENCH, [{ weight: 60, reps: 10 }]);
    await workouts.updateSetNotes(setIds[0]!, '  paused reps ');
    expect((await db.getFirstAsync<{ notes: string }>('SELECT notes FROM sets WHERE id = ?', [setIds[0]!]))!.notes).toBe('paused reps');
    await workouts.updateSetNotes(setIds[0]!, '   ');
    expect((await db.getFirstAsync<{ notes: string | null }>('SELECT notes FROM sets WHERE id = ?', [setIds[0]!]))!.notes).toBeNull();
  });
});

describe('warm-up insertion (2.10)', () => {
  it('puts warm-ups first, replaces unticked ones, keeps ticked ones', async () => {
    const { sessionExerciseId } = await logWorkout(
      BENCH,
      [
        { weight: 30, reps: 10, type: 'warmup', done: false },
        { weight: 100, reps: 5, done: false },
      ],
      { finish: false },
    );
    await workouts.insertWarmupSets(sessionExerciseId, [
      { weight_kg: 40, reps: 8 },
      { weight_kg: 60, reps: 5 },
    ]);
    const sets = await db.getAllAsync<{ set_type: string; weight_kg: number; order_index: number }>(
      'SELECT set_type, weight_kg, order_index FROM sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY order_index',
      [sessionExerciseId],
    );
    expect(sets).toEqual([
      { set_type: 'warmup', weight_kg: 40, order_index: 0 },
      { set_type: 'warmup', weight_kg: 60, order_index: 1 },
      { set_type: 'working', weight_kg: 100, order_index: 2 },
    ]);
  });
});

describe('lock-screen "Complete set" (2.11)', () => {
  it('picks the next unticked set from the current exercise and fills blanks from last time', async () => {
    await logWorkout(BENCH, [{ weight: 100, reps: 5 }, { weight: 100, reps: 4 }]); // last time
    const now = await logWorkout(BENCH, [{ weight: 102.5, reps: 5 }, { weight: null, reps: null, done: false }], { finish: false });
    await workouts.addExerciseToSession(now.sessionId, SQUAT);

    const next = await workouts.prepareNextSet(now.sessionId, 0);
    expect(next).toMatchObject({ setId: now.setIds[1], exerciseIndex: 0 });
    const filled = await db.getFirstAsync<{ weight_kg: number; reps: number }>('SELECT weight_kg, reps FROM sets WHERE id = ?', [now.setIds[1]!]);
    expect(filled).toEqual({ weight_kg: 100, reps: 4 }); // set 2 last time

    await workouts.setCompleted(now.setIds[1]!, true);
    expect((await workouts.prepareNextSet(now.sessionId, 0))?.exerciseIndex).toBe(1); // moves on to squat
  });

  it('returns null when everything is done', async () => {
    const { sessionId } = await logWorkout(BENCH, [{ weight: 100, reps: 5 }], { finish: false });
    expect(await workouts.prepareNextSet(sessionId, 0)).toBeNull();
  });
});
