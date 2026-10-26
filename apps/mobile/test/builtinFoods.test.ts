import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client';
import { createRecord } from '../src/db/mutate';
import { type BuiltinFoodsFile, getBuiltinFood, searchLocalFoods, seedBuiltinFoods } from '../src/db/repositories/builtinFoods';
import { freshApp } from './helpers';
import { getMeta } from '../src/db/meta';
import { initDatabase } from '../src/db/migrations';
import { resetTestDatabase } from './mocks/expoSqlite';

const food = (id: string, name: string, extra: Partial<BuiltinFoodsFile['foods'][number]> = {}) => ({
  id,
  name,
  name_search: name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  source: id.startsWith('cofid') ? ('cofid' as const) : ('usda' as const),
  basis: 'g' as const,
  kcal: 150,
  protein_g: 20,
  carbs_g: 0,
  fat_g: 5,
  fibre_g: null,
  sugars_g: null,
  sat_fat_g: null,
  salt_g: null,
  servings: [],
  ...extra,
});

const fixture: BuiltinFoodsFile = {
  version: 'test-1',
  foods: [
    food('cofid:18-323', 'Chicken, breast, grilled without skin, meat only'),
    food('cofid:13-001', 'Chickpeas, canned'),
    food('cofid:12-937', 'Eggs, chicken, whole, raw'),
    food('usda:171287', 'Egg, whole, raw, fresh', { hidden_by: 'cofid:12-937', servings: [{ label: '1 large', grams: 50 }] }),
    food('usda:999', 'Egg, white, raw', { hidden_by: 'cofid:12-937' }),
  ],
};

let userId: string;
beforeEach(async () => {
  userId = await freshApp();
  await seedBuiltinFoods(fixture);
});

const count = async () => (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM builtin_foods'))!.n;

describe('built-in foods', () => {
  it('loads the bundled list once per version', async () => {
    expect(await count()).toBe(5);
    await db.runAsync(`INSERT INTO builtin_foods (id, name, name_search, source, basis, kcal, servings) VALUES ('x', 'Marker', 'marker', 'cofid', 'g', 1, '[]')`);
    await seedBuiltinFoods(fixture);
    expect(await count()).toBe(6); // same version: untouched
    await seedBuiltinFoods({ ...fixture, version: 'test-2', foods: fixture.foods.slice(0, 2) });
    expect(await count()).toBe(2); // new version: replaced
  });

  it('matches every word of the query, anywhere in the name', async () => {
    const names = (await searchLocalFoods('chick bre')).map((h) => h.name);
    expect(names).toEqual(['Chicken, breast, grilled without skin, meat only']);
  });

  it('ranks my own foods first and leaves out archived ones', async () => {
    const base = { user_id: userId, brand: 'Tesco', barcode: null, source: 'custom' as const, basis: 'g' as const, kcal: 120, protein_g: 25,
      carbs_g: 0, fat_g: 2, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null, servings: [] };
    await createRecord('foods', { ...base, name: 'Chicken breast fillets', archived_at: null });
    await createRecord('foods', { ...base, name: 'Chicken breast old', archived_at: 1 });
    const hits = await searchLocalFoods('chicken breast');
    expect(hits.map((h) => h.name)).toEqual(['Chicken breast fillets', 'Chicken, breast, grilled without skin, meat only']);
    expect(hits[0]!.ref.kind).toBe('food');
    expect(hits[0]!.brand).toBe('Tesco');
  });

  it('hides a USDA near-duplicate when its CoFID twin also matches', async () => {
    expect((await searchLocalFoods('egg raw')).map((h) => h.ref.id)).toEqual(['cofid:12-937']);
    // "white" doesn't match the CoFID egg, so the USDA egg white is shown
    expect((await searchLocalFoods('egg white')).map((h) => h.ref.id)).toEqual(['usda:999']);
  });

  it('returns a built-in food with its servings and per-100 values', async () => {
    const egg = await getBuiltinFood('usda:171287');
    expect(egg).toMatchObject({ ref: { kind: 'builtin', id: 'usda:171287' }, servings: [{ label: '1 large', grams: 50 }], per100: { kcal: 150, protein_g: 20 } });
    expect(await getBuiltinFood('nope')).toBeNull();
  });
});

describe('bundled list loading', () => {
  it('startup (initDatabase) does not load the food list; it loads separately, once per version', async () => {
    resetTestDatabase();
    await initDatabase();
    expect(await count()).toBe(0);
    await seedBuiltinFoods();
    const loaded = await count();
    expect(loaded).toBeGreaterThan(10_000);
    const version = await getMeta('builtin_foods_version');
    const { version: bundled } = (await import('../assets/foods/builtin-foods.version.json')).default as { version: string };
    expect(version).toBe(bundled);
    await seedBuiltinFoods(); // same version: no reload
    expect(await count()).toBe(loaded);
  });
});
