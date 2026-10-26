import { describe, expect, it } from 'vitest';
import { buildFoodFromForm, formFieldsFrom, type FoodFormFields } from '../foodForm';

const fields = (over: Partial<FoodFormFields> = {}): FoodFormFields => ({
  name: 'Granola',
  basis: '100g',
  servingGrams: '',
  kcal: '450',
  protein: '10',
  carbs: '',
  fat: '',
  fibre: '',
  sugars: '',
  satFat: '',
  salt: '',
  ...over,
});

describe('buildFoodFromForm', () => {
  it('needs only a name, calories and protein; blanks stay unknown', () => {
    const r = buildFoodFromForm(fields());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.basis).toBe('g');
    expect(r.per100).toEqual({ kcal: 450, protein_g: 10, carbs_g: null, fat_g: null, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null });
    expect(r.extraServing).toBeNull();
  });

  it('reports missing required fields and junk numbers', () => {
    const r = buildFoodFromForm(fields({ name: ' ', kcal: '', protein: 'x', carbs: 'abc' }));
    expect(r).toEqual({ ok: false, errors: { name: 'Enter a name', kcal: 'Required', protein: 'Required', carbs: 'Not a number' } });
  });

  it('converts values per serving to per 100 g and keeps the serving', () => {
    const r = buildFoodFromForm(fields({ basis: 'serving', servingGrams: '40', kcal: '180', protein: '4', carbs: '24,4' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.per100.kcal).toBeCloseTo(450);
    expect(r.per100.protein_g).toBeCloseTo(10);
    expect(r.per100.carbs_g).toBeCloseTo(61);
    expect(r.extraServing).toEqual({ label: '1 serving', grams: 40 });
    expect(buildFoodFromForm(fields({ basis: 'serving', servingGrams: '' }))).toMatchObject({ ok: false, errors: { servingGrams: 'Enter the serving weight' } });
  });

  it('stores drinks per 100 ml', () => {
    const r = buildFoodFromForm(fields({ basis: '100ml', kcal: '42', protein: '0' }));
    expect(r.ok && r.basis).toBe('ml');
  });

  it('rejects "of which" values above their total and macros over 100 g per 100 g', () => {
    expect(buildFoodFromForm(fields({ carbs: '10', sugars: '12' }))).toMatchObject({ ok: false, errors: { sugars: 'More than total carbohydrate' } });
    expect(buildFoodFromForm(fields({ fat: '5', satFat: '6' }))).toMatchObject({ ok: false, errors: { satFat: 'More than total fat' } });
    expect(buildFoodFromForm(fields({ protein: '120' }))).toMatchObject({ ok: false, errors: { protein: 'More than 100 g per 100 g' } });
  });

  it('pre-fills the form from stored values, leaving unknowns blank', () => {
    const f = formFieldsFrom({ name: 'Yogurt', basis: 'ml', per100: { kcal: 57, protein_g: 10, carbs_g: 3.6, fat_g: null, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: 0.125 } });
    expect(f).toMatchObject({ name: 'Yogurt', basis: '100ml', kcal: '57', protein: '10', carbs: '3.6', fat: '', salt: '0.13' });
    expect(buildFoodFromForm(f)).toMatchObject({ ok: true, basis: 'ml' });
  });

  it('keeps a real 0 kcal (water) but blanks an unknown energy on drafts', () => {
    const water = { name: 'Water', basis: 'ml' as const, per100: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: 0 } };
    expect(formFieldsFrom(water).kcal).toBe('0');
    expect(formFieldsFrom(water, { unknownKcal: true }).kcal).toBe('');
  });
});
