import type { Equipment, UnitSystem } from './domain';
import { lbToKg } from './domain';
import { computePlates, type PlateProfile } from './plates';

/**
 * Warm-up set generator (ROADMAP 2.10). Ramps from the first working weight: compound lifts get 40/60/80 %,
 * isolation lifts a single 50 % set. Each weight is rounded to something that can actually be loaded.
 */
export interface WarmupStep {
  pct: number;
  reps: number;
}

export const COMPOUND_RAMP: readonly WarmupStep[] = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 3 },
];
export const ISOLATION_RAMP: readonly WarmupStep[] = [{ pct: 0.5, reps: 10 }];

/** Canonical multi-joint lifts that aren't barbell-based (barbell lifts always count as compound). */
const EXTRA_COMPOUNDS = new Set(
  [2, 16, 41, 42].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`), // incline DB, leg press, shoulder presses
);

export const isCompound = (exerciseId: string, equipment: Equipment) =>
  equipment === 'barbell' || EXTRA_COMPOUNDS.has(exerciseId);

export interface WarmupSet {
  weight_kg: number;
  reps: number;
}

/**
 * Warm-up sets for a working weight. Barbell lifts round to the gym's plates (never below the empty bar);
 * everything else rounds to 2.5 kg / 5 lb. Weights that round to the same value, or up to the working weight,
 * are dropped. Returns [] when there's no usable working weight.
 */
export function generateWarmups(opts: {
  workingKg: number | null;
  exerciseId: string;
  equipment: Equipment;
  unit: UnitSystem;
  plates?: PlateProfile;
}): WarmupSet[] {
  const { workingKg, equipment, unit, plates } = opts;
  if (!workingKg || workingKg <= 0) return [];
  const ramp = isCompound(opts.exerciseId, equipment) ? COMPOUND_RAMP : ISOLATION_RAMP;
  const step = unit === 'imperial' ? lbToKg(5) : 2.5;
  const round = (kg: number) =>
    equipment === 'barbell' && plates ? computePlates(kg, plates).totalKg : Math.max(step, Math.round(kg / step) * step);

  const out: WarmupSet[] = [];
  for (const { pct, reps } of ramp) {
    const w = round(workingKg * pct);
    if (w >= workingKg - 1e-6) continue;
    if (out.length && Math.abs(out[out.length - 1]!.weight_kg - w) < 1e-6) continue;
    out.push({ weight_kg: w, reps });
  }
  return out;
}
