import { kcalFromKj, saltFromSodiumMg, type Nutrients } from './nutrition';

/**
 * Reads a photographed nutrition table (OCR text lines) into per-100 g values (ROADMAP 2.15, spec §6.4).
 * Best effort: the user always checks the result on a confirmation page. Handles EU tables with a per 100 g and a
 * per-portion column, kJ-only energy, comma decimals, "<0.5 g" and sodium instead of salt.
 */
export interface ParsedLabel {
  per100: Partial<Nutrients>;
  servingGrams: number | null;
  found: (keyof Nutrients)[];
}

const NUMBER = /(?:<\s*)?(\d+(?:[.,]\d+)?)\s*(mg|g)?/gi;
const toNumber = (s: string) => Number(s.replace(',', '.'));

/** Row keywords, most specific first (so "of which saturates" isn't read as fat). */
const ROWS: { key: Exclude<keyof Nutrients, 'kcal'> | 'sodium'; test: RegExp }[] = [
  { key: 'sat_fat_g', test: /saturate/i },
  { key: 'sugars_g', test: /sugar/i },
  { key: 'fibre_g', test: /fib(re|er)/i },
  { key: 'carbs_g', test: /carbohydrate/i },
  { key: 'protein_g', test: /protein/i },
  { key: 'salt_g', test: /\bsalt\b/i },
  { key: 'sodium', test: /\bsodium\b/i },
  { key: 'fat_g', test: /\bfat\b/i },
];

/** Index of the per-100 column: second when the header names a portion before "100 g". */
function per100Column(lines: string[]): number {
  for (const line of lines) {
    const at100 = line.search(/100\s*(g|ml)\b/i);
    if (at100 < 0) continue;
    // A portion column is "portion"/"serving" or "per <n> g" with n ≠ 100.
    const portion = [...line.matchAll(/portion|serving|per\s*(\d+(?:[.,]\d+)?)\s*g\b/gi)].find((m) => m[1] === undefined || toNumber(m[1]) !== 100);
    return portion?.index !== undefined && portion.index < at100 ? 1 : 0;
  }
  return 0;
}

function servingGrams(lines: string[]): number | null {
  for (const line of lines) {
    const re = /(?:portion|serving|per)\D{0,12}?(\d+(?:[.,]\d+)?)\s*g\b/gi;
    for (const m of line.matchAll(re)) {
      const g = toNumber(m[1]!);
      if (g !== 100) return g;
    }
  }
  return null;
}

/** Numbers on a row after its label, with units. */
function rowValues(line: string, labelEnd: number): { value: number; unit: string | undefined }[] {
  return [...line.slice(labelEnd).matchAll(NUMBER)].map((m) => ({ value: toNumber(m[1]!), unit: m[2]?.toLowerCase() }));
}

export interface OcrLine {
  text: string;
  frame?: { left: number; top: number; width: number; height: number };
}

/**
 * Text recognition often returns a table's label column and number columns as separate blocks. Rebuilds rows by
 * grouping lines whose vertical centres are within half a line height, then reading each row left to right.
 * Lines without positions keep their order.
 */
export function rowsFromOcrLines(lines: OcrLine[]): string[] {
  const placed = lines.filter((l): l is Required<OcrLine> => l.frame !== undefined);
  if (placed.length < lines.length) return lines.map((l) => l.text);
  const sorted = [...placed].sort((a, b) => a.frame.top + a.frame.height / 2 - (b.frame.top + b.frame.height / 2));
  const rows: { centre: number; height: number; items: Required<OcrLine>[] }[] = [];
  for (const l of sorted) {
    const centre = l.frame.top + l.frame.height / 2;
    const row = rows[rows.length - 1];
    if (row && Math.abs(centre - row.centre) <= Math.max(row.height, l.frame.height) / 2) row.items.push(l);
    else rows.push({ centre, height: l.frame.height, items: [l] });
  }
  return rows.map((r) => r.items.sort((a, b) => a.frame.left - b.frame.left).map((l) => l.text).join(' '));
}

export function parseNutritionLabel(lines: string[]): ParsedLabel {
  const col = per100Column(lines);
  const per100: Partial<Nutrients> = {};

  for (const line of lines) {
    if (/energy|kcal|kj/i.test(line)) {
      const kcal = [...line.matchAll(/(\d+(?:[.,]\d+)?)\s*kcal/gi)].map((m) => toNumber(m[1]!));
      const kj = [...line.matchAll(/(\d+(?:[.,]\d+)?)\s*kj/gi)].map((m) => toNumber(m[1]!));
      if (per100.kcal === undefined) {
        if (kcal.length > 0) per100.kcal = kcal[Math.min(col, kcal.length - 1)];
        else if (kj.length > 0) per100.kcal = kcalFromKj(kj[Math.min(col, kj.length - 1)]!);
      }
      continue;
    }
    const row = ROWS.find((r) => r.test.test(line));
    if (!row) continue;
    const labelEnd = line.search(row.test) + (line.match(row.test)?.[0].length ?? 0);
    const values = rowValues(line, labelEnd);
    const v = values[Math.min(col, values.length - 1)];
    if (!v) continue;
    if (row.key === 'sodium') {
      if (per100.salt_g === undefined) per100.salt_g = v.unit === 'mg' ? saltFromSodiumMg(v.value) : v.value * 2.5;
    } else if (per100[row.key] === undefined) {
      per100[row.key] = v.unit === 'mg' ? v.value / 1000 : v.value;
    }
  }

  return { per100, servingGrams: servingGrams(lines), found: Object.keys(per100) as (keyof Nutrients)[] };
}
