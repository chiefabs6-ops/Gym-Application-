import { beforeEach, describe, expect, it } from 'vitest';
import { templateExerciseSchema, type TemplateExercise } from '@gym/shared';
import { db } from '../src/db/client';
import { getRecord } from '../src/db/mutate';
import {
  createExercise,
  findNameClash,
  setExerciseArchived,
  updateExercise,
} from '../src/db/repositories/exercises';
import {
  copyTitle,
  createTemplate,
  duplicateTemplate,
  listFolders,
  renameFolder,
  updateTemplate,
} from '../src/db/repositories/templates';
import * as workouts from '../src/db/repositories/workouts';
import { BENCH, SQUAT, freshApp } from './helpers';

beforeEach(async () => {
  await freshApp();
});

const te = (exercise_id: string, extra: Partial<TemplateExercise> = {}): TemplateExercise =>
  templateExerciseSchema.parse({ exercise_id, order_index: 0, target_sets: 3, target_reps: 10, rest_seconds: 90, ...extra });

const sessionSets = (sessionId: string) =>
  db.getAllAsync<{ set_type: string; weight_kg: number | null; reps: number | null; exercise_id: string }>(
    `SELECT s.set_type, s.weight_kg, s.reps, se.exercise_id FROM sets s
     JOIN session_exercises se ON se.id = s.session_exercise_id
     WHERE se.session_id = ? ORDER BY se.order_index, s.order_index`,
    [sessionId],
  );

describe('routines: folders, duplicate, targets', () => {
  it('stores folders, lists them A→Z, and renames/removes them atomically', async () => {
    await createTemplate('Push A', [te(BENCH)], { folder: ' PPL ' });
    await createTemplate('Push B', [te(BENCH)], { folder: 'PPL' });
    await createTemplate('Legs', [te(SQUAT)], { folder: 'Arms & legs' });
    const loose = await createTemplate('Quick', [te(BENCH)]);
    expect(loose.folder).toBeNull();
    expect(await listFolders()).toEqual(['Arms & legs', 'PPL']);

    await renameFolder('PPL', 'Push Pull Legs');
    expect(await listFolders()).toEqual(['Arms & legs', 'Push Pull Legs']);
    await renameFolder('Arms & legs', null);
    expect(await listFolders()).toEqual(['Push Pull Legs']);
  });

  it('duplicates a routine with a unique "(copy)" title, same folder and exercises', async () => {
    const src = await createTemplate('Push', [te(BENCH, { sets: [{ set_type: 'warmup', reps: 10, weight_kg: 40, duration_s: null, distance_m: null }] })], {
      folder: 'PPL',
      notes: 'heavy week',
    });
    const id1 = await duplicateTemplate(src.id);
    const id2 = await duplicateTemplate(src.id);
    const c1 = await getRecord('workout_templates', id1);
    const c2 = await getRecord('workout_templates', id2);
    expect(c1).toMatchObject({ title: 'Push (copy)', folder: 'PPL', notes: 'heavy week' });
    expect(c1!.template_exercises).toEqual(src.template_exercises);
    expect(c2!.title).toBe('Push (copy 2)');
    expect(await copyTitle('Push (copy)')).toBe('Push (copy 3)');
  });

  it('duplicating from the editor copies the unsaved draft, not the stored routine', async () => {
    const src = await createTemplate('Push', [te(BENCH)]);
    const id = await duplicateTemplate(src.id, {
      title: 'Push',
      notes: null,
      folder: 'New folder',
      template_exercises: [te(SQUAT)],
    });
    const copy = await getRecord('workout_templates', id);
    expect(copy).toMatchObject({ title: 'Push (copy)', folder: 'New folder' });
    expect(copy!.template_exercises[0]!.exercise_id).toBe(SQUAT);
    expect((await getRecord('workout_templates', src.id))!.template_exercises[0]!.exercise_id).toBe(BENCH);
  });

  it('starting a routine uses per-set targets, and a rep range leaves reps empty', async () => {
    const t = await createTemplate('Mixed', [
      te(BENCH, {
        target_sets: 3,
        sets: [
          { set_type: 'warmup', reps: 12, weight_kg: 40, duration_s: null, distance_m: null },
          { set_type: 'working', reps: 5, weight_kg: 100, duration_s: null, distance_m: null },
          { set_type: 'drop', reps: 10, weight_kg: 70, duration_s: null, distance_m: null },
        ],
      }),
      te(SQUAT, { target_sets: 2, target_reps: null, rep_min: 8, rep_max: 12, target_weight_kg: 120 }),
    ]);
    const sessionId = await workouts.startSession({ templateId: t.id });
    expect(await sessionSets(sessionId)).toEqual([
      { set_type: 'warmup', weight_kg: 40, reps: 12, exercise_id: BENCH },
      { set_type: 'working', weight_kg: 100, reps: 5, exercise_id: BENCH },
      { set_type: 'drop', weight_kg: 70, reps: 10, exercise_id: BENCH },
      { set_type: 'working', weight_kg: 120, reps: null, exercise_id: SQUAT },
      { set_type: 'working', weight_kg: 120, reps: null, exercise_id: SQUAT },
    ]);
  });

  it('rejects an invalid template (per-set list can’t be empty)', async () => {
    const t = await createTemplate('Push', [te(BENCH)]);
    await expect(updateTemplate(t.id, { template_exercises: [{ ...te(BENCH), sets: [] }] })).rejects.toThrow();
  });
});

