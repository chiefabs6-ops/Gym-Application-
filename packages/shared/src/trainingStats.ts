import { addDaysToKey, toLocalDateKey, weekStartKey } from './nutrition';

/** History → Stats maths: Monday-based local weeks (the same weeks the workout list groups by). */

export interface WeekTraining {
  /** Monday, 'YYYY-MM-DD'. */
  week_start: string;
  volume_kg: number;
  workouts: number;
}

/** `weeks` complete weeks plus the current one, oldest first. Sessions outside the window are ignored. */
export function weeklyTraining(
  sessions: readonly { start_time: number; volume_kg: number }[],
  todayKey: string,
  weeks: number,
): WeekTraining[] {
  const current = weekStartKey(todayKey);
  const out: WeekTraining[] = Array.from({ length: weeks + 1 }, (_, i) => ({
    week_start: addDaysToKey(current, -7 * (weeks - i)),
    volume_kg: 0,
    workouts: 0,
  }));
  const byStart = new Map(out.map((w) => [w.week_start, w]));
  for (const s of sessions) {
    const week = byStart.get(weekStartKey(toLocalDateKey(new Date(s.start_time))));
    if (!week) continue;
    week.volume_kg += s.volume_kg;
    week.workouts += 1;
  }
  return out;
}

/** Whole-percent change from `base`; null when there is nothing to compare with. */
export function percentChange(value: number, base: number): number | null {
  return base > 0 ? Math.round((value / base - 1) * 100) : null;
}
