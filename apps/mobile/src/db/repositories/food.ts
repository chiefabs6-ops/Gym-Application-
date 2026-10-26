import {
  addDaysToKey,
  per100FromEntry,
  scaleNutrients,
  type FoodLogEntryRow,
  type FoodRow,
  type MealItem,
  type Meal,
  type Nutrients,
  type Serving,
} from '@gym/shared';
import { db } from '../client';
import { commit, createRecord, getRecord, stageCreate, stageDelete, stageUpdate, updateRecord, write, type RowPatch } from '../mutate';
import { fromSqlite } from '../rows';
import { getBuiltinFood, userFoodHit, type FoodRef, type LocalFoodHit } from './builtinFoods';
import { batchRemaining } from './recipes';
import { getUserId } from './user';

/**
 * Food diary (ROADMAP 2.15). Every entry is an absolute snapshot of what was eaten, so editing a food, saved meal or
 * recipe never changes past days. Day = `local_date`, fixed when the entry is logged.
 */
export type { FoodRef } from './builtinFoods';

export interface RecentFood {
  ref: FoodRef;
  name: string;
  serving: Serving;
  servings: number;
  kcal: number;
  protein_g: number | null;
}

const RECENT_DAYS = 30;
const FREQUENT_DAYS = 60;
const FREQUENT_LIMIT = 10;

const nutrientsOf = (n: Nutrients): Nutrients => ({
  kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g,
  fibre_g: n.fibre_g, sugars_g: n.sugars_g, sat_fat_g: n.sat_fat_g, salt_g: n.salt_g,
});
const NO_REFS = { food_id: null, builtin_food_id: null, recipe_id: null, batch_id: null };
const refColumns = (ref: FoodRef) =>
  ref.kind === 'food' ? { ...NO_REFS, kind: 'food' as const, food_id: ref.id } : { ...NO_REFS, kind: 'builtin' as const, builtin_food_id: ref.id };
const refOf = (e: Pick<FoodLogEntryRow, 'food_id' | 'builtin_food_id'>): FoodRef | null =>
  e.food_id ? { kind: 'food', id: e.food_id } : e.builtin_food_id ? { kind: 'builtin', id: e.builtin_food_id } : null;

/** UPC-A (12 digits) is EAN-13 with a leading 0; store and look up everything as EAN-13/EAN-8. */
export const normaliseBarcode = (code: string) => {
  const digits = code.replace(/\D/g, '');
  return digits.length === 12 ? `0${digits}` : digits;
};

/* ───────────────────────────── Logging ───────────────────────────── */

export async function logFood(p: { ref: FoodRef; name: string; per100: Nutrients; serving: Serving; servings: number; meal: Meal; localDate: string }): Promise<string> {
  const grams = p.serving.grams * p.servings;
  const row = await createRecord('food_log_entries', {
    user_id: await getUserId(),
    local_date: p.localDate,
    meal: p.meal,
    logged_at: Date.now(),
    ...refColumns(p.ref),
    name: p.name.slice(0, 120),
    serving_label: p.serving.label,
    servings: p.servings,
    grams,
    ...nutrientsOf(scaleNutrients(p.per100, grams)),
  });
  return row.id;
}

export async function quickAdd(p: { kcal: number; protein_g: number; name: string | null; meal: Meal; localDate: string }): Promise<string> {
  const row = await createRecord('food_log_entries', {
    user_id: await getUserId(),
    local_date: p.localDate,
    meal: p.meal,
    logged_at: Date.now(),
    kind: 'quick',
    ...NO_REFS,
    name: p.name?.trim() || 'Quick add',
    serving_label: null,
    servings: null,
    grams: null,
    kcal: p.kcal,
    protein_g: p.protein_g,
    carbs_g: null,
    fat_g: null,
    fibre_g: null,
    sugars_g: null,
    sat_fat_g: null,
    salt_g: null,
  });
  return row.id;
}

export const updateEntry = (id: string, p: { serving: Serving; servings: number; meal: Meal; per100: Nutrients }) => {
  const grams = p.serving.grams * p.servings;
  return updateRecord('food_log_entries', id, {
    meal: p.meal,
    serving_label: p.serving.label,
    servings: p.servings,
    grams,
    ...nutrientsOf(scaleNutrients(p.per100, grams)),
  });
};

