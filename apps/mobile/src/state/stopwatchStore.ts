import { create } from 'zustand';

/**
 * Inline stopwatch for timed sets (plank, holds). One runs at a time. It stores the wall-clock start, not a
 * counter, so it stays right when the page is swiped away, the screen locks or JS timers pause.
 */
interface StopwatchState {
  setId: string | null;
  startedAt: number | null;
  start: (setId: string) => void;
  /** Stops and returns the elapsed whole seconds (0 if it wasn't running for this set). */
  stop: (setId: string) => number;
}

export const useStopwatchStore = create<StopwatchState>()((set, get) => ({
  setId: null,
  startedAt: null,
  start: (setId) => set({ setId, startedAt: Date.now() }),
  stop: (setId) => {
    const { setId: running, startedAt } = get();
    set({ setId: null, startedAt: null });
    return running === setId && startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
  },
}));
