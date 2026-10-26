import { create } from 'zustand';
import type { Meal, Nutrients, Serving } from '@gym/shared';
import type { FoodRow } from '@gym/shared';

/** Values pre-filled into the food form (Open Food Facts check page, label photo, or a new food). */
export interface FoodDraft {
  name: string;
  brand: string | null;
  barcode: string | null;
  basis: 'g' | 'ml';
  per100: Nutrients;
  /** false: energy wasn't found (kcal stored as 0), so the form shows it blank. */
  kcalKnown: boolean;
  servings: Serving[];
  source: FoodRow['source'];
}

/**
 * Hand-off between screens without URL-encoding nutrient objects: the add-food / scan screens put a draft here,
 * the food form reads it. `logTo`: after saving, open the portion screen for this meal and day.
 */
interface FoodFormDraftState {
  draft: FoodDraft | null;
  logTo: { meal: Meal; date: string } | null;
  set: (draft: FoodDraft | null, logTo?: { meal: Meal; date: string } | null) => void;
  clear: () => void;
}

export const useFoodFormDraftStore = create<FoodFormDraftState>()((set) => ({
  draft: null,
  logTo: null,
  set: (draft, logTo = null) => set({ draft, logTo }),
  clear: () => set({ draft: null, logTo: null }),
}));
