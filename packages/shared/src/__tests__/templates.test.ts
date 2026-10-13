import { describe, expect, it } from 'vitest';
import { templateExerciseSchema } from '../tables';
import {
  expandTemplateSets,
  formatRepTarget,
  parseRepTarget,
  routineFromSession,
  summarizeTemplateExercise,
  type LoggedSet,
} from '../templates';

const EX = '00000000-0000-4000-8000-000000000001';
const te = (extra: Record<string, unknown> = {}) =>
  templateExerciseSchema.parse({ exercise_id: EX, order_index: 0, target_sets: 3, target_reps: 10, rest_seconds: 90, ...extra });

describe('rep targets', () => {
  it('parses fixed reps, ranges and empty', () => {
    expect(parseRepTarget('10')).toEqual({ target_reps: 10, rep_min: null, rep_max: null });
    expect(parseRepTarget(' 8-12 ')).toEqual({ target_reps: null, rep_min: 8, rep_max: 12 });
    expect(parseRepTarget('8–12')).toEqual({ target_reps: null, rep_min: 8, rep_max: 12 });
    expect(parseRepTarget('6 to 8')).toEqual({ target_reps: null, rep_min: 6, rep_max: 8 });
    expect(parseRepTarget('')).toEqual({ target_reps: null, rep_min: null, rep_max: null });
  });

  it('rejects nonsense', () => {
    for (const bad of ['abc', '12-8', '8-8', '5000', '8-', '-3', '1.5']) expect(parseRepTarget(bad)).toBeNull();
  });

  it('formats back to the same text', () => {
    for (const text of ['10', '8–12', '']) expect(formatRepTarget(parseRepTarget(text)!)).toBe(text);
  });
});

describe('template sets', () => {
  it('old routines (no new fields) still parse with defaults', () => {
    expect(te()).toMatchObject({ target_weight_kg: null, rep_min: null, rep_max: null, sets: null });
  });

  it('expands shared targets into working sets; a range leaves reps empty', () => {
    expect(expandTemplateSets(te({ target_weight_kg: 60 }))).toEqual([
      { set_type: 'working', reps: 10, weight_kg: 60, duration_s: null, distance_m: null },
      { set_type: 'working', reps: 10, weight_kg: 60, duration_s: null, distance_m: null },
      { set_type: 'working', reps: 10, weight_kg: 60, duration_s: null, distance_m: null },
    ]);
    expect(expandTemplateSets(te({ target_sets: 2, target_reps: null, rep_min: 8, rep_max: 12 }))).toEqual([
      { set_type: 'working', reps: null, weight_kg: null, duration_s: null, distance_m: null },
      { set_type: 'working', reps: null, weight_kg: null, duration_s: null, distance_m: null },
    ]);
  });

  it('per-set targets win over the shared ones', () => {
    const sets = [
      { set_type: 'warmup', reps: 10, weight_kg: 40, duration_s: null, distance_m: null },
      { set_type: 'working', reps: 5, weight_kg: 100, duration_s: null, distance_m: null },
    ];
    expect(expandTemplateSets(te({ sets }))).toEqual(sets);
    expect(summarizeTemplateExercise(te({ sets }))).toBe('2 sets');
  });

  it('summarises the plan', () => {
    expect(summarizeTemplateExercise(te())).toBe('3 × 10');
    expect(summarizeTemplateExercise(te({ target_reps: null, rep_min: 8, rep_max: 12 }))).toBe('3 × 8–12');
    expect(summarizeTemplateExercise(te({ target_sets: 1, target_reps: null }))).toBe('1 set');
  });
});

describe('routineFromSession', () => {
  const EX2 = '00000000-0000-4000-8000-000000000015';
  const set = (extra: Partial<LoggedSet> = {}): LoggedSet => ({
    set_type: 'working',
    reps: 10,
    weight_kg: 60,
    duration_s: null,
    distance_m: null,
    is_completed: true,
    ...extra,
  });

  it('keeps completed sets as per-set targets, in order, including warm-ups', () => {
    const out = routineFromSession([
      {
        exercise_id: EX,
        rest_seconds: 120,
        superset_group: null,
        sets: [set({ set_type: 'warmup', reps: 12, weight_kg: 20 }), set(), set({ is_completed: false })],
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ exercise_id: EX, order_index: 0, target_sets: 2, rest_seconds: 120 });
    expect(out[0]!.sets).toEqual([
      { set_type: 'warmup', reps: 12, weight_kg: 20, duration_s: null, distance_m: null },
      { set_type: 'working', reps: 10, weight_kg: 60, duration_s: null, distance_m: null },
    ]);
    expect(() => templateExerciseSchema.parse(out[0])).not.toThrow();
  });

  it('drops exercises with no completed sets and renumbers order_index', () => {
    const out = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: null, sets: [set({ is_completed: false })] },
      { exercise_id: EX2, rest_seconds: null, superset_group: null, sets: [set()] },
    ]);
    expect(out.map((t) => [t.exercise_id, t.order_index])).toEqual([[EX2, 0]]);
  });

  it('keeps timed and distance values', () => {
    const out = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: null, sets: [set({ reps: null, weight_kg: null, duration_s: 60, distance_m: 5000 })] },
    ]);
    expect(out[0]!.sets![0]).toMatchObject({ duration_s: 60, distance_m: 5000, reps: null, weight_kg: null });
  });

  it('keeps a superset when both partners survive, drops it when one is removed', () => {
    const both = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: 'g1', sets: [set()] },
      { exercise_id: EX2, rest_seconds: null, superset_group: 'g1', sets: [set()] },
    ]);
    expect(both.map((t) => t.superset_group)).toEqual(['g1', 'g1']);
    const one = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: 'g1', sets: [set()] },
      { exercise_id: EX2, rest_seconds: null, superset_group: 'g1', sets: [set({ is_completed: false })] },
    ]);
    expect(one.map((t) => t.superset_group)).toEqual([null]);
  });

  it('clamps values the routine schema would reject (reps > 1000, > 50 sets)', () => {
    const out = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: null, sets: Array.from({ length: 60 }, () => set({ reps: 5000 })) },
    ]);
    expect(out[0]!.sets).toHaveLength(50);
    expect(out[0]!.target_sets).toBe(50);
    expect(out[0]!.sets![0]!.reps).toBe(1000);
    expect(() => templateExerciseSchema.parse(out[0])).not.toThrow();
  });
});
