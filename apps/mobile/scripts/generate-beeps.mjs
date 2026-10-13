/**
 * Generates the rest-timer beeps as 16-bit mono WAV files.
 *   node scripts/generate-beeps.mjs
 * Tweak the tone tables below and re-run to change the sounds.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

/** A tone is { hz, ms } (hz = 0 for silence). */
const SOUNDS = {
  // Countdown tick at 3 / 2 / 1 seconds: short, mid-pitched blip.
  'rest_tick.wav': [{ hz: 880, ms: 110 }],
  // Rest over: rising "beep-beep-beeeep", clearly different from the tick.
  'rest_finish.wav': [
    { hz: 1046.5, ms: 120 },
    { hz: 0, ms: 70 },
    { hz: 1046.5, ms: 120 },
    { hz: 0, ms: 70 },
    { hz: 1568, ms: 480 },
  ],
};

const AMPLITUDE = 0.7;
const FADE_MS = 6; // short attack/release so tones don't click

function render(tones) {
  const samples = [];
  for (const { hz, ms } of tones) {
    const n = Math.round((ms / 1000) * SAMPLE_RATE);
    const fade = Math.round((FADE_MS / 1000) * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      if (hz === 0) {
        samples.push(0);
        continue;
      }
      const envelope = Math.min(1, i / fade, (n - 1 - i) / fade);
      // Sine plus a quiet octave harmonic: cuts through gym noise better than a pure sine.
      const t = i / SAMPLE_RATE;
      const v = Math.sin(2 * Math.PI * hz * t) * 0.85 + Math.sin(2 * Math.PI * hz * 2 * t) * 0.15;
      samples.push(v * envelope * AMPLITUDE);
    }
  }
  return samples;
}

function toWav(samples) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return buf;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, tones] of Object.entries(SOUNDS)) {
  const wav = toWav(render(tones));
  writeFileSync(join(OUT_DIR, file), wav);
  console.log(`${file}: ${(wav.length / 1024).toFixed(1)} KB`);
}
