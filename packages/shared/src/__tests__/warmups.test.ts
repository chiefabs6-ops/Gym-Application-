import { describe, expect, it } from 'vitest';
import { DEFAULT_PLATE_PROFILES } from '../plates';
import { generateWarmups } from '../warmups';

const BENCH = '00000000-0000-4000-8000-000000000001';
const CURL = '00000000-0000-4000-8000-000000000011';
const LEG_PRESS = '00000000-0000-4000-8000-000000000016';

describe('warm-up generator', () => {
  it('ramps compound barbell lifts 40/60/80 % rounded to loadable plates', () => {
    expect(
      generateWarmups({ workingKg: 100, exerciseId: BENCH, equipment: 'barbell', unit: 'metric', plates: DEFAULT_PLATE_PROFILES.metric }),
    ).toEqual([
      { weight_kg: 40, reps: 8 },
      { weight_kg: 60, reps: 5 },
      { weight_kg: 80, reps: 3 },
    ]);
  });

  it('never goes below the empty bar and drops duplicates', () => {
    const sets = generateWarmups({ workingKg: 40, exerciseId: BENCH, equipment: 'barbell', unit: 'metric', plates: DEFAULT_PLATE_PROFILES.metric });
    expect(sets.map((s) => s.weight_kg)).toEqual([20, 25, 32.5]); // 16→bar 20, 24→25, 32→32.5
  });

  it('isolation lifts get one 50 % set rounded to 2.5 kg', () => {
    expect(generateWarmups({ workingKg: 17.5, exerciseId: CURL, equipment: 'dumbbell', unit: 'metric' })).toEqual([
      { weight_kg: 10, reps: 10 }, // 8.75 → 10 (nearest 2.5)
    ]);
  });

  it('treats non-barbell multi-joint lifts as compound', () => {
    expect(generateWarmups({ workingKg: 200, exerciseId: LEG_PRESS, equipment: 'machine', unit: 'metric' })).toHaveLength(3);
  });

  it('returns nothing without a working weight', () => {
    expect(generateWarmups({ workingKg: null, exerciseId: BENCH, equipment: 'barbell', unit: 'metric' })).toEqual([]);
  });
});
