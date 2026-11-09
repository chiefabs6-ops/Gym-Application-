import { nextPlanDay, planCycle, type PlanDay, type TrainingPlan } from '@gym/shared';
import { LAST_PLAN_DAY_SQL } from '../db/repositories/plan';
import { PLAN_DAY_LAST_SQL } from '../db/repositories/stats';
import { useLiveQuery } from '../db/useLiveQuery';
import { useSettingsStore } from '../state/settingsStore';

/** The plan and its next day (after the last finished workout's day). null = no plan, or still loading. */
export function useNextPlanDay(): { plan: TrainingPlan; day: PlanDay } | null {
  const plan = useSettingsStore((s) => s.training_plan);
  const ids = plan?.days.map((d) => d.id) ?? [];
  const { data, loading } = useLiveQuery<{ plan_day_id: string }>(
    ids.length ? LAST_PLAN_DAY_SQL(ids.length) : 'SELECT NULL AS plan_day_id WHERE 0',
    ids,
    ['workout_sessions'],
  );
  if (!plan || loading) return null;
  return { plan, day: nextPlanDay(plan, data[0]?.plan_day_id ?? null) };
}

export interface PlanCycleView {
  plan: TrainingPlan;
  next: PlanDay;
  /** Days done this round. */
  done: ReadonlySet<string>;
  /** Start of the latest finished workout per plan day. */
  lastAt: ReadonlyMap<string, number>;
}

/** Where the rotation stands, for the Workout tab's cycle strip. null = no plan, or still loading. */
export function usePlanCycle(): PlanCycleView | null {
  const plan = useSettingsStore((s) => s.training_plan);
  const ids = plan?.days.map((d) => d.id) ?? [];
  const none = 'SELECT NULL AS plan_day_id, NULL AS last_at WHERE 0';
  const last = useLiveQuery<{ plan_day_id: string }>(ids.length ? LAST_PLAN_DAY_SQL(ids.length) : none, ids, ['workout_sessions']);
  const dates = useLiveQuery<{ plan_day_id: string; last_at: number }>(
    ids.length ? PLAN_DAY_LAST_SQL(ids.length) : none,
    ids,
    ['workout_sessions'],
  );
  if (!plan || last.loading || dates.loading) return null;
  const { next, done } = planCycle(plan, last.data[0]?.plan_day_id ?? null);
  return { plan, next, done: new Set(done), lastAt: new Map(dates.data.map((r) => [r.plan_day_id, r.last_at])) };
}

/** Exercise names of a routine's template_exercises, in order, one per line. Needs the table aliased `t`. */
export const ROUTINE_NAMES_SQL = `
  (SELECT group_concat(name, char(10)) FROM (
     SELECT e.name FROM json_each(t.template_exercises) j
     JOIN exercise_definitions e ON e.id = json_extract(j.value, '$.exercise_id')
     ORDER BY json_extract(j.value, '$.order_index'))) AS names`;

export interface DayRoutine {
  id: string;
  title: string;
  n: number;
  last_used: number | null;
  names: string | null;
}

/** Routines linked to a plan day: never used first, then least recently used. */
export function useDayRoutines(dayId: string | null) {
  const { data } = useLiveQuery<DayRoutine>(
    `SELECT t.id, t.title, json_array_length(t.template_exercises) AS n,
       (SELECT MAX(s.start_time) FROM workout_sessions s WHERE s.template_id = t.id AND s.deleted_at IS NULL) AS last_used,
       ${ROUTINE_NAMES_SQL}
     FROM workout_templates t
     WHERE t.deleted_at IS NULL AND t.plan_day_id = ?
     ORDER BY last_used IS NOT NULL, last_used, t.title COLLATE NOCASE`,
    [dayId ?? ''],
    ['workout_templates', 'workout_sessions', 'exercise_definitions'],
  );
  return data;
}
