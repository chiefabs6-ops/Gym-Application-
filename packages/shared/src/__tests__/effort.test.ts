import { describe, expect, it } from 'vitest';
import { formatEffort, rirToRpe, rpeToRir } from '../effort';
import { parseSettings, resolveRestSeconds } from '../settings';

describe('effort (RPE / RIR)', () => {
  it('maps RIR to RPE and back (RPE 10 = RIR 0)', () => {
    expect(rirToRpe(0)).toBe(10);
    expect(rirToRpe(2)).toBe(8);
    expect(rpeToRir(7.5)).toBe(2.5);
  });

  it('formats in the chosen mode', () => {
    expect(formatEffort(8.5, 'rpe')).toBe('8.5');
    expect(formatEffort(8.5, 'rir')).toBe('1');
    expect(formatEffort(4, 'rir')).toBe('5+');
    expect(formatEffort(null, 'rpe')).toBe('');
    expect(formatEffort(8, 'off')).toBe('');
  });

  it('defaults to off and rejects junk', () => {
    expect(parseSettings({}).effort_input).toBe('off');
    expect(parseSettings({ effort_input: 'rir' }).effort_input).toBe('rir');
    expect(parseSettings({ effort_input: 'nope' }).effort_input).toBe('off');
  });
});

describe('rest resolution (2.8)', () => {
  const base = { default_rest_seconds: 90, warmup_rest_seconds: null, exercise_rest: { EX: 150 } };
  it('workout value beats remembered beats default', () => {
    expect(resolveRestSeconds(base, { exerciseId: 'EX', sessionRest: 60, isWarmup: false })).toBe(60);
    expect(resolveRestSeconds(base, { exerciseId: 'EX', sessionRest: null, isWarmup: false })).toBe(150);
    expect(resolveRestSeconds(base, { exerciseId: 'OTHER', sessionRest: null, isWarmup: false })).toBe(90);
  });
  it('warm-ups use the warm-up rest only when one is set', () => {
    expect(resolveRestSeconds(base, { exerciseId: 'EX', sessionRest: 60, isWarmup: true })).toBe(60);
    expect(resolveRestSeconds({ ...base, warmup_rest_seconds: 30 }, { exerciseId: 'EX', sessionRest: 60, isWarmup: true })).toBe(30);
  });
  it('new settings default sensibly', () => {
    expect(parseSettings({})).toMatchObject({ rest_auto_start: true, warmup_rest_seconds: null, exercise_rest: {} });
  });
});
