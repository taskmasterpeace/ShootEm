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

// sharp attack transient — the crack that makes a gunshot read as a gunshot
function addClick(b, { amp = 1, dur = 0.005, freq = 3200 } = {}) {
  const s1 = Math.min(b.length, Math.floor(dur * SR));
  for (let i = 0; i < s1; i++) {
    const env = 1 - i / s1;
    b[i] += (nrand() * 0.55 + Math.sin((2 * Math.PI * freq * i) / SR) * 0.45) * amp * env * env;
  }
  return b;
}

// mix one buffer into another at a start time
function mix(dst, src, { gain = 1, start = 0 } = {}) {
  const s0 = Math.floor(start * SR);
  for (let i = 0; i < src.length && s0 + i < dst.length; i++) dst[s0 + i] += src[i] * gain;
  return dst;
}

// cheap ambience tail: a few decaying delayed copies add size (explosions)
function tail(b, { delay = 0.06, feedback = 0.4, taps = 3 } = {}) {
  const d = Math.max(1, Math.floor(delay * SR));
  const out = b.slice();
  for (let tp = 1; tp <= taps; tp++) {
    const g = Math.pow(feedback, tp);
    const off = d * tp;
    for (let i = 0; i + off < b.length; i++) out[i + off] += b[i] * g;
  }
  return out;
}

// layered gunshot: attack click + noise crack (body) + pitched-down thud (punch)
function gunshot({ dur = 0.28, clickAmp = 1, clickFreq = 3500, crackAmp = 1, crackDecay = 30,
  thudFreq = 210, thudEnd = 60, thudAmp = 0.8, thudDecay = 22, lp = 5200, driveAmt = 2.2 } = {}) {
  const b = buf(dur);
  addClick(b, { amp: clickAmp, freq: clickFreq });
  addNoise(b, { amp: crackAmp, decay: crackDecay });
  addTone(b, { freq: thudFreq, freqEnd: thudEnd, amp: thudAmp, decay: thudDecay });
  return drive(lowpass(b, lp), driveAmt);
}

