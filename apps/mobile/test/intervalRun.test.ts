import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduled } from './mocks/expoNotifications';
import { db } from '../src/db/client';
import { createRecord } from '../src/db/mutate';
import * as workouts from '../src/db/repositories/workouts';
import { useActiveWorkoutStore } from '../src/state/activeWorkoutStore';
import { loadRunPlan, useIntervalRunStore } from '../src/state/intervalRunStore';
import { useRestTimerStore } from '../src/state/restTimerStore';
import { useSettingsStore } from '../src/state/settingsStore';
import { freshApp } from './helpers';

const PLANK = '00000000-0000-4000-8000-000000000022';
const T0 = new Date('2026-10-09T10:00:00Z').getTime();
const at = (ms: number) => vi.setSystemTime(T0 + ms);

let userId = '';

/** Starts a workout from a routine with one timed exercise: `sets` × `workS` s, `restS` s rest. */
async function startTimedWorkout({ sets = 3, workS = 60, restS = 30, autoNext = true as boolean | null } = {}) {
  const t = await createRecord('workout_templates', {
    user_id: userId,
    title: 'Ropes',
    notes: null,
    folder: null,
    plan_day_id: null,
    template_exercises: [
      {
        exercise_id: PLANK,
        order_index: 0,
        target_sets: sets,
        target_reps: null,
        rest_seconds: restS,
        target_weight_kg: null,
        rep_min: null,
        rep_max: null,
        sets: null,
        target_duration_s: workS,
        target_distance_m: null,
        superset_group: null,
        auto_next: autoNext,
      },
    ],
  });
  await useActiveWorkoutStore.getState().start({ templateId: t.id });
  const sessionId = useActiveWorkoutStore.getState().sessionId!;
  const se = (await db.getFirstAsync<{ id: string }>(`SELECT id FROM session_exercises WHERE session_id = ?`, [sessionId]))!;
  const setIds = (
    await db.getAllAsync<{ id: string }>(`SELECT id FROM sets WHERE session_exercise_id = ? ORDER BY order_index`, [se.id])
  ).map((r) => r.id);
  return { sessionId, seId: se.id, setIds };
}

const setRows = (seId: string) =>
  db.getAllAsync<{ id: string; is_completed: number; duration_s: number | null; completed_at: number | null }>(
    `SELECT id, is_completed, duration_s, completed_at FROM sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY order_index`,
    [seId],
  );

