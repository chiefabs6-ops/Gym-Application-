import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Preloaded short UI sounds. Regenerate the files with `node scripts/generate-beeps.mjs`.
 *
 * Each file is first resolved to a LOCAL file via expo-asset, then played from disk:
 *  - release builds: assets are embedded, so this resolves instantly;
 *  - dev (Expo Go): the file is downloaded from Metro once and cached, so beeps keep
 *    working if the dev-server connection drops or the device goes offline.
 * A failed load is retried on the next attempt instead of silently disabling sound.
 */
interface Players {
  tick: AudioPlayer;
  finish: AudioPlayer;
  /** Muted copy of the tick, used to wake the audio output just before the countdown. */
  primer: AudioPlayer;
}

let players: Players | null = null;
let loading: Promise<Players | null> | null = null;

async function playerFor(module: number): Promise<AudioPlayer> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  return createAudioPlayer({ uri: asset.localUri ?? asset.uri });
}

/** Loads (or retries loading) the sounds. Safe to call repeatedly. */
export function ensureSoundsLoaded(): Promise<Players | null> {
  if (players) return Promise.resolve(players);
  loading ??= (async () => {
    try {
      // mixWithOthers: beeps play over the user's music without pausing or ducking it.
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
      players = {
        tick: await playerFor(require('../../assets/sounds/rest_tick.wav')),
        finish: await playerFor(require('../../assets/sounds/rest_finish.wav')),
        primer: await playerFor(require('../../assets/sounds/rest_tick.wav')),
      };
      players.primer.volume = 0;
      if (__DEV__) console.log('[sounds] rest timer sounds ready');
      return players;
    } catch (err) {
      console.warn('[sounds] failed to load rest timer sounds, will retry', err);
      return null;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export const initSounds = () => ensureSoundsLoaded();

function play(pick: (p: Players) => AudioPlayer) {
  const run = (p: Players | null) => {
    if (!p) return;
    try {
      const player = pick(p);
      void player.seekTo(0);
      player.play();
    } catch (err) {
      console.warn('[sounds] playback failed', err);
    }
  };
  // Fast path: already loaded. Otherwise load (or retry) and play as soon as it's ready.
  if (players) run(players);
  else void ensureSoundsLoaded().then(run);
}

/**
 * Android puts the audio output to sleep after a few seconds of silence; waking it costs
 * 100–300 ms, which made the first countdown tick late. Playing a muted sound ~1 s earlier
 * keeps the output awake so the first audible tick lands on time.
 */
export const primeAudioOutput = () => play((p) => p.primer);

/** Short tick for the 3 · 2 · 1 countdown. */
export const playCountdownTick = () => play((p) => p.tick);

/** Distinct rising beep-beep-beeeep when rest is over. */
export const playRestFinished = () => play((p) => p.finish);
