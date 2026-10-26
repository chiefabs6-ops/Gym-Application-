import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupBarcode, normaliseOffProduct, searchProducts } from '../src/services/openFoodFacts';

const product = (nutriments: Record<string, number>, extra: Record<string, unknown> = {}) => ({
  code: '5000159484695',
  product_name: 'Greek Style Yogurt 0%',
  brands: 'Brand X, Brand Y',
  nutriments,
  ...extra,
});

const reply = (body: unknown, status = 200) =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normaliseOffProduct', () => {
  it('uses per-100 g values when present', () => {
    const p = normaliseOffProduct(product({ 'energy-kcal_100g': 57, proteins_100g: 10, carbohydrates_100g: 3.6, fat_100g: 0.2 }))!;
    expect(p).toMatchObject({ barcode: '5000159484695', name: 'Greek Style Yogurt 0%', brand: 'Brand X', basis: 'g', complete: true });
    expect(p.per100).toMatchObject({ kcal: 57, protein_g: 10, carbs_g: 3.6, fat_g: 0.2 });
  });

  it('converts kJ-only energy to kcal', () => {
    expect(normaliseOffProduct(product({ 'energy-kj_100g': 418.4, proteins_100g: 5 }))!.per100.kcal).toBeCloseTo(100);
  });

  it('converts per-serving-only values using serving_quantity', () => {
    const p = normaliseOffProduct(product({ 'energy-kcal_serving': 97, proteins_serving: 17 }, { serving_quantity: 170, serving_size: '1 pot (170 g)' }))!;
    expect(p.per100.kcal).toBeCloseTo(57.06, 1);
    expect(p.per100.protein_g).toBeCloseTo(10, 1);
    expect(p.serving).toEqual({ label: '1 pot (170 g)', grams: 170 });
  });

  it('derives salt from sodium and leaves missing extras null, never 0', () => {
    const p = normaliseOffProduct(product({ 'energy-kcal_100g': 57, proteins_100g: 10, sodium_100g: 0.4 }))!;
    expect(p.per100.salt_g).toBeCloseTo(1.0);
    expect(p.per100.fibre_g).toBeNull();
    expect(p.per100.carbs_g).toBeNull();
  });

  it('marks a product incomplete when calories or protein are missing', () => {
    expect(normaliseOffProduct(product({ 'energy-kcal_100g': 57 }))!.complete).toBe(false);
    expect(normaliseOffProduct(product({ proteins_100g: 3 }))).toMatchObject({ kcalKnown: false, complete: false });
    expect(normaliseOffProduct(product({ 'energy-kcal_100g': 0, proteins_100g: 0 }))).toMatchObject({ kcalKnown: true, complete: true });
    expect(normaliseOffProduct(product({}, { product_name: '' }))).toMatchObject({ name: '', complete: false });
  });

  it('reads drinks sold in ml as per 100 ml', () => {
    expect(normaliseOffProduct(product({ 'energy-kcal_100g': 42, proteins_100g: 0 }, { quantity: '330 ml' }))!.basis).toBe('ml');
  });
});

describe('lookupBarcode', () => {
  it('returns the product and sends the custom User-Agent', async () => {
    const fetchMock = reply({ status: 1, product: product({ 'energy-kcal_100g': 57, proteins_100g: 10 }) });
    vi.stubGlobal('fetch', fetchMock);
    const p = await lookupBarcode('5000159484695');
    expect(p).toMatchObject({ name: 'Greek Style Yogurt 0%' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/v2/product/5000159484695.json');
    expect(new Headers(init?.headers).get('User-Agent')).toMatch(/^GymLog\/.+ \(chiefabs6@gmail\.com\)$/);
  });

  it('returns null when the product is not found', async () => {
    vi.stubGlobal('fetch', reply({ status: 0, status_verbose: 'product not found' }));
    expect(await lookupBarcode('0000000000000')).toBeNull();
    vi.stubGlobal('fetch', reply({ status: 0 }, 404));
    expect(await lookupBarcode('0000000000000')).toBeNull();
  });

  it('returns "offline" on network failure, rate limiting or server errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network request failed'); }));
    expect(await lookupBarcode('5000159484695')).toBe('offline');
    vi.stubGlobal('fetch', reply({}, 503));
    expect(await lookupBarcode('5000159484695')).toBe('offline');
    vi.stubGlobal('fetch', reply({}, 429));
    expect(await lookupBarcode('5000159484695')).toBe('offline');
  });
});

describe('searchProducts', () => {
  it('returns normalised products and skips ones without a name', async () => {
    const fetchMock = reply({ products: [product({ 'energy-kcal_100g': 57, proteins_100g: 10 }), product({}, { product_name: '' })] });
    vi.stubGlobal('fetch', fetchMock);
    const hits = await searchProducts('greek yogurt');
    expect(hits).toHaveLength(1);
    expect(fetchMock.mock.calls[0]![0]).toContain('search_terms=greek%20yogurt');
  });

  it('returns "offline" when the search fails', async () => {
    vi.stubGlobal('fetch', reply({}, 503));
    expect(await searchProducts('yogurt')).toBe('offline');
  });
});
