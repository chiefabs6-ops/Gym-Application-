import { useEffect, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildTimeline,
  finishedWork,
  formatDuration,
  phaseAt,
  resolveAutoNext,
  resolveRestSeconds,
  runElapsedMs,
  skipClock,
  transitionTimes,
  type IntervalPhase,
  type PhaseState,
  type RunClock,
  type WorkoutTemplateRow,
} from '@gym/shared';
import { db } from '../db/client';
import { getRecord } from '../db/mutate';
import { updateSet } from '../db/repositories/workouts';
import { cancelScheduled, dismissIntervalAlerts, scheduleAlertAt } from '../services/notifications';
import { evaluateCompletedSet } from '../services/prEngine';
import { initialCueState, nextCue, STALE_EXPIRY_MS } from '../services/restCues';
import { ensureSoundsLoaded, playCountdownTick, playRestFinished, primeAudioOutput } from '../services/sounds';
import { useActiveWorkoutStore } from './activeWorkoutStore';
import { useRestTimerStore } from './restTimerStore';
import { getSettings } from './settingsStore';
import { useStopwatchStore } from './stopwatchStore';
import { kvStorage } from './storage';

/**
 * Interval timer for timed sets (battle rope 15 × 60 s / 30 s, plank holds).
 *
 * A run is a fixed timeline (see @gym/shared intervals.ts) measured from the wall clock, never counted: Android
 * suspends JS when the phone is locked. Every phase change is an OS-scheduled notification so the beeps still
 * come; the sets are written by `reconcile()` whenever JS runs again, each with the time its work really ended.
 * While a run is active it owns rest: ticking sets doesn't start the rest timer.
 */
export interface IntervalRun extends RunClock {
  sessionId: string;
  sessionExerciseId: string;
  exerciseName: string;
  setIds: string[];
  /** Work length per set (each set's own time). */
  workS: number[];
  restS: number;
  /** Auto-start next set: sets added to the exercise mid-run join it (see extend). */
  autoNext: boolean;
  /** Work phases already written to the sets table. */
  logged: number;
  notificationIds: string[];
}

export interface RunPlan {
  exerciseName: string;
  setIds: string[];
  workS: number[];
  restS: number;
  autoNext: boolean;
}

/**
 * What a countdown started on `fromSetId` covers: with auto-start, that set and every later unfinished set that
 * has a time; without, just that set. null when the set can't be timed (no time, ticked, gone).
 */
export async function loadRunPlan(
  sessionExerciseId: string,
  fromSetId: string,
  sessionOverride: boolean | null | undefined,
): Promise<RunPlan | null> {
  const se = await db.getFirstAsync<{ exercise_id: string; name: string; rest_seconds: number | null; template_id: string | null }>(
    `SELECT se.exercise_id, e.name, se.rest_seconds, ws.template_id
     FROM session_exercises se
     JOIN exercise_definitions e ON e.id = se.exercise_id
     JOIN workout_sessions ws ON ws.id = se.session_id
     WHERE se.id = ? AND se.deleted_at IS NULL`,
    [sessionExerciseId],
  );
  if (!se) return null;
  const sets = await db.getAllAsync<{ id: string; duration_s: number | null; is_completed: number }>(
    `SELECT id, duration_s, is_completed FROM sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY order_index`,
    [sessionExerciseId],
  );
  const from = sets.findIndex((s) => s.id === fromSetId);
  const first = sets[from];
  if (!first || first.is_completed === 1 || !first.duration_s) return null;

  const template: WorkoutTemplateRow | null = se.template_id ? await getRecord('workout_templates', se.template_id) : null;
  const routineValue = template?.template_exercises.find((te) => te.exercise_id === se.exercise_id)?.auto_next ?? null;
  const settings = getSettings();
  const autoNext = resolveAutoNext(settings, { exerciseId: se.exercise_id, sessionOverride, routineValue });
  const timed = autoNext ? sets.slice(from).filter((s) => s.is_completed === 0 && s.duration_s) : [first];
  return {
    exerciseName: se.name,
    setIds: timed.map((s) => s.id),
    workS: timed.map((s) => s.duration_s!),
    restS: resolveRestSeconds(settings, { exerciseId: se.exercise_id, sessionRest: se.rest_seconds, isWarmup: false }),
    autoNext,
  };
}