// a class death cry: a pained grunt (pitch = the voice) + a per-class gear
// signature, so you can hear WHO went down.
function classDeath({ hi, lo, amp = 0.7, shape = 'saw', dur = 0.7, gear }) {
  const b = buf(dur);
  addTone(b, { freq: hi, freqEnd: lo, amp, decay: 5, shape });
  addTone(b, { freq: hi * 1.5, freqEnd: lo * 1.5, amp: amp * 0.28, decay: 6 }); // formant
  addNoise(b, { amp: 0.18, decay: 7 }); // breath
  if (gear) gear(b);
  return lowpass(b, 2400);
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

// gunshots: layered attack click + noise crack + pitched-down thud
writeWav('rifle', gunshot({ dur: 0.3, clickFreq: 4200, crackDecay: 30, thudFreq: 220, thudAmp: 0.8, lp: 5600, driveAmt: 2.4 }));
writeWav('smg', gunshot({ dur: 0.15, clickFreq: 5200, crackAmp: 0.95, crackDecay: 52, thudFreq: 340, thudAmp: 0.5, lp: 7000, driveAmt: 2 }));
writeWav('pistol', gunshot({ dur: 0.2, clickFreq: 4600, crackDecay: 42, thudFreq: 280, thudAmp: 0.6, lp: 5000, driveAmt: 1.9 }));
writeWav('shotgun', (() => { // heavy boom: click + long low body + shot spray
  let b = gunshot({ dur: 0.5, clickAmp: 1.2, clickFreq: 2400, crackAmp: 1.2, crackDecay: 13, thudFreq: 125, thudAmp: 1, thudDecay: 11, lp: 3400, driveAmt: 2.6 });
  addNoise(b, { amp: 0.4, decay: 22, start: 0.02 }); // pellet hiss
  return b;
})());
writeWav('autocannon', (() => { // mechanical heavy cannon
  let b = gunshot({ dur: 0.28, clickAmp: 1.1, clickFreq: 2600, crackAmp: 1.05, crackDecay: 22, thudFreq: 150, thudAmp: 1, thudDecay: 17, lp: 3000, driveAmt: 2.5 });
  addTone(b, { freq: 300, freqEnd: 120, amp: 0.3, decay: 30, shape: 'square' }); // action clank
  return b;
})());

writeWav('rail', (() => { // electric snap → descending zap tail
  let b = buf(0.7);
  addClick(b, { amp: 1, freq: 6000 });
  addTone(b, { freq: 2600, freqEnd: 240, amp: 0.9, decay: 7, shape: 'saw' });
  addTone(b, { freq: 1300, freqEnd: 90, amp: 0.55, decay: 9 });
  addTone(b, { freq: 60, freqEnd: 40, amp: 0.5, decay: 10, shape: 'sine' }); // recoil thud
  addNoise(b, { amp: 0.45, decay: 20 });
  return drive(highpass(b, 220), 1.7);
})());

writeWav('rocket', (() => { // ignition whoosh + rumbling motor
  let b = buf(0.95);
  addClick(b, { amp: 0.8, freq: 1600 });
  addNoise(b, { amp: 0.95, decay: 3 });
  addTone(b, { freq: 95, freqEnd: 50, amp: 0.55, decay: 2.6, shape: 'saw' });
  addTone(b, { freq: 190, freqEnd: 110, amp: 0.3, decay: 3, shape: 'saw' }); // motor harmonic
  return lowpass(b, 2000);
})());

writeWav('thump', (() => { // grenade launcher
  let b = buf(0.35);
  addTone(b, { freq: 110, freqEnd: 42, amp: 1, decay: 14 });
  addNoise(b, { amp: 0.5, decay: 26 });
  return lowpass(b, 900);
})());

writeWav('cannon', (() => { // 120mm: crack → deep boom → tail
  let b = buf(1.1);
  addClick(b, { amp: 1.3, freq: 1800 });
  addNoise(b, { amp: 1.3, decay: 6 });
  addTone(b, { freq: 72, freqEnd: 28, amp: 1.3, decay: 4.5 });
  addTone(b, { freq: 40, freqEnd: 20, amp: 1.2, decay: 3, shape: 'sine' }); // sub
  return tail(drive(lowpass(b, 1600), 3), { delay: 0.07, feedback: 0.3, taps: 2 });
})());

writeWav('plasma', (() => { // ring-modulated energy bolt
  let b = buf(0.32);
  addClick(b, { amp: 0.5, freq: 2600 });
  addTone(b, { freq: 880, freqEnd: 320, amp: 0.8, decay: 12, shape: 'square' });
  addTone(b, { freq: 1320, freqEnd: 480, amp: 0.4, decay: 16 });
  // ring mod for a synthetic 'zwip'
  for (let i = 0; i < b.length; i++) b[i] *= 0.7 + 0.3 * Math.sin((2 * Math.PI * 140 * i) / SR);
  return lowpass(b, 5400);
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
writeWav('hit', (() => { // flesh/armor thwack
  let b = buf(0.12);
  addClick(b, { amp: 0.7, freq: 2400 });
  addNoise(b, { amp: 0.85, decay: 60 });
  addTone(b, { freq: 400, freqEnd: 180, amp: 0.4, decay: 45 });
  return lowpass(b, 4200);
})());

writeWav('hitmarker', (() => {
  let b = buf(0.09);
  addTone(b, { freq: 1600, amp: 0.6, decay: 55, shape: 'triangle' });
  addTone(b, { freq: 2400, amp: 0.3, decay: 60, shape: 'triangle' });
  return b;
})());

writeWav('explosion', (() => { // crack → body → sub → debris crackle → tail
  let b = buf(1.6);
  addClick(b, { amp: 1, freq: 1400 });
  addNoise(b, { amp: 1.4, decay: 4.5 });
  addTone(b, { freq: 90, freqEnd: 26, amp: 1.4, decay: 3 });
  addTone(b, { freq: 46, freqEnd: 20, amp: 1.6, decay: 2, shape: 'sine' }); // sub-bass
  for (let i = 0; i < 9; i++) addNoise(b, { amp: 0.28, decay: 42, start: 0.09 + i * 0.05 }); // debris
  return tail(drive(lowpass(b, 1000), 3.2), { delay: 0.08, feedback: 0.32 });
})());

writeWav('explosion_big', (() => { // deeper, longer, more debris + a second concussion
  let b = buf(2.6);
  addClick(b, { amp: 1.3, freq: 1000 });
  addNoise(b, { amp: 1.5, decay: 2.4 });
  addTone(b, { freq: 52, freqEnd: 18, amp: 1.8, decay: 1.6 });
  addTone(b, { freq: 34, freqEnd: 16, amp: 1.7, decay: 1.2, shape: 'sine' }); // deep sub
  addNoise(b, { amp: 0.55, decay: 4, start: 0.22 }); // second concussion
  for (let i = 0; i < 14; i++) addNoise(b, { amp: 0.3, decay: 30, start: 0.15 + i * 0.06 }); // rubble
  return tail(drive(lowpass(b, 760), 3.6), { delay: 0.11, feedback: 0.38, taps: 4 });
})());

// generic death (zombies / fallback) — a pained gurgle
writeWav('death', classDeath({ hi: 300, lo: 80, amp: 0.7, shape: 'saw', dur: 0.6 }));

// ---- per-class death cries: each voice + gear signature is distinct ----
writeWav('death_infantry', classDeath({ hi: 210, lo: 85, gear: (b) => { // grunt + gear rattle
  addNoise(b, { amp: 0.25, decay: 40, start: 0.28 }); addNoise(b, { amp: 0.2, decay: 45, start: 0.4 });
} }));
writeWav('death_heavy', classDeath({ hi: 128, lo: 46, amp: 0.9, dur: 0.85, gear: (b) => { // deep groan + armor clang
  addTone(b, { freq: 180, freqEnd: 70, amp: 0.5, decay: 6, start: 0.32, shape: 'square' });
  addNoise(b, { amp: 0.45, decay: 24, start: 0.34 });
} }));
writeWav('death_jump', classDeath({ hi: 330, lo: 150, shape: 'triangle', dur: 0.65, gear: (b) => { // yelp + jetpack sputter dying
  for (let i = 0; i < 4; i++) addNoise(b, { amp: 0.3, decay: 8, start: 0.2 + i * 0.09 });
} }));
writeWav('death_engineer', classDeath({ hi: 200, lo: 92, gear: (b) => { // grunt + dropped-tool clatter
  addTone(b, { freq: 1200, amp: 0.35, decay: 40, start: 0.3, dur: 0.05, shape: 'square' });
  addTone(b, { freq: 800, amp: 0.3, decay: 45, start: 0.42, dur: 0.05, shape: 'square' });
} }));
writeWav('death_medic', classDeath({ hi: 250, lo: 105, dur: 0.75, gear: (b) => { // gasp + medi-tone failing
  addTone(b, { freq: 930, freqEnd: 300, amp: 0.4, decay: 4, start: 0.28, shape: 'triangle' });
} }));
writeWav('death_infiltrator', classDeath({ hi: 380, lo: 165, dur: 0.55, gear: (b) => { // sharp gasp + cloak fizzle
  addTone(b, { freq: 1200, freqEnd: 300, amp: 0.4, decay: 7, start: 0.22, shape: 'triangle' });
} }));
writeWav('death_pathfinder', classDeath({ hi: 350, lo: 155, dur: 0.6, gear: (b) => { // cry + warp zip snapping out
  addTone(b, { freq: 220, freqEnd: 1500, amp: 0.35, decay: 9, start: 0.24, shape: 'triangle', dur: 0.12 });
} }));
writeWav('death_ghost', classDeath({ hi: 220, lo: 95, gear: (b) => { // grunt + comms static cutting out
  let s = buf(0.35); addNoise(s, { amp: 0.5, decay: 10 }); s = highpass(s, 1800);
  mix(b, s, { gain: 0.5, start: 0.26 });
  addTone(b, { freq: 1400, amp: 0.25, decay: 30, start: 0.3, dur: 0.05, shape: 'square' });
} }));

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

// three growl takes so a horde sounds like many throats (see renderer growl pick)
function growl({ base = 70, hi = 140, lp = 700, amp = 0.4 } = {}) {
  const b = buf(0.5);
  addTone(b, { freq: base, freqEnd: base * 0.74, amp, decay: 4, shape: 'saw', dur: 0.45 });
  addTone(b, { freq: hi, freqEnd: hi * 0.68, amp: amp * 0.5, decay: 5, shape: 'square', dur: 0.4 });
  addNoise(b, { amp: 0.18, decay: 5, dur: 0.45 });
  return lowpass(b, lp);
}
writeWav('growl', growl());
writeWav('growl2', growl({ base: 58, hi: 120, lp: 620, amp: 0.44 })); // wetter, lower
writeWav('growl3', growl({ base: 88, hi: 170, lp: 820, amp: 0.36 })); // higher rasp

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
