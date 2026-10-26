import { create } from 'zustand';

export interface ToastRequest {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastState {
  toast: (ToastRequest & { id: number }) | null;
  show: (t: ToastRequest) => void;
  hide: () => void;
}

let nextId = 1;

/** One toast at a time; a new one replaces the old (e.g. "Added Oats · Undo"). */
export const useToastStore = create<ToastState>()((set) => ({
  toast: null,
  show: (t) => set({ toast: { ...t, id: nextId++ } }),
  hide: () => set({ toast: null }),
}));

export const showToast = (t: ToastRequest) => useToastStore.getState().show(t);

/** For `.catch()` on a save whose sheet already closed: tell the user nothing was saved. */
export const saveFailed = (e: unknown) => {
  const message = e instanceof Error && e.name === 'BatchOverdrawError' ? e.message : 'Couldn’t save. Try again.';
  showToast({ message });
};