const timelineOf = (run: IntervalRun) => buildTimeline(run.workS, run.restS);

/** Notification text for the end of phase `i`. */
function alertFor(run: IntervalRun, timeline: IntervalPhase[], i: number) {
  const n = run.setIds.length;
  const next = timeline[i + 1];
  if (!next) return { title: `${run.exerciseName} done 💪`, body: `${n} ${n === 1 ? 'set' : 'sets'} logged` };
  if (next.kind === 'rest') return { title: `Rest ${formatDuration(run.restS)}`, body: `${run.exerciseName} · set ${next.setIndex + 1}/${n} done` };
  return { title: `Go! Set ${next.setIndex + 1}/${n}`, body: `${run.exerciseName} · ${formatDuration(run.workS[next.setIndex]!)}` };
}

/** Writes a finished work phase to its set (skipping sets ticked or deleted by hand) and checks for PRs. */
async function logWork(setId: string, seconds: number, completedAt: number) {
  const row = await getRecord('sets', setId);
  if (!row || row.deleted_at !== null || row.is_completed) return;
  await updateSet(setId, { duration_s: seconds, is_completed: true, completed_at: completedAt });
  const hits = await evaluateCompletedSet(setId);
  if (hits.length > 0) {
    const workout = useActiveWorkoutStore.getState();
    useActiveWorkoutStore.setState({ prHits: { ...workout.prHits, [setId]: hits } });
  }
}

interface IntervalRunState {
  run: IntervalRun | null;
  /** Starts a countdown on a set. false if it can't be timed (no time entered, ticked, no workout). */
  start: (sessionExerciseId: string, fromSetId: string) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Ends the current phase now. Skipping work logs the seconds done so far. */
  skip: () => Promise<void>;
  /** Ends the run; a set in its work phase is logged with the seconds done (at least 1). */
  stop: () => Promise<void>;
  /** A set was added to `sessionExerciseId`: with auto-start on, unfinished timed sets after the run join it. */
  extend: (sessionExerciseId: string) => Promise<void>;
  /** Ends the run without logging anything (workout finished or discarded). */
  cancel: () => Promise<void>;
  /** Writes every set whose work has ended; when the run is over, clears it and starts the normal rest. */
  reconcile: () => Promise<void>;
}

/** Serialises reconcile/skip/stop so a set is never written twice. */
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
};

