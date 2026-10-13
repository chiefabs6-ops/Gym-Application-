import { describe, expect, it } from 'vitest';
import {
  addPlanDay,
  MAX_PLAN_DAYS,
  movePlanDay,
  nextPlanDay,
  PLAN_PRESETS,
  planFromPreset,
  removedDayIds,
  removePlanDay,
  renamePlanDay,
  type TrainingPlan,
} from '../plans';
import { parseSettings } from '../settings';

const ppc = () => planFromPreset('push_pull_cardio')!;

describe('presets', () => {
  it('has Push / Pull / Cardio with fixed ids', () => {
    expect(PLAN_PRESETS.map((p) => p.id)).toContain('push_pull_cardio');
    expect(ppc()).toEqual({
      preset: 'push_pull_cardio',
      days: [
        { id: 'push', name: 'Push' },
        { id: 'pull', name: 'Pull' },
        { id: 'cardio', name: 'Cardio' },
      ],
    });
    expect(planFromPreset('nope')).toBeNull();
  });

  it('returns a copy, so edits never change the preset', () => {
    const a = ppc();
    a.days[0]!.name = 'Changed';
    expect(ppc().days[0]!.name).toBe('Push');
  });
});

describe('nextPlanDay', () => {
  it('starts at the first day with no history', () => {
    expect(nextPlanDay(ppc(), null).id).toBe('push');
  });
  it('returns the day after the last one and wraps', () => {
    expect(nextPlanDay(ppc(), 'push').id).toBe('pull');
    expect(nextPlanDay(ppc(), 'pull').id).toBe('cardio');
    expect(nextPlanDay(ppc(), 'cardio').id).toBe('push');
  });
  it('restarts at the first day when the last day is no longer in the plan', () => {
    expect(nextPlanDay(ppc(), 'legs').id).toBe('push');
  });
  it('a one-day plan always returns that day', () => {
    const one: TrainingPlan = { preset: null, days: [{ id: 'full', name: 'Full body' }] };
    expect(nextPlanDay(one, 'full').id).toBe('full');
  });
});

describe('editing keeps ids stable and marks the plan custom', () => {
  it('renames without changing the id', () => {
    const p = renamePlanDay(ppc(), 'push', '  Chest & shoulders ');
    expect(p.preset).toBeNull();
    expect(p.days[0]).toEqual({ id: 'push', name: 'Chest & shoulders' });
  });
  it('ignores a blank rename', () => {
    const p = renamePlanDay(ppc(), 'push', '   ');
    expect(p.days[0]!.name).toBe('Push');
  });
  it('adds a day with a new unique id, capped at the max', () => {
    const p = addPlanDay(ppc(), 'Legs');
    expect(p.days).toHaveLength(4);
    expect(p.days[3]!.name).toBe('Legs');
    expect(['push', 'pull', 'cardio']).not.toContain(p.days[3]!.id);
    let full: TrainingPlan = ppc();
    for (let i = 0; i < 20; i++) full = addPlanDay(full, `D${i}`);
    expect(full.days).toHaveLength(MAX_PLAN_DAYS);
    expect(new Set(full.days.map((d) => d.id)).size).toBe(MAX_PLAN_DAYS);
  });
  it('defaults a blank new day name', () => {
    expect(addPlanDay(ppc(), ' ').days[3]!.name).toBe('Day 4');
  });
  it('removes a day; removing the last day leaves no plan', () => {
    expect(removePlanDay(ppc(), 'pull')!.days.map((d) => d.id)).toEqual(['push', 'cardio']);
    const one: TrainingPlan = { preset: null, days: [{ id: 'a', name: 'A' }] };
    expect(removePlanDay(one, 'a')).toBeNull();
  });
  it('moves a day up/down and ignores moves past the ends', () => {
    expect(movePlanDay(ppc(), 'cardio', -1).days.map((d) => d.id)).toEqual(['push', 'cardio', 'pull']);
    expect(movePlanDay(ppc(), 'push', -1).days.map((d) => d.id)).toEqual(['push', 'pull', 'cardio']);
  });
});

describe('removedDayIds', () => {
  it('lists days that disappeared', () => {
    expect(removedDayIds(ppc(), removePlanDay(ppc(), 'pull'))).toEqual(['pull']);
  });
  it('switching to no plan removes nothing (links are kept)', () => {
    expect(removedDayIds(ppc(), null)).toEqual([]);
  });
  it('no previous plan removes nothing', () => {
    expect(removedDayIds(null, ppc())).toEqual([]);
  });
});

describe('training_plan setting', () => {
  it('defaults to null and keeps a valid plan', () => {
    expect(parseSettings({}).training_plan).toBeNull();
    expect(parseSettings({ training_plan: ppc() }).training_plan).toEqual(ppc());
  });
  it('falls back to null for invalid values', () => {
    for (const bad of ['x', { days: [] }, { preset: null, days: [{ id: '', name: 'A' }] }, { preset: null }]) {
      expect(parseSettings({ training_plan: bad }).training_plan).toBeNull();
    }
  });
});
