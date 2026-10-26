import { parseDecimal, per100FromServing, type Nutrients, type Serving } from './nutrition';

/**
 * The create / edit / check food form (ROADMAP 2.15, spec §6.3–6.4). Only name, calories and protein are required;
 * other blanks stay unknown (null). Values typed per serving are stored per 100 g, and the serving is kept.
 */
export type FoodFormBasis = '100g' | '100ml' | 'serving';

export interface FoodFormFields {
  name: string;
  basis: FoodFormBasis;
  /** Grams in one serving, when basis = 'serving'. */
  servingGrams: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  sugars: string;
  satFat: string;
  salt: string;
}

export type FoodFormErrors = Partial<Record<keyof FoodFormFields, string>>;
export type FoodFormResult =
  | { ok: true; basis: 'g' | 'ml'; per100: Nutrients; extraServing: Serving | null }
  | { ok: false; errors: FoodFormErrors };

const OPTIONAL = ['carbs', 'fat', 'fibre', 'sugars', 'satFat', 'salt'] as const;

export function buildFoodFromForm(f: FoodFormFields): FoodFormResult {
  const errors: FoodFormErrors = {};
  if (f.name.trim() === '') errors.name = 'Enter a name';
  const kcal = parseDecimal(f.kcal);
  const protein = parseDecimal(f.protein);
  if (kcal === null) errors.kcal = 'Required';
  if (protein === null) errors.protein = 'Required';
  const opt: Partial<Record<(typeof OPTIONAL)[number], number | null>> = {};
  for (const key of OPTIONAL) {
    const text = f[key].trim();
    const v = parseDecimal(text);
    if (text !== '' && v === null) errors[key] = 'Not a number';
    opt[key] = text === '' ? null : v;
  }
  let servingG: number | null = null;
  if (f.basis === 'serving') {
    servingG = parseDecimal(f.servingGrams);
    if (!servingG) errors.servingGrams = 'Enter the serving weight';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const typed: Nutrients = {
    kcal: kcal!,
    protein_g: protein!,
    carbs_g: opt.carbs ?? null,
    fat_g: opt.fat ?? null,
    fibre_g: opt.fibre ?? null,
    sugars_g: opt.sugars ?? null,
    sat_fat_g: opt.satFat ?? null,
    salt_g: opt.salt ?? null,
  };
  const per100 = servingG ? per100FromServing(typed, servingG) : typed;

  if (per100.carbs_g !== null && per100.sugars_g !== null && per100.sugars_g > per100.carbs_g) errors.sugars = 'More than total carbohydrate';
  if (per100.fat_g !== null && per100.sat_fat_g !== null && per100.sat_fat_g > per100.fat_g) errors.satFat = 'More than total fat';
  const grams: [keyof FoodFormFields, number | null][] = [
    ['protein', per100.protein_g],
    ['carbs', per100.carbs_g],
    ['fat', per100.fat_g],
  ];
  for (const [key, v] of grams) if (v !== null && v > 100) errors[key] = 'More than 100 g per 100 g';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    basis: f.basis === '100ml' ? 'ml' : 'g',
    per100,
    extraServing: servingG ? { label: '1 serving', grams: servingG } : null,
  };
}

const show = (v: number | null) => (v === null ? '' : String(Number(v.toFixed(2))));

/**
 * Form fields pre-filled from stored per-100 values. `unknownKcal`: the energy wasn't found (Open Food Facts or a
 * label photo) and is stored as 0, so show a blank to fill in instead of a real 0.
 */
export function formFieldsFrom(p: { name: string; basis: 'g' | 'ml'; per100: Nutrients }, opts: { unknownKcal?: boolean } = {}): FoodFormFields {
  return {
    name: p.name,
    basis: p.basis === 'ml' ? '100ml' : '100g',
    servingGrams: '',
    kcal: opts.unknownKcal ? '' : show(p.per100.kcal),
    protein: show(p.per100.protein_g),
    carbs: show(p.per100.carbs_g),
    fat: show(p.per100.fat_g),
    fibre: show(p.per100.fibre_g),
    sugars: show(p.per100.sugars_g),
    satFat: show(p.per100.sat_fat_g),
    salt: show(p.per100.salt_g),
  };
}
