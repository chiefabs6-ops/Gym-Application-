/**
 * Pure rest-timer cue logic (no React / React Native), so it can be unit-tested.
 * `useRestTimerCues` polls this every ~50 ms and performs the returned side effect.
 */
export const COUNTDOWN_SECONDS = 3;
/** Expiry older than this (e.g. a stale deadline restored after relaunch) is silent. */
export const STALE_EXPIRY_MS = 2_000;

export type Cue = 'none' | 'prime' | 'tick' | 'finish' | 'expire-silently';

export interface CueState {
  /** Seconds-left value we last cued for. */
  lastSecond: number;
}

/** Initial state: treat the current second as already handled, so resuming mid-countdown doesn't fire an off-beat tick. */
export const initialCueState = (remainingMs: number): CueState => ({ lastSecond: Math.ceil(remainingMs / 1000) });

/**
 * Decide what (if anything) to do at this poll.
 *  - 'prime'  at 4 s left: play a muted sound so Android's audio output is awake for the first tick
 *  - 'tick'   at 3, 2, 1 s left
 *  - 'finish' at 0 (fresh expiry) → finish beep / vibration, then stop the timer
 *  - 'expire-silently' at 0 for a stale deadline → just stop the timer
 * Audio/foreground preferences are applied by the caller.
 */
export function nextCue(remainingMs: number, state: CueState): { cue: Cue; state: CueState } {
  if (remainingMs <= 0) {
    return { cue: -remainingMs < STALE_EXPIRY_MS ? 'finish' : 'expire-silently', state };
  }
  const second = Math.ceil(remainingMs / 1000);
  if (second >= state.lastSecond) return { cue: 'none', state };
  const next = { lastSecond: second };
  if (second <= COUNTDOWN_SECONDS) return { cue: 'tick', state: next };
  if (second === COUNTDOWN_SECONDS + 1) return { cue: 'prime', state: next };
  return { cue: 'none', state: next };
}
