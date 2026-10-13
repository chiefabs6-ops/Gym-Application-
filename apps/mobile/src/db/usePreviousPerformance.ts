import type { PreviousSource } from '@gym/shared';
import { useLiveQuery } from './useLiveQuery';

export interface PreviousSet {
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
}

/**
 * Completed sets from the most recent *finished* session that included this exercise,
 * in set order. Index i is shown next to set i of the current session (Hevy/Strong style).
 * With source 'same_routine' only sessions started from the same routine count; workouts without a
 * routine fall back to the last session.
 */
export function usePreviousPerformance(
  exerciseId: string,
  currentSessionId: string,
  source: PreviousSource = 'last_session',
  templateId: string | null = null,
): PreviousSet[] {
  const templateFilter = source === 'same_routine' ? templateId : null;
  const { data } = useLiveQuery<PreviousSet>(
    `WITH last AS (
       SELECT se.id FROM session_exercises se
       JOIN workout_sessions ws ON ws.id = se.session_id
       WHERE se.exercise_id = ? AND se.session_id <> ?
         AND se.deleted_at IS NULL AND ws.deleted_at IS NULL AND ws.end_time IS NOT NULL
         AND (? IS NULL OR ws.template_id = ?)
       ORDER BY ws.start_time DESC LIMIT 1
     )
     SELECT weight_kg, reps, duration_s, distance_m FROM sets
     WHERE session_exercise_id IN (SELECT id FROM last) AND deleted_at IS NULL AND is_completed = 1
     ORDER BY order_index`,
    [exerciseId, currentSessionId, templateFilter, templateFilter],
    ['sets', 'workout_sessions'],
  );
  return data;
}
