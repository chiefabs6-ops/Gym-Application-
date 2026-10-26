import { beforeEach, describe, expect, it } from 'vitest';
import { seedBuiltinFoods } from '../src/db/repositories/builtinFoods';
import { logWeight, saveProfileAndGoal } from '../src/db/repositories/body';
import { deleteEntry, quickAdd } from '../src/db/repositories/food';
import { chartDays, dailyTotals, weekRange, weeklyAverages, weightVsCalories } from '../src/db/repositories/nutritionStats';
import { freshApp } from './helpers';

const TODAY = '2026-10-26';
const male = { birth_date: '1996-01-01', sex: 'male', height_cm: 180, activity: 'moderate' } as const;
const add = (localDate: string, kcal: number, protein = 20) => quickAdd({ kcal, protein_g: protein, name: null, meal: 'lunch', localDate });

beforeEach(async () => {
  await freshApp();
  await seedBuiltinFoods({ version: 'test', foods: [] });
});

describe('nutrition stats', () => {
  it('"this week" is the last 7 days including today', () => {
    expect(weekRange(TODAY)).toEqual({ from: '2026-10-20', to: '2026-10-26' });
  });

  it('daily totals skip deleted entries', async () => {
    await add('2026-10-25', 500);
    const gone = await add('2026-10-25', 300);
    await add(TODAY, 700, 40);
    await deleteEntry(gone);
    expect(await dailyTotals('2026-10-20', TODAY)).toEqual([
      { local_date: '2026-10-25', kcal: 500, protein_g: 20, carbs_g: 0, fat_g: 0 },
      { local_date: TODAY, kcal: 700, protein_g: 40, carbs_g: 0, fat_g: 0 },
    ]);
  });

  it('weekly averages count logged days only', async () => {
    await add('2026-10-21', 2000, 150);
    await add('2026-10-24', 1000, 100);
    await add('2026-10-10', 9999); // outside the 7 days
    expect(await weeklyAverages(TODAY)).toEqual({ days: 2, kcal: 1500, protein_g: 125, carbs_g: 0, fat_g: 0 });
  });

  it('compares each day with the targets in effect that day', async () => {
    await logWeight(80, '2026-10-01', '2026-10-01');
    await saveProfileAndGoal(male, { kind: 'lose', rate_kg_per_week: 0.5 }, '2026-10-01');
    await saveProfileAndGoal(male, { kind: 'maintain', rate_kg_per_week: 0 }, '2026-10-24');
    const days = await chartDays(TODAY);
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ local_date: '2026-10-20', kcal: 0 });
    expect(days.find((d) => d.local_date === '2026-10-23')!.target!.kcal).toBe(2209);
    expect(days.find((d) => d.local_date === '2026-10-24')!.target!.kcal).toBe(2759);
  });

  it('weight vs calories gives 8 weeks, oldest first, with gaps as null', async () => {
    await add(TODAY, 2000);
    await add('2026-10-22', 1800);
    await logWeight(80, '2026-10-25', '2026-10-25');
    await logWeight(82, '2026-09-10', '2026-09-10');
    const weeks = await weightVsCalories(TODAY);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toEqual({ week_start: '2026-10-20', avg_kcal: 1900, weight_kg: 80 });
    expect(weeks[0]!.week_start).toBe('2026-09-01');
    expect(weeks.find((w) => w.week_start === '2026-09-08')).toMatchObject({ avg_kcal: null, weight_kg: 82 });
    expect(weeks[6]).toMatchObject({ avg_kcal: null, weight_kg: null });
  });
});
