import { describe, expect, it } from 'vitest';
import { ageOn, bmrMifflinStJeor, calculateTargets, checkMacroOverrides, cmToFeetInches, feetInchesToCm, maintenanceKcal, resolveTargets } from '../targets';
import { parseSettings } from '../settings';

const male = { birth_date: '1996-01-01', sex: 'male', height_cm: 180, activity: 'moderate' } as const; // 1.55
const sumKcal = (t: { protein_g: number; carbs_g: number; fat_g: number }) => 4 * t.protein_g + 4 * t.carbs_g + 9 * t.fat_g;
const loseHalf = { kind: 'lose', rate_kg_per_week: 0.5 } as const;

describe('targets', () => {
  it('works out age from birth date', () => {
    expect(ageOn('1996-01-01', '2026-10-26')).toBe(30);
    expect(ageOn('1996-10-27', '2026-10-26')).toBe(29);
  });

  it('uses Mifflin-St Jeor', () => {
    expect(bmrMifflinStJeor({ sex: 'male', weight_kg: 80, height_cm: 180, age: 30 })).toBe(1780);
    expect(bmrMifflinStJeor({ sex: 'female', weight_kg: 50, height_cm: 160, age: 40 })).toBe(1139);
  });

  it('calculates calories and macros that add up', () => {
    const t = calculateTargets(male, loseHalf, 80, '2026-10-26');
    expect(t).toEqual({ kcal: 2209, protein_g: 160, fat_g: 61, carbs_g: 255 });
    expect(Math.abs(sumKcal(t) - t.kcal)).toBeLessThanOrEqual(4);
  });

  it('never goes below the minimum', () => {
    const f = { birth_date: '1986-01-01', sex: 'female', height_cm: 160, activity: 'sedentary' } as const;
    const t = calculateTargets(f, { kind: 'lose', rate_kg_per_week: 1 }, 50, '2026-10-26');
    expect(t.kcal).toBe(1200);
    expect(t).toMatchObject({ protein_g: 100, fat_g: 33, carbs_g: 126 });
  });

  it('halves fat when carbs would go negative', () => {
    const m = { birth_date: '1956-01-01', sex: 'male', height_cm: 165, activity: 'sedentary' } as const;
    const t = calculateTargets(m, { kind: 'lose', rate_kg_per_week: 1 }, 150, '2026-10-26');
    expect(t).toEqual({ kcal: 1524, protein_g: 300, fat_g: 21, carbs_g: 34 });
  });

  it('recalculates macros from hand-edited calories, clamped to the minimum', () => {
    const calc = calculateTargets(male, loseHalf, 80, '2026-10-26');
    expect(resolveTargets(calc, { kcal: 2000 }, { sex: 'male', weight_kg: 80 })).toEqual({ kcal: 2000, protein_g: 160, fat_g: 56, carbs_g: 214 });
    expect(resolveTargets(calc, { kcal: 900 }, { sex: 'male', weight_kg: 80 }).kcal).toBe(1500);
  });

  it('keeps a hand-edited macro and makes room with the others', () => {
    const calc = calculateTargets(male, loseHalf, 80, '2026-10-26');
    const t = resolveTargets(calc, { carbs_g: 300 }, { sex: 'male', weight_kg: 80 });
    expect(t).toEqual({ kcal: 2209, protein_g: 160, carbs_g: 300, fat_g: 41 });
  });

  it('lets calories follow when all three macros are edited, and rejects totals under the minimum', () => {
    const calc = calculateTargets(male, loseHalf, 80, '2026-10-26');
    expect(resolveTargets(calc, { protein_g: 180, carbs_g: 200, fat_g: 70 }, { sex: 'male', weight_kg: 80 })).toEqual({ kcal: 2150, protein_g: 180, carbs_g: 200, fat_g: 70 });
    expect(checkMacroOverrides({ protein_g: 100, carbs_g: 100, fat_g: 40 }, 'male')).toEqual({ ok: false, kcal: 1160, min: 1500 });
    expect(checkMacroOverrides({ protein_g: 180, carbs_g: 200, fat_g: 70 }, 'male')).toEqual({ ok: true });
  });

  it('parses missing or broken nutrition settings as null', () => {
    expect(parseSettings({}).nutrition).toBeNull();
    expect(parseSettings({ nutrition: { profile: 'x' } }).nutrition).toBeNull();
  });

  it('converts height between cm and feet/inches', () => {
    expect(feetInchesToCm(5, 11)).toBeCloseTo(180.34);
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 });
    expect(cmToFeetInches(152.4)).toEqual({ feet: 5, inches: 0 });
  });

  it('shows maintenance as Mifflin-St Jeor × activity', () => {
    expect(maintenanceKcal(male, 80, '2026-10-26')).toBe(2759);
  });
});
