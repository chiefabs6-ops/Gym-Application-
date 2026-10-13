/**
 * Interval timer maths for timed sets (work / rest rounds, e.g. battle rope 15 × 60 s / 30 s).
 *
 * A run is a fixed timeline of phases measured from the run's start. Where the run is "now" is always derived
 * from the wall clock (like the rest timer's endsAt), never counted, so it stays right when Android suspends JS.
 * Pausing is folded into the clock: `pausedTotalMs` is time spent paused so far, `pausedAt` freezes it.
 */
export type IntervalPhaseKind = 'work' | 'rest';

export interface IntervalPhase {
  kind: IntervalPhaseKind;
  /** Index into the run's sets. A rest phase belongs to the set before it. */
  setIndex: number;
  /** Offset from the start of the run (ms of running time, pauses excluded). */
  startMs: number;
  durationMs: number;
}

export interface RunClock {
  startedAt: number;
  pausedAt: number | null;
  pausedTotalMs: number;
}

/** Work phases (one per set, each with its own length) with `restS` between them; no rest after the last set. */
export function buildTimeline(workS: readonly number[], restS: number): IntervalPhase[] {
  const phases: IntervalPhase[] = [];
  let at = 0;
  workS.forEach((w, i) => {
    phases.push({ kind: 'work', setIndex: i, startMs: at, durationMs: w * 1000 });
    at += w * 1000;
    if (i < workS.length - 1 && restS > 0) {
      phases.push({ kind: 'rest', setIndex: i, startMs: at, durationMs: restS * 1000 });
      at += restS * 1000;
    }
  });
  return phases;
}

export const timelineMs = (timeline: readonly IntervalPhase[]) => {
  const last = timeline[timeline.length - 1];
  return last ? last.startMs + last.durationMs : 0;
};

/** Running time since the start (pauses excluded). Frozen while paused. */
export const runElapsedMs = (clock: RunClock, now: number) =>
  (clock.pausedAt ?? now) - clock.startedAt - clock.pausedTotalMs;

export interface PhaseState {
  /** Current phase index (= timeline.length when the run is over). */
  index: number;
  phase: IntervalPhase | null;
  remainingMs: number;
  done: boolean;
}

export function phaseAt(timeline: readonly IntervalPhase[], clock: RunClock, now: number): PhaseState {
  const elapsed = runElapsedMs(clock, now);
  const index = timeline.findIndex((p) => elapsed < p.startMs + p.durationMs);
  if (index === -1) return { index: timeline.length, phase: null, remainingMs: 0, done: true };
  const phase = timeline[index]!;
  return { index, phase, remainingMs: phase.startMs + phase.durationMs - elapsed, done: false };
}

/** Clock with the current phase ending right now (Skip). Stays paused if it was paused. */
export function skipClock(timeline: readonly IntervalPhase[], clock: RunClock, now: number): RunClock {
  const { remainingMs, done } = phaseAt(timeline, clock, now);
  return done ? clock : { ...clock, pausedTotalMs: clock.pausedTotalMs - remainingMs };
}

/** Wall-clock end time of phase `i` (only meaningful while running). */
const phaseEnd = (p: IntervalPhase, clock: RunClock) => clock.startedAt + clock.pausedTotalMs + p.startMs + p.durationMs;

/** Work phases that have ended by `now`, with the moment each one ended. */
export function finishedWork(
  timeline: readonly IntervalPhase[],
  clock: RunClock,
  now: number,
): { setIndex: number; endedAt: number }[] {
  const elapsed = runElapsedMs(clock, now);
  return timeline
    .filter((p) => p.kind === 'work' && p.startMs + p.durationMs <= elapsed)
    .map((p) => ({ setIndex: p.setIndex, endedAt: phaseEnd(p, clock) }));
}

/** Absolute end time of every phase still ahead (for OS-scheduled alerts). None while paused. */
export function transitionTimes(
  timeline: readonly IntervalPhase[],
  clock: RunClock,
  now: number,
): { index: number; at: number }[] {
  if (clock.pausedAt !== null) return [];
  return timeline.map((p, index) => ({ index, at: phaseEnd(p, clock) })).filter((x) => x.at > now);
}
