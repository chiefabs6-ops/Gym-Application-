import { beforeEach, describe, expect, it } from 'vitest';
import type { Nutrients, RecipeIngredient } from '@gym/shared';
import { db } from '../src/db/client';
import { getRecord } from '../src/db/mutate';
import { copyEntries } from '../src/db/repositories/food';
import { seedBuiltinFoods } from '../src/db/repositories/builtinFoods';
import {
  BatchOverdrawError,
  batchRemaining,
  createRecipe,
  deleteBatchEntry,
  finishBatch,
  logFromBatch,
  logRecipeOneOff,
  openBatches,
  recipePer100,
  searchRecipes,
  archiveRecipe,
  startBatch,
  updateBatchEntryGrams,
  updateRecipe,
  undoStartBatch,
} from '../src/db/repositories/recipes';
import { freshApp } from './helpers';

const n = (kcal: number, protein: number): Nutrients => ({ kcal, protein_g: protein, carbs_g: 0, fat_g: 10, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null });
const chilliIngredients: RecipeIngredient[] = [
  { name: 'Beef mince, raw', food_id: null, builtin_food_id: 'cofid:18-001', grams: 400, per100: n(250, 20) },
  { name: 'Tomatoes, canned', food_id: null, builtin_food_id: 'cofid:13-002', grams: 400, per100: n(20, 1) },
];

let recipeId: string;
beforeEach(async () => {
  await freshApp();
  await seedBuiltinFoods({ version: 'test', foods: [] });
  recipeId = await createRecipe('Chilli', chilliIngredients);
});

const liveEntries = () => db.getAllAsync<Record<string, unknown>>('SELECT * FROM food_log_entries WHERE deleted_at IS NULL');

