import { describe, expect, it } from 'vitest';
import { weekStartKey } from '../nutrition';
import { percentChange, weeklyTraining } from '../trainingStats';

const at = (key: string, hour = 18) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour).getTime();
};

describe('weekStartKey', () => {
  it('returns the Monday of the local week', () => {
    expect(weekStartKey('2026-10-27')).toBe('2026-10-26'); // Tue
    expect(weekStartKey('2026-10-26')).toBe('2026-10-26'); // Mon
    expect(weekStartKey('2026-10-25')).toBe('2026-10-19'); // Sun belongs to the week before
  });
});

describe('weeklyTraining', () => {
  it('buckets sessions into Monday weeks, oldest first, ending with the current week', () => {
    const weeks = weeklyTraining(
      [
        { start_time: at('2026-10-25'), volume_kg: 7850 }, // Sun, week of 19 Oct
        { start_time: at('2026-10-20'), volume_kg: 7640 },
        { start_time: at('2026-10-16'), volume_kg: 9040 }, // week of 12 Oct
        { start_time: at('2026-08-01'), volume_kg: 999 }, // outside the window
      ],
      '2026-10-27',
      3,
    );
    expect(weeks).toEqual([
      { week_start: '2026-10-05', volume_kg: 0, workouts: 0 },
      { week_start: '2026-10-12', volume_kg: 9040, workouts: 1 },
      { week_start: '2026-10-19', volume_kg: 15490, workouts: 2 },
      { week_start: '2026-10-26', volume_kg: 0, workouts: 0 },
    ]);
  });
});

describe('percentChange', () => {
  it('rounds to whole percent and is null without a baseline', () => {
    expect(percentChange(23610, 19905)).toBe(19);
    expect(percentChange(90, 100)).toBe(-10);
    expect(percentChange(5, 0)).toBeNull();
  });
});
