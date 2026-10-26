import Constants from 'expo-constants';
import { kcalFromKj, per100FromServing, type Nutrients, type Serving } from '@gym/shared';

/**
 * Open Food Facts client (ROADMAP 2.15, spec §6). The only online part of food tracking: product search and
 * barcode lookup. Data is ODbL (attribution in Settings). API rules: identify the app with a custom User-Agent,
 * ≤ 15 product reads and ≤ 10 searches per minute, no search on every keystroke. Every failure is reported as
 * 'offline' so callers fall back to local foods / the label photo.
 */

const BASE = 'https://world.openfoodfacts.org';
const CONTACT = 'chiefabs6@gmail.com';
const TIMEOUT_MS = 8000;
const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,serving_size,quantity';
const userAgent = () => `GymLog/${Constants.expoConfig?.version ?? 'unknown'} (${CONTACT})`;

export interface OffProduct {
  barcode: string;
  name: string;
  brand: string | null;
  basis: 'g' | 'ml';
  per100: Nutrients;
  serving: Serving | null;
  /** Energy was listed (false = stored as 0 but unknown; the form shows a blank). */
  kcalKnown: boolean;
  /** Calories and protein present (the two values the food form requires). */
  complete: boolean;
}

/* ───────────────────────────── Rate limiting ───────────────────────────── */

const WINDOW_MS = 60_000;
const calls = { product: [] as number[], search: [] as number[] };
const LIMITS = { product: 15, search: 10 };

/** Waits until another call of this kind fits in the per-minute limit. */
async function throttle(kind: keyof typeof calls): Promise<void> {
  const list = calls[kind];
  const now = Date.now();
  while (list.length > 0 && now - list[0]! >= WINDOW_MS) list.shift();
  if (list.length >= LIMITS[kind]) {
    await new Promise((resolve) => setTimeout(resolve, WINDOW_MS - (now - list[0]!)));
    list.shift();
  }
  list.push(Date.now());
}

async function getJson(url: string): Promise<{ status: number; body: unknown } | 'offline'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' }, signal: controller.signal });
    if (res.status === 429 || res.status >= 500) return 'offline';
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
}

/* ───────────────────────────── Normalising ───────────────────────────── */

const numberOr = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Nutrients for one basis (per 100 g or per serving); null when the product lists none. */
function readNutrients(n: Record<string, unknown>, suffix: '_100g' | '_serving'): { values: Nutrients; hasKcal: boolean } | null {
  const get = (key: string) => numberOr(n[`${key}${suffix}`]);
  const kj = get('energy-kj');
  const kcal = get('energy-kcal') ?? (kj !== null ? kcalFromKj(kj) : null);
  const sodium = get('sodium'); // grams
  const rest = {
    protein_g: get('proteins'),
    carbs_g: get('carbohydrates'),
    fat_g: get('fat'),
    fibre_g: get('fiber'),
    sugars_g: get('sugars'),
    sat_fat_g: get('saturated-fat'),
    salt_g: get('salt') ?? (sodium !== null ? sodium * 2.5 : null),
  };
  if (kcal === null && Object.values(rest).every((v) => v === null)) return null;
  return { values: { kcal: kcal ?? 0, ...rest }, hasKcal: kcal !== null };
}

const EMPTY: Nutrients = { kcal: 0, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null };

export function normaliseOffProduct(raw: unknown): OffProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const nutriments = (p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {}) as Record<string, unknown>;
  const servingG = numberOr(p.serving_quantity);
  let found = readNutrients(nutriments, '_100g');
  if (!found && servingG) {
    const perServing = readNutrients(nutriments, '_serving');
    if (perServing) found = { values: per100FromServing(perServing.values, servingG), hasKcal: perServing.hasKcal };
  }
  const per100 = found?.values ?? EMPTY;
  const quantity = typeof p.quantity === 'string' ? p.quantity : '';
  const servingLabel = typeof p.serving_size === 'string' && p.serving_size.trim() ? p.serving_size.trim().slice(0, 60) : '1 serving';
  return {
    barcode: typeof p.code === 'string' ? p.code : '',
    name: typeof p.product_name === 'string' ? p.product_name.trim().slice(0, 120) : '',
    brand: typeof p.brands === 'string' && p.brands.trim() ? p.brands.split(',')[0]!.trim().slice(0, 120) : null,
    basis: /\d\s*(ml|cl|l)\b/i.test(quantity) ? 'ml' : 'g',
    per100,
    serving: servingG && servingG > 0 && servingG <= 5000 ? { label: servingLabel, grams: servingG } : null,
    kcalKnown: !!found?.hasKcal,
    complete: !!found?.hasKcal && per100.protein_g !== null,
  };
}

/* ───────────────────────────── API ───────────────────────────── */

export async function lookupBarcode(code: string): Promise<OffProduct | null | 'offline'> {
  await throttle('product');
  const r = await getJson(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (r === 'offline') return 'offline';
  const body = r.body as { status?: number; product?: unknown } | null;
  if (r.status === 404 || !body || body.status !== 1) return null;
  return normaliseOffProduct(body.product);
}

export async function searchProducts(query: string): Promise<OffProduct[] | 'offline'> {
  await throttle('search');
  const q = encodeURIComponent(query.trim());
  const r = await getJson(`${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`);
  if (r === 'offline') return 'offline';
  const products = (r.body as { products?: unknown[] } | null)?.products ?? [];
  return products.map(normaliseOffProduct).filter((p): p is OffProduct => p !== null && p.name !== '');
}
