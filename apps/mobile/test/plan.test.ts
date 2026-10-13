import { beforeEach, describe, expect, it } from 'vitest';
import { planFromPreset, removePlanDay, templateExerciseSchema, type TemplateExercise } from '@gym/shared';
import { db } from '../src/db/client';
import { getRecord } from '../src/db/mutate';
import { createTemplate, duplicateTemplate } from '../src/db/repositories/templates';
import * as workouts from '../src/db/repositories/workouts';
import {
  countLinkedRoutines,
  getSavePrompt,
  lastPlanDayId,
  saveSessionAsRoutine,
  setTrainingPlan,
} from '../src/db/repositories/plan';
import { useActiveWorkoutStore } from '../src/state/activeWorkoutStore';
import { getSettings } from '../src/state/settingsStore';
import { BENCH, SQUAT, freshApp, logWorkout } from './helpers';

beforeEach(async () => {
  await freshApp();
});

const te = (exercise_id: string, extra: Partial<TemplateExercise> = {}): TemplateExercise =>
  templateExerciseSchema.parse({ exercise_id, order_index: 0, target_sets: 2, target_reps: 10, rest_seconds: 90, ...extra });

describe('plan_day_id on routines and sessions', () => {
  it('migration v6 adds the columns', async () => {
    const cols = async (t: string) => (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
    expect(await cols('workout_templates')).toContain('plan_day_id');
    expect(await cols('workout_sessions')).toContain('plan_day_id');
  });

  it('stores a routine day and duplicates keep it', async () => {
    const t = await createTemplate('Push A', [te(BENCH)], { planDayId: 'push' });
    expect(t.plan_day_id).toBe('push');
    const copy = await getRecord('workout_templates', await duplicateTemplate(t.id));
    expect(copy!.plan_day_id).toBe('push');
  });

  it('a session started from a routine takes its day unless one is given', async () => {
    const t = await createTemplate('Push A', [te(BENCH)], { planDayId: 'push' });
    const a = await workouts.startSession({ templateId: t.id });
    expect((await getRecord('workout_sessions', a))!.plan_day_id).toBe('push');
    await workouts.finishSession(a);
    const b = await workouts.startSession({ templateId: t.id, planDayId: 'pull' });
    expect((await getRecord('workout_sessions', b))!.plan_day_id).toBe('pull');
  });

  it('starts from a draft without writing a routine row', async () => {
    const id = await workouts.startSession({ draft: [te(SQUAT, { target_sets: 3 })], title: 'Push', planDayId: 'push' });
    const s = await getRecord('workout_sessions', id);
    expect(s).toMatchObject({ template_id: null, title: 'Push', plan_day_id: 'push' });
    const n = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sets x JOIN session_exercises se ON se.id = x.session_exercise_id WHERE se.session_id = ?`,
      [id],
    );
    expect(n!.n).toBe(3);
    const routines = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_templates');
    expect(routines!.n).toBe(0);
  });

  it('repeating a workout keeps its day', async () => {
    const a = await workouts.startSession({ draft: [te(BENCH)], planDayId: 'cardio' });
    await workouts.finishSession(a);
    const b = await workouts.startSession({ repeatOf: a });
    expect((await getRecord('workout_sessions', b))!.plan_day_id).toBe('cardio');
  });
});

const DAYS = ['push', 'pull', 'cardio'];

/** Finished workout counted as `day` (optionally from a routine). */
async function doDay(day: string | null, templateId?: string) {
  const id = await workouts.startSession({ templateId: templateId ?? null, draft: templateId ? undefined : [te(BENCH)], planDayId: day });
  await workouts.finishSession(id);
  return id;
}

describe('lastPlanDayId', () => {
  it('is null with no history', async () => {
    expect(await lastPlanDayId(DAYS)).toBeNull();
  });

  it('is the most recently finished workout in the plan', async () => {
    await doDay('push');
    await new Promise((r) => setTimeout(r, 5));
    await doDay('pull');
    expect(await lastPlanDayId(DAYS)).toBe('pull');
  });

  it('a day workout that was never saved as a routine still counts', async () => {
    await doDay('push'); // draft start, template_id null
    expect(await lastPlanDayId(DAYS)).toBe('push');
  });

  it('ignores unfinished, deleted, unlinked and foreign-day workouts', async () => {
    await doDay('push');
    await new Promise((r) => setTimeout(r, 5));
    await workouts.startSession({ draft: [te(BENCH)], planDayId: 'pull' }); // still active
    const deleted = await doDay('cardio');
    await workouts.discardSession(deleted);
    await doDay(null);
    await doDay('legs');
    expect(await lastPlanDayId(DAYS)).toBe('push');
  });
});

describe('setTrainingPlan', () => {
  it('saves the plan and unlinks routines of removed days only', async () => {
    const ppc = planFromPreset('push_pull_cardio')!;
    await setTrainingPlan(ppc);
    const push = await createTemplate('Push A', [te(BENCH)], { planDayId: 'push' });
    const pull = await createTemplate('Pull A', [te(SQUAT)], { planDayId: 'pull' });
    expect(await countLinkedRoutines(['pull'])).toBe(1);

    await setTrainingPlan(removePlanDay(ppc, 'pull'));
    expect(getSettings().training_plan!.days.map((d) => d.id)).toEqual(['push', 'cardio']);
    expect((await getRecord('workout_templates', pull.id))!.plan_day_id).toBeNull();
    expect((await getRecord('workout_templates', push.id))!.plan_day_id).toBe('push');
  });

  it('deleting the only day unlinks its routines even though no plan is left', async () => {
    const one = { preset: null, days: [{ id: 'full', name: 'Full body' }] };
    await setTrainingPlan(one);
    const t = await createTemplate('Full A', [te(BENCH)], { planDayId: 'full' });
    await setTrainingPlan(removePlanDay(one, 'full'), ['full']);
    expect(getSettings().training_plan).toBeNull();
    expect((await getRecord('workout_templates', t.id))!.plan_day_id).toBeNull();
  });

  it('switching to no plan keeps links, so re-enabling restores them', async () => {
    await setTrainingPlan(planFromPreset('push_pull_cardio'));
    const push = await createTemplate('Push A', [te(BENCH)], { planDayId: 'push' });
    await setTrainingPlan(null);
    expect(getSettings().training_plan).toBeNull();
    await setTrainingPlan(planFromPreset('push_pull_cardio'));
    expect((await getRecord('workout_templates', push.id))!.plan_day_id).toBe('push');
  });
});

describe('save as routine', () => {
  it('offers to save only an unsaved workout with completed sets', async () => {
    const { sessionId } = await logWorkout(BENCH, [{ weight: 60, reps: 8 }]);
    expect(await getSavePrompt(sessionId)).toEqual({ sessionId, title: 'Test', planDayId: null });

    const empty = await logWorkout(BENCH, [{ weight: 60, reps: 8, done: false }]);
    expect(await getSavePrompt(empty.sessionId)).toBeNull();

    const t = await createTemplate('Push A', [te(BENCH)]);
    const fromRoutine = await workouts.startSession({ templateId: t.id });
    await workouts.finishSession(fromRoutine);
    expect(await getSavePrompt(fromRoutine)).toBeNull();
  });

  it('creates the routine from what was logged and links the session to it', async () => {
    const { sessionId } = await logWorkout(BENCH, [
      { weight: 20, reps: 12, type: 'warmup' },
      { weight: 60, reps: 8 },
      { weight: 60, reps: 8, done: false },
    ]);
    const id = await saveSessionAsRoutine(sessionId, { title: '  Push day ', folder: 'PPL', planDayId: 'push' });

    const r = await getRecord('workout_templates', id);
    expect(r).toMatchObject({ title: 'Push day', folder: 'PPL', plan_day_id: 'push' });
    expect(r!.template_exercises).toHaveLength(1);
    expect(r!.template_exercises[0]!.sets!.map((s) => [s.set_type, s.weight_kg, s.reps])).toEqual([
      ['warmup', 20, 12],
      ['working', 60, 8],
    ]);
    expect(await getRecord('workout_sessions', sessionId)).toMatchObject({ template_id: id, plan_day_id: 'push' });
    expect(await getSavePrompt(sessionId)).toBeNull();
  });

  it('a blank name falls back to "Workout"', async () => {
    const { sessionId } = await logWorkout(BENCH, [{ weight: 60, reps: 8 }]);
    const id = await saveSessionAsRoutine(sessionId, { title: '  ', folder: null, planDayId: null });
    expect((await getRecord('workout_templates', id))!.title).toBe('Workout');
  });
});

describe('finish → save prompt', () => {
  it('sets savePrompt for an unsaved workout with ticked sets, and clears it', async () => {
    useActiveWorkoutStore.setState({ sessionId: null, startedAt: null, prHits: {}, currentIndex: 0, autoNext: {}, savePrompt: null });
    await useActiveWorkoutStore.getState().start({ draft: [te(BENCH)], planDayId: 'push', title: 'Push' });
    const sessionId = useActiveWorkoutStore.getState().sessionId!;
    const set = await db.getFirstAsync<{ id: string }>(
      `SELECT x.id FROM sets x JOIN session_exercises se ON se.id = x.session_exercise_id WHERE se.session_id = ? LIMIT 1`,
      [sessionId],
    );
    await workouts.updateSet(set!.id, { weight_kg: 60, reps: 8 });
    await workouts.setCompleted(set!.id, true);
    await useActiveWorkoutStore.getState().finish();
    expect(useActiveWorkoutStore.getState().savePrompt).toEqual({ sessionId, title: 'Push', planDayId: 'push' });
    useActiveWorkoutStore.getState().clearSavePrompt();
    expect(useActiveWorkoutStore.getState().savePrompt).toBeNull();
  });
});