export const useIntervalRunStore = create<IntervalRunState>()(
  persist(
    (set, get) => {
      /** (Re)schedules one alert per phase change still ahead. */
      const arm = async () => {
        const old = get().run;
        if (!old) return;
        await Promise.all(old.notificationIds.map(cancelScheduled));
        const run = get().run;
        if (!run) return;
        set({ run: { ...run, notificationIds: [] } });
        const timeline = timelineOf(run);
        const style = { sound: getSettings().rest_sound, vibrate: getSettings().rest_vibration };
        const ids = (
          await Promise.all(
            transitionTimes(timeline, run, Date.now()).map(({ index, at }) => {
              const { title, body } = alertFor(run, timeline, index);
              return scheduleAlertAt(at, title, body, style);
            }),
          )
        ).filter((id): id is string => id !== null);
        // Guard against a pause/stop/skip racing the async schedule.
        const now = get().run;
        if (
          now &&
          now.startedAt === run.startedAt &&
          now.pausedAt === run.pausedAt &&
          now.pausedTotalMs === run.pausedTotalMs &&
          now.workS === run.workS
        ) {
          set({ run: { ...now, notificationIds: ids } });
        } else await Promise.all(ids.map(cancelScheduled));
      };

      const clear = async () => {
        const run = get().run;
        set({ run: null });
        if (run) await Promise.all(run.notificationIds.map(cancelScheduled));
        await dismissIntervalAlerts();
      };

      const reconcileNow = async () => {
        const run = get().run;
        if (!run) return;
        // Alerts already shown while the phone was locked are stale once the app is running again.
        await dismissIntervalAlerts();
        const now = Date.now();
        const timeline = timelineOf(run);
        const ended = finishedWork(timeline, run, now);
        for (const { setIndex, endedAt } of ended.slice(run.logged)) {
          await logWork(run.setIds[setIndex]!, run.workS[setIndex]!, endedAt);
        }
        const current = get().run;
        if (current?.startedAt !== run.startedAt) return;
        if (ended.length > run.logged) set({ run: { ...current, logged: ended.length } });
        if (!phaseAt(timeline, run, now).done) return;

        // The run is over and so is the exercise: no rest after the last set.
        await clear();
      };

      const stopNow = async () => {
        await reconcileNow();
        const run = get().run;
        if (!run) return;
        const now = Date.now();
        const { phase } = phaseAt(timelineOf(run), run, now);
        await clear();
        if (phase?.kind === 'work') {
          const done = Math.max(1, Math.round((runElapsedMs(run, now) - phase.startMs) / 1000));
          await logWork(run.setIds[phase.setIndex]!, done, now);
        }
      };

      return {
        run: null,

        start: (sessionExerciseId, fromSetId) =>
          serial(async () => {
            const workout = useActiveWorkoutStore.getState();
            if (!workout.sessionId) return false;
            if (get().run) await stopNow();
            const plan = await loadRunPlan(sessionExerciseId, fromSetId, workout.autoNext[sessionExerciseId]);
            if (!plan) return false;
            await useRestTimerStore.getState().stop();
            useStopwatchStore.setState({ setId: null, startedAt: null });
            set({
              run: {
                sessionId: workout.sessionId,
                sessionExerciseId,
                exerciseName: plan.exerciseName,
                setIds: plan.setIds,
                workS: plan.workS,
                restS: plan.restS,
                autoNext: plan.autoNext,
                startedAt: Date.now(),
                pausedAt: null,
                pausedTotalMs: 0,
                logged: 0,
                notificationIds: [],
              },
            });
            await arm();
            return true;
          }),

        pause: () =>
          serial(async () => {
            // Log anything that already ended first, so its completed_at isn't shifted by the pause.
            await reconcileNow();
            const run = get().run;
            if (!run || run.pausedAt !== null) return;
            set({ run: { ...run, pausedAt: Date.now(), notificationIds: [] } });
            await Promise.all(run.notificationIds.map(cancelScheduled));
          }),

        resume: () =>
          serial(async () => {
            const run = get().run;
            if (!run || run.pausedAt === null) return;
            set({ run: { ...run, pausedTotalMs: run.pausedTotalMs + Date.now() - run.pausedAt, pausedAt: null } });
            await arm();
          }),

        skip: () =>
          serial(async () => {
            await reconcileNow();
            const run = get().run;
            if (!run) return;
            const now = Date.now();
            const timeline = timelineOf(run);
            const { phase } = phaseAt(timeline, run, now);
            if (!phase) return;
            // Skipping work logs the seconds done so far (the reconciler then skips that ticked set).
            if (phase.kind === 'work') {
              const done = Math.max(1, Math.round((runElapsedMs(run, now) - phase.startMs) / 1000));
              await logWork(run.setIds[phase.setIndex]!, done, now);
            }
            const current = get().run;
            if (current) set({ run: { ...current, ...skipClock(timeline, current, now) } });
            await reconcileNow();
            if (get().run) await arm();
          }),

        stop: () => serial(stopNow),

        extend: (sessionExerciseId) =>
          serial(async () => {
            const run = get().run;
            if (!run?.autoNext || run.sessionExerciseId !== sessionExerciseId) return;
            if (phaseAt(timelineOf(run), run, Date.now()).done) return;
            const sets = await db.getAllAsync<{ id: string; duration_s: number | null; is_completed: number }>(
              `SELECT id, duration_s, is_completed FROM sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY order_index`,
              [sessionExerciseId],
            );
            const last = sets.findIndex((s) => s.id === run.setIds[run.setIds.length - 1]);
            const added = sets.slice(last + 1).filter((s) => s.is_completed === 0 && s.duration_s && !run.setIds.includes(s.id));
            if (last < 0 || added.length === 0) return;
            // Appending only adds phases after the current ones, so nothing already timed moves.
            set({
              run: {
                ...run,
                setIds: [...run.setIds, ...added.map((s) => s.id)],
                workS: [...run.workS, ...added.map((s) => s.duration_s!)],
              },
            });
            await arm();
          }),

        cancel: () => serial(clear),

        reconcile: () => serial(reconcileNow),
      };
    },
    {
      name: 'interval-run',
      storage: kvStorage,
      partialize: ({ run }) => ({ run }),
    },
  ),
);

