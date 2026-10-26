import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  fromDisplayFoodAmount,
  isLateNight,
  kcalFromKj,
  parseDecimal,
  per100FromEntry,
  servingOptions,
  sumNutrients,
  per100FromServing,
  resolveLogDate,
  saltFromSodiumMg,
  scaleNutrients,
  toDisplayFoodAmount,
  toLocalDateKey,
} from '../nutrition';

const egg = { kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5, fibre_g: null, sugars_g: 0.4, sat_fat_g: 3.1, salt_g: null };

describe('nutrition', () => {
  it('scales per-100 values and keeps unknowns unknown', () => {
    expect(scaleNutrients(egg, 100)).toEqual(egg);
    const two = scaleNutrients(egg, 120);
    expect(two.kcal).toBeCloseTo(171.6);
    expect(two.protein_g).toBeCloseTo(15.12);
    expect(two.fibre_g).toBeNull();
  });

  it('converts a per-serving label to per 100 g', () => {
    expect(per100FromServing({ ...egg, kcal: 97, protein_g: 17 }, 170).kcal).toBeCloseTo(57.06, 1);
  });

  it('converts kJ and sodium', () => {
    expect(kcalFromKj(418.4)).toBeCloseTo(100);
    expect(saltFromSodiumMg(400)).toBeCloseTo(1.0);
  });

  it('converts food amounts for imperial', () => {
    expect(toDisplayFoodAmount(28.349523125, 'imperial')).toBeCloseTo(1);
    expect(fromDisplayFoodAmount(2, 'imperial')).toBeCloseTo(56.699);
    expect(toDisplayFoodAmount(150, 'metric')).toBe(150);
  });

  it('builds local date keys and handles late night', () => {
    expect(toLocalDateKey(new Date(2026, 9, 26, 23, 59))).toBe('2026-10-26');
    expect(isLateNight(new Date(2026, 9, 27, 0, 30))).toBe(true);
    expect(isLateNight(new Date(2026, 9, 27, 3, 0))).toBe(false);
    expect(resolveLogDate(new Date(2026, 9, 27, 0, 30), 'yesterday')).toBe('2026-10-26');
    expect(resolveLogDate(new Date(2026, 9, 27, 0, 30), 'today')).toBe('2026-10-27');
    expect(resolveLogDate(new Date(2026, 9, 27, 14, 0), null)).toBe('2026-10-27');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToKey('2026-10-25', 1)).toBe('2026-10-26'); // DST change in Ireland that night
  });

  it('parses typed amounts with a comma or dot, rejecting junk and negatives', () => {
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal(' 2.25 ')).toBe(2.25);
    expect(parseDecimal('3')).toBe(3);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('-1')).toBeNull();
  });

  it('lists serving options: named servings, then the base unit, then oz for imperial', () => {
    const named = [{ label: '1 large', grams: 50 }];
    expect(servingOptions(named, 'g', 'metric')).toEqual([{ label: '1 large', grams: 50 }, { label: 'g', grams: 1 }]);
    expect(servingOptions([], 'ml', 'metric')).toEqual([{ label: 'ml', grams: 1 }]);
    expect(servingOptions([], 'g', 'imperial')).toEqual([{ label: 'g', grams: 1 }, { label: 'oz', grams: 28.349523125 }]);
  });

  it('recovers per-100 values from a logged snapshot', () => {
    const per100 = per100FromEntry({ ...egg, kcal: 171.6, protein_g: 15.12 }, 120);
    expect(per100.kcal).toBeCloseTo(143);
    expect(per100.protein_g).toBeCloseTo(12.6);
    expect(per100.fibre_g).toBeNull();
  });

  it('sums calories and macros, counting unknown values as 0', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(sumNutrients([egg, { ...egg, kcal: 650, protein_g: 30, carbs_g: null, fat_g: null }])).toEqual({
      kcal: 793,
      protein_g: 42.6,
      carbs_g: 0.7,
      fat_g: 9.5,
    });
  });
});
