import { addDaysToKey, type MacroTotals, type Targets } from '@gym/shared';
import { db } from '../client';
import { getTargetsForDate } from './body';

/** Data for the four nutrition charts in History → Stats (spec §8.5). "This week" = the last 7 days. */

export type DayTotals = { local_date: string } & MacroTotals;

export const weekRange = (todayKey: string) => ({ from: addDaysToKey(todayKey, -6), to: todayKey });

/** One row per day that has entries, oldest first. Unknown macros count as 0. */
export async function dailyTotals(fromKey: string, toKey: string): Promise<DayTotals[]> {
  return db.getAllAsync<DayTotals>(
    `SELECT local_date,
            ROUND(SUM(kcal), 2) AS kcal,
            ROUND(SUM(COALESCE(protein_g, 0)), 2) AS protein_g,
            ROUND(SUM(COALESCE(carbs_g, 0)), 2) AS carbs_g,
            ROUND(SUM(COALESCE(fat_g, 0)), 2) AS fat_g
     FROM food_log_entries
     WHERE deleted_at IS NULL AND local_date >= ? AND local_date <= ?
     GROUP BY local_date ORDER BY local_date`,
    [fromKey, toKey],
  );
}

/** Each of the last 7 days (empty days as 0) with the targets in effect that day. */
export async function chartDays(todayKey: string): Promise<(DayTotals & { target: Targets | null })[]> {
  const { from, to } = weekRange(todayKey);
  const totals = new Map((await dailyTotals(from, to)).map((d) => [d.local_date, d]));
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDaysToKey(from, i);
    const t = totals.get(key) ?? { local_date: key, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    return { ...t, target: getTargetsForDate(key) };
  });
}

/** Averages over the last 7 days, counting only days with something logged. */
export async function weeklyAverages(todayKey: string): Promise<{ days: number } & MacroTotals> {
  const { from, to } = weekRange(todayKey);
  const days = await dailyTotals(from, to);
  const avg = (k: keyof MacroTotals) => (days.length === 0 ? 0 : Math.round((days.reduce((s, d) => s + d[k], 0) / days.length) * 10) / 10);
  return { days: days.length, kcal: avg('kcal'), protein_g: avg('protein_g'), carbs_g: avg('carbs_g'), fat_g: avg('fat_g') };
}

/** 8 seven-day blocks ending today, oldest first: average daily calories (logged days) and average weigh-in. */
export async function weightVsCalories(todayKey: string, weeks = 8): Promise<{ week_start: string; avg_kcal: number | null; weight_kg: number | null }[]> {
  const first = addDaysToKey(todayKey, -(7 * weeks - 1));
  const days = await dailyTotals(first, todayKey);
  const weights = await db.getAllAsync<{ local_date: string; value: number }>(
    `SELECT local_date, value FROM body_metrics WHERE deleted_at IS NULL AND metric = 'weight' AND local_date >= ? AND local_date <= ?`,
    [first, todayKey],
  );
  const mean = (xs: number[]) => (xs.length === 0 ? null : Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDaysToKey(first, 7 * i);
    const end = addDaysToKey(start, 6);
    const inWeek = <T extends { local_date: string }>(r: T) => r.local_date >= start && r.local_date <= end;
    return {
      week_start: start,
      avg_kcal: mean(days.filter(inWeek).map((d) => d.kcal)),
      weight_kg: mean(weights.filter(inWeek).map((w) => w.value)),
    };
  });
}
