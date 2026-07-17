#!/usr/bin/env node
/**
 * LSW signature sounds (§21.6, Robert: "make sure they have their own sound
 * effects"). Standalone — never regenerates the curated pack. CC0.
 *
 *   ice_freeze  — the encase: a rising crystalline shimmer that snaps shut
 *   ice_shatter — the block breaking (teammate shot / struggle-out)
 *   gas_hiss    — Plaguebearer's cloud venting
 *   rage_roar   — Ragebeast's fury, deeper and louder the more it bleeds
 *   fire_whoosh — Firebrand painting the floor (a body-scale flame gout)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

let noiseState = 0xa17ce5ed; // deterministic — the pack is reproducible
function nrand() {
  noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
  return noiseState / 2147483648 - 1;
}
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

function addNoise(b, { amp = 1, decay = 8, start = 0, dur = Infinity, lp = 0, hp = 0 } = {}) {
  const s0 = Math.floor(start * SR);
  const s1 = Math.min(b.length, s0 + Math.floor(Math.min(dur, 1e6) * SR));
  let y = 0, yh = 0, xPrev = 0;
  const a = lp > 0 ? 1 - Math.exp((-2 * Math.PI * lp) / SR) : 1;
  const ah = hp > 0 ? Math.exp((-2 * Math.PI * hp) / SR) : 0;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    const x = nrand();
    y += a * (x - y);
    let v = y;
    if (hp > 0) { yh = ah * (yh + v - xPrev); xPrev = v; v = yh; }
    b[i] += v * amp * Math.exp(-decay * t);
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
    const v = shape === 'square' ? Math.sign(Math.sin(phase))
      : shape === 'saw' ? (2 * ((phase / (2 * Math.PI)) % 1) - 1)
      : Math.sin(phase);
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

console.log('Generating LSW signature sounds →', OUT);

// the freeze: high crystalline tones sweeping UP, then a sharp snap-shut
writeWav('ice_freeze', (() => {
  const b = buf(0.5);
  for (const [f, d] of [[1400, 0.05], [1900, 0.08], [2600, 0.03]]) {
    addTone(b, { freq: f * 0.7, freqEnd: f, amp: 0.4, decay: 5, dur: 0.35, start: d, attack: 0.04 });
  }
  addNoise(b, { amp: 0.5, decay: 40, hp: 3000, start: 0.34, dur: 0.14 }); // the snap
  addTone(b, { freq: 300, freqEnd: 140, amp: 0.6, decay: 26, start: 0.34, dur: 0.12 }); // the thud of solid ice
  return b;
})());

// the shatter: a bright glassy burst + tumbling shards
writeWav('ice_shatter', (() => {
  const b = buf(0.45);
  addNoise(b, { amp: 1, decay: 30, hp: 2500, dur: 0.12 });
  for (const [f, s] of [[2200, 0.02], [3100, 0.05], [1700, 0.08], [2600, 0.12]]) {
    addTone(b, { freq: f, freqEnd: f * 0.6, amp: 0.3, decay: 24, start: s, dur: 0.12, shape: 'sine' });
  }
  addNoise(b, { amp: 0.25, decay: 12, lp: 4000, start: 0.1, dur: 0.3 }); // shards settling
  return b;
})());

// gas hiss: filtered noise venting, long and low-pressure
writeWav('gas_hiss', (() => {
  const b = buf(0.7);
  addNoise(b, { amp: 1, decay: 4.5, hp: 1200, lp: 6000, dur: 0.65 });
  addNoise(b, { amp: 0.3, decay: 3, lp: 900, dur: 0.6 }); // the low body of the cloud
  return b;
})());

// rage roar: a guttural saw-tone growl bending down, gravel on top
writeWav('rage_roar', (() => {
  const b = buf(0.75);
  addTone(b, { freq: 150, freqEnd: 85, amp: 1, decay: 2.6, dur: 0.7, shape: 'saw', attack: 0.03 });
  addTone(b, { freq: 226, freqEnd: 120, amp: 0.4, decay: 3, dur: 0.6, shape: 'saw' }); // harmonic snarl
  addNoise(b, { amp: 0.5, decay: 5, lp: 2200, hp: 300, dur: 0.55 }); // the throat gravel
  return b;
})());

// fire whoosh: a soft roaring gout, air + low rumble
writeWav('fire_whoosh', (() => {
  const b = buf(0.4);
  addNoise(b, { amp: 1, decay: 9, lp: 3200, hp: 400, dur: 0.35 });
  addTone(b, { freq: 90, freqEnd: 60, amp: 0.5, decay: 10, dur: 0.2 });
  return b;
})());

console.log('done — 5 sounds, additive only');
