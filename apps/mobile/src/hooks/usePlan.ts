import { nextPlanDay, type PlanDay, type TrainingPlan } from '@gym/shared';
import { LAST_PLAN_DAY_SQL } from '../db/repositories/plan';
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

/** Routines linked to a plan day: never used first, then least recently used. */
export function useDayRoutines(dayId: string | null) {
  const { data } = useLiveQuery<{ id: string; title: string; n: number }>(
    `SELECT t.id, t.title, json_array_length(t.template_exercises) AS n,
       (SELECT MAX(s.start_time) FROM workout_sessions s WHERE s.template_id = t.id AND s.deleted_at IS NULL) AS last_used
     FROM workout_templates t
     WHERE t.deleted_at IS NULL AND t.plan_day_id = ?
     ORDER BY last_used IS NOT NULL, last_used, t.title COLLATE NOCASE`,
    [dayId ?? ''],
    ['workout_templates', 'workout_sessions'],
  );
  return data;
}
