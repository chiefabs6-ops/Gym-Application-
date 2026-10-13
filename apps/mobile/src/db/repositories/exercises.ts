import { categoryFor, type Equipment, type MuscleGroup, type TrackingType } from '@gym/shared';
import { db } from '../client';
import { createRecord, getRecord, updateRecord } from '../mutate';
import { getUserId } from './user';

export interface ExerciseFields {
  name: string;
  primary_muscle: MuscleGroup;
  equipment: Equipment;
  /** How it's logged; the stored `category` is derived from it. */
  tracking_type: TrackingType;
}

/** Collapses whitespace so "Cable  Fly " and "Cable Fly" count as the same name. */
export const cleanExerciseName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 120);

/**
 * Name of a live, unarchived exercise (canonical or custom) that already uses this name, ignoring case,
 * or null. `exceptId` skips the exercise being edited.
 */
export async function findNameClash(name: string, exceptId: string | null = null): Promise<string | null> {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM exercise_definitions
     WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL AND archived_at IS NULL AND id <> COALESCE(?, '')`,
    [cleanExerciseName(name), exceptId],
  );
  return row?.name ?? null;
}

export async function createExercise(fields: ExerciseFields) {
  return createRecord('exercise_definitions', {
    ...fields,
    category: categoryFor(fields.tracking_type),
    name: cleanExerciseName(fields.name),
    user_id: await getUserId(),
    archived_at: null,
  });
}

/** Only custom exercises (user_id set) can be changed; canonical ones ship with the app. */
async function assertCustom(id: string) {
  const row = await getRecord('exercise_definitions', id);
  if (!row || row.user_id === null) throw new Error(`exercise_definitions/${id} is not a custom exercise`);
}

export async function updateExercise(id: string, fields: ExerciseFields) {
  await assertCustom(id);
  await updateRecord('exercise_definitions', id, {
    ...fields,
    category: categoryFor(fields.tracking_type),
    name: cleanExerciseName(fields.name),
  });
}

/** Archived exercises leave the picker but stay in history, PRs and routines that use them. */
export async function setExerciseArchived(id: string, archived: boolean) {
  await assertCustom(id);
  await updateRecord('exercise_definitions', id, { archived_at: archived ? Date.now() : null });
}
