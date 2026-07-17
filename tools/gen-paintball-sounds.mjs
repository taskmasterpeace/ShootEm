#!/usr/bin/env node
/**
 * Paintball sound micro-pack (Robert: "we need paintball sounds").
 * Standalone ON PURPOSE: public/audio carries hand-picked takes from the AI
 * pack pipeline (apply-picks.mjs), so regenerating the whole pack would
 * clobber curated sounds. This writes ONLY the six paintball wavs.
 * Same law as gen-sounds.mjs: synthesized from scratch, CC0.
 *
 *   marker      — the Blitz: a soft pneumatic "thoop", more air than bang
 *   marker_pump — the Pump: deeper single thoop with a mechanical clack
 *   marker_lob  — the Lobber: hollow tube "thoomp", almost a cough
 *   splat       — a ball breaking: wet slap, no ring
 *   splat_big   — a player painted out: the whole hopper's worth
 *   whistle     — the referee: two sharp pea-whistle blasts (round start/end)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

let noiseState = 0x600df00d; // deterministic — the pack is reproducible
function nrand() {
  noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
  return noiseState / 2147483648 - 1;
}
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

function addNoise(b, { amp = 1, decay = 8, start = 0, dur = Infinity, lp = 0 } = {}) {
  const s0 = Math.floor(start * SR);
  const s1 = Math.min(b.length, s0 + Math.floor(Math.min(dur, 1e6) * SR));
  let y = 0;
  const a = lp > 0 ? 1 - Math.exp((-2 * Math.PI * lp) / SR) : 1;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    y += a * (nrand() - y);
    b[i] += y * amp * Math.exp(-decay * t);
  }
  return b;
}

function addTone(b, { freq = 440, freqEnd = null, amp = 0.5, decay = 6, start = 0, dur = Infinity, shape = 'sine', attack = 0.002 } = {}) {
  const s0 = Math.floor(start * SR);
  const s1 = Math.min(b.length, s0 + Math.floor(Math.min(dur, 1e6) * SR));
  const fEnd = freqEnd ?? freq;
  let phase = 0;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    const k = (i - s0) / Math.max(1, s1 - s0);
    const f = freq + (fEnd - freq) * k;
    phase += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    const v = shape === 'square' ? Math.sign(Math.sin(phase)) : shape === 'tri'
      ? Math.asin(Math.sin(phase)) * (2 / Math.PI) : Math.sin(phase);
    b[i] += v * amp * env;
  }
  return b;
}

function normalize(b, peak = 0.9) {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] = (b[i] / m) * peak;
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

console.log('Generating paintball micro-pack →', OUT);

// the Blitz marker: an air burst, not gunpowder — soft chuff + brief hiss
writeWav('marker', (() => {
  const b = buf(0.16);
  addTone(b, { freq: 210, freqEnd: 90, amp: 1, decay: 34, dur: 0.09, shape: 'sine', attack: 0.001 });
  addNoise(b, { amp: 0.55, decay: 46, lp: 2400, dur: 0.1 });
  addNoise(b, { amp: 0.16, decay: 16, lp: 5200, start: 0.02, dur: 0.12 }); // co2 tail
  return b;
})());

// the Pump: bigger air chamber + the slide clack right after
writeWav('marker_pump', (() => {
  const b = buf(0.30);
  addTone(b, { freq: 150, freqEnd: 65, amp: 1, decay: 22, dur: 0.14, attack: 0.001 });
  addNoise(b, { amp: 0.6, decay: 30, lp: 1900, dur: 0.14 });
  addNoise(b, { amp: 0.35, decay: 70, lp: 6000, start: 0.14, dur: 0.05 }); // pump CLACK
  addTone(b, { freq: 1300, amp: 0.12, decay: 80, start: 0.14, dur: 0.04, shape: 'square' });
  return b;
})());

// the Lobber: a hollow tube cough — long low thoomp, no crack at all
writeWav('marker_lob', (() => {
  const b = buf(0.4);
  addTone(b, { freq: 110, freqEnd: 48, amp: 1, decay: 12, dur: 0.3, attack: 0.004 });
  addNoise(b, { amp: 0.4, decay: 14, lp: 900, dur: 0.25 });
  return b;
})());

// a ball breaking on anything: wet slap — noise burst through a low filter,
// pitch-bent droplet, ZERO ring (paint doesn't ring)
writeWav('splat', (() => {
  const b = buf(0.22);
  addNoise(b, { amp: 1, decay: 40, lp: 1400, dur: 0.12 });
  addTone(b, { freq: 420, freqEnd: 120, amp: 0.5, decay: 38, dur: 0.08, shape: 'tri', attack: 0.001 });
  addNoise(b, { amp: 0.2, decay: 18, lp: 700, start: 0.05, dur: 0.15 }); // dribble
  return b;
})());

// painted OUT: the big one — double slap + heavier dribble down the bunker
writeWav('splat_big', (() => {
  const b = buf(0.5);
  addNoise(b, { amp: 1, decay: 26, lp: 1100, dur: 0.16 });
  addTone(b, { freq: 300, freqEnd: 80, amp: 0.6, decay: 22, dur: 0.14, shape: 'tri', attack: 0.001 });
  addNoise(b, { amp: 0.5, decay: 34, lp: 1600, start: 0.09, dur: 0.12 }); // second ball
  addNoise(b, { amp: 0.25, decay: 9, lp: 600, start: 0.16, dur: 0.3 });   // the run-down
  return b;
})());

// the referee's pea whistle: two blasts, warbled by the pea — round bookends
writeWav('whistle', (() => {
  const b = buf(0.62);
  for (const start of [0, 0.3]) {
    for (let i = 0; i < 0.22 * SR; i++) {
      const t = i / SR;
      const idx = Math.floor(start * SR) + i;
      if (idx >= b.length) break;
      const warble = 1 + 0.045 * Math.sin(2 * Math.PI * 38 * t); // the pea
      const f = 2350 * warble;
      const env = Math.min(1, t / 0.012) * Math.min(1, Math.max(0, (0.22 - t) / 0.05));
      b[idx] += Math.sin(2 * Math.PI * f * t) * 0.8 * env;
      b[idx] += Math.sin(2 * Math.PI * f * 1.5 * t) * 0.18 * env; // overblow
    }
  }
  addNoise(b, { amp: 0.06, decay: 3, lp: 8000, dur: 0.6 }); // breath
  return b;
})());

console.log('done — 6 sounds, additive only (no existing wav touched)');