export const updateQuickAdd = (id: string, p: { kcal: number; protein_g: number; name: string | null; meal: Meal }) =>
  updateRecord('food_log_entries', id, { kcal: p.kcal, protein_g: p.protein_g, name: p.name?.trim() || 'Quick add', meal: p.meal });

export const deleteEntry = (id: string) => write(async () => [await stageDelete('food_log_entries', id)]);

async function liveEntries(ids: string[]): Promise<FoodLogEntryRow[]> {
  const rows: FoodLogEntryRow[] = [];
  for (const id of ids) {
    const r = await getRecord('food_log_entries', id);
    if (r && r.deleted_at === null) rows.push(r);
  }
  return rows;
}

/** New entries with the same amounts and snapshots on another day / meal (leftover portions become plain entries). */
export async function copyEntries(ids: string[], to: { localDate: string; meal: Meal }): Promise<void> {
  const source = await liveEntries(ids);
  const now = Date.now();
  await commit(
    source.map((e, i) => {
      const { id: _id, created_at: _c, updated_at: _u, deleted_at: _d, ...fields } = e;
      // A leftover portion is copied as a normal recipe entry: same calories, takes nothing from the batch.
      const unbatched = e.batch_id ? { kind: 'recipe' as const, batch_id: null } : {};
      return stageCreate('food_log_entries', { ...fields, ...unbatched, local_date: to.localDate, meal: to.meal, logged_at: now + i });
    }),
  );
}

/* ───────────────────────────── Saved meals ───────────────────────────── */

/** Saves the foods of these entries (quick adds, recipes and batches are skipped). Returns the saved meal id. */
export async function saveMeal(name: string, entryIds: string[]): Promise<string> {
  const items: MealItem[] = (await liveEntries(entryIds))
    .filter((e) => (e.kind === 'food' || e.kind === 'builtin') && e.serving_label && e.servings && e.grams)
    .map((e) => ({
      name: e.name,
      food_id: e.food_id,
      builtin_food_id: e.builtin_food_id,
      serving_label: e.serving_label!,
      servings: e.servings!,
      grams: e.grams!,
      per100: scaleNutrients(nutrientsOf(e), 10_000 / e.grams!), // snapshot back to per 100 g
    }));
  const row = await createRecord('saved_meals', { user_id: await getUserId(), name: name.trim().slice(0, 120), items });
  return row.id;
}

/** Logs every item of a saved meal as its own, separately editable entry. */
export async function logSavedMeal(savedMealId: string, meal: Meal, localDate: string): Promise<string[]> {
  const saved = await getRecord('saved_meals', savedMealId);
  if (!saved || saved.deleted_at !== null) return [];
  const userId = await getUserId();
  const now = Date.now();
  const staged = saved.items.map((item, i) =>
    stageCreate('food_log_entries', {
      user_id: userId,
      local_date: localDate,
      meal,
      logged_at: now + i,
      ...NO_REFS,
      kind: item.food_id ? 'food' : 'builtin',
      food_id: item.food_id,
      builtin_food_id: item.builtin_food_id,
      name: item.name,
      serving_label: item.serving_label,
      servings: item.servings,
      grams: item.grams,
      ...nutrientsOf(scaleNutrients(item.per100, item.grams)),
    }),
  );
  await commit(staged);
  return staged.map((s) => s.row.id);
}

/* ───────────────────────────── History lists ───────────────────────────── */

type EntryRow = FoodLogEntryRow;
const servingOf = (e: EntryRow): Serving => ({ label: e.serving_label!, grams: e.grams! / e.servings! });
const toRecent = (e: EntryRow): RecentFood => ({
  ref: refOf(e)!,
  name: e.name,
  serving: servingOf(e),
  servings: e.servings!,
  kcal: e.kcal,
  protein_g: e.protein_g,
});
const refKey = (e: EntryRow) => (e.food_id ? `f:${e.food_id}` : `b:${e.builtin_food_id}`);

