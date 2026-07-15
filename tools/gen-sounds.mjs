#!/usr/bin/env node
/**
 * War World sound pack generator.
 * Every sound is synthesized from scratch (noise + oscillators + filters) —
 * no samples, no third-party audio. The generated WAVs are dedicated to the
 * public domain under CC0 1.0 (see public/audio/LICENSE-CC0.txt).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

// ---------- tiny synth toolkit ----------

// deterministic noise so the pack is reproducible
let noiseState = 0x12345678;
function nrand() {
  noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
  return noiseState / 2147483648 - 1;
}

const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

function addNoise(b, { amp = 1, decay = 8, start = 0, dur = Infinity } = {}) {
  const s0 = Math.floor(start * SR);
  const s1 = Math.min(b.length, s0 + Math.floor(Math.min(dur, 1e6) * SR));
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    b[i] += nrand() * amp * Math.exp(-decay * t);
  }
  return b;
}

function addTone(b, { freq = 440, freqEnd = null, amp = 0.5, decay = 6, start = 0, dur = Infinity, shape = 'sine', attack = 0.002 } = {}) {
  const s0 = Math.floor(start * SR);
  const s1 = Math.min(b.length, s0 + Math.floor(Math.min(dur, 1e6) * SR));
  const fEnd = freqEnd ?? freq;
  let phase = 0;
  const span = Math.max(1, s1 - s0);
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    const k = (i - s0) / span;
    const f = freq + (fEnd - freq) * k;
    phase += (2 * Math.PI * f) / SR;
    let v;
    switch (shape) {
      case 'saw': v = ((phase / Math.PI) % 2) - 1; break;
      case 'square': v = Math.sin(phase) > 0 ? 1 : -1; break;
      case 'triangle': v = Math.asin(Math.sin(phase)) * (2 / Math.PI); break;
      default: v = Math.sin(phase);
    }
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    b[i] += v * amp * env;
  }
  return b;
}

function lowpass(b, cutoff) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = 1 / SR / (rc + 1 / SR);
  let y = 0;
  for (let i = 0; i < b.length; i++) {
    y += a * (b[i] - y);
    b[i] = y;
  }
  return b;
}

function highpass(b, cutoff) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = rc / (rc + 1 / SR);
  let y = 0, xPrev = 0;
  for (let i = 0; i < b.length; i++) {
    y = a * (y + b[i] - xPrev);
    xPrev = b[i];
    b[i] = y;
  }
  return b;
}

function drive(b, gain) {
  for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * gain);
  return b;
}

function normalize(b, peak = 0.9) {
  let max = 0;
  for (const v of b) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < b.length; i++) b[i] = (b[i] / max) * peak;
  return b;
}

function writeWav(name, b) {
  normalize(b);
  const n = b.length;
  const bytes = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(bytes);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, b[i])) * 32767, true);
  writeFileSync(join(OUT, `${name}.wav`), Buffer.from(bytes));
  console.log(`  ${name}.wav (${(n / SR).toFixed(2)}s)`);
}

// ---------- the sounds ----------

console.log('Generating War World CC0 sound pack →', OUT);

// gunshots: noise crack + low thud
writeWav('rifle', (() => {
  let b = buf(0.3);
  addNoise(b, { amp: 1, decay: 30 });
  addTone(b, { freq: 220, freqEnd: 60, amp: 0.8, decay: 22 });
  return drive(lowpass(b, 5200), 2.2);
})());

writeWav('smg', (() => {
  let b = buf(0.18);
  addNoise(b, { amp: 1, decay: 46 });
  addTone(b, { freq: 320, freqEnd: 90, amp: 0.6, decay: 34 });
  return drive(lowpass(b, 6400), 2);
})());

writeWav('pistol', (() => {
  let b = buf(0.22);
  addNoise(b, { amp: 0.9, decay: 40 });
  addTone(b, { freq: 260, freqEnd: 80, amp: 0.7, decay: 30 });
  return drive(lowpass(b, 4800), 1.8);
})());

writeWav('shotgun', (() => {
  let b = buf(0.5);
  addNoise(b, { amp: 1.2, decay: 14 });
  addTone(b, { freq: 130, freqEnd: 45, amp: 1, decay: 12 });
  return drive(lowpass(b, 3400), 2.6);
})());

writeWav('autocannon', (() => {
  let b = buf(0.26);
  addNoise(b, { amp: 1, decay: 24 });
  addTone(b, { freq: 160, freqEnd: 50, amp: 1, decay: 18 });
  return drive(lowpass(b, 3000), 2.4);
})());

writeWav('rail', (() => {
  let b = buf(0.7);
  addTone(b, { freq: 2400, freqEnd: 240, amp: 0.9, decay: 7, shape: 'saw' });
  addTone(b, { freq: 1200, freqEnd: 90, amp: 0.6, decay: 9 });
  addNoise(b, { amp: 0.5, decay: 18 });
  return drive(highpass(b, 300), 1.6);
})());

writeWav('rocket', (() => {
  let b = buf(0.9);
  addNoise(b, { amp: 0.9, decay: 3.2 });
  addTone(b, { freq: 90, freqEnd: 55, amp: 0.5, decay: 3, shape: 'saw' });
  return lowpass(b, 1800);
})());

writeWav('thump', (() => { // grenade launcher
  let b = buf(0.35);
  addTone(b, { freq: 110, freqEnd: 42, amp: 1, decay: 14 });
  addNoise(b, { amp: 0.5, decay: 26 });
  return lowpass(b, 900);
})());

writeWav('cannon', (() => {
  let b = buf(1.1);
  addNoise(b, { amp: 1.3, decay: 6 });
  addTone(b, { freq: 70, freqEnd: 28, amp: 1.3, decay: 4.5 });
  return drive(lowpass(b, 1500), 3);
})());

writeWav('plasma', (() => {
  let b = buf(0.32);
  addTone(b, { freq: 880, freqEnd: 320, amp: 0.8, decay: 12, shape: 'square' });
  addTone(b, { freq: 1320, freqEnd: 480, amp: 0.4, decay: 16 });
  return lowpass(b, 5200);
})());

writeWav('flame', (() => {
  let b = buf(0.4);
  addNoise(b, { amp: 0.8, decay: 4 });
  return lowpass(b, 1100);
})());

writeWav('repair', (() => {
  let b = buf(0.3);
  addTone(b, { freq: 500, freqEnd: 700, amp: 0.5, decay: 8, shape: 'triangle' });
  addTone(b, { freq: 1000, freqEnd: 1400, amp: 0.25, decay: 10 });
  return b;
})());

writeWav('heal', (() => {
  let b = buf(0.45);
  addTone(b, { freq: 620, freqEnd: 930, amp: 0.5, decay: 6, shape: 'sine' });
  addTone(b, { freq: 930, freqEnd: 1240, amp: 0.3, decay: 7, start: 0.08 });
  return b;
})());

writeWav('claw', (() => {
  let b = buf(0.28);
  addNoise(b, { amp: 0.9, decay: 16 });
  addTone(b, { freq: 180, freqEnd: 70, amp: 0.5, decay: 14 });
  return lowpass(b, 2200);
})());

writeWav('acid', (() => {
  let b = buf(0.4);
  addNoise(b, { amp: 0.6, decay: 9 });
  addTone(b, { freq: 420, freqEnd: 130, amp: 0.5, decay: 9, shape: 'triangle' });
  return lowpass(b, 2600);
})());

// impacts & explosions
writeWav('hit', (() => {
  let b = buf(0.12);
  addNoise(b, { amp: 0.9, decay: 60 });
  addTone(b, { freq: 400, freqEnd: 180, amp: 0.4, decay: 45 });
  return lowpass(b, 4200);
})());

writeWav('hitmarker', (() => {
  let b = buf(0.09);
  addTone(b, { freq: 1600, amp: 0.6, decay: 55, shape: 'triangle' });
  return b;
})());

writeWav('explosion', (() => {
  let b = buf(1.5);
  addNoise(b, { amp: 1.4, decay: 4 });
  addTone(b, { freq: 60, freqEnd: 24, amp: 1.5, decay: 2.8 });
  return drive(lowpass(b, 900), 3.2);
})());

writeWav('explosion_big', (() => {
  let b = buf(2.4);
  addNoise(b, { amp: 1.5, decay: 2.4 });
  addTone(b, { freq: 50, freqEnd: 18, amp: 1.8, decay: 1.6 });
  addNoise(b, { amp: 0.5, decay: 5, start: 0.25 });
  return drive(lowpass(b, 700), 3.6);
})());

writeWav('death', (() => {
  let b = buf(0.6);
  addTone(b, { freq: 300, freqEnd: 80, amp: 0.7, decay: 5, shape: 'saw' });
  addNoise(b, { amp: 0.35, decay: 8 });
  return lowpass(b, 1400);
})());

// movement / gear
writeWav('jetpack', (() => {
  let b = buf(0.35);
  addNoise(b, { amp: 0.7, decay: 2.5 });
  addTone(b, { freq: 140, freqEnd: 180, amp: 0.3, decay: 3, shape: 'saw' });
  return lowpass(b, 1600);
})());

writeWav('cloak', (() => {
  let b = buf(0.5);
  addTone(b, { freq: 1200, freqEnd: 300, amp: 0.5, decay: 6, shape: 'triangle' });
  addTone(b, { freq: 600, freqEnd: 150, amp: 0.3, decay: 7 });
  return b;
})());

writeWav('reload', (() => {
  let b = buf(0.5);
  addNoise(b, { amp: 0.6, decay: 70, start: 0 });
  addNoise(b, { amp: 0.7, decay: 60, start: 0.16 });
  addNoise(b, { amp: 0.8, decay: 50, start: 0.34 });
  return highpass(lowpass(b, 3800), 700);
})());

writeWav('pickup', (() => {
  let b = buf(0.35);
  addTone(b, { freq: 660, amp: 0.5, decay: 14, dur: 0.1, shape: 'triangle' });
  addTone(b, { freq: 990, amp: 0.5, decay: 12, start: 0.09, shape: 'triangle' });
  return b;
})());

writeWav('engine', (() => {
  let b = buf(1.0);
  addTone(b, { freq: 75, amp: 0.7, decay: 0.4, shape: 'saw' });
  addTone(b, { freq: 151, amp: 0.35, decay: 0.4, shape: 'saw' });
  addNoise(b, { amp: 0.2, decay: 0.5 });
  // fade tail for seamless-ish looping
  for (let i = 0; i < b.length; i++) {
    const t = i / b.length;
    b[i] *= t < 0.06 ? t / 0.06 : t > 0.94 ? (1 - t) / 0.06 : 1;
  }
  return lowpass(b, 900);
})());

writeWav('mine_plant', (() => {
  let b = buf(0.3);
  addNoise(b, { amp: 0.5, decay: 40 });
  addTone(b, { freq: 900, amp: 0.4, decay: 25, start: 0.12, shape: 'square', dur: 0.08 });
  return b;
})());

writeWav('turret_built', (() => {
  let b = buf(0.7);
  addNoise(b, { amp: 0.5, decay: 30 });
  addNoise(b, { amp: 0.5, decay: 30, start: 0.2 });
  addTone(b, { freq: 520, amp: 0.4, decay: 10, start: 0.4, shape: 'square', dur: 0.2 });
  return lowpass(b, 3000);
})());

// stingers / UI
const stinger = (notes, shape = 'triangle', noteLen = 0.16, decay = 7) => {
  const b = buf(notes.length * noteLen + 0.6);
  notes.forEach((f, i) => {
    addTone(b, { freq: f, amp: 0.5, decay, start: i * noteLen, shape });
    addTone(b, { freq: f * 2, amp: 0.15, decay: decay + 2, start: i * noteLen, shape });
  });
  return b;
};

writeWav('flag_taken', stinger([523, 659, 784], 'square', 0.11, 9));
writeWav('flag_captured', stinger([523, 659, 784, 1047, 1319], 'triangle', 0.13, 5));
writeWav('flag_returned', stinger([784, 659, 523], 'triangle', 0.12, 8));
writeWav('point_captured', stinger([440, 554, 659, 880], 'triangle', 0.12, 6));
writeWav('wave_start', (() => {
  let b = buf(1.6);
  addTone(b, { freq: 110, amp: 0.8, decay: 2, shape: 'saw', dur: 0.7 });
  addTone(b, { freq: 116, amp: 0.6, decay: 2, shape: 'saw', dur: 0.7 });
  addTone(b, { freq: 220, amp: 0.4, decay: 3, start: 0.5, shape: 'square', dur: 0.4 });
  return lowpass(b, 800);
})());
writeWav('victory', stinger([523, 659, 784, 1047, 784, 1047, 1319], 'triangle', 0.15, 4));
writeWav('defeat', stinger([392, 349, 311, 262], 'saw', 0.22, 4));
// ---- sci-fi kit ----
writeWav('impulse', (() => { // disc launcher: hollow punch + ring
  let b = buf(0.45);
  addTone(b, { freq: 320, freqEnd: 90, amp: 0.9, decay: 12, shape: 'square' });
  addTone(b, { freq: 1400, freqEnd: 700, amp: 0.35, decay: 18 });
  addNoise(b, { amp: 0.4, decay: 22 });
  return drive(lowpass(b, 3200), 1.8);
})());

writeWav('warp', (() => { // teleport: rising shimmer + zap
  let b = buf(0.75);
  addTone(b, { freq: 220, freqEnd: 1760, amp: 0.55, decay: 4, shape: 'triangle', dur: 0.4 });
  addTone(b, { freq: 440, freqEnd: 3520, amp: 0.3, decay: 5, dur: 0.4 });
  addNoise(b, { amp: 0.45, decay: 14, start: 0.32 });
  addTone(b, { freq: 1200, freqEnd: 200, amp: 0.4, decay: 9, start: 0.35 });
  return b;
})());

writeWav('blink', (() => { // stalker phase: reversed-feeling dark shimmer
  let b = buf(0.5);
  addTone(b, { freq: 900, freqEnd: 110, amp: 0.6, decay: 6, shape: 'saw' });
  addTone(b, { freq: 1350, freqEnd: 160, amp: 0.3, decay: 7, shape: 'triangle' });
  addNoise(b, { amp: 0.25, decay: 10 });
  return lowpass(b, 2400);
})());

writeWav('emp_burst', (() => { // crackling electric thump
  let b = buf(0.9);
  addTone(b, { freq: 70, freqEnd: 30, amp: 1.1, decay: 6 });
  for (let i = 0; i < 9; i++) addNoise(b, { amp: 0.5, decay: 60, start: 0.02 + i * 0.07 });
  addTone(b, { freq: 2200, freqEnd: 300, amp: 0.35, decay: 5, shape: 'square' });
  return drive(lowpass(b, 4200), 2);
})());

writeWav('gravlift', (() => { // launch: springy rising whoosh
  let b = buf(0.6);
  addTone(b, { freq: 150, freqEnd: 900, amp: 0.6, decay: 4, shape: 'triangle', dur: 0.35 });
  addNoise(b, { amp: 0.4, decay: 5 });
  return lowpass(b, 2600);
})());

writeWav('beacon', (() => { // deploy ping
  let b = buf(0.5);
  addTone(b, { freq: 1180, amp: 0.5, decay: 10, dur: 0.12, shape: 'sine' });
  addTone(b, { freq: 1760, amp: 0.35, decay: 9, start: 0.16, dur: 0.12 });
  return b;
})());

writeWav('orbital_charge', (() => { // 3s of dread
  let b = buf(2.9);
  addTone(b, { freq: 55, freqEnd: 110, amp: 0.5, decay: 0.2, shape: 'saw', dur: 2.8 });
  addTone(b, { freq: 440, freqEnd: 1760, amp: 0.25, decay: 0.4, shape: 'sine', dur: 2.8 });
  for (let i = 0; i < 6; i++) addTone(b, { freq: 1200 + i * 150, amp: 0.2, decay: 14, start: 0.4 * i, dur: 0.1, shape: 'square' });
  return lowpass(b, 3000);
})());

writeWav('ui_click', (() => {
  let b = buf(0.08);
  addTone(b, { freq: 900, amp: 0.5, decay: 60, shape: 'triangle' });
  return b;
})());
writeWav('spawn', (() => {
  let b = buf(0.4);
  addTone(b, { freq: 300, freqEnd: 900, amp: 0.5, decay: 8 });
  return b;
})());

writeWav('footstep', (() => { // soft boot scuff — synced to the walk cycle
  let b = buf(0.09);
  addNoise(b, { amp: 0.35, decay: 45 });
  addTone(b, { freq: 110, freqEnd: 70, amp: 0.25, decay: 40, shape: 'sine' });
  return lowpass(b, 900);
})());

writeWav('growl', (() => { // undead rasp — marks the reach animation
  let b = buf(0.5);
  addTone(b, { freq: 70, freqEnd: 52, amp: 0.4, decay: 4, shape: 'saw', dur: 0.45 });
  addTone(b, { freq: 140, freqEnd: 95, amp: 0.2, decay: 5, shape: 'square', dur: 0.4 });
  addNoise(b, { amp: 0.18, decay: 5, dur: 0.45 });
  return lowpass(b, 700);
})());

writeFileSync(join(OUT, 'LICENSE-CC0.txt'),
`War World Sound Pack
====================
All .wav files in this directory were procedurally synthesized for War World
(no recordings or third-party samples were used) and are dedicated to the
public domain under CC0 1.0 Universal:
https://creativecommons.org/publicdomain/zero/1.0/

You may copy, modify, and use them for any purpose without attribution.
`);
console.log('Done.');
