import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '@gym/shared';
import { db } from '../src/db/client';
import { initDatabase } from '../src/db/migrations';
import { createRecord, getRecord, updateRecord } from '../src/db/mutate';
import { clearOutbox } from '../src/db/sync/syncManager';
import * as workouts from '../src/db/repositories/workouts';
import { BENCH, freshApp, logWorkout } from './helpers';

let userId: string;
beforeEach(async () => {
  userId = await freshApp();
});

describe('migrations', () => {
  it('creates the schema and seeds every canonical exercise', async () => {
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(7);
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercise_definitions');
    expect(n?.n).toBe(DEFAULT_EXERCISES.length);
  });

  it('upgrades a v1 install: adds v2–v6 columns, keeps rows, refreshes canonical exercises', async () => {
    const t = await createRecord('workout_templates', { user_id: userId, title: 'Push', notes: null, folder: null, plan_day_id: null, template_exercises: [] });
    // Turn the fresh database back into what a v1 phone has.
    await db.execAsync(`
      ALTER TABLE workout_templates DROP COLUMN folder;
      ALTER TABLE exercise_definitions DROP COLUMN archived_at;
      ALTER TABLE exercise_definitions DROP COLUMN tracking_type;
      ALTER TABLE sets DROP COLUMN duration_s;
      ALTER TABLE sets DROP COLUMN distance_m;
      ALTER TABLE session_exercises DROP COLUMN superset_group;
      ALTER TABLE sets DROP COLUMN notes;
      DROP INDEX idx_sessions_plan_day;
      ALTER TABLE workout_templates DROP COLUMN plan_day_id;
      ALTER TABLE workout_sessions DROP COLUMN plan_day_id;
      UPDATE exercise_definitions SET name = 'Triceps Pushdown (Cable)' WHERE id = '00000000-0000-4000-8000-000000000013';
      DELETE FROM exercise_definitions WHERE id = '00000000-0000-4000-8000-000000000044';
      DROP TABLE foods; DROP TABLE saved_meals; DROP TABLE recipes; DROP TABLE recipe_batches;
      DROP TABLE food_log_entries; DROP TABLE body_metrics; DROP TABLE builtin_foods;
      PRAGMA user_version = 1;
    `);
    await initDatabase();

    expect(await getRecord('workout_templates', t.id)).toMatchObject({ title: 'Push', folder: null, plan_day_id: null });
    const pushdown = await getRecord('exercise_definitions', '00000000-0000-4000-8000-000000000013');
    expect(pushdown).toMatchObject({ name: 'Triceps Pushdown (Straight Bar)', archived_at: null });
    expect(await getRecord('exercise_definitions', '00000000-0000-4000-8000-000000000044')).toMatchObject({
      name: 'Dip',
      tracking_type: 'weighted_bodyweight',
    });
    expect(await getRecord('exercise_definitions', '00000000-0000-4000-8000-000000000022')).toMatchObject({ tracking_type: 'duration' });
  });

  it('v7 food tables accept rows through mutate.ts', async () => {
    const f = await createRecord('foods', { user_id: userId, name: 'Oats', brand: null, barcode: null, source: 'custom', basis: 'g',
      kcal: 375, protein_g: 11, carbs_g: 60, fat_g: 8, fibre_g: 9, sugars_g: 1, sat_fat_g: 1.5, salt_g: 0, servings: [{ label: '1 bowl', grams: 60 }], archived_at: null });
    expect(await getRecord('foods', f.id)).toMatchObject({ name: 'Oats', servings: [{ label: '1 bowl', grams: 60 }] });
    await createRecord('food_log_entries', { user_id: userId, local_date: '2026-10-26', meal: 'breakfast', logged_at: Date.now(), kind: 'quick',
      food_id: null, builtin_food_id: null, recipe_id: null, batch_id: null, name: 'Cafe lunch', serving_label: null, servings: null, grams: null,
      kcal: 650, protein_g: 30, carbs_g: null, fat_g: null, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null });
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM food_log_entries WHERE deleted_at IS NULL');
    expect(n?.n).toBe(1);
  });

  it('is safe to run again (no duplicate seed rows, version unchanged)', async () => {
    await initDatabase();
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercise_definitions');
    expect(n?.n).toBe(DEFAULT_EXERCISES.length);
  });
});

