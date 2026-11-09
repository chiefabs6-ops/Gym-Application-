import { volumeTypeSql } from '@gym/shared';
import { db } from '../client';

/** History tab queries: the workout list, strength progress per lift, and when each plan day was last trained. */

export interface HistorySession {
  id: string;
  title: string | null;
  start_time: number;
  end_time: number;
  sets_done: number;
  volume_kg: number;
  distance_m: number;
  /** Exercise names in workout order, one per line. */
  names: string | null;
}

/** Finished workouts, newest first, with their totals. Warm-ups never count toward volume. */
export const HISTORY_SQL = `
  SELECT ws.id, ws.title, ws.start_time, ws.end_time,
         COALESCE(SUM(s.is_completed), 0) AS sets_done,
         COALESCE(SUM(CASE WHEN s.is_completed = 1 AND s.set_type <> 'warmup' AND ${volumeTypeSql('e')}
                           THEN s.weight_kg * s.reps END), 0) AS volume_kg,
         COALESCE(SUM(CASE WHEN s.is_completed = 1 THEN s.distance_m END), 0) AS distance_m,
         (SELECT group_concat(name, char(10)) FROM (
            SELECT e2.name FROM session_exercises se2 JOIN exercise_definitions e2 ON e2.id = se2.exercise_id
            WHERE se2.session_id = ws.id AND se2.deleted_at IS NULL ORDER BY se2.order_index)) AS names
  FROM workout_sessions ws
  LEFT JOIN session_exercises se ON se.session_id = ws.id AND se.deleted_at IS NULL
  LEFT JOIN exercise_definitions e ON e.id = se.exercise_id
  LEFT JOIN sets s ON s.session_exercise_id = se.id AND s.deleted_at IS NULL
  WHERE ws.end_time IS NOT NULL AND ws.deleted_at IS NULL
  GROUP BY ws.id
  ORDER BY ws.start_time DESC
  LIMIT 200`;

/** "Bench press · Overhead press · Dips · +3" from one-per-line names. */
export function namesPreview(names: string | null, shown = 3): string {
  const list = names ? names.split('\n') : [];
  const head = list.slice(0, shown).join(' · ');
  return list.length > shown ? `${head} · +${list.length - shown}` : head;
}

export interface LiftProgress {
  exercise_id: string;
  name: string;
  /** The best set ever, by estimated 1-rep max. */
  weight_kg: number;
  reps: number;
  best_at: number;
  e1rm: number;
  /** Best e1RM before `since`; null when the lift was first logged after it. */
  before_e1rm: number | null;
  /** 1 when an earlier set of this lift exists, so the best set really beat something. */
  had_prior: number;
}

/**
 * Weight × reps lifts with their best set, latest best first. The e1rm expression mirrors epley1RM() in
 * packages/shared/src/pr.ts. Bind [since].
 */
export const STRENGTH_SQL = `
  WITH c AS (
    SELECT e.id AS exercise_id, e.name, s.weight_kg, s.reps, ws.start_time,
           s.weight_kg * (1 + s.reps / 30.0) AS e1rm
    FROM sets s
    JOIN session_exercises se ON se.id = s.session_exercise_id
    JOIN workout_sessions ws ON ws.id = se.session_id
    JOIN exercise_definitions e ON e.id = se.exercise_id
    WHERE s.is_completed = 1 AND s.set_type <> 'warmup' AND s.weight_kg > 0 AND s.reps > 0
      AND e.tracking_type = 'weight_reps'
      AND s.deleted_at IS NULL AND se.deleted_at IS NULL AND ws.deleted_at IS NULL AND ws.end_time IS NOT NULL
  ),
  ranked AS (
    SELECT c.*, ROW_NUMBER() OVER (PARTITION BY exercise_id ORDER BY e1rm DESC, start_time ASC) AS rn FROM c
  )
  SELECT r.exercise_id, r.name, r.weight_kg, r.reps, r.start_time AS best_at, r.e1rm,
         (SELECT MAX(c2.e1rm) FROM c c2 WHERE c2.exercise_id = r.exercise_id AND c2.start_time < ?) AS before_e1rm,
         EXISTS (SELECT 1 FROM c c3 WHERE c3.exercise_id = r.exercise_id AND c3.start_time < r.start_time) AS had_prior
  FROM ranked r WHERE r.rn = 1
  ORDER BY r.start_time DESC, r.name`;

export const strengthProgress = (since: number) => db.getAllAsync<LiftProgress>(STRENGTH_SQL, [since]);

/** Latest finished workout per plan day. Bind the day ids. */
export const PLAN_DAY_LAST_SQL = (count: number) =>
  `SELECT plan_day_id, MAX(start_time) AS last_at FROM workout_sessions
   WHERE deleted_at IS NULL AND end_time IS NOT NULL
     AND plan_day_id IN (${Array.from({ length: count }, () => '?').join(', ')})
   GROUP BY plan_day_id`;
