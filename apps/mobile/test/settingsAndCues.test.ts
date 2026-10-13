import { beforeEach, describe, expect, it } from 'vitest';
import { getLocalUser } from '../src/db/repositories/user';
import { COUNTDOWN_SECONDS, initialCueState, nextCue, type Cue } from '../src/services/restCues';
import { useSettingsStore } from '../src/state/settingsStore';
import { freshApp } from './helpers';

describe('settings store', () => {
  beforeEach(async () => {
    await freshApp();
  });

  it('starts with defaults and persists changes to the local user row', async () => {
    expect(useSettingsStore.getState()).toMatchObject({ unit: 'metric', default_rest_seconds: 90, rest_sound: true });
    await useSettingsStore.getState().update({ unit: 'imperial', rest_sound: false, default_rest_seconds: 150 });

    const user = await getLocalUser();
    expect(user!.unit_system).toBe('imperial');
    expect(user!.preferences).toMatchObject({ rest_sound: false, default_rest_seconds: 150 });

    // Simulate an app restart: in-memory state reset, then reloaded from SQLite.
    useSettingsStore.setState({ unit: 'metric', rest_sound: true, default_rest_seconds: 90 });
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState()).toMatchObject({ unit: 'imperial', rest_sound: false, default_rest_seconds: 150 });
  });
});

/** Runs the cue loop like the app (poll every 50 ms) and records when each cue fired. */
function simulate(startRemainingMs: number, pollMs = 50) {
  let state = initialCueState(startRemainingMs);
  const fired: { cue: Cue; atRemainingMs: number }[] = [];
  for (let remaining = startRemainingMs; ; remaining -= pollMs) {
    const r = nextCue(remaining, state);
    state = r.state;
    if (r.cue !== 'none') fired.push({ cue: r.cue, atRemainingMs: remaining });
    if (r.cue === 'finish' || r.cue === 'expire-silently') return fired;
  }
}

describe('rest timer cues', () => {
  it('primes the audio at 4 s, ticks exactly at 3·2·1, then finishes once', () => {
    const fired = simulate(10_000);
    expect(fired.map((f) => f.cue)).toEqual(['prime', 'tick', 'tick', 'tick', 'finish']);
    // Each cue lands within one poll interval after the whole second.
    const expected = [4000, 3000, 2000, 1000, 0];
    fired.forEach((f, i) => expect(expected[i]! - f.atRemainingMs).toBeLessThan(50));
    expect(COUNTDOWN_SECONDS).toBe(3);
  });

  it('does not fire an off-beat tick when a timer is resumed mid-countdown', () => {
    // Resumed with 2.5 s left: no late "3" straight away; the next tick waits for the 2-second mark.
    const fired = simulate(2_500);
    expect(fired.map((f) => f.cue)).toEqual(['tick', 'tick', 'finish']);
    expect(fired[0]!.atRemainingMs).toBeLessThanOrEqual(2000);
    expect(2000 - fired[0]!.atRemainingMs).toBeLessThan(50);
  });

  it('a stale deadline (app reopened long after) expires silently', () => {
    expect(nextCue(-5_000, initialCueState(1_000)).cue).toBe('expire-silently');
    expect(nextCue(-500, initialCueState(1_000)).cue).toBe('finish');
  });
});