async function foodEntriesSince(fromKey: string, toKey: string, meal: Meal | null): Promise<EntryRow[]> {
  return db.getAllAsync<EntryRow>(
    `SELECT * FROM food_log_entries
     WHERE deleted_at IS NULL AND kind IN ('food', 'builtin') AND serving_label IS NOT NULL
       AND local_date >= ? AND local_date <= ? ${meal ? 'AND meal = ?' : ''}
     ORDER BY local_date DESC, logged_at DESC, rowid DESC`,
    meal ? [fromKey, toKey, meal] : [fromKey, toKey],
  );
}

/** Foods logged in this meal in the last 30 days, newest first, one row per food (its latest amount). */
export async function recentFoods(meal: Meal, todayKey: string): Promise<RecentFood[]> {
  const seen = new Set<string>();
  const out: RecentFood[] = [];
  for (const e of await foodEntriesSince(addDaysToKey(todayKey, -RECENT_DAYS), todayKey, meal)) {
    if (seen.has(refKey(e))) continue;
    seen.add(refKey(e));
    out.push(toRecent(e));
  }
  return out;
}

/** Top 10 foods by times logged over the last 60 days (any meal), with their latest amount. */
export async function frequentFoods(todayKey: string): Promise<RecentFood[]> {
  const counts = new Map<string, { n: number; latest: EntryRow }>();
  for (const e of await foodEntriesSince(addDaysToKey(todayKey, -FREQUENT_DAYS), todayKey, null)) {
    const c = counts.get(refKey(e));
    if (c) c.n++;
    else counts.set(refKey(e), { n: 1, latest: e });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, FREQUENT_LIMIT)
    .map((c) => toRecent(c.latest));
}

export async function lastServing(ref: FoodRef): Promise<{ serving: Serving; servings: number } | null> {
  const e = await db.getFirstAsync<EntryRow>(
    `SELECT * FROM food_log_entries
     WHERE deleted_at IS NULL AND serving_label IS NOT NULL AND ${ref.kind === 'food' ? 'food_id' : 'builtin_food_id'} = ?
     ORDER BY local_date DESC, logged_at DESC, rowid DESC LIMIT 1`,
    [ref.id],
  );
  return e ? { serving: servingOf(e), servings: e.servings! } : null;
}

/* ───────────────────────────── My foods ───────────────────────────── */

export interface FoodInput {
  name: string;
  brand: string | null;
  barcode: string | null;
  source: FoodRow['source'];
  basis: FoodRow['basis'];
  per100: Nutrients;
  servings: Serving[];
}

export async function createFood(input: FoodInput): Promise<FoodRow> {
  return createRecord('foods', {
    user_id: await getUserId(),
    name: input.name.trim().slice(0, 120),
    brand: input.brand?.trim() || null,
    barcode: input.barcode ? normaliseBarcode(input.barcode) : null,
    source: input.source,
    basis: input.basis,
    ...nutrientsOf(input.per100),
    servings: input.servings,
    archived_at: null,
  });
}

export const updateFood = (id: string, patch: RowPatch<'foods'>) =>
  write(async () => [await stageUpdate('foods', id, patch.barcode ? { ...patch, barcode: normaliseBarcode(patch.barcode) } : patch)]);

/** Hides the food from search and My foods; past diary entries keep their snapshots. */
export const archiveFood = (id: string) => updateRecord('foods', id, { archived_at: Date.now() });

export async function findFoodByBarcode(code: string): Promise<FoodRow | null> {
  const raw = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM foods WHERE barcode = ? AND deleted_at IS NULL AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
    [normaliseBarcode(code)],
  );
  return raw ? fromSqlite('foods', raw) : null;
}

/* ───────────────────────────── Editing a logged entry ───────────────────────────── */

export interface PortionFood {
  name: string;
  per100: Nutrients;
  servings: Serving[];
  basis: 'g' | 'ml';
}

export type EditableEntry =
  | {
      kind: 'food';
      entry: FoodLogEntryRow;
      food: PortionFood;
      initial: { serving: Serving; servings: number; meal: Meal };
      /** Recipe / batch entries are edited in grams. */
      gramsOnly: boolean;
      /** Batch entries: the most this entry can grow to (what's left + its own grams). */
      maxGrams?: number;
    }
  | { kind: 'quick'; entry: FoodLogEntryRow; quick: { kcal: number; protein_g: number; name: string; meal: Meal } };

