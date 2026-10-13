import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { afterSetCompleted, resolveRestSeconds, type PRKind } from '@gym/shared';
import { db } from '../db/client';
import { getRecord } from '../db/mutate';
import * as workouts from '../db/repositories/workouts';
import { getSavePrompt, type SavePrompt } from '../db/repositories/plan';
import { runAutoBackup } from '../services/backup';
import { evaluateCompletedSet } from '../services/prEngine';
import { useIntervalRunStore } from './intervalRunStore';
import { useRestTimerStore } from './restTimerStore';
import { getSettings, useSettingsStore } from './settingsStore';
import { kvStorage } from './storage';

/** Set while a session is being created, so a double tap can't start two workouts. */
let starting = false;

/**
 * Active workout engine (singleton store).
 *
 * Workout DATA lives in SQLite (screens read it with useLiveQuery); this store only holds
 * which session is active plus ephemeral UI state such as PR badges. All writes go through
 * the repositories, which commit locally and enqueue for sync.
 */
interface ActiveWorkoutState {
  sessionId: string | null;
  startedAt: number | null;
  /** setId → records broken when it was completed. */
  prHits: Record<string, PRKind[]>;
  /** Focused exercise in the pager. Persisted so a relaunch reopens the same exercise. */
  currentIndex: number;
  /** Interval timer "auto-start next set" chosen in this workout (session_exercise id → on/off). Beats the routine's. */
  autoNext: Record<string, boolean>;

  setCurrentIndex: (index: number) => void;
  /** In-workout auto-start toggle: applies to this workout and is remembered for the exercise. */
  setAutoNext: (sessionExerciseId: string, exerciseId: string, on: boolean) => Promise<void>;

  /** Set after finishing a workout that wasn't started from a routine: Workout tab asks "Save as routine?". */
  savePrompt: SavePrompt | null;
  clearSavePrompt: () => void;
  start: (opts?: workouts.StartOptions) => Promise<void>;
  restore: () => Promise<void>;
  addExercise: (exerciseId: string) => Promise<void>;
  addSet: (sessionExerciseId: string) => Promise<void>;
  /** `skipRest`: mid-superset (more exercises to do in this round), so no rest timer yet. */
  toggleSetComplete: (
    setId: string,
    completed: boolean,
    restSeconds?: number | null,
    opts?: { skipRest?: boolean },
  ) => Promise<void>;
  /**
   * Ticks a set and runs the workout flow: superset → straight to the next member (no rest), end of a round /
   * normal exercise → rest timer. Used by the workout screen, the lock-screen mode and the notification button.
   */
  completeSet: (setId: string, restSeconds?: number | null) => Promise<void>;
  /** Lock-screen "Complete set": logs the next unticked set (from the exercise on screen). */
  completeNextSet: () => Promise<boolean>;
  finish: (fields?: { notes?: string | null; rpe?: number | null }) => Promise<void>;
  discard: () => Promise<void>;
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      startedAt: null,
      prHits: {},
      currentIndex: 0,
      autoNext: {},

      savePrompt: null,
      clearSavePrompt: () => set({ savePrompt: null }),
      setCurrentIndex: (index) => set({ currentIndex: Math.max(0, index) }),

      setAutoNext: async (sessionExerciseId, exerciseId, on) => {
        set({ autoNext: { ...get().autoNext, [sessionExerciseId]: on } });
        const settings = getSettings();
        await useSettingsStore.getState().update({ exercise_auto_next: { ...settings.exercise_auto_next, [exerciseId]: on } });
      },

      start: async (opts) => {
        if (get().sessionId || starting) return;
        starting = true;
        try {
          const sessionId = await workouts.startSession(opts);
          set({ sessionId, startedAt: Date.now(), prHits: {}, currentIndex: 0, autoNext: {} });
        } finally {
          starting = false;
        }
      },

      /** Drop a persisted sessionId whose session was finished/deleted (e.g. on another device). */
      restore: async () => {
        const { sessionId } = get();
        if (!sessionId) return;
        const session = await getRecord('workout_sessions', sessionId);
        if (!session || session.end_time !== null || session.deleted_at !== null) {
          await useIntervalRunStore.getState().cancel();
          set({ sessionId: null, startedAt: null, prHits: {}, currentIndex: 0, autoNext: {} });
        } else {
          set({ startedAt: session.start_time });
        }
      },

      addExercise: async (exerciseId) => {
        const { sessionId } = get();
        if (sessionId) await workouts.addExerciseToSession(sessionId, exerciseId);
      },