describe('recipes', () => {
  it('per-100 g comes from ingredients and cooked weight', () => {
    const per100 = recipePer100(chilliIngredients, 600);
    expect(per100.kcal).toBeCloseTo(180); // 1,080 kcal over 600 g
    expect(per100.protein_g).toBeCloseTo(14); // 84 g over 600 g
    expect(per100.fibre_g).toBeNull();
  });

  it('one-off logs grams eaten without tracking leftovers', async () => {
    const id = await logRecipeOneOff({ recipeId, cookedWeightG: 600, gramsEaten: 300, meal: 'dinner', localDate: '2026-10-26' });
    const row = await getRecord('food_log_entries', id);
    expect(row).toMatchObject({ kind: 'recipe', recipe_id: recipeId, batch_id: null, name: 'Chilli', grams: 300 });
    expect(row!.kcal).toBeCloseTo(540);
    expect(await openBatches()).toEqual([]);
  });

  it('batch tracks what is left and finishes at 0 g', async () => {
    const { batchId, entryId } = await startBatch({ recipeId, cookedWeightG: 500, firstPortionG: 250, meal: 'dinner', localDate: '2026-10-26' });
    expect(await getRecord('food_log_entries', entryId)).toMatchObject({ kind: 'batch', batch_id: batchId, recipe_id: recipeId, grams: 250 });
    expect(await batchRemaining(batchId)).toBe(250);
    const left = await openBatches();
    expect(left).toMatchObject([{ batchId, recipeName: 'Chilli', remainingG: 250 }]);
    expect(left[0]!.per100.kcal).toBeCloseTo(216); // 1,080 / 500 g
    await logFromBatch({ batchId, grams: 250, meal: 'lunch', localDate: '2026-10-27' });
    expect(await batchRemaining(batchId)).toBe(0);
    expect((await getRecord('recipe_batches', batchId))!.finished_at).not.toBeNull();
    expect(await openBatches()).toEqual([]);
  });

  it('blocks logging more than what is left', async () => {
    const { batchId } = await startBatch({ recipeId, cookedWeightG: 500, firstPortionG: 250, meal: 'dinner', localDate: '2026-10-26' });
    const attempt = logFromBatch({ batchId, grams: 300, meal: 'lunch', localDate: '2026-10-27' });
    await expect(attempt).rejects.toBeInstanceOf(BatchOverdrawError);
    await expect(logFromBatch({ batchId, grams: 300, meal: 'lunch', localDate: '2026-10-27' })).rejects.toMatchObject({ remainingG: 250 });
    expect(await liveEntries()).toHaveLength(1);
    await expect(startBatch({ recipeId, cookedWeightG: 200, firstPortionG: 250, meal: 'dinner', localDate: '2026-10-26' })).rejects.toMatchObject({ remainingG: 200 });
  });

  it('editing or deleting a batch entry puts the amount back', async () => {
    const { batchId } = await startBatch({ recipeId, cookedWeightG: 500, firstPortionG: 250, meal: 'dinner', localDate: '2026-10-26' });
    const second = await logFromBatch({ batchId, grams: 250, meal: 'lunch', localDate: '2026-10-27' }); // now finished
    await updateBatchEntryGrams(second, 100);
    expect(await batchRemaining(batchId)).toBe(150);
    expect((await getRecord('recipe_batches', batchId))!.finished_at).toBeNull();
    expect((await getRecord('food_log_entries', second))!.kcal).toBeCloseTo(216);
    await expect(updateBatchEntryGrams(second, 300)).rejects.toMatchObject({ remainingG: 250 });
    await deleteBatchEntry(second);
    expect(await batchRemaining(batchId)).toBe(250);
    expect(await openBatches()).toMatchObject([{ batchId, remainingG: 250 }]);
  });

  it('a finished batch reopens when an entry is deleted', async () => {
    const { batchId, entryId } = await startBatch({ recipeId, cookedWeightG: 300, firstPortionG: 300, meal: 'dinner', localDate: '2026-10-26' });
    expect(await openBatches()).toEqual([]);
    await deleteBatchEntry(entryId);
    expect(await openBatches()).toMatchObject([{ batchId, remainingG: 300 }]);
  });

  it('manual finish hides the leftover', async () => {
    const { batchId } = await startBatch({ recipeId, cookedWeightG: 500, firstPortionG: 100, meal: 'dinner', localDate: '2026-10-26' });
    await finishBatch(batchId);
    expect(await openBatches()).toEqual([]);
    expect(await batchRemaining(batchId)).toBe(400);
  });

  it('editing the recipe never changes past entries or open batches', async () => {
    const one = await logRecipeOneOff({ recipeId, cookedWeightG: 600, gramsEaten: 300, meal: 'dinner', localDate: '2026-10-26' });
    const { batchId } = await startBatch({ recipeId, cookedWeightG: 500, firstPortionG: 100, meal: 'dinner', localDate: '2026-10-26' });
    await updateRecipe(recipeId, { name: 'Chilli v2', ingredients: [chilliIngredients[0]!] });
    expect((await getRecord('food_log_entries', one))!.kcal).toBeCloseTo(540);
    expect((await openBatches())[0]).toMatchObject({ recipeName: 'Chilli v2' });
    expect((await openBatches())[0]!.per100.kcal).toBeCloseTo(216);
    expect(await batchRemaining(batchId)).toBe(400);
  });

  it('finds recipes by name and leaves out archived ones', async () => {
    const soup = await createRecipe('Lentil soup', chilliIngredients);
    expect((await searchRecipes('chil')).map((r) => r.name)).toEqual(['Chilli']);
    expect((await searchRecipes('')).map((r) => r.name)).toEqual(['Chilli', 'Lentil soup']);
    await archiveRecipe(soup);
    expect((await searchRecipes('soup'))).toEqual([]);
  });

  it('a batch finished by hand stays finished when a portion is edited or deleted', async () => {
    const { batchId, entryId } = await startBatch({ recipeId, cookedWeightG: 500, firstPortionG: 200, meal: 'dinner', localDate: '2026-10-26' });
    await finishBatch(batchId);
    await updateBatchEntryGrams(entryId, 150);
    expect(await openBatches()).toEqual([]);
    await deleteBatchEntry(entryId);
    expect(await openBatches()).toEqual([]);
  });

  it('copying a batch portion makes a normal entry that takes nothing from the batch', async () => {
    const { batchId, entryId } = await startBatch({ recipeId, cookedWeightG: 600, firstPortionG: 400, meal: 'lunch', localDate: '2026-10-26' });
    await copyEntries([entryId], { localDate: '2026-10-27', meal: 'lunch' });
    expect(await batchRemaining(batchId)).toBe(200);
    const copy = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM food_log_entries WHERE local_date = '2026-10-27' AND deleted_at IS NULL`);
    expect(copy).toMatchObject({ kind: 'recipe', batch_id: null, recipe_id: recipeId, grams: 400 });
  });

  it('undoing a new batch removes its first portion and the batch', async () => {
    const { batchId, entryId } = await startBatch({ recipeId, cookedWeightG: 500, firstPortionG: 200, meal: 'dinner', localDate: '2026-10-26' });
    await undoStartBatch(batchId, entryId);
    expect(await openBatches()).toEqual([]);
    expect(await liveEntries()).toEqual([]);
    expect((await getRecord('recipe_batches', batchId))!.deleted_at).not.toBeNull();
  });
});