export interface IntervalRunView {
  run: IntervalRun;
  state: PhaseState;
  timeline: IntervalPhase[];
}

/** Render-side ticker for display only (recomputed from the wall clock). null when no run. */
export function useIntervalRun(tickMs = 250): IntervalRunView | null {
  const run = useIntervalRunStore((s) => s.run);
  const [, setTick] = useState(0);
  const running = run !== null && run.pausedAt === null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), tickMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((t) => t + 1));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [running, tickMs]);

  if (!run) return null;
  const timeline = timelineOf(run);
  // Read the clock at render (not a stored value) so a resume never shows a stale phase for a frame.
  return { run, timeline, state: phaseAt(timeline, run, Date.now()) };
}

const CUE_POLL_MS = 50;

/**
 * Single owner of interval-run side effects. Mount ONCE at the app root:
 *   - 3·2·1 ticks before every phase change and a beep + buzz at it (foreground only; in the background the
 *     scheduled notification beeps instead)
 *   - writes finished sets at each phase change, on launch and whenever the app comes back to the foreground
 */
export function useIntervalRunCues() {
  const run = useIntervalRunStore((s) => s.run);
  const key = run ? `${run.startedAt}|${run.pausedAt}|${run.pausedTotalMs}|${run.workS.join(',')}|${run.restS}` : null;

  useEffect(() => {
    const store = useIntervalRunStore.getState();
    void store.reconcile();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void useIntervalRunStore.getState().reconcile());
    const current = store.run;
    if (!current || current.pausedAt !== null) return () => sub.remove();

    void ensureSoundsLoaded();
    const timeline = timelineOf(current);
    const start = phaseAt(timeline, current, Date.now());
    let index = start.index;
    let cueState = initialCueState(start.remainingMs);

    const id = setInterval(() => {
      const now = Date.now();
      const st = phaseAt(timeline, current, now);
      const foreground = AppState.currentState === 'active';
      const { rest_sound: soundEnabled, rest_vibration: vibrate } = getSettings();

      if (st.index !== index) {
        const ended = timeline[st.index - 1];
        const endedAt = ended ? current.startedAt + current.pausedTotalMs + ended.startMs + ended.durationMs : now;
        console.log(`[interval] phase ${index}->${st.index} late=${now - endedAt}ms fg=${foreground}`);
        if (foreground && now - endedAt < STALE_EXPIRY_MS) {
          if (soundEnabled) playRestFinished();
          if (vibrate) Vibration.vibrate(st.done ? [0, 400, 200, 400] : 300);
        }
        index = st.index;
        cueState = initialCueState(st.remainingMs);
        void useIntervalRunStore.getState().reconcile();
        if (st.done) clearInterval(id);
        return;
      }

      const { cue, state } = nextCue(st.remainingMs, cueState);
      cueState = state;
      if (!foreground || !soundEnabled) return;
      if (cue === 'prime') primeAudioOutput();
      else if (cue === 'tick') playCountdownTick();
    }, CUE_POLL_MS);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
