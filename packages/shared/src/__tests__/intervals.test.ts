import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  finishedWork,
  phaseAt,
  runElapsedMs,
  skipClock,
  timelineMs,
  transitionTimes,
  type RunClock,
} from '../intervals';
import { resolveAutoNext } from '../settings';
import { templateExerciseSchema } from '../tables';

const T0 = 1_000_000;
const clock = (over: Partial<RunClock> = {}): RunClock => ({ startedAt: T0, pausedAt: null, pausedTotalMs: 0, ...over });

describe('buildTimeline', () => {
  it('alternates work and rest with no rest after the last set', () => {
    const t = buildTimeline([60, 60, 60], 30);
    expect(t.map((p) => `${p.kind}${p.setIndex}:${p.startMs}+${p.durationMs}`)).toEqual([
      'work0:0+60000',
      'rest0:60000+30000',
      'work1:90000+60000',
      'rest1:150000+30000',
      'work2:180000+60000',
    ]);
    expect(timelineMs(t)).toBe(240_000);
  });

  it('handles one set, zero rest and per-set work lengths', () => {
    expect(buildTimeline([45], 30).map((p) => p.kind)).toEqual(['work']);
    expect(buildTimeline([20, 40], 0).map((p) => `${p.kind}${p.setIndex}:${p.startMs}`)).toEqual(['work0:0', 'work1:20000']);
  });
});

describe('phaseAt', () => {
  const t = buildTimeline([60, 60], 30);

  it('finds the phase and time left across boundaries', () => {
    expect(phaseAt(t, clock(), T0)).toMatchObject({ index: 0, remainingMs: 60_000, done: false });
    expect(phaseAt(t, clock(), T0 + 59_999)).toMatchObject({ index: 0, remainingMs: 1 });
    expect(phaseAt(t, clock(), T0 + 60_000)).toMatchObject({ index: 1, remainingMs: 30_000 });
    expect(phaseAt(t, clock(), T0 + 100_000).phase).toMatchObject({ kind: 'work', setIndex: 1 });
    expect(phaseAt(t, clock(), T0 + 150_000)).toMatchObject({ index: 3, phase: null, done: true, remainingMs: 0 });
  });

  it('freezes while paused and resumes where it left off', () => {
    const paused = clock({ pausedAt: T0 + 10_000 });
    expect(phaseAt(t, paused, T0 + 500_000)).toMatchObject({ index: 0, remainingMs: 50_000 });
    const resumed = clock({ pausedTotalMs: 490_000 });
    expect(runElapsedMs(resumed, T0 + 500_000)).toBe(10_000);
    expect(phaseAt(t, resumed, T0 + 500_000)).toMatchObject({ index: 0, remainingMs: 50_000 });
  });
});

describe('skipClock', () => {
  it('ends the current phase now', () => {
    const t = buildTimeline([60, 60], 30);
    const skipped = skipClock(t, clock(), T0 + 20_000);
    expect(phaseAt(t, skipped, T0 + 20_000)).toMatchObject({ index: 1, remainingMs: 30_000 });
  });

  it('keeps the run paused when skipping while paused', () => {
    const t = buildTimeline([60, 60], 30);
    const skipped = skipClock(t, clock({ pausedAt: T0 + 20_000 }), T0 + 99_000);
    expect(skipped.pausedAt).toBe(T0 + 20_000);
    expect(phaseAt(t, skipped, T0 + 200_000)).toMatchObject({ index: 1, remainingMs: 30_000 });
  });
});

describe('finishedWork / transitionTimes', () => {
  const t = buildTimeline([60, 60, 60], 30);

  it('lists work phases that ended, with their real end time', () => {
    expect(finishedWork(t, clock(), T0 + 59_000)).toEqual([]);
    expect(finishedWork(t, clock(), T0 + 200_000)).toEqual([
      { setIndex: 0, endedAt: T0 + 60_000 },
      { setIndex: 1, endedAt: T0 + 150_000 },
    ]);
    // A pause shifts the end times by the paused span.
    expect(finishedWork(t, clock({ pausedTotalMs: 5_000 }), T0 + 66_000)).toEqual([{ setIndex: 0, endedAt: T0 + 65_000 }]);
  });

  it('gives the absolute end of every phase still ahead', () => {
    const all = transitionTimes(t, clock(), T0);
    expect(all.map((x) => [x.index, x.at])).toEqual([
      [0, T0 + 60_000],
      [1, T0 + 90_000],
      [2, T0 + 150_000],
      [3, T0 + 180_000],
      [4, T0 + 240_000],
    ]);
    expect(transitionTimes(t, clock(), T0 + 100_000).map((x) => x.index)).toEqual([2, 3, 4]);
    expect(transitionTimes(t, clock({ pausedAt: T0 }), T0)).toEqual([]);
  });
});

describe('auto next', () => {
  const settings = { exercise_auto_next: { EX: true } };

  it('prefers the workout override, then the routine, then the remembered value', () => {
    expect(resolveAutoNext(settings, { exerciseId: 'EX', sessionOverride: false, routineValue: true })).toBe(false);
    expect(resolveAutoNext(settings, { exerciseId: 'EX', sessionOverride: null, routineValue: false })).toBe(false);
    expect(resolveAutoNext(settings, { exerciseId: 'EX', sessionOverride: null, routineValue: null })).toBe(true);
    expect(resolveAutoNext(settings, { exerciseId: 'OTHER', sessionOverride: null, routineValue: null })).toBe(false);
  });

  it('old routines without auto_next still parse', () => {
    const te = templateExerciseSchema.parse({
      exercise_id: '00000000-0000-4000-8000-000000000001',
      order_index: 0,
      target_sets: 3,
      target_reps: null,
      rest_seconds: 30,
    });
    expect(te.auto_next).toBeNull();
  });
});
