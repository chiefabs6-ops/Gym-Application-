import { describe, expect, it } from 'vitest';
import { DEFAULT_PLATE_PROFILES, computePlates, formatPlates, type PlateProfile } from '../plates';
import { KG_PER_LB } from '../domain';

const kg = DEFAULT_PLATE_PROFILES.metric;
const lb = DEFAULT_PLATE_PROFILES.imperial;

describe('plate calculator', () => {
  it('loads exact weights with the fewest plates', () => {
    expect(computePlates(100, kg)).toMatchObject({ perSide: [25, 15], total: 100, exact: true });
    expect(computePlates(62.5, kg)).toMatchObject({ perSide: [20, 1.25], total: 62.5, exact: true });
    expect(computePlates(142.5, kg).perSide).toEqual([25, 25, 10, 1.25]);
  });

  it('falls back to the nearest loadable weight (ties go lighter)', () => {
    const r = computePlates(101, kg); // 100 or 102.5 → 100 is nearer
    expect(r).toMatchObject({ total: 100, exact: false });
    expect(computePlates(101.25, kg).total).toBe(100); // tie 100 / 102.5 → lighter
  });

  it('handles the bar alone and weights below the bar', () => {
    expect(computePlates(20, kg)).toMatchObject({ perSide: [], total: 20, exact: true });
    expect(computePlates(10, kg)).toMatchObject({ perSide: [], total: 20, exact: false });
    expect(formatPlates([])).toBe('Empty bar');
  });

  it('respects limited pairs', () => {
    const tiny: PlateProfile = { ...kg, plates: [{ weight: 20, pairs: 1 }, { weight: 5, pairs: 1 }] };
    expect(computePlates(200, tiny)).toMatchObject({ perSide: [20, 5], total: 70, exact: false }); // max loadable
  });

  it('works in pounds for lb gyms', () => {
    const r = computePlates(225 * KG_PER_LB, lb);
    expect(r).toMatchObject({ perSide: [45, 45], total: 225, exact: true });
    expect(r.totalKg).toBeCloseTo(102.06, 2);
  });
});