      addSet: async (sessionExerciseId) => {
        await workouts.addSet(sessionExerciseId);
        await useIntervalRunStore.getState().extend(sessionExerciseId);
      },

      toggleSetComplete: async (setId, completed, restSeconds, opts) => {
        await workouts.setCompleted(setId, completed);
        if (!completed) {
          const { [setId]: _removed, ...rest } = get().prHits;
          set({ prHits: rest });
          return;
        }

        const hits = await evaluateCompletedSet(setId);
        if (hits.length > 0) set({ prHits: { ...get().prHits, [setId]: hits } });

        const settings = getSettings();
        // An interval run owns rest while it's going (see intervalRunStore).
        if (opts?.skipRest || !settings.rest_auto_start || useIntervalRunStore.getState().run) return;
        const info = await db.getFirstAsync<{ set_type: string; exercise_id: string }>(
          `SELECT s.set_type, se.exercise_id FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
           WHERE s.id = ?`,
          [setId],
        );
        const seconds = resolveRestSeconds(settings, {
          exerciseId: info?.exercise_id ?? '',
          sessionRest: restSeconds ?? null,
          isWarmup: info?.set_type === 'warmup',
        });
        await useRestTimerStore.getState().start(seconds);
      },

      completeSet: async (setId, restSeconds) => {
        const { sessionId } = get();
        if (!sessionId) return;
        const rows = await db.getAllAsync<{ se_id: string; g: string | null; set_id: string; done: number }>(
          `SELECT se.id AS se_id, se.superset_group AS g, s.id AS set_id, s.is_completed AS done
           FROM session_exercises se JOIN sets s ON s.session_exercise_id = se.id AND s.deleted_at IS NULL
           WHERE se.session_id = ? AND se.deleted_at IS NULL ORDER BY se.order_index, s.order_index`,
          [sessionId],
        );
        const exercises = [...new Set(rows.map((r) => r.se_id))];
        const groups = exercises.map((id) => rows.find((r) => r.se_id === id)!.g);
        const at = exercises.indexOf(rows.find((r) => r.set_id === setId)?.se_id ?? '');
        const flow =
          at >= 0
            ? afterSetCompleted(groups, at, (i) =>
                rows.some((r) => r.se_id === exercises[i] && r.done === 0 && r.set_id !== setId),
              )
            : { skipRest: false, nextIndex: null };
        await get().toggleSetComplete(setId, true, restSeconds, { skipRest: flow.skipRest });
        // A short beat so the tick animation is seen before the next superset exercise slides in.
        if (flow.nextIndex !== null) {
          const next = flow.nextIndex;
          setTimeout(() => get().sessionId === sessionId && set({ currentIndex: next }), 450);
        }
      },

      completeNextSet: async () => {
        const { sessionId, currentIndex } = get();
        if (!sessionId) return false;
        const next = await workouts.prepareNextSet(sessionId, currentIndex);
        if (!next) return false;
        if (next.exerciseIndex !== currentIndex) set({ currentIndex: next.exerciseIndex });
        await get().completeSet(next.setId, next.restSeconds);
        return true;
      },

      finish: async (fields) => {
        const { sessionId } = get();
        if (!sessionId) return;
        // Log interval sets that ended while the app was asleep, then end the run.
        await useIntervalRunStore.getState().reconcile();
        await useIntervalRunStore.getState().cancel();
        await workouts.finishSession(sessionId, fields);
        const savePrompt = await getSavePrompt(sessionId).catch(() => null);
        await useRestTimerStore.getState().stop();
        set({ sessionId: null, startedAt: null, prHits: {}, currentIndex: 0, autoNext: {}, savePrompt });
        // Fresh data worth protecting: back up now if automatic backups are on (never throws).
        void runAutoBackup({ force: true });
      },

      discard: async () => {
        const { sessionId } = get();
        if (!sessionId) return;
        await useIntervalRunStore.getState().cancel();
        await workouts.discardSession(sessionId);
        await useRestTimerStore.getState().stop();
        set({ sessionId: null, startedAt: null, prHits: {}, currentIndex: 0, autoNext: {} });
      },
    }),
    {
      name: 'active-workout',
      storage: kvStorage,
      partialize: ({ sessionId, startedAt, prHits, currentIndex, autoNext }) => ({ sessionId, startedAt, prHits, currentIndex, autoNext }),
    },
  ),
);
