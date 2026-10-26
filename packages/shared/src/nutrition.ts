import { z } from 'zod';
import type { UnitSystem } from './domain';

/**
 * Food tracking maths (ROADMAP 2.15). Foods store nutrients per 100 g (or 100 ml); log entries store an
 * absolute snapshot. Energy is kcal only. Unknown nutrient values are null, never 0.
 */

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export const NUTRIENT_KEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'sugars_g', 'sat_fat_g', 'salt_g'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

const grams = z.number().min(0).max(1000).nullable();
export const nutrientsSchema = z.object({
  kcal: z.number().min(0).max(10_000),
  protein_g: grams,
  carbs_g: grams,
  fat_g: grams,
  fibre_g: grams,
  sugars_g: grams,
  sat_fat_g: grams,
  salt_g: grams,
});
export type Nutrients = z.infer<typeof nutrientsSchema>;

export const servingSchema = z.object({
  label: z.string().min(1).max(60),
  grams: z.number().positive().max(5000),
});
export type Serving = z.infer<typeof servingSchema>;

function mapNutrients(values: Nutrients, factor: number): Nutrients {
  const out = { ...values };
  for (const key of NUTRIENT_KEYS) {
    const v = values[key];
    if (v !== null) (out as Record<NutrientKey, number | null>)[key] = v * factor;
  }
  return out;
}

/** Per-100 values → values for `grams` of the food. */
export const scaleNutrients = (per100: Nutrients, grams: number): Nutrients => mapNutrients(per100, grams / 100);

/** Values printed for one serving of `servingGrams` → per 100 g. */
export const per100FromServing = (values: Nutrients, servingGrams: number): Nutrients =>
  mapNutrients(values, 100 / servingGrams);

export const kcalFromKj = (kj: number) => kj / 4.184;
/** EU labels: salt = sodium × 2.5. */
export const saltFromSodiumMg = (mg: number) => (mg * 2.5) / 1000;

/** Typed amount → number. Accepts "1,5" and "1.5"; empty, junk and negatives → null. */
export function parseDecimal(text: string): number | null {
  const t = text.trim();
  const n = Number(t.replace(',', '.'));
  return t === '' || !Number.isFinite(n) || n < 0 ? null : n;
}

/* ───────────────────────────── Food amount units ───────────────────────────── */

export const GRAMS_PER_OZ = 28.349523125;
export const foodAmountLabel = (unit: UnitSystem) => (unit === 'imperial' ? 'oz' : 'g');
export const toDisplayFoodAmount = (grams: number, unit: UnitSystem) => (unit === 'imperial' ? grams / GRAMS_PER_OZ : grams);
export const fromDisplayFoodAmount = (value: number, unit: UnitSystem) =>
  unit === 'imperial' ? value * GRAMS_PER_OZ : value;

export interface MacroTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Diary totals: calories and macros summed, unknown values counted as 0. */
export function sumNutrients(list: Pick<Nutrients, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>[]): MacroTotals {
  const t = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const n of list) {
    t.kcal += n.kcal;
    t.protein_g += n.protein_g ?? 0;
    t.carbs_g += n.carbs_g ?? 0;
    t.fat_g += n.fat_g ?? 0;
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  return { kcal: r(t.kcal), protein_g: r(t.protein_g), carbs_g: r(t.carbs_g), fat_g: r(t.fat_g) };
}

/** Units offered on the portion screen: the food's named servings, then g (or ml), then oz for imperial solids. */
export function servingOptions(named: Serving[], basis: 'g' | 'ml', unit: UnitSystem): Serving[] {
  const out: Serving[] = [...named, { label: basis, grams: 1 }];
  if (unit === 'imperial' && basis === 'g') out.push({ label: 'oz', grams: GRAMS_PER_OZ });
  return out;
}

/** A logged snapshot back to per-100 values (to edit the amount of an entry). */
export const per100FromEntry = (values: Nutrients, grams: number): Nutrients => mapNutrients(values, 100 / grams);

/* ───────────────────────────── Day keys ───────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day, 'YYYY-MM-DD'. A food's day is fixed when it's logged. */
export const toLocalDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 00:00–02:59 local: the Food tab asks once whether to log to yesterday or today. */
export const isLateNight = (d: Date) => d.getHours() < 3;

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  // Local noon, so a DST change can never push the result onto the wrong day.
  return toLocalDateKey(new Date(y, m - 1, d + days, 12));
}

export function resolveLogDate(now: Date, lateNightChoice: 'yesterday' | 'today' | null): string {
  const today = toLocalDateKey(now);
  return isLateNight(now) && lateNightChoice === 'yesterday' ? addDaysToKey(today, -1) : today;
}
