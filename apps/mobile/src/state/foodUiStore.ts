import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Meal } from '@gym/shared';
import { kvStorage } from './storage';

/**
 * Food tab UI state. `lastMeal` (the meal tab shown when the Food tab opens) survives restarts.
 * `lateNightChoice` is the 00:00–02:59 "yesterday or today?" answer, kept only for the current visit.
 */
interface FoodUiState {
  lastMeal: Meal;
  setLastMeal: (m: Meal) => void;
  lateNightChoice: 'yesterday' | 'today' | null;
  setLateNightChoice: (c: 'yesterday' | 'today' | null) => void;
}

export const useFoodUiStore = create<FoodUiState>()(
  persist(
    (set) => ({
      lastMeal: 'breakfast',
      setLastMeal: (lastMeal) => set({ lastMeal }),
      lateNightChoice: null,
      setLateNightChoice: (lateNightChoice) => set({ lateNightChoice }),
    }),
    { name: 'food-ui', storage: kvStorage, partialize: (s) => ({ lastMeal: s.lastMeal }) },
  ),
);
