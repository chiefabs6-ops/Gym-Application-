import type { FoodRow, Nutrients, Serving } from '@gym/shared';
import { db } from '../client';
import { getMeta, setMeta } from '../meta';

/**
 * Bundled CoFID + USDA food list (ROADMAP 2.15, built by scripts/build-food-db.py). Lives in the local,
 * non-synced `builtin_foods` table, reloaded only when the bundled list's version changes.
 */
export interface BuiltinFood extends Nutrients {
  id: string;
  name: string;
  name_search: string;
  source: 'cofid' | 'usda';
  basis: 'g' | 'ml';
  servings: Serving[];
  /** USDA near-duplicate of this CoFID food: hidden in search when that food also matches. */
  hidden_by?: string | null;
}
export interface BuiltinFoodsFile {
  version: string;
  foods: BuiltinFood[];
}

export type FoodRef = { kind: 'builtin'; id: string } | { kind: 'food'; id: string };

export interface LocalFoodHit {
  ref: FoodRef;
  name: string;
  brand: string | null;
  per100: Nutrients;
  servings: Serving[];
  basis: 'g' | 'ml';
}

const COLUMNS = ['id', 'name', 'name_search', 'source', 'basis', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'sugars_g', 'sat_fat_g', 'salt_g', 'servings', 'hidden_by'] as const;

/** The 3.9 MB list is only loaded when its version (a tiny separate file) differs from what's in the database. */
async function bundledVersion(): Promise<string> {
  return ((await import('../../../assets/foods/builtin-foods.version.json')).default as { version: string }).version;
}
async function bundledFoods(): Promise<BuiltinFoodsFile> {
  return (await import('../../../assets/foods/builtin-foods.json')).default as BuiltinFoodsFile;
}

/**
 * Loads the bundled list into `builtin_foods` when its version changed. Runs after startup (root layout), not in
 * initDatabase, so a failure here can never stop the app from opening.
 */
export async function seedBuiltinFoods(data?: BuiltinFoodsFile): Promise<void> {
  const stored = await getMeta('builtin_foods_version');
  if (!data && stored === (await bundledVersion())) return;
  const file = data ?? (await bundledFoods());
  if (stored === file.version) return;
  const sql = `INSERT INTO builtin_foods (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM builtin_foods');
    const stmt = await db.prepareAsync(sql);
    try {
      for (const f of file.foods) {
        await stmt.executeAsync([f.id, f.name, f.name_search, f.source, f.basis, f.kcal, f.protein_g, f.carbs_g, f.fat_g,
          f.fibre_g, f.sugars_g, f.sat_fat_g, f.salt_g, JSON.stringify(f.servings), f.hidden_by ?? null]);
      }
    } finally {
      await stmt.finalizeAsync();
    }
    await setMeta('builtin_foods_version', file.version);
  });
}

/** Same normalisation as the build script's name_search: lowercase ASCII words. */
export const normaliseQuery = (q: string) =>
  q.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const per100Of = (r: Nutrients): Nutrients => ({
  kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g,
  fibre_g: r.fibre_g, sugars_g: r.sugars_g, sat_fat_g: r.sat_fat_g, salt_g: r.salt_g,
});

type BuiltinRow = Omit<BuiltinFood, 'servings'> & { servings: string };
const builtinHit = (r: BuiltinRow): LocalFoodHit => ({
  ref: { kind: 'builtin', id: r.id },
  name: r.name,
  brand: null,
  per100: per100Of(r),
  servings: JSON.parse(r.servings) as Serving[],
  basis: r.basis,
});

type FoodDbRow = Omit<FoodRow, 'servings'> & { servings: string };
export const userFoodHit = (r: FoodDbRow): LocalFoodHit => ({
  ref: { kind: 'food', id: r.id },
  name: r.name,
  brand: r.brand,
  per100: per100Of(r),
  servings: JSON.parse(r.servings) as Serving[],
  basis: r.basis,
});

/**
 * Every word of the query must appear in the name (any order). Your own foods first (name or brand), then the
 * built-in list, shorter names first. A USDA food is hidden when the CoFID food it duplicates also matches.
 */
export async function searchLocalFoods(query: string, limit = 50): Promise<LocalFoodHit[]> {
  const words = normaliseQuery(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const likes = words.map((w) => `%${w}%`);

  const userWhere = words.map(() => `(name || ' ' || COALESCE(brand, '')) LIKE ?`).join(' AND ');
  const mine = await db.getAllAsync<FoodDbRow>(
    `SELECT * FROM foods WHERE deleted_at IS NULL AND archived_at IS NULL AND ${userWhere}
     ORDER BY length(name), name COLLATE NOCASE LIMIT ?`,
    [...likes, limit],
  );

  const match = words.map(() => 'name_search LIKE ?').join(' AND ');
  const builtin = await db.getAllAsync<BuiltinRow>(
    `SELECT * FROM builtin_foods
     WHERE ${match}
       AND NOT (hidden_by IS NOT NULL AND hidden_by IN (SELECT id FROM builtin_foods WHERE ${match}))
     ORDER BY length(name), name LIMIT ?`,
    [...likes, ...likes, Math.max(0, limit - mine.length)],
  );
  return [...mine.map(userFoodHit), ...builtin.map(builtinHit)];
}

export async function getBuiltinFood(id: string): Promise<LocalFoodHit | null> {
  const r = await db.getFirstAsync<BuiltinRow>('SELECT * FROM builtin_foods WHERE id = ?', [id]);
  return r ? builtinHit(r) : null;
}
