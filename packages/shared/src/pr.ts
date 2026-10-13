import type { SetType } from './domain';
import type { TrackingType } from './tracking';

export const PR_KINDS = [
  'e1rm',
  'max_weight',
  'max_volume',
  'max_reps',
  'min_assist',
  'max_duration',
  'max_distance',
  'best_pace',
] as const;
export type PRKind = (typeof PR_KINDS)[number];

export const PR_LABELS: Record<PRKind, string> = {
  e1rm: 'Est. 1RM',
  max_weight: 'Heaviest',
  max_volume: 'Best set volume',
  max_reps: 'Most reps',
  min_assist: 'Least assistance',
  max_duration: 'Longest',
  max_distance: 'Furthest',
  best_pace: 'Best pace',
};

/** Which records apply to each tracking type. */
export const RECORD_KINDS: Record<TrackingType, readonly PRKind[]> = {
  weight_reps: ['e1rm', 'max_weight', 'max_volume'],
  reps_only: ['max_reps'],
  weighted_bodyweight: ['max_weight', 'max_reps'],
  assisted_bodyweight: ['min_assist', 'max_reps'],
  duration: ['max_duration'],
  distance_duration: ['max_distance', 'best_pace'],
};

/** Records where a smaller number is better. */
export const LOWER_IS_BETTER: ReadonlySet<PRKind> = new Set<PRKind>(['min_assist', 'best_pace']);

/**
 * Epley one-rep max: 1RM = weight * (1 + reps / 30).
 * NOTE: the mobile PR engine mirrors setMetrics() in SQL (apps/mobile/src/services/prEngine.ts:
 * BEST_COLUMNS). Keep them in sync.
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

export interface SetPerformance {
  weight_kg: number | null;
  reps: number | null;
  set_type: SetType;
  duration_s?: number | null;
  distance_m?: number | null;
}

/** Best value per record; a missing/null entry means "no history for that record yet". */
export type PersonalBests = Partial<Record<PRKind, number | null>>;

/**
 * Every metric a set can contribute, or null where it doesn't qualify (e.g. no reps). Mirrors the CASE
 * expressions in the mobile SQL. Pace is seconds per km.
 */
export function setMetrics(set: SetPerformance): Record<PRKind, number | null> {
  const w = set.weight_kg ?? 0;
  const r = set.reps ?? 0;
  const d = set.duration_s ?? 0;
  const m = set.distance_m ?? 0;
  const loaded = w > 0 && r > 0;
  return {
    e1rm: loaded ? epley1RM(w, r) : null,
    max_weight: loaded ? w : null,
    max_volume: loaded ? w * r : null,
    max_reps: r > 0 ? r : null,
    min_assist: r > 0 ? w : null,
    max_duration: d > 0 ? d : null,
    max_distance: m > 0 ? m : null,
    best_pace: m > 0 && d > 0 ? (d * 1000) / m : null,
  };
}

/** Warm-ups never count; otherwise a set counts if it qualifies for at least one of its type's records. */
export function countsTowardRecords(set: SetPerformance, type: TrackingType = 'weight_reps'): boolean {
  if (set.set_type === 'warmup') return false;
  const metrics = setMetrics(set);
  return RECORD_KINDS[type].some((k) => metrics[k] !== null);
}

const EPSILON = 1e-6;

/**
 * Returns which records `set` breaks relative to `previous` bests, for its tracking type.
 * A record with no prior value (null) is never reported, so a first session doesn't light up every set.
 */
export function detectPRs(set: SetPerformance, previous: PersonalBests, type: TrackingType = 'weight_reps'): PRKind[] {
  if (set.set_type === 'warmup') return [];
  const current = setMetrics(set);
  return RECORD_KINDS[type].filter((kind) => {
    const best = previous[kind];
    const value = current[kind];
    if (best === null || best === undefined || value === null) return false;
    return LOWER_IS_BETTER.has(kind) ? value < best - EPSILON : value > best + EPSILON;
  });
}
