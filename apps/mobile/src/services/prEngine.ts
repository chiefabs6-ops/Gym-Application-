import { detectPRs, type PRKind, type PersonalBests, type SetType, type TrackingType } from '@gym/shared';
import { db } from '../db/client';

/**
 * Best value per record over the history rows aliased `h` (columns w = weight_kg, r = reps, d = duration_s,
 * m = distance_m). Each CASE mirrors setMetrics() in packages/shared/src/pr.ts; the e1rm expression is
 * epley1RM(): weight * (1 + reps / 30). Keep them in sync.
 */
const BEST_COLUMNS = `
  MAX(CASE WHEN h.w > 0 AND h.r > 0 THEN h.w * (1 + h.r / 30.0) END) AS e1rm,
  MAX(CASE WHEN h.w > 0 AND h.r > 0 THEN h.w END)                   AS max_weight,
  MAX(CASE WHEN h.w > 0 AND h.r > 0 THEN h.w * h.r END)             AS max_volume,
  MAX(CASE WHEN h.r > 0 THEN h.r END)                               AS max_reps,
  MIN(CASE WHEN h.r > 0 THEN COALESCE(h.w, 0) END)                  AS min_assist,
  MAX(CASE WHEN h.d > 0 THEN h.d END)                               AS max_duration,
  MAX(CASE WHEN h.m > 0 THEN h.m END)                               AS max_distance,
  MIN(CASE WHEN h.m > 0 AND h.d > 0 THEN h.d * 1000.0 / h.m END)    AS best_pace`;

/** Completed, non-warm-up sets of live workouts, with short metric aliases for BEST_COLUMNS. */
const HISTORY_SETS = `
  SELECT s.id, s.weight_kg AS w, s.reps AS r, s.duration_s AS d, s.distance_m AS m,
         se.exercise_id, ws.id AS session_id, ws.start_time,
         COALESCE(s.completed_at, 0) AS t, se.order_index AS eo, s.order_index AS so
  FROM sets s
  JOIN session_exercises se ON se.id = s.session_exercise_id
  JOIN workout_sessions ws ON ws.id = se.session_id
  WHERE s.is_completed = 1 AND s.set_type <> 'warmup'
    AND s.deleted_at IS NULL AND se.deleted_at IS NULL AND ws.deleted_at IS NULL`;

interface SetUnderTest {
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  set_type: SetType;
  exercise_id: string;
  tracking_type: TrackingType;
}

/**
 * Instant on-device PR detection, run when a set is marked complete: one aggregate over the user's
 * completed history for that exercise (excluding the set itself, including earlier sets in this session),
 * judged by the exercise's tracking type (e.g. most reps for push-ups, longest hold for planks).
 *
 * The server recomputes authoritative records asynchronously (BullMQ 'recompute-prs').
 */
export async function evaluateCompletedSet(setId: string): Promise<PRKind[]> {
  const set = await db.getFirstAsync<SetUnderTest>(
    `SELECT s.weight_kg, s.reps, s.duration_s, s.distance_m, s.set_type, se.exercise_id, e.tracking_type
     FROM sets s
     JOIN session_exercises se ON se.id = s.session_exercise_id
     JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE s.id = ?`,
    [setId],
  );
  if (!set) return [];

  const bests = await db.getFirstAsync<PersonalBests>(
    `SELECT ${BEST_COLUMNS} FROM (${HISTORY_SETS}) h WHERE h.exercise_id = ? AND h.id <> ?`,
    [set.exercise_id, setId],
  );
  return detectPRs(set, bests ?? {}, set.tracking_type);
}

export interface SessionSetBests extends PersonalBests {
  set_id: string;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  set_type: SetType;
  tracking_type: TrackingType;
}

/**
 * History detail: for every completed set of one session, the bests that existed *before* it, i.e. sets of
 * earlier-started sessions plus sets of the same session ticked earlier (same instant: earlier in the
 * workout's order). Feed rows to sessionPRs(). Because it's derived on the fly, editing any past workout
 * recomputes the badges everywhere. Bind [sessionId].
 */
export const SESSION_PR_SQL = `
  WITH cur AS (
    SELECT s.id, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.set_type, se.exercise_id, e.tracking_type,
           ws.id AS session_id, ws.start_time,
           COALESCE(s.completed_at, 0) AS t, se.order_index AS eo, s.order_index AS so
    FROM sets s
    JOIN session_exercises se ON se.id = s.session_exercise_id
    JOIN workout_sessions ws ON ws.id = se.session_id
    JOIN exercise_definitions e ON e.id = se.exercise_id
    WHERE ws.id = ? AND s.is_completed = 1 AND s.deleted_at IS NULL AND se.deleted_at IS NULL
  ),
  hist AS (${HISTORY_SETS} AND se.exercise_id IN (SELECT exercise_id FROM cur))
  SELECT cur.id AS set_id, cur.weight_kg, cur.reps, cur.duration_s, cur.distance_m, cur.set_type, cur.tracking_type,
         ${BEST_COLUMNS}
  FROM cur
  LEFT JOIN hist h ON h.exercise_id = cur.exercise_id AND h.id <> cur.id
   AND (h.start_time < cur.start_time
        OR (h.session_id = cur.session_id AND (h.t, h.eo, h.so) < (cur.t, cur.eo, cur.so)))
  GROUP BY cur.id`;

/** setId → records it broke (only sets with at least one). */
export function sessionPRs(rows: SessionSetBests[]): Record<string, PRKind[]> {
  const out: Record<string, PRKind[]> = {};
  for (const row of rows) {
    const kinds = detectPRs(row, row, row.tracking_type);
    if (kinds.length > 0) out[row.set_id] = kinds;
  }
  return out;
}

export async function getSessionPRs(sessionId: string): Promise<Record<string, PRKind[]>> {
  return sessionPRs(await db.getAllAsync<SessionSetBests>(SESSION_PR_SQL, [sessionId]));
}
