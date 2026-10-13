import { z } from 'zod';
import { UNIT_SYSTEMS, kgToLb, lbToKg, type UnitSystem } from './domain';

const toDisplayWeight = (kg: number, unit: UnitSystem) => (unit === 'imperial' ? kgToLb(kg) : kg);
const fromDisplayWeight = (v: number, unit: UnitSystem) => (unit === 'imperial' ? lbToKg(v) : v);

/**
 * Plate calculator (ROADMAP 2.9). A gym profile lists its bar and plate pairs in one unit (kg or lb, as the
 * plates are labelled). All maths runs in that unit; weights are converted from/to kg only at the edges.
 */
export const plateProfileSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(40),
  unit: z.enum(UNIT_SYSTEMS),
  bar: z.number().min(0).max(100),
  /** Plate weight → number of PAIRS available (one plate per side each). */
  plates: z.array(z.object({ weight: z.number().positive().max(100), pairs: z.number().int().min(0).max(20) })).max(20),
});
export type PlateProfile = z.infer<typeof plateProfileSchema>;

export const DEFAULT_PLATE_PROFILES: Record<UnitSystem, PlateProfile> = {
  metric: {
    id: 'default',
    name: 'My gym',
    unit: 'metric',
    bar: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25].map((weight) => ({ weight, pairs: weight >= 10 ? 4 : 2 })),
  },
  imperial: {
    id: 'default',
    name: 'My gym',
    unit: 'imperial',
    bar: 45,
    plates: [45, 35, 25, 10, 5, 2.5].map((weight) => ({ weight, pairs: weight >= 25 ? 4 : 2 })),
  },
};

export interface PlateLoad {
  /** Plates on ONE side, heaviest first (in the profile's unit). */
  perSide: number[];
  /** Total on the bar including the bar, in the profile's unit. */
  total: number;
  /** total in kg. */
  totalKg: number;
  /** True when total equals the requested weight. */
  exact: boolean;
}

const SCALE = 1000; // work in thousandths so 1.25 / 2.5 / 0.5 plates are exact integers

/**
 * Plates per side for `targetKg` on this profile. With the available pairs it picks the loadable total nearest
 * to the target (ties → the lighter one), using the fewest plates. Below the bar weight: just the bar.
 */
export function computePlates(targetKg: number, profile: PlateProfile): PlateLoad {
  const target = toDisplayWeight(targetKg, profile.unit);
  const bar = profile.bar;
  const wantSide = Math.max(0, Math.round(((target - bar) / 2) * SCALE));

  // Bounded knapsack over per-side weight: best[w] = the plates reaching exactly w (fewest plates; on a tie the
  // set with heavier plates, which is how people load a bar: 25 + 15, not 20 + 20).
  const items: number[] = [];
  for (const p of [...profile.plates].sort((a, b) => b.weight - a.weight)) {
    for (let i = 0; i < p.pairs; i++) items.push(Math.round(p.weight * SCALE));
  }
  const maxSide = items.reduce((s, w) => s + w, 0);
  const limit = Math.min(maxSide, wantSide + (items.length ? Math.max(...items) : 0));
  const better = (a: number[], b: number[]) => {
    if (a.length !== b.length) return a.length < b.length;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
    return false;
  };
  const best = new Map<number, number[]>([[0, []]]);
  for (const w of items) {
    const snapshot = [...best.entries()].sort((a, b) => b[0] - a[0]);
    for (const [sum, plates] of snapshot) {
      const next = sum + w;
      if (next > limit) continue;
      const candidate = [...plates, w].sort((a, b) => b - a);
      const cur = best.get(next);
      if (!cur || better(candidate, cur)) best.set(next, candidate);
    }
  }

  let chosen = 0;
  let bestDiff = Infinity;
  for (const sum of best.keys()) {
    const diff = Math.abs(sum - wantSide);
    if (diff < bestDiff || (diff === bestDiff && sum < chosen)) {
      bestDiff = diff;
      chosen = sum;
    }
  }

  const perSide = best.get(chosen)!.map((w) => w / SCALE);
  const total = Number((bar + (2 * chosen) / SCALE).toFixed(3));
  return {
    perSide,
    total,
    totalKg: fromDisplayWeight(total, profile.unit),
    exact: Math.abs(total - target) < 1e-6,
  };
}

/** "20 + 10 + 2.5" for a side, or "Empty bar". */
export const formatPlates = (perSide: number[]) => (perSide.length ? perSide.join(' + ') : 'Empty bar');
