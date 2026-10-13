/**
 * Per-set effort (ROADMAP 2.7). Always STORED as RPE in `sets.rpe` (1–10, half steps); users can choose to
 * enter and see it as RIR (reps in reserve) instead: RIR = 10 − RPE, so RPE 10 = RIR 0 (failure).
 */
export const EFFORT_INPUTS = ['off', 'rpe', 'rir'] as const;
export type EffortInput = (typeof EFFORT_INPUTS)[number];

/** Picker choices. RPE below 6 is rarely meaningful for working sets; RIR 5 means "5 or more". */
export const RPE_CHOICES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;
export const RIR_CHOICES = [5, 4, 3, 2, 1, 0] as const;

export const rirToRpe = (rir: number) => Math.min(10, Math.max(1, 10 - rir));
export const rpeToRir = (rpe: number) => Math.max(0, 10 - rpe);

/** Short cell text in the chosen mode: "8.5" (RPE) or "2" (RIR, rounded down; 5 = 5+). '' when unset. */
export function formatEffort(rpe: number | null | undefined, mode: EffortInput): string {
  if (rpe === null || rpe === undefined || mode === 'off') return '';
  if (mode === 'rpe') return String(rpe);
  const rir = Math.floor(rpeToRir(rpe));
  return rir >= 5 ? '5+' : String(rir);
}
