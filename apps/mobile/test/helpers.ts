import { resetTestDatabase } from './mocks/expoSqlite';
import { db } from '../src/db/client';
import { initDatabase } from '../src/db/migrations';
import { ensureLocalUser } from '../src/db/repositories/user';
import * as workouts from '../src/db/repositories/workouts';
import { useSettingsStore } from '../src/state/settingsStore';

/** Fresh empty database, migrated and seeded, with a new local user (like a first app launch). */
export async function freshApp(): Promise<string> {
  resetTestDatabase();
  await initDatabase();
  const userId = await ensureLocalUser();
  await useSettingsStore.getState().load();
  return userId;
}

export const BENCH = '00000000-0000-4000-8000-000000000001';
export const SQUAT = '00000000-0000-4000-8000-000000000015';

export interface LoggedSet {
  weight: number | null;
  reps: number | null;
  type?: 'warmup' | 'working' | 'drop' | 'failure';
  done?: boolean;
}

/**
 * Logs a workout through the real repositories: one exercise with the given sets.
 * Returns ids so tests can act on individual sets. Leaves the session open unless `finish`.
 */
export async function logWorkout(exerciseId: string, sets: LoggedSet[], { finish = true } = {}) {
  const sessionId = await workouts.startSession({ title: 'Test' });
  await workouts.addExerciseToSession(sessionId, exerciseId); // creates 1 empty set
  const se = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM session_exercises WHERE session_id = ? AND deleted_at IS NULL',
    [sessionId],
  );
  for (let i = 1; i < sets.length; i++) await workouts.addSet(se!.id);
  const setRows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY order_index',
    [se!.id],
  );
  for (const [i, s] of sets.entries()) {
    const id = setRows[i]!.id;
    await workouts.updateSet(id, { weight_kg: s.weight, reps: s.reps, set_type: s.type ?? 'working' });
    if (s.done ?? true) await workouts.setCompleted(id, true);
  }
  if (finish) await workouts.finishSession(sessionId);
  return { sessionId, sessionExerciseId: se!.id, setIds: setRows.map((r) => r.id) };
}

/** All live rows of a table, as plain objects ordered by id. */
export const rows = (table: string) => db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`);
