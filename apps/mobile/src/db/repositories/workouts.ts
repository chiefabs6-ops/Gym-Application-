import {
  expandTemplateSets,
  normalizeGroups,
  type SetRow,
  type TemplateExercise,
  type WorkoutTemplateRow,
} from '@gym/shared';
import { db } from '../client';
import {
  deleteRecord,
  getRecord,
  stageCreate,
  stageDelete,
  stageUpdate,
  updateRecord,
  write,
  type RowPatch,
  type StagedMutation,
} from '../mutate';
import { getUserId } from './user';

/**
 * Workout write API. Every function stages its mutations inside write(), so the reads it
 * depends on (next order_index, previous set, current row) happen under the write lock.
 */

const emptySet = (
  userId: string,
  sessionExerciseId: string,
  orderIndex: number,
  reps: number | null = null,
  weightKg: number | null = null,
  durationS: number | null = null,
  distanceM: number | null = null,
) =>
  stageCreate('sets', {
    user_id: userId,
    session_exercise_id: sessionExerciseId,
    order_index: orderIndex,
    set_type: 'working',
    weight_kg: weightKg,
    reps,
    rpe: null,
    is_completed: false,
    completed_at: null,
    duration_s: durationS,
    distance_m: distanceM,
    notes: null,
  });

export interface StartOptions {
  templateId?: string | null;
  title?: string | null;
  /** Copy the exercises and sets of this (finished) session: History → "Repeat workout". */
  repeatOf?: string | null;
  /** Training-plan day this workout counts as. undefined = the routine's own day (if any). */
  planDayId?: string | null;
  /** Workout tab "Start empty workout": exercises built in the draft editor. No routine row is written. */
  draft?: TemplateExercise[];
}

