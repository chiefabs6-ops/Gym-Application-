import { describe, expect, it } from 'vitest';
import { detectPRs, setMetrics } from '../pr';
import {
  categoryFor,
  countsTowardVolume,
  formatDistanceNumber,
  formatDuration,
  formatPace,
  formatSetSummary,
  fromDisplayDistance,
  parseDuration,
} from '../tracking';

describe('time', () => {
  it('formats seconds as m:ss / h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(null)).toBe('');
  });

  it('parses colons and keypad-style digits', () => {
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('130')).toBe(90);
    expect(parseDuration('2500')).toBe(1500);
    expect(parseDuration('10000')).toBe(3600);
    expect(parseDuration('')).toBeNull();
  });

  it('rejects invalid time', () => {
    for (const bad of ['1:75', 'abc', '1:2:3:4', '1.5']) expect(parseDuration(bad)).toBeUndefined();
  });
});

describe('distance', () => {
  it('converts km and miles', () => {
    expect(formatDistanceNumber(5000, 'metric')).toBe('5');
    expect(formatDistanceNumber(1609.344, 'imperial')).toBe('1');
    expect(fromDisplayDistance(5, 'metric')).toBe(5000);
    expect(formatPace(300, 'metric')).toBe('5:00 /km');
  });
});

describe('set summaries per tracking type', () => {
  it('formats each type', () => {
    expect(formatSetSummary('weight_reps', { weight_kg: 100, reps: 5 }, 'metric')).toBe('100 × 5');
    expect(formatSetSummary('weight_reps', { weight_kg: 100, reps: 5 }, 'metric', true)).toBe('100 kg × 5');
    expect(formatSetSummary('reps_only', { weight_kg: null, reps: 12 }, 'metric')).toBe('12 reps');
    expect(formatSetSummary('weighted_bodyweight', { weight_kg: 10, reps: 8 }, 'metric')).toBe('+10 × 8');
    expect(formatSetSummary('weighted_bodyweight', { weight_kg: null, reps: 8 }, 'metric')).toBe('BW × 8');
    expect(formatSetSummary('assisted_bodyweight', { weight_kg: 20, reps: 8 }, 'metric')).toBe('−20 × 8');
    expect(formatSetSummary('duration', { weight_kg: null, reps: null, duration_s: 90 }, 'metric')).toBe('1:30');
    expect(
      formatSetSummary('distance_duration', { weight_kg: null, reps: null, duration_s: 1500, distance_m: 5000 }, 'metric'),
    ).toBe('5 km · 25:00');
    expect(formatSetSummary('weight_reps', { weight_kg: null, reps: null }, 'metric')).toBe('');
  });

  it('derives category and volume rules', () => {
    expect(categoryFor('distance_duration')).toBe('cardio');
    expect(categoryFor('assisted_bodyweight')).toBe('bodyweight');
    expect(countsTowardVolume('weighted_bodyweight')).toBe(true);
    expect(countsTowardVolume('assisted_bodyweight')).toBe(false);
  });
});

describe('records per tracking type', () => {
  const working = { set_type: 'working' as const };

  it('reps only: most reps', () => {
    expect(detectPRs({ ...working, weight_kg: null, reps: 21 }, { max_reps: 20 }, 'reps_only')).toEqual(['max_reps']);
    expect(detectPRs({ ...working, weight_kg: null, reps: 20 }, { max_reps: 20 }, 'reps_only')).toEqual([]);
  });

  it('weighted bodyweight: heaviest added weight and most reps; bodyweight-only sets only count for reps', () => {
    const prev = { max_weight: 10, max_reps: 10 };
    expect(detectPRs({ ...working, weight_kg: 15, reps: 5 }, prev, 'weighted_bodyweight')).toEqual(['max_weight']);
    expect(detectPRs({ ...working, weight_kg: null, reps: 12 }, prev, 'weighted_bodyweight')).toEqual(['max_reps']);
  });

  it('assisted: less assistance is better (0 = unassisted)', () => {
    expect(detectPRs({ ...working, weight_kg: 15, reps: 8 }, { min_assist: 20, max_reps: 10 }, 'assisted_bodyweight')).toEqual([
      'min_assist',
    ]);
    expect(detectPRs({ ...working, weight_kg: null, reps: 3 }, { min_assist: 5, max_reps: 10 }, 'assisted_bodyweight')).toEqual([
      'min_assist',
    ]);
  });

  it('duration: longest; distance: furthest and fastest pace', () => {
    expect(detectPRs({ ...working, weight_kg: null, reps: null, duration_s: 95 }, { max_duration: 90 }, 'duration')).toEqual([
      'max_duration',
    ]);
    const run = { ...working, weight_kg: null, reps: null, duration_s: 1400, distance_m: 5000 }; // 4:40 /km
    expect(detectPRs(run, { max_distance: 10_000, best_pace: 300 }, 'distance_duration')).toEqual(['best_pace']);
    expect(setMetrics(run).best_pace).toBe(280);
  });

  it('warm-ups and first-ever sets never count', () => {
    expect(detectPRs({ set_type: 'warmup', weight_kg: null, reps: 50 }, { max_reps: 1 }, 'reps_only')).toEqual([]);
    expect(detectPRs({ ...working, weight_kg: null, reps: 50 }, {}, 'reps_only')).toEqual([]);
  });
});
