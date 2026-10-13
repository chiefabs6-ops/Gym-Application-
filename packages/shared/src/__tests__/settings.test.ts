import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  addRestPreset,
  removeRestPreset,
  formatWeight,
  formatWeightNumber,
  fromDisplayWeight,
  mergePreferences,
  parseSettings,
  toDisplayWeight,
} from '../settings';

describe('parseSettings', () => {
  it('fills defaults for missing or non-object preferences', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({ default_rest_seconds: 90, rest_sound: true, previous_source: 'last_session' });
  });

  it('keeps valid values and replaces invalid ones with defaults', () => {
    const s = parseSettings({ default_rest_seconds: 120, rest_sound: false, keep_awake: 'yes', previous_source: 'bogus' });
    expect(s).toMatchObject({ default_rest_seconds: 120, rest_sound: false, keep_awake: true, previous_source: 'last_session' });
    expect(parseSettings({ default_rest_seconds: 5 }).default_rest_seconds).toBe(90); // below minimum
  });

  it('mergePreferences applies a patch and preserves unknown keys', () => {
    const merged = mergePreferences({ theme: 'dark', rest_sound: true }, { rest_sound: false });
    expect(merged).toMatchObject({ theme: 'dark', rest_sound: false, default_rest_seconds: 90 });
  });
});

describe('weight units', () => {
  it('converts kg <-> lb and round-trips typed values exactly', () => {
    expect(toDisplayWeight(100, 'metric')).toBe(100);
    expect(toDisplayWeight(100, 'imperial')).toBeCloseTo(220.462, 3);
    expect(formatWeightNumber(fromDisplayWeight(225, 'imperial'), 'imperial')).toBe('225');
    expect(formatWeightNumber(fromDisplayWeight(102.5, 'metric'), 'metric')).toBe('102.5');
  });

  it('formats with unit labels and handles empty values', () => {
    expect(formatWeight(60, 'metric')).toBe('60 kg');
    expect(formatWeight(20, 'imperial')).toBe('44.1 lb');
    expect(formatWeight(null, 'metric')).toBe('');
    expect(formatWeight(1234.4, 'metric', { decimals: 0 })).toMatch(/^1[,.\s]?234 kg$/);
  });
});

describe('custom rest presets', () => {
  it('defaults to none and drops invalid lists', () => {
    expect(DEFAULT_SETTINGS.rest_presets).toEqual([]);
    expect(parseSettings({ rest_presets: [75, 'x'] }).rest_presets).toEqual([]);
    expect(parseSettings({ rest_presets: [75, 150] }).rest_presets).toEqual([75, 150]);
  });

  it('adds sorted, deduped, capped presets and skips built-in values', () => {
    expect(addRestPreset([150], 75)).toEqual([75, 150]);
    expect(addRestPreset([75], 75)).toEqual([75]);
    expect(addRestPreset([], 90)).toEqual([]); // 1:30 is already built in
    expect(addRestPreset([10, 20, 30, 40, 50, 70, 80, 100], 110)).toHaveLength(8);
    expect(removeRestPreset([75, 150], 75)).toEqual([150]);
  });
});
