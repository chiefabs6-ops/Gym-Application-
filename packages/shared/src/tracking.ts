import type { ExerciseCategory, UnitSystem } from './domain';
import { formatWeightNumber, weightUnitLabel } from './settings';

/**
 * How an exercise is logged. Stored on `exercise_definitions.tracking_type`; decides the set table's
 * columns, the PREVIOUS text, which records (PRs) apply and whether a set adds to volume.
 *
 *  weight_reps          100 kg × 5          (barbell, dumbbell, machine, cable)
 *  reps_only            12 reps             (push-ups, band work: no load logged)
 *  weighted_bodyweight  +10 kg × 8          (pull-ups / dips; empty weight = just bodyweight)
 *  assisted_bodyweight  −20 kg × 8          (assisted pull-up machine: less assistance is better)
 *  duration             1:30                (plank, holds)
 *  distance_duration    5 km in 25:00       (running, cycling, rowing)
 */
export const TRACKING_TYPES = [
  'weight_reps',
  'reps_only',
  'weighted_bodyweight',
  'assisted_bodyweight',
  'duration',
  'distance_duration',
] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Weight & reps',
  reps_only: 'Reps only',
  weighted_bodyweight: 'Bodyweight + weight',
  assisted_bodyweight: 'Assisted (−weight)',
  duration: 'Time',
  distance_duration: 'Distance & time',
};

/** The set fields a type logs, in table order. */
export type SetField = 'weight' | 'reps' | 'duration' | 'distance';
export const TRACKING_FIELDS: Record<TrackingType, readonly SetField[]> = {
  weight_reps: ['weight', 'reps'],
  reps_only: ['reps'],
  weighted_bodyweight: ['weight', 'reps'],
  assisted_bodyweight: ['weight', 'reps'],
  duration: ['duration'],
  distance_duration: ['distance', 'duration'],
};

export const usesField = (type: TrackingType, field: SetField) => TRACKING_FIELDS[type].includes(field);

/** Prefix shown with the weight for bodyweight types: "+10 kg" added, "−20 kg" assistance. */
export const weightSign = (type: TrackingType) =>
  type === 'weighted_bodyweight' ? '+' : type === 'assisted_bodyweight' ? '−' : '';

/** The broad category stored alongside (kept for filtering/analytics), derived from the tracking type. */
export function categoryFor(type: TrackingType): ExerciseCategory {
  if (type === 'duration') return 'duration';
  if (type === 'distance_duration') return 'cardio';
  if (type === 'weight_reps') return 'strength';
  return 'bodyweight';
}

/** Volume (kg × reps) only counts real external load: not bodyweight-only, assistance, time or distance. */
export const countsTowardVolume = (type: TrackingType) => type === 'weight_reps' || type === 'weighted_bodyweight';

/** SQL twin of countsTowardVolume, for queries that join exercise_definitions as `alias`. */
export const volumeTypeSql = (alias: string) => `${alias}.tracking_type IN ('weight_reps', 'weighted_bodyweight')`;

/* ───────────────────────────── Time ───────────────────────────── */

/** 90 → "1:30", 3725 → "1:02:05". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Typed time → seconds. With colons it's m:ss or h:mm:ss ("1:30", "1:02:05"). Plain digits fill from the
 * right like a timer keypad: "45" → 0:45, "130" → 1:30, "2500" → 25:00, "10000" → 1:00:00.
 * Empty → null; invalid (letters, seconds ≥ 60 after a colon) → undefined.
 */
export function parseDuration(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  if (/^\d{1,6}$/.test(t)) {
    const d = t.padStart(6, '0');
    const h = Number(d.slice(0, 2));
    const m = Number(d.slice(2, 4));
    const s = Number(d.slice(4, 6));
    return h * 3600 + m * 60 + s;
  }
  const parts = t.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return undefined;
  const nums = parts.map(Number);
  const [a, b, c] = nums as [number, number, number?];
  if (parts.length === 2) return b < 60 ? a * 60 + b : undefined;
  return b < 60 && c! < 60 ? a * 3600 + b * 60 + c! : undefined;
}

/* ───────────────────────────── Distance ───────────────────────────── */

export const METERS_PER_MILE = 1609.344;
export const distanceUnitLabel = (unit: UnitSystem) => (unit === 'imperial' ? 'mi' : 'km');

/** Meters → display number (km or mi), up to 2 decimals: 5000 → "5", 1609.344 → "1" (imperial). */
export function formatDistanceNumber(m: number | null | undefined, unit: UnitSystem): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return '';
  const v = unit === 'imperial' ? m / METERS_PER_MILE : m / 1000;
  return String(Number(v.toFixed(2)));
}

/** Typed km/mi → meters. */
export const fromDisplayDistance = (value: number, unit: UnitSystem) =>
  unit === 'imperial' ? value * METERS_PER_MILE : value * 1000;

/** Seconds per km (or mi) → "5:00 /km". */
export function formatPace(secondsPerKm: number | null | undefined, unit: UnitSystem): string {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return '';
  const perUnit = unit === 'imperial' ? secondsPerKm * (METERS_PER_MILE / 1000) : secondsPerKm;
  return `${formatDuration(perUnit)} /${distanceUnitLabel(unit)}`;
}

/* ───────────────────────────── One-line set summary ───────────────────────────── */

export interface SetValues {
  weight_kg: number | null;
  reps: number | null;
  duration_s?: number | null;
  distance_m?: number | null;
}

/**
 * Human summary of a set for PREVIOUS, History and exports: "100 × 5", "12 reps", "+10 × 8", "BW × 8",
 * "−20 × 8", "1:30", "5 km · 25:00". `withUnit` adds the weight unit ("100 kg × 5"). Empty → "".
 */
export function formatSetSummary(type: TrackingType, set: SetValues, unit: UnitSystem, withUnit = false): string {
  const w = formatWeightNumber(set.weight_kg, unit);
  const wu = w && withUnit ? `${w} ${weightUnitLabel(unit)}` : w;
  switch (type) {
    case 'weight_reps':
      return w && set.reps !== null ? `${wu} × ${set.reps}` : '';
    case 'reps_only':
      return set.reps !== null ? `${set.reps} reps` : '';
    case 'weighted_bodyweight':
    case 'assisted_bodyweight': {
      if (set.reps === null) return '';
      const load = set.weight_kg ? `${weightSign(type)}${wu}` : 'BW';
      return `${load} × ${set.reps}`;
    }
    case 'duration':
      return formatDuration(set.duration_s);
    case 'distance_duration': {
      const d = formatDistanceNumber(set.distance_m, unit);
      const t = formatDuration(set.duration_s);
      if (d && t) return `${d} ${distanceUnitLabel(unit)} · ${t}`;
      return d ? `${d} ${distanceUnitLabel(unit)}` : t;
    }
  }
}
