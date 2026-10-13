import { describe, expect, it } from 'vitest';
import { detectPRs, epley1RM } from '../pr';

const none = { e1rm: null, max_weight: null, max_volume: null };

describe('epley1RM', () => {
  it('applies weight * (1 + reps / 30)', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3);
    expect(epley1RM(60, 30)).toBe(120);
  });

  it('returns 0 for empty sets', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
  });
});

describe('detectPRs', () => {
  const prev = { e1rm: 120, max_weight: 100, max_volume: 600 };

  it('reports every record that is strictly beaten', () => {
    expect(detectPRs({ weight_kg: 105, reps: 6, set_type: 'working' }, prev)).toEqual([
      'e1rm',
      'max_weight',
      'max_volume',
    ]);
  });

  it('reports only the beaten record', () => {
    // e1rm = 80 * (1 + 12/30) = 112, volume = 960
    expect(detectPRs({ weight_kg: 80, reps: 12, set_type: 'working' }, prev)).toEqual(['max_volume']);
  });

  it('ignores ties, warmups, and first-ever sets', () => {
    expect(detectPRs({ weight_kg: 100, reps: 6, set_type: 'working' }, prev)).toEqual([]);
    expect(detectPRs({ weight_kg: 200, reps: 5, set_type: 'warmup' }, prev)).toEqual([]);
    expect(detectPRs({ weight_kg: 200, reps: 5, set_type: 'working' }, none)).toEqual([]);
  });
});