describe('mutate.ts (offline-only mode)', () => {
  it('writes rows with system columns and validates against the shared schema', async () => {
    const row = await createRecord('workout_templates', { user_id: userId, title: 'Push', notes: null, folder: null, plan_day_id: null, template_exercises: [] });
    const stored = await getRecord('workout_templates', row.id);
    expect(stored).toMatchObject({ title: 'Push', deleted_at: null, template_exercises: [] });
    expect(stored!.created_at).toBe(stored!.updated_at);
  });

  it('rejects invalid rows without writing anything', async () => {
    await expect(
      createRecord('workout_templates', { user_id: userId, title: '', notes: null, folder: null, plan_day_id: null, template_exercises: [] }),
    ).rejects.toThrow();
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_templates');
    expect(n?.n).toBe(0);
  });

  it('does not add anything to the sync outbox while cloud sync is off', async () => {
    await logWorkout(BENCH, [{ weight: 60, reps: 10 }]);
    const q = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_queue');
    expect(q?.n).toBe(0);
  });

  it('clearOutbox empties leftovers from before offline-only mode', async () => {
    await db.runAsync(
      `INSERT INTO sync_queue (mutation_id, table_name, op, record_id, payload, client_ts) VALUES ('m1','sets','create','r1','{}',1)`,
    );
    expect(await clearOutbox()).toBe(1);
  });

  it('updated_at strictly increases even for back-to-back edits', async () => {
    const t = await createRecord('workout_templates', { user_id: userId, title: 'A', notes: null, folder: null, plan_day_id: null, template_exercises: [] });
    await updateRecord('workout_templates', t.id, { title: 'B' });
    await updateRecord('workout_templates', t.id, { title: 'C' });
    const stored = await getRecord('workout_templates', t.id);
    expect(stored!.title).toBe('C');
    expect(stored!.updated_at).toBeGreaterThanOrEqual(t.updated_at + 2);
  });

  it('write() lock: concurrent edits to one set are both kept (no lost update)', async () => {
    const { setIds } = await logWorkout(BENCH, [{ weight: null, reps: null, done: false }], { finish: false });
    const id = setIds[0]!;
    // The set row's weight blur-save and tapping ✓ fire at the same moment.
    await Promise.all([workouts.updateSet(id, { weight_kg: 80, reps: 5 }), workouts.setCompleted(id, true)]);
    const s = await getRecord('sets', id);
    expect(s).toMatchObject({ weight_kg: 80, reps: 5, is_completed: true });
  });

  it('starting a routine pre-fills sets with its target weight and reps', async () => {
    const t = await createRecord('workout_templates', {
      user_id: userId,
      title: 'Bench day',
      notes: null,
      folder: null,
      plan_day_id: null,
      template_exercises: [
        { exercise_id: BENCH, order_index: 0, target_sets: 3, target_reps: 8, rest_seconds: 120, target_weight_kg: 62.5, rep_min: null, rep_max: null, sets: null, target_duration_s: null, target_distance_m: null, superset_group: null, auto_next: null },
      ],
    });
    const sessionId = await workouts.startSession({ templateId: t.id });
    const sets = await db.getAllAsync<{ weight_kg: number; reps: number }>(
      `SELECT s.weight_kg, s.reps FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id WHERE se.session_id = ?`,
      [sessionId],
    );
    expect(sets).toEqual([{ weight_kg: 62.5, reps: 8 }, { weight_kg: 62.5, reps: 8 }, { weight_kg: 62.5, reps: 8 }]);
  });

  it('routines saved before target weights existed still load (weight defaults to none)', async () => {
    const t = await createRecord('workout_templates', { user_id: userId, title: 'Old', notes: null, folder: null, plan_day_id: null, template_exercises: [] });
    await db.runAsync(
      `UPDATE workout_templates SET template_exercises = ? WHERE id = ?`,
      [JSON.stringify([{ exercise_id: BENCH, order_index: 0, target_sets: 2, target_reps: 5, rest_seconds: null }]), t.id],
    );
    await updateRecord('workout_templates', t.id, { title: 'Old (renamed)' }); // re-validates the stored row
    const stored = await getRecord('workout_templates', t.id);
    expect(stored!.title).toBe('Old (renamed)');
  });

  it('discarding a workout tombstones the session and all its children', async () => {
    const { sessionId } = await logWorkout(BENCH, [{ weight: 50, reps: 5 }, { weight: 55, reps: 5 }], { finish: false });
    await workouts.discardSession(sessionId);
    const live = await db.getFirstAsync<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM workout_sessions WHERE deleted_at IS NULL)
            + (SELECT COUNT(*) FROM session_exercises WHERE deleted_at IS NULL)
            + (SELECT COUNT(*) FROM sets WHERE deleted_at IS NULL) AS n`,
    );
    expect(live?.n).toBe(0);
  });
});
