import type { TemplateExercise } from '@gym/shared';
import { db } from '../client';
import { createRecord, deleteRecord, getRecord, stageCreate, stageUpdate, updateRecord, write } from '../mutate';
import { getUserId } from './user';

/** Trimmed folder name, or null for "no folder". */
export const cleanFolder = (folder: string | null | undefined) => folder?.trim().slice(0, 60) || null;

export async function createTemplate(
  title: string,
  exercises: TemplateExercise[],
  opts: { notes?: string | null; folder?: string | null; planDayId?: string | null } = {},
) {
  return createRecord('workout_templates', {
    user_id: await getUserId(),
    title,
    notes: opts.notes ?? null,
    folder: cleanFolder(opts.folder),
    plan_day_id: opts.planDayId ?? null,
    template_exercises: exercises,
  });
}

/** Templates sync as one LWW document: always write the full exercise list. */
export const updateTemplate = (
  id: string,
  patch: {
    title?: string;
    notes?: string | null;
    folder?: string | null;
    plan_day_id?: string | null;
    template_exercises?: TemplateExercise[];
  },
) => updateRecord('workout_templates', id, 'folder' in patch ? { ...patch, folder: cleanFolder(patch.folder) } : patch);

export const deleteTemplate = (id: string) => deleteRecord('workout_templates', id);

/** "Push (copy)", "Push (copy 2)", … : the first title not already used by a live routine. */
export async function copyTitle(title: string): Promise<string> {
  const taken = new Set(
    (await db.getAllAsync<{ title: string }>('SELECT title FROM workout_templates WHERE deleted_at IS NULL')).map((r) =>
      r.title.toLowerCase(),
    ),
  );
  const base = title.replace(/ \(copy(?: \d+)?\)$/, '').slice(0, 100);
  for (let n = 1; ; n++) {
    const candidate = `${base} (copy${n === 1 ? '' : ` ${n}`})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * New routine with the same exercises, notes and folder. `draft` (unsaved editor state) is copied instead of
 * the stored version when given. Returns the new routine's id.
 */
export async function duplicateTemplate(
  id: string,
  draft?: {
    title: string;
    notes: string | null;
    folder: string | null;
    plan_day_id?: string | null;
    template_exercises: TemplateExercise[];
  },
): Promise<string> {
  const userId = await getUserId();
  let newId = '';
  await write(async () => {
    const source = draft ?? (await getRecord('workout_templates', id));
    if (!source) throw new Error(`workout_templates/${id} not found`);
    const staged = stageCreate('workout_templates', {
      user_id: userId,
      title: await copyTitle(source.title),
      notes: source.notes,
      folder: cleanFolder(source.folder),
      plan_day_id: source.plan_day_id ?? null,
      template_exercises: source.template_exercises.map((te) => ({ ...te, sets: te.sets?.map((s) => ({ ...s })) ?? null })),
    });
    newId = staged.row.id;
    return [staged];
  });
  return newId;
}

/** Renames a folder (or merges it into another / removes it with null) on every routine in it, atomically. */
export const renameFolder = (from: string, to: string | null) =>
  write(async () => {
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM workout_templates WHERE folder = ? AND deleted_at IS NULL',
      [from],
    );
    return Promise.all(rows.map((r) => stageUpdate('workout_templates', r.id, { folder: cleanFolder(to) })));
  });

/** Distinct folder names in use, A→Z. */
export const listFolders = async () =>
  (
    await db.getAllAsync<{ folder: string }>(
      `SELECT DISTINCT folder FROM workout_templates WHERE folder IS NOT NULL AND deleted_at IS NULL
       ORDER BY folder COLLATE NOCASE`,
    )
  ).map((r) => r.folder);