describe('custom exercises', () => {
  const fields = { name: '  Cable  Crunch ', primary_muscle: 'core', equipment: 'cable', tracking_type: 'weight_reps' } as const;

  it('creates a custom exercise owned by the user, with a cleaned name', async () => {
    const ex = await createExercise(fields);
    expect(ex).toMatchObject({ name: 'Cable Crunch', archived_at: null });
    expect(ex.user_id).not.toBeNull();
  });

  it('detects name clashes ignoring case, against canonical and custom exercises', async () => {
    expect(await findNameClash('bench press (barbell)')).toBe('Bench Press (Barbell)');
    const ex = await createExercise(fields);
    expect(await findNameClash('cable crunch')).toBe('Cable Crunch');
    expect(await findNameClash('Cable Crunch', ex.id)).toBeNull(); // editing itself
    await setExerciseArchived(ex.id, true);
    expect(await findNameClash('cable crunch')).toBeNull(); // archived names are free again
  });

  it('edits and archives/unarchives custom exercises, but never canonical ones', async () => {
    const ex = await createExercise(fields);
    await updateExercise(ex.id, { ...fields, name: 'Kneeling Cable Crunch', equipment: 'cable' });
    expect((await getRecord('exercise_definitions', ex.id))!.name).toBe('Kneeling Cable Crunch');

    await setExerciseArchived(ex.id, true);
    expect((await getRecord('exercise_definitions', ex.id))!.archived_at).toBeGreaterThan(0);
    await setExerciseArchived(ex.id, false);
    expect((await getRecord('exercise_definitions', ex.id))!.archived_at).toBeNull();

    await expect(updateExercise(BENCH, fields)).rejects.toThrow();
    await expect(setExerciseArchived(BENCH, true)).rejects.toThrow();
  });

  it('can be logged like any other exercise, and stays in history after archiving', async () => {
    const ex = await createExercise(fields);
    const sessionId = await workouts.startSession();
    await workouts.addExerciseToSession(sessionId, ex.id);
    await workouts.finishSession(sessionId);
    await setExerciseArchived(ex.id, true);
    const row = await db.getFirstAsync<{ name: string }>(
      `SELECT e.name FROM session_exercises se JOIN exercise_definitions e ON e.id = se.exercise_id WHERE se.session_id = ?`,
      [sessionId],
    );
    expect(row?.name).toBe('Cable Crunch');
  });
});

describe('supersets', () => {
  const groupsOf = (sessionId: string) =>
    db
      .getAllAsync<{ g: string | null }>(
        'SELECT superset_group AS g FROM session_exercises WHERE session_id = ? AND deleted_at IS NULL ORDER BY order_index',
        [sessionId],
      )
      .then((rows) => rows.map((r) => r.g));

  it('starting a routine and repeating a workout keep the supersets', async () => {
    const t = await createTemplate('SS', [
      te(BENCH, { order_index: 0, superset_group: 'x' }),
      te(SQUAT, { order_index: 1, superset_group: 'x' }),
      te(BENCH, { order_index: 2 }),
    ]);
    const sessionId = await workouts.startSession({ templateId: t.id });
    expect(await groupsOf(sessionId)).toEqual(['x', 'x', null]);
    await workouts.finishSession(sessionId);
    const again = await workouts.startSession({ repeatOf: sessionId });
    expect(await groupsOf(again)).toEqual(['x', 'x', null]);
  });

  it('links and unlinks exercises in a live workout', async () => {
    const sessionId = await workouts.startSession();
    for (const ex of [BENCH, SQUAT, BENCH]) await workouts.addExerciseToSession(sessionId, ex);
    await workouts.setSessionSupersets(sessionId, ['a', 'a', null]);
    expect(await groupsOf(sessionId)).toEqual(['a', 'a', null]);
    await workouts.setSessionSupersets(sessionId, ['a', null, null]); // a lone member is not a superset
    expect(await groupsOf(sessionId)).toEqual([null, null, null]);
  });
});
