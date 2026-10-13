import { normalizeGroups } from './supersets';
import type { SetRow, TemplateExercise, TemplateSet } from './tables';

/** What a routine exercise's reps field means: a fixed count, a range, or nothing. */
export interface RepTarget {
  target_reps: number | null;
  rep_min: number | null;
  rep_max: number | null;
}

const MAX_REPS = 1000;

/**
 * Parses the routine editor's reps text: "" → no target, "10" → fixed, "8-12" / "8–12" / "8 to 12" → range.
 * Returns null when the text is invalid (non-numeric, reversed or equal range, too large).
 */
export function parseRepTarget(text: string): RepTarget | null {
  const t = text.trim();
  if (t === '') return { target_reps: null, rep_min: null, rep_max: null };
  const fixed = /^(\d{1,4})$/.exec(t);
  if (fixed) {
    const n = Number(fixed[1]);
    return n <= MAX_REPS ? { target_reps: n, rep_min: null, rep_max: null } : null;
  }
  const range = /^(\d{1,4})\s*(?:-|–|—|to)\s*(\d{1,4})$/i.exec(t);
  if (!range) return null;
  const lo = Number(range[1]);
  const hi = Number(range[2]);
  if (lo >= hi || hi > MAX_REPS) return null;
  return { target_reps: null, rep_min: lo, rep_max: hi };
}

/** "10", "8–12" or "" (no target). Inverse of parseRepTarget. */
export function formatRepTarget(t: Pick<TemplateExercise, 'target_reps' | 'rep_min' | 'rep_max'>): string {
  if (t.rep_min !== null && t.rep_max !== null) return `${t.rep_min}–${t.rep_max}`;
  return t.target_reps !== null ? String(t.target_reps) : '';
}

/**
 * The concrete sets a routine exercise starts with: its per-set targets if it has them, otherwise
 * target_sets working sets with the shared weight and reps. A rep range leaves reps empty (the range is
 * shown as the hint instead), so the lifter types what they actually did.
 */
export function expandTemplateSets(te: TemplateExercise): TemplateSet[] {
  if (te.sets && te.sets.length > 0) return te.sets.map((s) => ({ ...s }));
  return Array.from({ length: te.target_sets }, () => ({
    set_type: 'working' as const,
    reps: te.target_reps,
    weight_kg: te.target_weight_kg ?? null,
    duration_s: te.target_duration_s ?? null,
    distance_m: te.target_distance_m ?? null,
  }));
}

/** Short plan summary for a routine row, e.g. "3 × 8–12" or "4 sets" (per-set targets). */
export function summarizeTemplateExercise(te: TemplateExercise): string {
  if (te.sets && te.sets.length > 0) return `${te.sets.length} set${te.sets.length === 1 ? '' : 's'}`;
  const reps = formatRepTarget(te);
  return reps ? `${te.target_sets} × ${reps}` : `${te.target_sets} set${te.target_sets === 1 ? '' : 's'}`;
}

export type LoggedSet = Pick<SetRow, 'set_type' | 'reps' | 'weight_kg' | 'duration_s' | 'distance_m' | 'is_completed'>;

/** One exercise of a finished workout, in session order, with all its sets (ticked or not). */
export interface LoggedExercise {
  exercise_id: string;
  rest_seconds: number | null;
  superset_group: string | null;
  sets: LoggedSet[];
}

const MAX_TEMPLATE_SETS = 50;

/**
 * "Save as routine" after a workout: what was actually logged becomes per-set targets. Only ticked sets count;
 * exercises with none are dropped, and supersets that lost a partner are dissolved.
 */
export function routineFromSession(exercises: readonly LoggedExercise[]): TemplateExercise[] {
  const kept = exercises
    .map((e) => ({ e, done: e.sets.filter((s) => s.is_completed).slice(0, MAX_TEMPLATE_SETS) }))
    .filter((x) => x.done.length > 0);
  const groups = normalizeGroups(kept.map((x) => x.e.superset_group));
  return kept.map(({ e, done }, i) => ({
    exercise_id: e.exercise_id,
    order_index: i,
    target_sets: done.length,
    target_reps: null,
    rest_seconds: e.rest_seconds,
    target_weight_kg: null,
    rep_min: null,
    rep_max: null,
    sets: done.map((s) => ({
      set_type: s.set_type,
      reps: s.reps === null ? null : Math.min(s.reps, MAX_REPS),
      weight_kg: s.weight_kg,
      duration_s: s.duration_s,
      distance_m: s.distance_m,
    })),
    target_duration_s: null,
    target_distance_m: null,
    superset_group: groups[i] ?? null,
    auto_next: null,
  }));
}
