import { z } from 'zod';
import { KG_PER_LB, type UnitSystem } from './domain';
import { EFFORT_INPUTS } from './effort';
import { plateProfileSchema } from './plates';
import { trainingPlanSchema } from './plans';

/**
 * User settings stored in `users.preferences` (JSON). Units live in the `users.unit_system` column.
 * Every field has a default and invalid values fall back to it, so old/partial/foreign preference
 * objects always parse. Unknown keys are preserved by `mergePreferences`.
 */
export const PREVIOUS_SOURCES = ['last_session', 'same_routine'] as const;
export type PreviousSource = (typeof PREVIOUS_SOURCES)[number];

export const REST_SECONDS_MIN = 15;
export const REST_SECONDS_MAX = 600;
export const MAX_CUSTOM_REST_PRESETS = 8;
/** Built-in rest presets (seconds), always offered. */
export const BUILT_IN_REST_PRESETS = [45, 60, 90, 120, 180] as const;

export const settingsSchema = z.object({
  default_rest_seconds: z.number().int().min(REST_SECONDS_MIN).max(REST_SECONDS_MAX).catch(90),
  rest_sound: z.boolean().catch(true),
  rest_vibration: z.boolean().catch(true),
  keep_awake: z.boolean().catch(true),
  previous_source: z.enum(PREVIOUS_SOURCES).catch('last_session'),
  /** User-defined rest-time presets in seconds (shown next to the built-in ones), sorted, max 8. */
  rest_presets: z.array(z.number().int().min(0).max(REST_SECONDS_MAX)).max(MAX_CUSTOM_REST_PRESETS).catch([]),
  /** Optional per-set effort column: off, RPE or RIR (stored as RPE either way). */
  effort_input: z.enum(EFFORT_INPUTS).catch('off'),
  /** Start the rest timer when a set is ticked. */
  rest_auto_start: z.boolean().catch(true),
  /** Rest after warm-up sets (seconds); null = same as the exercise's normal rest. */
  warmup_rest_seconds: z.number().int().min(0).max(REST_SECONDS_MAX).nullable().catch(null),
  /** Last rest time chosen per exercise (exercise id → seconds), reused when the exercise is added again. */
  exercise_rest: z.record(z.number().int().min(0).max(REST_SECONDS_MAX)).catch({}),
  /** Interval timer: last "auto-start next set" choice per exercise (exercise id → on/off). */
  exercise_auto_next: z.record(z.boolean()).catch({}),
  /** Gyms for the plate calculator (empty = the built-in default for the user's unit). */
  plate_profiles: z.array(plateProfileSchema).max(10).catch([]),
  active_plate_profile: z.string().nullable().catch(null),
  /** Lock-screen card with the next set and a "Complete set" button while a workout is running. */
  workout_notification: z.boolean().catch(true),
  /** Show the workout over the lock screen (Maps-style) while one is running, to log sets without unlocking. */
  lock_screen_mode: z.boolean().catch(true),
  /** Training split run as a rotation (see plans.ts). null = no plan. */
  training_plan: trainingPlanSchema.nullable().catch(null),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = settingsSchema.parse({});

/**
 * Rest after ticking a set: warm-ups use the warm-up rest when set; otherwise this workout's per-exercise
 * rest (from the routine or chosen in the workout), then the remembered rest for the exercise, then the default.
 */
export function resolveRestSeconds(
  settings: Pick<AppSettings, 'default_rest_seconds' | 'warmup_rest_seconds' | 'exercise_rest'>,
  opts: { exerciseId: string; sessionRest: number | null; isWarmup: boolean },
): number {
  if (opts.isWarmup && settings.warmup_rest_seconds !== null) return settings.warmup_rest_seconds;
  return opts.sessionRest ?? settings.exercise_rest[opts.exerciseId] ?? settings.default_rest_seconds;
}

/**
 * Interval timer: after a timed set's rest, start the next set's countdown by itself (battle rope) or wait for a
 * tap (plank). This workout's choice, then the routine's, then the remembered choice for the exercise, else off.
 */
export function resolveAutoNext(
  settings: Pick<AppSettings, 'exercise_auto_next'>,
  opts: { exerciseId: string; sessionOverride: boolean | null | undefined; routineValue: boolean | null | undefined },
): boolean {
  return opts.sessionOverride ?? opts.routineValue ?? settings.exercise_auto_next[opts.exerciseId] ?? false;
}

export function parseSettings(preferences: unknown): AppSettings {
  return settingsSchema.parse(preferences && typeof preferences === 'object' ? preferences : {});
}

/** Applies a settings patch without dropping unrelated keys already in the preferences object. */
export function mergePreferences(preferences: unknown, patch: Partial<AppSettings>): Record<string, unknown> {
  const base = preferences && typeof preferences === 'object' ? (preferences as Record<string, unknown>) : {};
  return { ...base, ...parseSettings(base), ...patch };
}

/* ───────────────────────────── Weight units ─────────────────────────────
 * Weights are always STORED in kg. Convert only at the UI boundary.
 * Inputs typed in lb are stored as unrounded kg, so 225 lb round-trips to exactly 225 lb.
 */

export const weightUnitLabel = (unit: UnitSystem) => (unit === 'imperial' ? 'lb' : 'kg');

export function toDisplayWeight(kg: number, unit: UnitSystem): number {
  return unit === 'imperial' ? kg / KG_PER_LB : kg;
}

export function fromDisplayWeight(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? value * KG_PER_LB : value;
}

/** Rounded display number as a string without trailing zeros: 102.5, 225, 0.5 */
export function formatWeightNumber(kg: number | null | undefined, unit: UnitSystem, decimals = 1): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '';
  const v = toDisplayWeight(kg, unit);
  return String(Number(v.toFixed(decimals)));
}

/** "102.5 kg" / "225 lb"; whole numbers for large totals such as volume. */
export function formatWeight(kg: number | null | undefined, unit: UnitSystem, opts: { decimals?: number } = {}): string {
  const n = formatWeightNumber(kg, unit, opts.decimals ?? 1);
  return n === '' ? '' : `${Number(n).toLocaleString()} ${weightUnitLabel(unit)}`;
}

/** Adds a custom rest preset (deduped, sorted, capped). Built-in values aren't duplicated. */
export function addRestPreset(presets: readonly number[], seconds: number): number[] {
  if ((BUILT_IN_REST_PRESETS as readonly number[]).includes(seconds) || presets.includes(seconds)) return [...presets];
  return [...presets, seconds].sort((a, b) => a - b).slice(0, MAX_CUSTOM_REST_PRESETS);
}

export const removeRestPreset = (presets: readonly number[], seconds: number): number[] => presets.filter((p) => p !== seconds);
