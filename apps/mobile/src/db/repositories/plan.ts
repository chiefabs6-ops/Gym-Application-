import { removedDayIds, routineFromSession, type LoggedExercise, type SetRow, type TrainingPlan } from '@gym/shared';
import { getSettings, useSettingsStore } from '../../state/settingsStore';
import { db } from '../client';
import { getRecord, stageCreate, stageUpdate, write } from '../mutate';
import { cleanFolder } from './templates';
import { getUserId } from './user';

/** Training split: the rotation's last day, plan edits that unlink routines, and "Save as routine". */

const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Latest finished workout counted as one of the plan's days. Used by useLiveQuery too. */
export const LAST_PLAN_DAY_SQL = (count: number) =>
  `SELECT plan_day_id FROM workout_sessions
   WHERE deleted_at IS NULL AND end_time IS NOT NULL AND plan_day_id IN (${marks(count)})
   ORDER BY end_time DESC LIMIT 1`;

export async function lastPlanDayId(dayIds: readonly string[]): Promise<string | null> {
  if (dayIds.length === 0) return null;
  const row = await db.getFirstAsync<{ plan_day_id: string }>(LAST_PLAN_DAY_SQL(dayIds.length), [...dayIds]);
  return row?.plan_day_id ?? null;
}

const linkedRoutines = (dayIds: readonly string[]) =>
  db.getAllAsync<{ id: string }>(
    `SELECT id FROM workout_templates WHERE deleted_at IS NULL AND plan_day_id IN (${marks(dayIds.length)})`,
    [...dayIds],
  );

export async function countLinkedRoutines(dayIds: readonly string[]): Promise<number> {
  return dayIds.length === 0 ? 0 : (await linkedRoutines(dayIds)).length;
}

export async function unlinkPlanDays(dayIds: readonly string[]): Promise<void> {
  if (dayIds.length === 0) return;
  await write(async () => {
    const rows = await linkedRoutines(dayIds);
    return Promise.all(rows.map((r) => stageUpdate('workout_templates', r.id, { plan_day_id: null })));
  });
}

/**
 * Saves the plan, then unlinks routines of days that were removed. Switching to no plan keeps every link.
 * `removed` overrides the diff (deleting the only day also leaves no plan, but must unlink it).
 */
export async function setTrainingPlan(
  next: TrainingPlan | null,
  removed: readonly string[] = removedDayIds(getSettings().training_plan, next),
): Promise<void> {
  await useSettingsStore.getState().update({ training_plan: next });
  await unlinkPlanDays(removed);
}

export interface SavePrompt {
  sessionId: string;
  title: string | null;
  planDayId: string | null;
}

/** "Save as routine?" applies to a workout not started from a routine that has at least one ticked set. */
export async function getSavePrompt(sessionId: string): Promise<SavePrompt | null> {
  const row = await db.getFirstAsync<{ template_id: string | null; title: string | null; plan_day_id: string | null; done: number }>(
    `SELECT s.template_id, s.title, s.plan_day_id,
       (SELECT COUNT(*) FROM sets x JOIN session_exercises se ON se.id = x.session_exercise_id
        WHERE se.session_id = s.id AND se.deleted_at IS NULL AND x.deleted_at IS NULL AND x.is_completed = 1) AS done
     FROM workout_sessions s WHERE s.id = ? AND s.deleted_at IS NULL`,
    [sessionId],
  );
  if (!row || row.template_id !== null || row.done === 0) return null;
  return { sessionId, title: row.title, planDayId: row.plan_day_id };
}

/** New routine from what was logged; the workout then counts as started from it (and as `planDayId`). */
export async function saveSessionAsRoutine(
  sessionId: string,
  opts: { title: string; folder: string | null; planDayId: string | null },
): Promise<string> {
  const userId = await getUserId();
  let routineId = '';
  await write(async () => {
    const session = await getRecord('workout_sessions', sessionId);
    if (!session || session.deleted_at !== null) throw new Error(`workout_sessions/${sessionId} not found`);
    const exercises = await db.getAllAsync<{ id: string; exercise_id: string; rest_seconds: number | null; superset_group: string | null }>(
      `SELECT id, exercise_id, rest_seconds, superset_group FROM session_exercises
       WHERE session_id = ? AND deleted_at IS NULL ORDER BY order_index`,
      [sessionId],
    );
    const sets = await db.getAllAsync<
      Pick<SetRow, 'set_type' | 'weight_kg' | 'reps' | 'duration_s' | 'distance_m'> & { se: string; done: number }
    >(
      `SELECT s.session_exercise_id AS se, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.is_completed AS done
       FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
       WHERE se.session_id = ? AND s.deleted_at IS NULL ORDER BY s.order_index`,
      [sessionId],
    );
    const logged: LoggedExercise[] = exercises.map((e) => ({
      exercise_id: e.exercise_id,
      rest_seconds: e.rest_seconds,
      superset_group: e.superset_group,
      sets: sets.filter((s) => s.se === e.id).map(({ se: _se, done, ...s }) => ({ ...s, is_completed: done === 1 })),
    }));
    const template_exercises = routineFromSession(logged);
    if (template_exercises.length === 0) throw new Error('Nothing logged to save');

    const routine = stageCreate('workout_templates', {
      user_id: userId,
      title: opts.title.trim().slice(0, 120) || 'Workout',
      notes: null,
      folder: cleanFolder(opts.folder),
      plan_day_id: opts.planDayId,
      template_exercises,
    });
    routineId = routine.row.id;
    return [routine, await stageUpdate('workout_sessions', sessionId, { template_id: routineId, plan_day_id: opts.planDayId })];
  });
  return routineId;
}