describe('interval run', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    at(0);
    userId = await freshApp();
    useActiveWorkoutStore.setState({ sessionId: null, startedAt: null, prHits: {}, currentIndex: 0, autoNext: {} });
    useIntervalRunStore.setState({ run: null });
    await useRestTimerStore.getState().stop();
    scheduled.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('plans every unfinished timed set from the tapped one when auto-start is on', async () => {
    const { seId, setIds } = await startTimedWorkout({ sets: 4 });
    await workouts.setCompleted(setIds[2]!, true);
    const plan = await loadRunPlan(seId, setIds[1]!, undefined);
    expect(plan).toMatchObject({ setIds: [setIds[1], setIds[3]], workS: [60, 60], restS: 30, autoNext: true });
  });

  it('plans only the tapped set when auto-start is off (routine, remembered, or workout override)', async () => {
    const { seId, setIds } = await startTimedWorkout({ autoNext: null });
    expect((await loadRunPlan(seId, setIds[0]!, undefined))!.setIds).toEqual([setIds[0]]);

    await useSettingsStore.getState().update({ exercise_auto_next: { [PLANK]: true } });
    expect((await loadRunPlan(seId, setIds[0]!, undefined))!.setIds).toHaveLength(3);
    expect((await loadRunPlan(seId, setIds[0]!, false))!.setIds).toEqual([setIds[0]]);
  });

  it('refuses a set without a time', async () => {
    const { seId, setIds } = await startTimedWorkout();
    await workouts.updateSet(setIds[0]!, { duration_s: null });
    expect(await loadRunPlan(seId, setIds[0]!, undefined)).toBeNull();
  });

  it('runs hands-free: logs each set at its real end time, and no rest timer during or after the run', async () => {
    const { seId, setIds } = await startTimedWorkout();
    await useRestTimerStore.getState().start(90);
    expect(await useIntervalRunStore.getState().start(seId, setIds[0]!)).toBe(true);
    expect(useRestTimerStore.getState().endsAt).toBeNull(); // starting a run stops the rest timer
    expect(scheduled.size).toBe(5); // work, rest, work, rest, work

    // Phone locked for a while: nothing ran. The app wakes in set 3's work phase.
    at(200_000);
    await useIntervalRunStore.getState().reconcile();
    let rows = await setRows(seId);
    expect(rows.map((r) => [r.is_completed, r.duration_s, r.completed_at])).toEqual([
      [1, 60, T0 + 60_000],
      [1, 60, T0 + 150_000],
      [0, 60, null],
    ]);
    expect(useRestTimerStore.getState().endsAt).toBeNull();

    // Ticking a set by hand mid-run doesn't start the rest timer either.
    await useActiveWorkoutStore.getState().completeSet(setIds[2]!, 30);
    expect(useRestTimerStore.getState().endsAt).toBeNull();
    await useActiveWorkoutStore.getState().toggleSetComplete(setIds[2]!, false);

    // Run ends at 240 s: the exercise is done, so no rest after the last set.
    at(240_500);
    await useIntervalRunStore.getState().reconcile();
    rows = await setRows(seId);
    expect(rows[2]).toMatchObject({ is_completed: 1, completed_at: T0 + 240_000 });
    expect(useIntervalRunStore.getState().run).toBeNull();
    expect(useRestTimerStore.getState().endsAt).toBeNull();
  });

  it('does not start a rest that is already over by the time the app wakes', async () => {
    const { seId, setIds } = await startTimedWorkout({ sets: 1 });
    await useIntervalRunStore.getState().start(seId, setIds[0]!);
    at(600_000);
    await useIntervalRunStore.getState().reconcile();
    expect(useIntervalRunStore.getState().run).toBeNull();
    expect(useRestTimerStore.getState().endsAt).toBeNull();
  });

  it('skips sets that were ticked or deleted by hand', async () => {
    const { seId, setIds } = await startTimedWorkout();
    await useIntervalRunStore.getState().start(seId, setIds[0]!);
    await workouts.updateSet(setIds[0]!, { duration_s: 45 });
    await workouts.setCompleted(setIds[0]!, true);
    await workouts.removeSet(setIds[1]!);
    at(200_000);
    await useIntervalRunStore.getState().reconcile();
    const rows = await setRows(seId);
    expect(rows.map((r) => r.duration_s)).toEqual([45, 60]);
    expect(rows[1]!.is_completed).toBe(0);
  });

  it('pause cancels the alerts and freezes the countdown; resume reschedules what is left', async () => {
    const { seId, setIds } = await startTimedWorkout();
    await useIntervalRunStore.getState().start(seId, setIds[0]!);
    at(70_000); // in rest 1
    await useIntervalRunStore.getState().pause();
    expect(scheduled.size).toBe(0);

    at(500_000);
    await useIntervalRunStore.getState().reconcile();
    expect((await setRows(seId)).filter((r) => r.is_completed).length).toBe(1);

    await useIntervalRunStore.getState().resume();
    expect(scheduled.size).toBe(4); // rest 1 end, work 2, rest 2, work 3
    at(500_000 + 20_000 + 60_000);
    await useIntervalRunStore.getState().reconcile();
    expect((await setRows(seId))[1]).toMatchObject({ is_completed: 1, completed_at: T0 + 580_000 });
  });

  it('skip during work logs the seconds done; stop during work logs at least 1 s', async () => {
    const { seId, setIds } = await startTimedWorkout();
    await useIntervalRunStore.getState().start(seId, setIds[0]!);
    at(20_400);
    await useIntervalRunStore.getState().skip();
    expect((await setRows(seId))[0]).toMatchObject({ is_completed: 1, duration_s: 20 });
    expect(useIntervalRunStore.getState().run).not.toBeNull(); // now resting

    at(20_400 + 30_000 + 400); // 0.4 s into set 2
    await useIntervalRunStore.getState().stop();
    const rows = await setRows(seId);
    expect(rows[1]).toMatchObject({ is_completed: 1, duration_s: 1 });
    expect(rows[2]!.is_completed).toBe(0);
    expect(useIntervalRunStore.getState().run).toBeNull();
    expect(scheduled.size).toBe(0);
    expect(useRestTimerStore.getState().endsAt).toBeNull();
  });

  it('skip while paused still moves on (and works past the half-second mark)', async () => {
    const { seId, setIds } = await startTimedWorkout();
    await useIntervalRunStore.getState().start(seId, setIds[0]!);
    at(10_600);
    await useIntervalRunStore.getState().pause();
    await useIntervalRunStore.getState().skip();
    expect((await setRows(seId))[0]).toMatchObject({ is_completed: 1, duration_s: 11 });
    const { run } = useIntervalRunStore.getState();
    expect(run).not.toBeNull();
    await useIntervalRunStore.getState().skip(); // skip the rest too
    await useIntervalRunStore.getState().resume();
    at(10_600 + 1_000);
    await useIntervalRunStore.getState().stop();
    expect((await setRows(seId))[1]).toMatchObject({ is_completed: 1, duration_s: 1 });
  });

  it('finishing the workout logs sets that ended while the phone was asleep', async () => {
    const { seId, setIds } = await startTimedWorkout();
    await useIntervalRunStore.getState().start(seId, setIds[0]!);
    at(100_000);
    await useActiveWorkoutStore.getState().finish();
    expect((await setRows(seId)).map((r) => r.is_completed)).toEqual([1, 0, 0]);
    expect(useIntervalRunStore.getState().run).toBeNull();
  });

  it('a set added mid-run joins the run when auto-start is on', async () => {
    const { seId } = await startTimedWorkout({ sets: 2 });
    const first = (await setRows(seId))[0]!.id;
    await useIntervalRunStore.getState().start(seId, first);
    at(70_000); // resting after set 1
    await useActiveWorkoutStore.getState().addSet(seId);
    const run = useIntervalRunStore.getState().run!;
    expect(run.setIds).toHaveLength(3);
    expect(run.workS).toEqual([60, 60, 60]);
    expect(scheduled.size).toBe(4); // rest 1 end, work 2, rest 2, work 3

    at(240_000);
    await useIntervalRunStore.getState().reconcile();
    expect((await setRows(seId)).map((r) => [r.is_completed, r.completed_at])).toEqual([
      [1, T0 + 60_000],
      [1, T0 + 150_000],
      [1, T0 + 240_000],
    ]);
  });

  it('a set added mid-run is left alone when auto-start is off', async () => {
    const { seId } = await startTimedWorkout({ sets: 2, autoNext: false });
    const first = (await setRows(seId))[0]!.id;
    await useIntervalRunStore.getState().start(seId, first);
    await useActiveWorkoutStore.getState().addSet(seId);
    expect(useIntervalRunStore.getState().run!.setIds).toEqual([first]);
  });

  it('discarding the workout cancels the run without logging anything', async () => {
    const { seId, setIds } = await startTimedWorkout();
    await useIntervalRunStore.getState().start(seId, setIds[0]!);
    at(30_000);
    await useActiveWorkoutStore.getState().discard();
    expect(useIntervalRunStore.getState().run).toBeNull();
    expect(scheduled.size).toBe(0);
  });

  it('the in-workout toggle overrides the routine and is remembered for the exercise', async () => {
    const { seId } = await startTimedWorkout({ autoNext: true });
    await useActiveWorkoutStore.getState().setAutoNext(seId, PLANK, false);
    expect(useActiveWorkoutStore.getState().autoNext[seId]).toBe(false);
    expect(useSettingsStore.getState().exercise_auto_next[PLANK]).toBe(false);
  });
});
