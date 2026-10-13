import { useEffect, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cancelScheduled, scheduleRestDone } from '../services/notifications';
import { ensureSoundsLoaded, playCountdownTick, playRestFinished, primeAudioOutput } from '../services/sounds';
import { getSettings } from './settingsStore';
import { initialCueState, nextCue } from '../services/restCues';
import { kvStorage } from './storage';

/**
 * Precision rest timer.
 *
 * JS timers are paused when Android backgrounds the app or the screen sleeps, so the
 * timer never "counts". It stores an absolute deadline (endsAt) and derives the remaining
 * time from the wall clock on every render. Completion while backgrounded is delivered by
 * an OS-scheduled notification. State is persisted, so it survives the process being killed.
 *
 * Audio/vibration cues and expiry are owned by useRestTimerCues(), mounted once at the app root.
 */
interface RestTimerState {
  endsAt: number | null;
  totalMs: number;
  pausedRemainingMs: number | null;
  notificationId: string | null;
  start: (seconds: number) => Promise<void>;
  adjust: (deltaSeconds: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

export const useRestTimerStore = create<RestTimerState>()(
  persist(
    (set, get) => {
      const arm = async (remainingMs: number, totalMs: number) => {
        await cancelScheduled(get().notificationId);
        const endsAt = Date.now() + remainingMs;
        set({ endsAt, totalMs, pausedRemainingMs: null, notificationId: null });
        const { rest_sound, rest_vibration } = getSettings();
        const notificationId = await scheduleRestDone(remainingMs / 1000, { sound: rest_sound, vibrate: rest_vibration });
        // Guard against a stop()/restart racing the async schedule.
        if (get().endsAt === endsAt) set({ notificationId });
        else await cancelScheduled(notificationId);
      };

      return {
        endsAt: null,
        totalMs: 0,
        pausedRemainingMs: null,
        notificationId: null,
        start: (seconds) => arm(seconds * 1000, seconds * 1000),

        adjust: async (delta) => {
          const { endsAt, totalMs, pausedRemainingMs } = get();
          if (pausedRemainingMs !== null) {
            set({ pausedRemainingMs: Math.max(0, pausedRemainingMs + delta * 1000), totalMs: Math.max(1000, totalMs + delta * 1000) });
            return;
          }
          if (endsAt === null) return;
          const remaining = endsAt - Date.now() + delta * 1000;
          if (remaining <= 0) return get().stop();
          await arm(remaining, Math.max(remaining, totalMs + delta * 1000));
        },

        pause: async () => {
          const { endsAt, notificationId } = get();
          if (endsAt === null) return;
          await cancelScheduled(notificationId);
          set({ pausedRemainingMs: Math.max(0, endsAt - Date.now()), endsAt: null, notificationId: null });
        },

        resume: async () => {
          const { pausedRemainingMs, totalMs } = get();
          if (pausedRemainingMs !== null) await arm(pausedRemainingMs, totalMs);
        },

        stop: async () => {
          await cancelScheduled(get().notificationId);
          set({ endsAt: null, pausedRemainingMs: null, notificationId: null, totalMs: 0 });
        },
      };
    },
    {
      name: 'rest-timer',
      storage: kvStorage,
      partialize: ({ endsAt, totalMs, pausedRemainingMs, notificationId }) => ({
        endsAt,
        totalMs,
        pausedRemainingMs,
        notificationId,
      }),
    },
  ),
);

/** Render-side ticker for display only. Recomputes from the wall clock; never accumulates drift. */
export function useRestTimer(tickMs = 250) {
  const { endsAt, totalMs, pausedRemainingMs } = useRestTimerStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), tickMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [endsAt, tickMs]);

  const remainingMs = pausedRemainingMs ?? (endsAt === null ? 0 : Math.max(0, endsAt - now));

  return {
    remainingMs,
    totalMs,
    isActive: endsAt !== null || pausedRemainingMs !== null,
    isPaused: pausedRemainingMs !== null,
  };
}

const CUE_POLL_MS = 50;

/**
 * Single owner of rest-timer side effects. Mount ONCE at the app root so cues fire on any tab:
 *   - a tick at 3, 2 and 1 seconds remaining (audio primed silently at 4)
 *   - a distinct finish beep + vibration at 0, then stops the timer
 * Cues only play while the app is in the foreground; in the background the scheduled
 * notification signals the end instead. Timing decisions live in `nextCue` (unit-tested).
 */
export function useRestTimerCues() {
  const endsAt = useRestTimerStore((s) => s.endsAt);

  useEffect(() => {
    if (endsAt === null) return;
    // Warm up (or retry) the sounds now, long before the countdown needs them.
    void ensureSoundsLoaded();
    let cueState = initialCueState(endsAt - Date.now());

    const id = setInterval(() => {
      const { cue, state } = nextCue(endsAt - Date.now(), cueState);
      cueState = state;
      if (cue === 'none') return;

      const foreground = AppState.currentState === 'active';
      const { rest_sound: soundEnabled, rest_vibration: vibrate } = getSettings();
      switch (cue) {
        case 'prime':
          if (foreground && soundEnabled) primeAudioOutput();
          return;
        case 'tick':
          if (foreground && soundEnabled) playCountdownTick();
          return;
        case 'finish':
          if (foreground && soundEnabled) playRestFinished();
          if (foreground && vibrate) Vibration.vibrate([0, 400, 200, 400]);
          break;
        case 'expire-silently':
          break;
      }
      clearInterval(id);
      void useRestTimerStore.getState().stop();
    }, CUE_POLL_MS);

    return () => clearInterval(id);
  }, [endsAt]);
}
