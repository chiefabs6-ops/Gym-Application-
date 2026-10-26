import { beforeEach, describe, expect, it } from 'vitest';
import { resolveLogDate, type Nutrients } from '@gym/shared';
import { db } from '../src/db/client';
import { getRecord } from '../src/db/mutate';
import { seedBuiltinFoods } from '../src/db/repositories/builtinFoods';
import {
  archiveFood,
  copyEntries,
  createFood,
  deleteEntry,
  editableEntry,
  findFoodByBarcode,
  frequentFoods,
  lastServing,
  logFood,
  logSavedMeal,
  normaliseBarcode,
  quickAdd,
  recentFoods,
  recentFoodHit,
  saveMeal,
  savedMeals,
  updateSavedMeal,
  deleteSavedMeal,
  updateEntry,
  updateFood,
  updateQuickAdd,
} from '../src/db/repositories/food';
import { freshApp } from './helpers';

const zero: Nutrients = { kcal: 0, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null };
const eggPer100: Nutrients = { ...zero, kcal: 131, protein_g: 12.6, carbs_g: 0, fat_g: 9 };
const toastPer100: Nutrients = { ...zero, kcal: 250, protein_g: 10, carbs_g: 42, fat_g: 3 };
const EGG = { kind: 'builtin', id: 'cofid:12-937' } as const;
const TOAST = { kind: 'builtin', id: 'cofid:11-999' } as const;
const egg = { label: '1 egg', grams: 50 };
const slice = { label: '1 slice', grams: 36 };
const TODAY = '2026-10-26';

const live = async () =>
  db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM food_log_entries WHERE deleted_at IS NULL ORDER BY logged_at, rowid',
  );

beforeEach(async () => {
  await freshApp();
  await seedBuiltinFoods({
    version: 'test',
    foods: [{ id: 'cofid:12-937', name: 'Eggs, chicken, whole, raw', name_search: 'eggs chicken whole raw', source: 'cofid', basis: 'g', ...eggPer100, servings: [{ label: '1 egg', grams: 50 }] }],
  });
});

