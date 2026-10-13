import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  distanceUnitLabel,
  formatDistanceNumber,
  fromDisplayDistance,
  formatWeight,
  formatWeightNumber,
  fromDisplayWeight,
  mergePreferences,
  parseSettings,
  weightUnitLabel,
  type AppSettings,
  type UnitSystem,
} from '@gym/shared';
import { updateRecord } from '../db/mutate';
import { getLocalUser, getUserId } from '../db/repositories/user';

/**
 * In-memory mirror of the user's settings (ROADMAP 1.4) so any code (incl. the 50 ms rest-timer
 * cue loop) can read them synchronously. The source of truth is the local `users` row:
 * `unit_system` column + `preferences` JSON, written through mutate.ts so it's included in
 * backups and will sync in Phase 8.
 */
interface SettingsState extends AppSettings {
  unit: UnitSystem;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings> & { unit?: UnitSystem }) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  unit: 'metric',
  loaded: false,

  load: async () => {
    const user = await getLocalUser();
    set({ ...parseSettings(user?.preferences), unit: user?.unit_system ?? 'metric', loaded: true });
  },

  update: async ({ unit, ...patch }) => {
    // Optimistic: UI reflects the change immediately; the DB write follows.
    set({ ...patch, ...(unit ? { unit } : {}) });
    const user = await getLocalUser();
    await updateRecord('users', await getUserId(), {
      preferences: mergePreferences(user?.preferences, patch),
      ...(unit ? { unit_system: unit } : {}),
    });
  },
}));

/** Non-React access (rest timer cues, stores). */
export const getSettings = () => useSettingsStore.getState();

/** Weight helpers bound to the current unit. Store kg; convert only for display/input. */
export function useUnits() {
  const unit = useSettingsStore((s) => s.unit);
  return {
    unit,
    label: weightUnitLabel(unit),
    /** kg → display string without unit, e.g. "225" */
    display: (kg: number | null | undefined, decimals = 1) => formatWeightNumber(kg, unit, decimals),
    /** kg → "225 lb" */
    format: (kg: number | null | undefined, decimals = 1) => formatWeight(kg, unit, { decimals }),
    /** typed number in the current unit → kg */
    toKg: (value: number) => fromDisplayWeight(value, unit),
    /** "km" / "mi" */
    distanceLabel: distanceUnitLabel(unit),
    /** meters → display number string in km / mi, e.g. "5" */
    displayDistance: (m: number | null | undefined) => formatDistanceNumber(m, unit),
    /** typed km / mi → meters */
    toMeters: (value: number) => fromDisplayDistance(value, unit),
  };
}
