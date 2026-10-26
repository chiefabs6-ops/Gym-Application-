import {
  NUTRIENT_KEYS,
  scaleNutrients,
  type Meal,
  type NutrientKey,
  type Nutrients,
  type RecipeBatchRow,
  type RecipeIngredient,
} from '@gym/shared';
import { db } from '../client';
import { createRecord, getRecord, stageCreate, stageDelete, stageUpdate, updateRecord, write, type RowPatch } from '../mutate';
import { getUserId } from './user';

/**
 * Recipes and batches (ROADMAP 2.15, spec §7). A recipe is raw ingredients; each cooking asks "one-off or batch".
 * A batch stores the cooked weight and per-100 g values; what's left is CALCULATED (cooked weight − grams logged
 * from it), so editing or deleting an entry puts the amount back. Logging more than what's left is refused.
 */

export class BatchOverdrawError extends Error {
  constructor(readonly remainingG: number) {
    super(`Only ${Math.round(remainingG)} g left in this batch`);
    this.name = 'BatchOverdrawError';
  }
}

export interface Leftover {
  batchId: string;
  recipeName: string;
  remainingG: number;
  per100: Nutrients;
}

const EPS = 1e-6;
const GRAM_SERVING = 'g';

const nutrientsOf = (n: Nutrients): Nutrients => ({
  kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g,
  fibre_g: n.fibre_g, sugars_g: n.sugars_g, sat_fat_g: n.sat_fat_g, salt_g: n.salt_g,
});

/** Σ ingredient nutrients ÷ cooked weight × 100. A nutrient unknown for any ingredient is unknown for the dish. */
export function recipePer100(ingredients: RecipeIngredient[], cookedWeightG: number): Nutrients {
  const out = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sugars_g: 0, sat_fat_g: 0, salt_g: 0 } as Record<NutrientKey, number | null>;
  for (const ing of ingredients) {
    const part = scaleNutrients(ing.per100, ing.grams);
    for (const key of NUTRIENT_KEYS) {
      const v = part[key];
      out[key] = out[key] === null || v === null ? null : (out[key] as number) + v;
    }
  }
  for (const key of NUTRIENT_KEYS) if (out[key] !== null) out[key] = ((out[key] as number) / cookedWeightG) * 100;
  return out as Nutrients;
}

export async function createRecipe(name: string, ingredients: RecipeIngredient[]): Promise<string> {
  const row = await createRecord('recipes', { user_id: await getUserId(), name: name.trim().slice(0, 120), ingredients, archived_at: null });
  return row.id;
}

export const updateRecipe = (id: string, patch: RowPatch<'recipes'>) => updateRecord('recipes', id, patch);
export const archiveRecipe = (id: string) => updateRecord('recipes', id, { archived_at: Date.now() });

async function requireRecipe(recipeId: string) {
  const recipe = await getRecord('recipes', recipeId);
  if (!recipe || recipe.deleted_at !== null) throw new Error(`recipe ${recipeId} not found`);
  return recipe;
}

const entryFields = async (p: { meal: Meal; localDate: string; name: string; grams: number; per100: Nutrients }) => ({
  user_id: await getUserId(),
  local_date: p.localDate,
  meal: p.meal,
  logged_at: Date.now(),
  food_id: null,
  builtin_food_id: null,
  name: p.name.slice(0, 120),
  serving_label: GRAM_SERVING,
  servings: p.grams,
  grams: p.grams,
  ...nutrientsOf(scaleNutrients(p.per100, p.grams)),
});

/** One-off: logged once from the cooked weight, nothing tracked afterwards. */
export async function logRecipeOneOff(p: { recipeId: string; cookedWeightG: number; gramsEaten: number; meal: Meal; localDate: string }): Promise<string> {
  const recipe = await requireRecipe(p.recipeId);
  const per100 = recipePer100(recipe.ingredients, p.cookedWeightG);
  const row = await createRecord('food_log_entries', {
    ...(await entryFields({ meal: p.meal, localDate: p.localDate, name: recipe.name, grams: p.gramsEaten, per100 })),
    kind: 'recipe',
    recipe_id: recipe.id,
    batch_id: null,
  });
  return row.id;
}

/** Logged grams of a batch's live entries, optionally leaving one entry out. */
async function loggedFromBatch(batchId: string, exceptEntryId: string | null = null): Promise<number> {
  const r = await db.getFirstAsync<{ g: number | null }>(
    `SELECT SUM(grams) AS g FROM food_log_entries WHERE batch_id = ? AND deleted_at IS NULL AND id <> COALESCE(?, '')`,
    [batchId, exceptEntryId],
  );
  return r?.g ?? 0;
}

export async function batchRemaining(batchId: string): Promise<number> {
  const batch = await getRecord('recipe_batches', batchId);
  if (!batch) return 0;
  return Math.max(0, batch.cooked_weight_g - (await loggedFromBatch(batchId)));
}

const per100OfBatch = (b: RecipeBatchRow): Nutrients => nutrientsOf(b);

export async function startBatch(p: { recipeId: string; cookedWeightG: number; firstPortionG: number; meal: Meal; localDate: string }): Promise<{ batchId: string; entryId: string }> {
  if (p.firstPortionG > p.cookedWeightG + EPS) throw new BatchOverdrawError(p.cookedWeightG);
  const recipe = await requireRecipe(p.recipeId);
  const per100 = recipePer100(recipe.ingredients, p.cookedWeightG);
  const finished = p.cookedWeightG - p.firstPortionG <= EPS;
  const batch = stageCreate('recipe_batches', {
    user_id: await getUserId(),
    recipe_id: recipe.id,
    cooked_weight_g: p.cookedWeightG,
    ...per100,
    finished_at: finished ? Date.now() : null,
  });
  const entry = stageCreate('food_log_entries', {
    ...(await entryFields({ meal: p.meal, localDate: p.localDate, name: recipe.name, grams: p.firstPortionG, per100 })),
    kind: 'batch',
    recipe_id: recipe.id,
    batch_id: batch.row.id,
  });
  await write(() => [batch, entry]);
  return { batchId: batch.row.id, entryId: entry.row.id };
}

