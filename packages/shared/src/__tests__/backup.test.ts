import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, buildWorkoutCsv, csvEscape, parseBackup, skippedDataMessage, type BackupTables } from '../backup';

const U = '11111111-1111-4111-8111-111111111111';
const S1 = '22222222-2222-4222-8222-222222222222';
const S2 = '22222222-2222-4222-8222-222222222223';
const SE1 = '33333333-3333-4333-8333-333333333331';
const SE2 = '33333333-3333-4333-8333-333333333332';
const EX_BENCH = '00000000-0000-4000-8000-000000000001';
const EX_ROW = '00000000-0000-4000-8000-000000000006';
const base = { created_at: 1, updated_at: 1, deleted_at: null };

const id = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
const set = (n: number, seId: string, order: number, extra: Partial<BackupTables['sets'][number]> = {}) => ({
  ...base,
  id: id(n),
  user_id: U,
  session_exercise_id: seId,
  order_index: order,
  set_type: 'working' as const,
  weight_kg: 60,
  reps: 10,
  rpe: null,
  is_completed: true,
  completed_at: 5,
  duration_s: null,
  distance_m: null,
  notes: null,
  ...extra,
});

function tables(): BackupTables {
  return {
    users: [],
    workout_templates: [],
    foods: [],
    saved_meals: [],
    recipes: [],
    recipe_batches: [],
    food_log_entries: [],
    body_metrics: [],
    exercise_definitions: [
      { ...base, id: EX_BENCH, user_id: null, name: 'Bench Press (Barbell)', primary_muscle: 'chest', equipment: 'barbell', category: 'strength', archived_at: null, tracking_type: 'weight_reps' as const },
      { ...base, id: EX_ROW, user_id: null, name: 'Row, "heavy"', primary_muscle: 'back', equipment: 'barbell', category: 'strength', archived_at: null, tracking_type: 'weight_reps' as const },
    ],
    workout_sessions: [
      { ...base, id: S2, user_id: U, template_id: null, plan_day_id: null, title: 'Pull', start_time: 2_000_000, end_time: 2_000_000 + 30 * 60_000, notes: null, rpe: 8 },
      { ...base, id: S1, user_id: U, template_id: null, plan_day_id: null, title: null, start_time: 1_000_000, end_time: 1_000_000 + 45 * 60_000, notes: 'good, felt strong', rpe: null },
    ],
    session_exercises: [
      { ...base, id: SE1, user_id: U, session_id: S1, exercise_id: EX_BENCH, order_index: 0, notes: null, rest_seconds: null, superset_group: null },
      { ...base, id: SE2, user_id: U, session_id: S2, exercise_id: EX_ROW, order_index: 0, notes: null, rest_seconds: null, superset_group: null },
    ],
    sets: [
      set(2, SE1, 1, { reps: 8 }),
      set(1, SE1, 0, { set_type: 'warmup', weight_kg: 20 }),
      set(3, SE1, 2, { deleted_at: 9 }), // tombstone: excluded
      set(4, SE2, 0, { is_completed: false, weight_kg: null, reps: null }),
    ],
  };
}

describe('buildWorkoutCsv', () => {
  const lines = buildWorkoutCsv(tables()).trim().split('\r\n');

  it('writes a header and one row per live set, oldest workout first, in set order', () => {
    expect(lines[0]).toMatch(/^Date,Workout,Duration \(min\),Exercise,Set,/);
    expect(lines).toHaveLength(1 + 3);
    expect(lines[1]).toContain('Bench Press (Barbell),1,warmup,20,10');
    expect(lines[2]).toContain('Bench Press (Barbell),2,working,60,8');
    expect(lines[3]).toContain('Pull,30,');
  });

  it('escapes commas and quotes, and labels untitled workouts', () => {
    expect(lines[1]).toContain(',Workout,45,');
    expect(lines[1]).toContain('"good, felt strong"');
    expect(lines[3]).toContain('"Row, ""heavy"""');
    expect(lines[3]).toContain(',no,');
  });

  it('csvEscape handles empty values', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape('a\nb')).toBe('"a\nb"');
  });
});

describe('parseBackup', () => {
  const valid = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: 123,
    app_version: '0.1.0',
    user_id: U,
    tables: tables(),
  };

  it('accepts a valid backup and fills defaults', () => {
    const r = parseBackup(JSON.stringify(valid));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.tables.sets).toHaveLength(4);
      expect(r.backup.telemetry_points).toEqual([]);
    }
  });

  it('rejects non-JSON, foreign files, newer versions and damaged rows with friendly errors', () => {
    expect(parseBackup('nope')).toMatchObject({ ok: false, error: expect.stringContaining('not valid JSON') });
    expect(parseBackup('{"format":"other","version":1}')).toMatchObject({ ok: false, error: expect.stringContaining('isn’t a Gym Log backup') });
    expect(parseBackup(JSON.stringify({ ...valid, version: BACKUP_VERSION + 1 }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('newer version'),
    });
    const damaged = { ...valid, tables: { ...valid.tables, sets: [{ ...valid.tables.sets[0], reps: 'ten' }] } };
    expect(parseBackup(JSON.stringify(damaged))).toMatchObject({ ok: false, error: expect.stringContaining('damaged') });
  });

  it('reports tables it does not know and still parses the rest', () => {
    const file = { ...valid, tables: { ...valid.tables, meal_plans: [{ id: 'x' }] } };
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok && r.skippedTables).toEqual(['meal_plans']);
    expect(r.ok && r.backup.tables.sets).toHaveLength(4);
    expect(skippedDataMessage(['meal_plans'])).toBe(
      'Some data (meal_plans) was skipped because this backup is from a newer app version. Update the app to restore it.',
    );
    expect(skippedDataMessage([])).toBeNull();
  });

  it('parses an old backup that has no food tables', () => {
    const old = JSON.parse(JSON.stringify(valid));
    for (const t of ['foods', 'saved_meals', 'recipes', 'recipe_batches', 'food_log_entries', 'body_metrics']) delete old.tables[t];
    const r = parseBackup(JSON.stringify(old));
    expect(r.ok && r.backup.tables.food_log_entries).toEqual([]);
    expect(r.ok && r.skippedTables).toEqual([]);
  });
});