/** What the edit sheet needs for an entry: per-100 values from its snapshot, servings from its food. */
export async function editableEntry(id: string): Promise<EditableEntry | null> {
  const entry = await getRecord('food_log_entries', id);
  if (!entry || entry.deleted_at !== null) return null;
  if (entry.kind === 'quick' || !entry.grams || !entry.servings || !entry.serving_label) {
    return { kind: 'quick', entry, quick: { kcal: entry.kcal, protein_g: entry.protein_g ?? 0, name: entry.name, meal: entry.meal } };
  }
  const per100 = per100FromEntry(nutrientsOf(entry), entry.grams);
  let servings: Serving[] = [];
  let basis: 'g' | 'ml' = 'g';
  if (entry.builtin_food_id) {
    const b = await getBuiltinFood(entry.builtin_food_id);
    if (b) ({ servings, basis } = b);
  } else if (entry.food_id) {
    const f = await getRecord('foods', entry.food_id);
    if (f) ({ servings, basis } = f);
  }
  const gramsOnly = entry.kind === 'recipe' || entry.kind === 'batch';
  return {
    kind: 'food',
    entry,
    food: { name: entry.name, per100, servings, basis },
    initial: { serving: servingOf(entry), servings: entry.servings, meal: entry.meal },
    gramsOnly,
    maxGrams: entry.kind === 'batch' && entry.batch_id ? (await batchRemaining(entry.batch_id)) + entry.grams : undefined,
  };
}

/* ───────────────────────────── Saved meal list ───────────────────────────── */

export interface SavedMealSummary {
  id: string;
  name: string;
  items: number;
  kcal: number;
  protein_g: number;
}

export async function savedMeals(): Promise<SavedMealSummary[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM saved_meals WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`);
  return rows.map((raw) => {
    const m = fromSqlite('saved_meals', raw);
    const totals = m.items.map((i) => scaleNutrients(i.per100, i.grams));
    return {
      id: m.id,
      name: m.name,
      items: m.items.length,
      kcal: totals.reduce((s, n) => s + n.kcal, 0),
      protein_g: totals.reduce((s, n) => s + (n.protein_g ?? 0), 0),
    };
  });
}

/** A recent food as a search hit: its food's current values if it still exists, else its latest logged snapshot. */
export async function recentFoodHit(r: RecentFood): Promise<LocalFoodHit> {
  if (r.ref.kind === 'builtin') {
    const b = await getBuiltinFood(r.ref.id);
    if (b) return b;
  } else {
    const f = await getRecord('foods', r.ref.id);
    if (f && f.deleted_at === null) return userFoodHit({ ...f, servings: JSON.stringify(f.servings) });
  }
  const e = await db.getFirstAsync<EntryRow>(
    `SELECT * FROM food_log_entries WHERE deleted_at IS NULL AND grams > 0 AND ${r.ref.kind === 'food' ? 'food_id' : 'builtin_food_id'} = ?
     ORDER BY local_date DESC, logged_at DESC, rowid DESC LIMIT 1`,
    [r.ref.id],
  );
  const per100 = e?.grams ? per100FromEntry(nutrientsOf(e), e.grams) : per100FromEntry({ ...nutrientsOf({ kcal: r.kcal, protein_g: r.protein_g, carbs_g: null, fat_g: null, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null }) }, r.serving.grams * r.servings);
  return { ref: r.ref, name: r.name, brand: null, basis: 'g', servings: [r.serving], per100 };
}

/** Rename a saved meal and keep only the items at `keepItems` (indexes). At least one item must stay. */
export async function updateSavedMeal(id: string, p: { name: string; keepItems: number[] }): Promise<void> {
  await write(async () => {
    const meal = await getRecord('saved_meals', id);
    if (!meal) return [];
    const items = meal.items.filter((_, i) => p.keepItems.includes(i));
    if (items.length === 0) throw new Error('A saved meal needs at least one food');
    return [await stageUpdate('saved_meals', id, { name: p.name.trim().slice(0, 120), items })];
  });
}

export const deleteSavedMeal = (id: string) => write(async () => [await stageDelete('saved_meals', id)]);