export async function logFromBatch(p: { batchId: string; grams: number; meal: Meal; localDate: string }): Promise<string> {
  let entryId = '';
  await write(async () => {
    const batch = await getRecord('recipe_batches', p.batchId);
    if (!batch || batch.deleted_at !== null) throw new Error(`batch ${p.batchId} not found`);
    const remaining = batch.cooked_weight_g - (await loggedFromBatch(p.batchId));
    if (p.grams > remaining + EPS) throw new BatchOverdrawError(Math.max(0, remaining));
    const recipe = await getRecord('recipes', batch.recipe_id);
    const entry = stageCreate('food_log_entries', {
      ...(await entryFields({ meal: p.meal, localDate: p.localDate, name: recipe?.name ?? 'Recipe', grams: p.grams, per100: per100OfBatch(batch) })),
      kind: 'batch',
      recipe_id: batch.recipe_id,
      batch_id: batch.id,
    });
    entryId = entry.row.id;
    const nowFinished = remaining - p.grams <= EPS;
    return [entry, nowFinished ? await stageUpdate('recipe_batches', batch.id, { finished_at: Date.now() }) : null];
  });
  return entryId;
}

/** Changes the grams of an entry that came from a batch; the difference goes back into (or out of) the batch. */
export async function updateBatchEntryGrams(entryId: string, grams: number, changes: { meal?: Meal } = {}): Promise<void> {
  await write(async () => {
    const entry = await getRecord('food_log_entries', entryId);
    if (!entry?.batch_id) throw new Error(`entry ${entryId} is not from a batch`);
    const batch = await getRecord('recipe_batches', entry.batch_id);
    if (!batch) throw new Error(`batch ${entry.batch_id} not found`);
    const available = batch.cooked_weight_g - (await loggedFromBatch(batch.id, entryId));
    if (grams > available + EPS) throw new BatchOverdrawError(Math.max(0, available));
    const left = available - grams;
    // A batch the user finished by hand (binned) stays finished; one finished by reaching 0 g reopens.
    const finishedByHand = batch.finished_at !== null && available - (entry.grams ?? 0) > EPS;
    const finishedAt = finishedByHand ? batch.finished_at : left <= EPS ? (batch.finished_at ?? Date.now()) : null;
    return [
      await stageUpdate('food_log_entries', entryId, {
        ...changes,
        servings: grams,
        grams,
        ...nutrientsOf(scaleNutrients(per100OfBatch(batch), grams)),
      }),
      finishedAt !== batch.finished_at ? await stageUpdate('recipe_batches', batch.id, { finished_at: finishedAt }) : null,
    ];
  });
}

/** Deletes an entry from a batch; its grams go back (a batch emptied to 0 g reopens; a binned one stays finished). */
export async function deleteBatchEntry(entryId: string): Promise<void> {
  await write(async () => {
    const entry = await getRecord('food_log_entries', entryId);
    const batch = entry?.batch_id ? await getRecord('recipe_batches', entry.batch_id) : null;
    // Reopen only a batch that finished by reaching 0 g, not one the user binned by hand.
    const finishedAtZero = batch !== null && batch.finished_at !== null && (await loggedFromBatch(batch.id)) >= batch.cooked_weight_g - EPS;
    return [
      await stageDelete('food_log_entries', entryId),
      batch && finishedAtZero ? await stageUpdate('recipe_batches', batch.id, { finished_at: null }) : null,
    ];
  });
}

/** Undo of "Batch" on the add-food screen: removes the first portion and the batch it started. */
export const undoStartBatch = (batchId: string, entryId: string) =>
  write(async () => [await stageDelete('food_log_entries', entryId), await stageDelete('recipe_batches', batchId)]);

/** Manual finish (binned / given away): the leftover disappears from the quick options. */
export const finishBatch = (batchId: string) => updateRecord('recipe_batches', batchId, { finished_at: Date.now() });

export async function openBatches(): Promise<Leftover[]> {
  const rows = await db.getAllAsync<RecipeBatchRow & { recipe_name: string | null; logged: number | null }>(
    `SELECT b.*, r.name AS recipe_name,
            (SELECT SUM(e.grams) FROM food_log_entries e WHERE e.batch_id = b.id AND e.deleted_at IS NULL) AS logged
     FROM recipe_batches b LEFT JOIN recipes r ON r.id = b.recipe_id
     WHERE b.deleted_at IS NULL AND b.finished_at IS NULL
     ORDER BY b.created_at DESC`,
  );
  return rows
    .map((b) => ({ batchId: b.id, recipeName: b.recipe_name ?? 'Recipe', remainingG: b.cooked_weight_g - (b.logged ?? 0), per100: per100OfBatch(b) }))
    .filter((l) => l.remainingG > EPS);
}

/** Live, unarchived recipes whose name contains the query (all of them for an empty query), A–Z. */
export async function searchRecipes(query: string): Promise<{ id: string; name: string }[]> {
  return db.getAllAsync(
    `SELECT id, name FROM recipes WHERE deleted_at IS NULL AND archived_at IS NULL AND name LIKE ? ORDER BY name COLLATE NOCASE LIMIT 50`,
    [`%${query.trim()}%`],
  );
}