/** Creates a session (optionally expanded from a template or a past session) in one atomic commit. */
export async function startSession(opts: StartOptions = {}): Promise<string> {
  if (opts.repeatOf) return repeatSession(opts.repeatOf);
  const userId = await getUserId();
  let sessionId = '';

  await write(async () => {
    const template: WorkoutTemplateRow | null = opts.templateId
      ? await getRecord('workout_templates', opts.templateId)
      : null;

    const session = stageCreate('workout_sessions', {
      user_id: userId,
      template_id: template?.id ?? null,
      plan_day_id: opts.planDayId !== undefined ? opts.planDayId : (template?.plan_day_id ?? null),
      title: opts.title ?? template?.title ?? null,
      start_time: Date.now(),
      end_time: null,
      notes: null,
      rpe: null,
    });
    sessionId = session.row.id;
    const staged: StagedMutation[] = [session];

    const planned = [...(opts.draft ?? template?.template_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);
    planned.forEach((te, i) => {
      const se = stageCreate('session_exercises', {
        user_id: userId,
        session_id: session.row.id,
        exercise_id: te.exercise_id,
        order_index: i,
        notes: null,
        rest_seconds: te.rest_seconds,
        superset_group: te.superset_group ?? null,
      });
      staged.push(se);
      expandTemplateSets(te).forEach((planned, n) => {
        const set = emptySet(userId, se.row.id, n, planned.reps, planned.weight_kg, planned.duration_s, planned.distance_m);
        set.row.set_type = planned.set_type;
        staged.push(set);
      });
    });
    return staged;
  });

  return sessionId;
}

/**
 * Starts a new session that copies a past one: same title/routine link, same exercises in order, and each
 * set's type, weight and reps as the new (unticked) sets. Unticked sets of the source are skipped unless an
 * exercise had none ticked, so the copy matches what was actually done.
 */
async function repeatSession(sourceId: string): Promise<string> {
  const userId = await getUserId();
  let sessionId = '';

  await write(async () => {
    const source = await getRecord('workout_sessions', sourceId);
    if (!source || source.deleted_at !== null) throw new Error(`workout_sessions/${sourceId} not found`);
    const exercises = await db.getAllAsync<{
      id: string;
      exercise_id: string;
      rest_seconds: number | null;
      superset_group: string | null;
    }>(
      `SELECT id, exercise_id, rest_seconds, superset_group FROM session_exercises
       WHERE session_id = ? AND deleted_at IS NULL ORDER BY order_index`,
      [sourceId],
    );
    const sets = await db.getAllAsync<
      Pick<SetRow, 'set_type' | 'weight_kg' | 'reps' | 'duration_s' | 'distance_m'> & { se: string; done: number }
    >(
      `SELECT s.session_exercise_id AS se, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.is_completed AS done
       FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
       WHERE se.session_id = ? AND s.deleted_at IS NULL ORDER BY s.order_index`,
      [sourceId],
    );

    const session = stageCreate('workout_sessions', {
      user_id: userId,
      template_id: source.template_id,
      plan_day_id: source.plan_day_id,
      title: source.title,
      start_time: Date.now(),
      end_time: null,
      notes: null,
      rpe: null,
    });
    sessionId = session.row.id;
    const staged: StagedMutation[] = [session];

    exercises.forEach((e, i) => {
      const se = stageCreate('session_exercises', {
        user_id: userId,
        session_id: session.row.id,
        exercise_id: e.exercise_id,
        order_index: i,
        notes: null,
        rest_seconds: e.rest_seconds,
        superset_group: e.superset_group,
      });
      staged.push(se);
      const all = sets.filter((s) => s.se === e.id);
      const done = all.filter((s) => s.done === 1);
      const copy = done.length > 0 ? done : all;
      if (copy.length === 0) staged.push(emptySet(userId, se.row.id, 0));
      copy.forEach((s, n) => {
        const set = emptySet(userId, se.row.id, n, s.reps, s.weight_kg, s.duration_s, s.distance_m);
        set.row.set_type = s.set_type;
        staged.push(set);
      });
    });
    return staged;
  });

  return sessionId;
}

export async function addExerciseToSession(sessionId: string, exerciseId: string): Promise<void> {
  const userId = await getUserId();
  await write(async () => {
    const next = await db.getFirstAsync<{ n: number }>(
      `SELECT COALESCE(MAX(order_index) + 1, 0) AS n FROM session_exercises WHERE session_id = ? AND deleted_at IS NULL`,
      [sessionId],
    );
    const se = stageCreate('session_exercises', {
      user_id: userId,
      session_id: sessionId,
      exercise_id: exerciseId,
      order_index: next?.n ?? 0,
      notes: null,
      rest_seconds: null,
      superset_group: null,
    });
    return [se, emptySet(userId, se.row.id, 0)];
  });
}

/** Appends a set, pre-filled from the previous set of the same exercise. */
export async function addSet(sessionExerciseId: string): Promise<void> {
  const userId = await getUserId();
  await write(async () => {
    const last = await db.getFirstAsync<
      Pick<SetRow, 'order_index' | 'weight_kg' | 'reps' | 'set_type' | 'duration_s' | 'distance_m'>
    >(
      `SELECT order_index, weight_kg, reps, set_type, duration_s, distance_m FROM sets
       WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY order_index DESC LIMIT 1`,
      [sessionExerciseId],
    );
    const staged = emptySet(
      userId,
      sessionExerciseId,
      (last?.order_index ?? -1) + 1,
      last?.reps ?? null,
      last?.weight_kg ?? null,
      last?.duration_s ?? null,
      last?.distance_m ?? null,
    );
    staged.row.set_type = !last || last.set_type === 'warmup' ? 'working' : last.set_type;
    return [staged];
  });
}

export const updateSet = (id: string, patch: RowPatch<'sets'>) => updateRecord('sets', id, patch);

export const setCompleted = (id: string, completed: boolean) =>
  updateRecord('sets', id, { is_completed: completed, completed_at: completed ? Date.now() : null });

export const removeSet = (id: string) => deleteRecord('sets', id);

/**
 * Rewrites a workout's superset groups from the ordered list of its exercises' group values (as produced by
 * linkWithNext / unlinkFromNext in @gym/shared). Only rows whose group changed are written.
 */
export const setSessionSupersets = (sessionId: string, groups: readonly (string | null)[]) =>
  write(async () => {
    const rows = await db.getAllAsync<{ id: string; superset_group: string | null }>(
      `SELECT id, superset_group FROM session_exercises WHERE session_id = ? AND deleted_at IS NULL ORDER BY order_index`,
      [sessionId],
    );
    const clean = normalizeGroups(groups);
    return Promise.all(
      rows.map((r, i) =>
        (clean[i] ?? null) === r.superset_group
          ? null
          : stageUpdate('session_exercises', r.id, { superset_group: clean[i] ?? null }),
      ),
    );
  });

/**
 * Moves an exercise one place up (-1) or down (+1) in a workout. Superset groups are re-checked afterwards, so
 * moving an exercise out of a superset leaves no half-superset behind.
 */
export const moveSessionExercise = (sessionId: string, index: number, delta: -1 | 1) =>
  write(async () => {
    const rows = await db.getAllAsync<{ id: string; order_index: number; superset_group: string | null }>(
      `SELECT id, order_index, superset_group FROM session_exercises
       WHERE session_id = ? AND deleted_at IS NULL ORDER BY order_index`,
      [sessionId],
    );
    const j = index + delta;
    if (index < 0 || j < 0 || j >= rows.length) return [];
    const order = [...rows];
    [order[index], order[j]] = [order[j]!, order[index]!];
    const groups = normalizeGroups(order.map((r) => r.superset_group));
    return Promise.all(
      order.map((r, i) =>
        r.order_index === i && r.superset_group === groups[i]
          ? null
          : stageUpdate('session_exercises', r.id, { order_index: i, superset_group: groups[i] ?? null }),
      ),
    );
  });

/** Swaps the exercise in a workout slot (e.g. machine taken) while keeping its sets, notes and place. */
export const replaceSessionExercise = (sessionExerciseId: string, exerciseId: string) =>
  updateRecord('session_exercises', sessionExerciseId, { exercise_id: exerciseId });

/**
 * Puts warm-up sets at the start of an exercise: unticked warm-ups already there are replaced, everything else
 * shifts down. Returns how many were inserted.
 */
export async function insertWarmupSets(
  sessionExerciseId: string,
  warmups: readonly { weight_kg: number; reps: number }[],
): Promise<number> {
  if (warmups.length === 0) return 0;
  const userId = await getUserId();
  await write(async () => {
    const sets = await db.getAllAsync<{ id: string; set_type: string; is_completed: number }>(
      `SELECT id, set_type, is_completed FROM sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY order_index`,
      [sessionExerciseId],
    );
    const replaced = sets.filter((s) => s.set_type === 'warmup' && s.is_completed === 0);
    const kept = sets.filter((s) => !replaced.includes(s));
    const staged: (StagedMutation | null)[] = await Promise.all(replaced.map((s) => stageDelete('sets', s.id)));
    warmups.forEach((w, i) => {
      const set = emptySet(userId, sessionExerciseId, i, w.reps, w.weight_kg);
      set.row.set_type = 'warmup';
      staged.push(set);
    });
    staged.push(...(await Promise.all(kept.map((s, i) => stageUpdate('sets', s.id, { order_index: warmups.length + i })))));
    return staged;
  });
  return warmups.length;
}

export interface NextSet {
  setId: string;
  exerciseIndex: number;
  restSeconds: number | null;
}

/**
 * The set "Complete set" (lock-screen notification) should log: the first unticked set of the exercise at
 * `fromIndex`, else of the exercises after it, else before it. Empty values are filled in from the same set
 * last time (like the ghost values in the app). Returns null when every set is done.
 */
export async function prepareNextSet(sessionId: string, fromIndex: number): Promise<NextSet | null> {
  let result: NextSet | null = null;
  await write(async () => {
    const rows = await db.getAllAsync<{
      id: string;
      se_id: string;
      exercise_id: string;
      rest_seconds: number | null;
      ex_order: number;
      is_completed: number;
      weight_kg: number | null;
      reps: number | null;
      duration_s: number | null;
      distance_m: number | null;
    }>(
      `SELECT s.id, se.id AS se_id, se.exercise_id, se.rest_seconds, se.order_index AS ex_order, s.is_completed,
              s.weight_kg, s.reps, s.duration_s, s.distance_m
       FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
       WHERE se.session_id = ? AND s.deleted_at IS NULL AND se.deleted_at IS NULL
       ORDER BY se.order_index, s.order_index`,
      [sessionId],
    );
    const exerciseOrder = [...new Set(rows.map((r) => r.se_id))];
    const order = exerciseOrder.map((_, i) => i);
    const from = Math.min(Math.max(0, fromIndex), Math.max(0, order.length - 1));
    const search = [...order.slice(from), ...order.slice(0, from)];
    let target: (typeof rows)[number] | undefined;
    for (const i of search) {
      target = rows.find((r) => r.se_id === exerciseOrder[i] && r.is_completed === 0);
      if (target) break;
    }
    if (!target) return [];

    const position = rows.filter((r) => r.se_id === target!.se_id).findIndex((r) => r.id === target!.id);
    const previous = await db.getAllAsync<{
      weight_kg: number | null;
      reps: number | null;
      duration_s: number | null;
      distance_m: number | null;
    }>(
      `WITH last AS (
         SELECT se.id FROM session_exercises se JOIN workout_sessions ws ON ws.id = se.session_id
         WHERE se.exercise_id = ? AND se.session_id <> ? AND se.deleted_at IS NULL AND ws.deleted_at IS NULL
           AND ws.end_time IS NOT NULL
         ORDER BY ws.start_time DESC LIMIT 1
       )
       SELECT weight_kg, reps, duration_s, distance_m FROM sets
       WHERE session_exercise_id IN (SELECT id FROM last) AND deleted_at IS NULL AND is_completed = 1
       ORDER BY order_index`,
      [target.exercise_id, sessionId],
    );
    const ghost = previous[position];
    result = { setId: target.id, exerciseIndex: exerciseOrder.indexOf(target.se_id), restSeconds: target.rest_seconds };
    if (!ghost) return [];
    const patch: RowPatch<'sets'> = {};
    for (const col of ['weight_kg', 'reps', 'duration_s', 'distance_m'] as const) {
      if (target[col] === null && ghost[col] !== null) patch[col] = ghost[col];
    }
    return Object.keys(patch).length ? [await stageUpdate('sets', target.id, patch)] : [];
  });
  return result;
}

export const updateSessionExerciseRest = (id: string, seconds: number | null) =>
  updateRecord('session_exercises', id, { rest_seconds: seconds });

export const updateSetNotes = (id: string, notes: string | null) =>
  updateRecord('sets', id, { notes: notes?.trim() ? notes.trim().slice(0, 500) : null });

export const updateSessionExerciseNotes = (id: string, notes: string | null) =>
  updateRecord('session_exercises', id, { notes: notes?.trim() ? notes.trim() : null });

export const removeSessionExercise = (id: string) =>
  write(async () => {
    const sets = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM sets WHERE session_exercise_id = ? AND deleted_at IS NULL`,
      [id],
    );
    return Promise.all([...sets.map((s) => stageDelete('sets', s.id)), stageDelete('session_exercises', id)]);
  });

/** History → edit details. Duration is edited by moving end_time; start_time stays (it orders history). */
export const updateSessionDetails = (id: string, fields: RowPatch<'workout_sessions'>) => {
  const patch = { ...fields };
  if ('title' in patch) patch.title = patch.title?.trim() || null;
  if ('notes' in patch) patch.notes = patch.notes?.trim() || null;
  return updateRecord('workout_sessions', id, patch);
};

export const finishSession = (id: string, fields: { notes?: string | null; rpe?: number | null } = {}) =>
  write(async () => [await stageUpdate('workout_sessions', id, { end_time: Date.now(), ...fields })]);

/** Tombstones the session and its whole subtree. */
export const discardSession = (id: string) =>
  write(async () => {
    const exercises = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM session_exercises WHERE session_id = ? AND deleted_at IS NULL`,
      [id],
    );
    const sets = await db.getAllAsync<{ id: string }>(
      `SELECT s.id FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
       WHERE se.session_id = ? AND s.deleted_at IS NULL`,
      [id],
    );
    return Promise.all([
      ...sets.map((s) => stageDelete('sets', s.id)),
      ...exercises.map((e) => stageDelete('session_exercises', e.id)),
      stageDelete('workout_sessions', id),
    ]);
  });