describe('food diary', () => {
  it('logs a food as a snapshot of its nutrients for the amount eaten', async () => {
    const id = await logFood({ ref: EGG, name: 'Eggs, chicken, whole, raw', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: TODAY });
    const row = await getRecord('food_log_entries', id);
    expect(row).toMatchObject({ kind: 'builtin', builtin_food_id: 'cofid:12-937', food_id: null, grams: 100, servings: 2, serving_label: '1 egg', meal: 'breakfast', local_date: TODAY });
    expect(row!.kcal).toBeCloseTo(131);
    expect(row!.protein_g).toBeCloseTo(12.6);
    expect(row!.fibre_g).toBeNull();
  });

  it('snapshots nutrients so editing the food never changes past entries', async () => {
    const f = await createFood({ name: 'Granola', brand: null, barcode: null, source: 'custom', basis: 'g', per100: { ...zero, kcal: 450, protein_g: 10, carbs_g: 60, fat_g: 18 }, servings: [{ label: '1 bowl', grams: 50 }] });
    const id = await logFood({ ref: { kind: 'food', id: f.id }, name: 'Granola', per100: { ...zero, kcal: 450, protein_g: 10, carbs_g: 60, fat_g: 18 }, serving: { label: '1 bowl', grams: 50 }, servings: 2, meal: 'breakfast', localDate: TODAY });
    await updateFood(f.id, { kcal: 500 });
    expect(await getRecord('food_log_entries', id)).toMatchObject({ kind: 'food', food_id: f.id, grams: 100, kcal: 450, protein_g: 10 });
    expect(await getRecord('foods', f.id)).toMatchObject({ kcal: 500 });
  });

  it('quick add stores calories and protein only', async () => {
    const id = await quickAdd({ kcal: 650, protein_g: 30, name: null, meal: 'lunch', localDate: TODAY });
    expect(await getRecord('food_log_entries', id)).toMatchObject({ kind: 'quick', name: 'Quick add', kcal: 650, protein_g: 30, carbs_g: null, fat_g: null, grams: null, servings: null, serving_label: null });
    await updateQuickAdd(id, { kcal: 700, protein_g: 35, name: 'Burrito', meal: 'dinner' });
    expect(await getRecord('food_log_entries', id)).toMatchObject({ name: 'Burrito', kcal: 700, protein_g: 35, meal: 'dinner' });
  });

  it('editing an entry recalculates its snapshot from the amount', async () => {
    const id = await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: TODAY });
    await updateEntry(id, { serving: egg, servings: 3, meal: 'lunch', per100: eggPer100 });
    const row = await getRecord('food_log_entries', id);
    expect(row).toMatchObject({ grams: 150, servings: 3, meal: 'lunch' });
    expect(row!.kcal).toBeCloseTo(196.5);
  });

  it('copies a whole meal or picked items to another day', async () => {
    const a = await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: TODAY });
    const b = await logFood({ ref: TOAST, name: 'Toast', per100: toastPer100, serving: slice, servings: 2, meal: 'breakfast', localDate: TODAY });
    await copyEntries([a], { localDate: '2026-10-27', meal: 'lunch' });
    await copyEntries([a, b], { localDate: '2026-10-28', meal: 'breakfast' });
    const rows = await live();
    expect(rows).toHaveLength(5);
    expect(rows.filter((r) => r.local_date === '2026-10-27')).toMatchObject([{ name: 'Egg', meal: 'lunch', grams: 100 }]);
    expect(rows.filter((r) => r.local_date === '2026-10-28').map((r) => r.name)).toEqual(['Egg', 'Toast']);
    expect(await getRecord('food_log_entries', a)).toMatchObject({ local_date: TODAY, meal: 'breakfast' });
  });

  it('saved meal logs its foods as separate entries, skipping quick adds', async () => {
    const a = await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: TODAY });
    const b = await logFood({ ref: TOAST, name: 'Toast', per100: toastPer100, serving: slice, servings: 2, meal: 'breakfast', localDate: TODAY });
    const q = await quickAdd({ kcal: 40, protein_g: 2, name: 'Coffee', meal: 'breakfast', localDate: TODAY });
    const mealId = await saveMeal('Eggs on toast', [a, b, q]);
    expect((await getRecord('saved_meals', mealId))!.items).toHaveLength(2);
    const ids = await logSavedMeal(mealId, 'lunch', '2026-10-27');
    expect(ids).toHaveLength(2);
    const copies = (await live()).filter((r) => r.local_date === '2026-10-27');
    expect(copies).toMatchObject([{ name: 'Egg', grams: 100, servings: 2, meal: 'lunch' }, { name: 'Toast', grams: 72, servings: 2, meal: 'lunch' }]);
    expect(copies[0]!.kcal as number).toBeCloseTo(131);
  });

  it('remembers the last serving per food', async () => {
    await logFood({ ref: TOAST, name: 'Toast', per100: toastPer100, serving: slice, servings: 2, meal: 'breakfast', localDate: '2026-10-25' });
    await logFood({ ref: TOAST, name: 'Toast', per100: toastPer100, serving: slice, servings: 3, meal: 'breakfast', localDate: TODAY });
    expect(await lastServing(TOAST)).toEqual({ serving: slice, servings: 3 });
    expect(await lastServing(EGG)).toBeNull();
  });

  it('lists recent foods for the meal, newest first, one row per food, last 30 days', async () => {
    await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 1, meal: 'breakfast', localDate: '2026-09-20' }); // > 30 days
    await logFood({ ref: TOAST, name: 'Toast', per100: toastPer100, serving: slice, servings: 1, meal: 'breakfast', localDate: '2026-10-20' });
    await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: '2026-10-24' });
    await logFood({ ref: TOAST, name: 'Toast', per100: toastPer100, serving: slice, servings: 2, meal: 'lunch', localDate: TODAY });
    const recent = await recentFoods('breakfast', TODAY);
    expect(recent.map((r) => [r.name, r.servings])).toEqual([['Egg', 2], ['Toast', 1]]);
    expect(recent[0]).toMatchObject({ ref: EGG, serving: egg });
    expect(recent[0]!.kcal).toBeCloseTo(131);
  });

  it('lists the most frequent foods over the last 60 days', async () => {
    for (const d of ['2026-10-20', '2026-10-21', '2026-10-22']) {
      await logFood({ ref: TOAST, name: 'Toast', per100: toastPer100, serving: slice, servings: 1, meal: 'breakfast', localDate: d });
    }
    await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 1, meal: 'dinner', localDate: '2026-10-22' });
    expect((await frequentFoods(TODAY)).map((r) => r.name)).toEqual(['Toast', 'Egg']);
  });

  it('delete is a tombstone', async () => {
    const id = await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 1, meal: 'breakfast', localDate: TODAY });
    await deleteEntry(id);
    expect(await live()).toHaveLength(0);
    expect((await getRecord('food_log_entries', id))!.deleted_at).not.toBeNull();
  });

  it('finds my food by barcode, normalising UPC-A, and ignores archived foods', async () => {
    expect(normaliseBarcode('012345678905')).toBe('0012345678905');
    expect(normaliseBarcode('5000159484695')).toBe('5000159484695');
    const f = await createFood({ name: 'Yogurt', brand: null, barcode: '012345678905', source: 'label', basis: 'g', per100: { ...zero, kcal: 57, protein_g: 10 }, servings: [] });
    expect((await findFoodByBarcode('0012345678905'))?.id).toBe(f.id);
    await archiveFood(f.id);
    expect(await findFoodByBarcode('012345678905')).toBeNull();
  });

  it('logs a late-night entry on the chosen day', async () => {
    const id = await quickAdd({ kcal: 200, protein_g: 5, name: null, meal: 'snacks', localDate: resolveLogDate(new Date(2026, 9, 27, 0, 30), 'yesterday') });
    expect((await getRecord('food_log_entries', id))?.local_date).toBe('2026-10-26');
  });

  it('prepares a logged entry for the edit sheet with its food servings and per-100 values', async () => {
    const id = await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: TODAY });
    const e = await editableEntry(id);
    expect(e).toMatchObject({ kind: 'food', gramsOnly: false, initial: { serving: egg, servings: 2, meal: 'breakfast' } });
    if (e?.kind !== 'food') throw new Error('expected a food entry');
    expect(e.food.servings).toEqual([egg]);
    expect(e.food.per100.kcal).toBeCloseTo(131);
    const q = await quickAdd({ kcal: 650, protein_g: 30, name: 'Burrito', meal: 'lunch', localDate: TODAY });
    expect(await editableEntry(q)).toMatchObject({ kind: 'quick', quick: { kcal: 650, protein_g: 30, name: 'Burrito', meal: 'lunch' } });
  });

  it('lists saved meals with their totals', async () => {
    const a = await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: TODAY });
    await saveMeal('Two eggs', [a]);
    const meals = await savedMeals();
    expect(meals).toMatchObject([{ name: 'Two eggs', items: 1 }]);
    expect(meals[0]!.kcal).toBeCloseTo(131);
    expect(meals[0]!.protein_g).toBeCloseTo(12.6);
  });

  it('resolves a recent food to its current food, falling back to the logged snapshot', async () => {
    await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: TODAY });
    const [r] = await recentFoods('breakfast', TODAY);
    expect(await recentFoodHit(r!)).toMatchObject({ ref: EGG, name: 'Eggs, chicken, whole, raw', servings: [egg] });
    const gone = { ...r!, ref: { kind: 'builtin' as const, id: 'cofid:removed' } };
    const hit = await recentFoodHit(gone);
    expect(hit.per100.kcal).toBeCloseTo(131);
    expect(hit.servings).toEqual([egg]);
  });

  it('renames a saved meal, drops items, and deletes it without touching logged entries', async () => {
    const a = await logFood({ ref: EGG, name: 'Egg', per100: eggPer100, serving: egg, servings: 2, meal: 'breakfast', localDate: TODAY });
    const b = await logFood({ ref: TOAST, name: 'Toast', per100: toastPer100, serving: slice, servings: 2, meal: 'breakfast', localDate: TODAY });
    const id = await saveMeal('Eggs on toast', [a, b]);
    await updateSavedMeal(id, { name: 'Just eggs', keepItems: [0] });
    expect(await getRecord('saved_meals', id)).toMatchObject({ name: 'Just eggs', items: [{ name: 'Egg' }] });
    await deleteSavedMeal(id);
    expect(await savedMeals()).toEqual([]);
    expect(await live()).toHaveLength(2);
  });
});
