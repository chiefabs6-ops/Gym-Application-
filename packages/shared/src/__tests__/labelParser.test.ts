import { describe, expect, it } from 'vitest';
import { parseNutritionLabel, rowsFromOcrLines } from '../labelParser';
import { EU_TWO_COLUMN, KJ_ONLY, TRACE_AND_SODIUM } from './fixtures/labels';

describe('parseNutritionLabel', () => {
  it('reads the per 100 g column of a two-column EU label and the serving size', () => {
    const r = parseNutritionLabel(EU_TWO_COLUMN);
    expect(r.per100).toEqual({ kcal: 389, fat_g: 7.0, sat_fat_g: 1.2, carbs_g: 60.0, sugars_g: 1.0, fibre_g: 9.0, protein_g: 13.0, salt_g: 0.02 });
    expect(r.servingGrams).toBe(30);
    expect(r.found.sort()).toEqual(['carbs_g', 'fat_g', 'fibre_g', 'kcal', 'protein_g', 'salt_g', 'sat_fat_g', 'sugars_g']);
  });

  it('converts kJ to kcal when the label has no kcal, and reads comma decimals', () => {
    const r = parseNutritionLabel(KJ_ONLY);
    expect(r.per100.kcal).toBeCloseTo(43.02, 1);
    expect(r.per100).toMatchObject({ fat_g: 0, carbs_g: 10.6, sugars_g: 10.6, protein_g: 0, salt_g: 0 });
    expect(r.servingGrams).toBeNull();
    expect(r.found).not.toContain('fibre_g');
  });

  it('reads "<0.5 g" as 0.5 and converts sodium in mg to salt', () => {
    const r = parseNutritionLabel(TRACE_AND_SODIUM);
    expect(r.per100).toMatchObject({ kcal: 502, fat_g: 28, sat_fat_g: 3.1, carbs_g: 52, sugars_g: 0.5, protein_g: 9.5 });
    expect(r.per100.salt_g).toBeCloseTo(1.0);
  });

  it('uses the second column when the portion column comes first', () => {
    const r = parseNutritionLabel(['Per 30g serving Per 100g', 'Energy 117kcal 389kcal', 'Protein 3.9g 13.0g']);
    expect(r.per100).toEqual({ kcal: 389, protein_g: 13 });
    expect(r.servingGrams).toBe(30);
  });

  it('returns nothing found for unrelated text', () => {
    expect(parseNutritionLabel(['INGREDIENTS: oats, salt']).found).toEqual([]);
  });

  it('rebuilds table rows from OCR lines split into columns, by vertical position', () => {
    const line = (text: string, left: number, top: number) => ({ text, frame: { left, top, width: 80, height: 20 } });
    const rows = rowsFromOcrLines([
      line('Energy', 10, 100), line('Fat', 10, 130), line('Protein', 10, 160),
      line('1628kJ / 389kcal', 200, 102), line('7.0g', 200, 128), line('13.0g', 200, 161),
      line('488kJ / 117kcal', 320, 99), line('2.1g', 320, 131), line('3.9g', 320, 159),
      line('Typical values Per 100g Per 30g', 10, 60),
    ]);
    expect(rows).toEqual(['Typical values Per 100g Per 30g', 'Energy 1628kJ / 389kcal 488kJ / 117kcal', 'Fat 7.0g 2.1g', 'Protein 13.0g 3.9g']);
    expect(parseNutritionLabel(rows).per100).toMatchObject({ kcal: 389, fat_g: 7, protein_g: 13 });
  });

  it('keeps OCR lines without positions in their original order', () => {
    expect(rowsFromOcrLines([{ text: 'Fat 7g' }, { text: 'Protein 13g' }])).toEqual(['Fat 7g', 'Protein 13g']);
  });
});
