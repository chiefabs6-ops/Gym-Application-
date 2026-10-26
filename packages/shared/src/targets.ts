import { z } from 'zod';

/**
 * Daily calorie and macro targets (ROADMAP 2.15, spec §8). Maintenance = Mifflin-St Jeor × activity; the goal's
 * weekly rate moves it by 7,700 kcal per kg. Protein from bodyweight, fat a share of calories, carbs the rest, so the
 * macros always add up to the calorie target. Calories never go below the minimum for the user's sex.
 */

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'very', 'extra'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};
export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  very: 'Very active',
  extra: 'Extra active',
};

export const GOAL_KINDS = ['lose', 'maintain', 'gain'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const LOSE_RATES_KG = [0.25, 0.5, 0.75, 1] as const;
export const GAIN_RATES_KG = [0.25, 0.5] as const;

export const KCAL_PER_KG = 7700;
export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };
export const PROTEIN_G_PER_KG = 2.0;
export const FAT_SHARE = 0.25;
export const FAT_SHARE_LOW = 0.125;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const bodyProfileSchema = z.object({
  birth_date: dateKey,
  sex: z.enum(SEXES),
  height_cm: z.number().min(100).max(250),
  activity: z.enum(ACTIVITY_LEVELS),
});
export type BodyProfile = z.infer<typeof bodyProfileSchema>;

export const goalSchema = z.object({
  kind: z.enum(GOAL_KINDS),
  /** 0 for maintain. */
  rate_kg_per_week: z.number().min(0).max(1),
});
export type Goal = z.infer<typeof goalSchema>;

export const targetsSchema = z.object({
  kcal: z.number().min(0).max(10_000),
  protein_g: z.number().min(0).max(1000),
  carbs_g: z.number().min(0).max(2000),
  fat_g: z.number().min(0).max(1000),
});
export type Targets = z.infer<typeof targetsSchema>;
export const targetOverridesSchema = targetsSchema.partial();
export type TargetOverrides = z.infer<typeof targetOverridesSchema>;

/** Stored in `users.preferences.nutrition`. `history` records the targets in effect from each date. */
export const nutritionSettingsSchema = z.object({
  profile: bodyProfileSchema,
  goal: goalSchema,
  overrides: targetOverridesSchema.catch({}),
  history: z.array(z.object({ from_date: dateKey, targets: targetsSchema })).catch([]),
  last_prompt_at: z.number().nullable().catch(null),
  weight_at_last_calc: z.number().nullable().catch(null),
});
export type NutritionSettings = z.infer<typeof nutritionSettingsSchema>;

export function ageOn(birthDate: string, onDateKey: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = onDateKey.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function bmrMifflinStJeor(p: { sex: Sex; weight_kg: number; height_cm: number; age: number }): number {
  return 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

const macroKcal = (protein: number, carbs: number, fat: number) => 4 * protein + 4 * carbs + 9 * fat;

/** Splits `kcal` given protein; fat/carbs fixed when overridden, otherwise the default split with the low-fat fallback. */
function split(kcal: number, protein: number, fixed: { carbs_g?: number; fat_g?: number }): Omit<Targets, 'kcal' | 'protein_g'> {
  if (fixed.carbs_g !== undefined && fixed.fat_g !== undefined) return { carbs_g: fixed.carbs_g, fat_g: fixed.fat_g };
  if (fixed.fat_g !== undefined) {
    return { fat_g: fixed.fat_g, carbs_g: Math.max(0, Math.round((kcal - 4 * protein - 9 * fixed.fat_g) / 4)) };
  }
  if (fixed.carbs_g !== undefined) {
    return { carbs_g: fixed.carbs_g, fat_g: Math.max(0, Math.round((kcal - 4 * protein - 4 * fixed.carbs_g) / 9)) };
  }
  let fat = Math.round((kcal * FAT_SHARE) / 9);
  let carbs = Math.round((kcal - 4 * protein - 9 * fat) / 4);
  if (carbs < 0) {
    fat = Math.round((kcal * FAT_SHARE_LOW) / 9);
    carbs = Math.max(0, Math.round((kcal - 4 * protein - 9 * fat) / 4));
  }
  return { carbs_g: carbs, fat_g: fat };
}

export function calculateTargets(profile: BodyProfile, goal: Goal, weightKg: number, onDateKey: string): Targets {
  const bmr = bmrMifflinStJeor({ sex: profile.sex, weight_kg: weightKg, height_cm: profile.height_cm, age: ageOn(profile.birth_date, onDateKey) });
  const sign = goal.kind === 'lose' ? -1 : goal.kind === 'gain' ? 1 : 0;
  const dailyDelta = (sign * goal.rate_kg_per_week * KCAL_PER_KG) / 7;
  const kcal = Math.max(MIN_KCAL[profile.sex], Math.round(bmr * ACTIVITY_MULTIPLIER[profile.activity] + dailyDelta));
  const protein = Math.round(PROTEIN_G_PER_KG * weightKg);
  return { kcal, protein_g: protein, ...split(kcal, protein, {}) };
}

/**
 * Applies hand edits. Calories edited → the non-edited macros are recalculated from them. A macro edited → it stays,
 * and the others make room (carbs first, then fat, then protein). All three macros edited → calories follow them.
 */
export function resolveTargets(calculated: Targets, overrides: TargetOverrides, ctx: { sex: Sex; weight_kg: number }): Targets {
  const { protein_g: p, carbs_g: c, fat_g: f } = overrides;
  if (p !== undefined && c !== undefined && f !== undefined) {
    return { kcal: macroKcal(p, c, f), protein_g: p, carbs_g: c, fat_g: f };
  }
  const kcal = overrides.kcal !== undefined ? Math.max(MIN_KCAL[ctx.sex], overrides.kcal) : calculated.kcal;
  if (p === undefined && c !== undefined && f !== undefined) {
    return { kcal, protein_g: Math.max(0, Math.round((kcal - 4 * c - 9 * f) / 4)), carbs_g: c, fat_g: f };
  }
  const protein = p ?? Math.round(PROTEIN_G_PER_KG * ctx.weight_kg);
  return { kcal, protein_g: protein, ...split(kcal, protein, { carbs_g: c, fat_g: f }) };
}

/** All three macros edited: their calories must not be below the minimum (the edit is rejected with a message). */
export function checkMacroOverrides(overrides: TargetOverrides, sex: Sex): { ok: true } | { ok: false; kcal: number; min: number } {
  const { protein_g: p, carbs_g: c, fat_g: f } = overrides;
  if (p === undefined || c === undefined || f === undefined) return { ok: true };
  const kcal = macroKcal(p, c, f);
  return kcal < MIN_KCAL[sex] ? { ok: false, kcal, min: MIN_KCAL[sex] } : { ok: true };
}

/* ───────────────────────────── Height units (imperial body details) ───────────────────────────── */

const CM_PER_INCH = 2.54;
export const feetInchesToCm = (feet: number, inches: number) => (feet * 12 + inches) * CM_PER_INCH;
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

/** Maintenance calories (Mifflin-St Jeor × activity), shown with the targets so the maths is visible. */
export const maintenanceKcal = (profile: BodyProfile, weightKg: number, onDateKey: string) =>
  Math.round(
    bmrMifflinStJeor({ sex: profile.sex, weight_kg: weightKg, height_cm: profile.height_cm, age: ageOn(profile.birth_date, onDateKey) }) *
      ACTIVITY_MULTIPLIER[profile.activity],
  );
