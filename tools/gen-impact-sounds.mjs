#!/usr/bin/env node
/**
 * Ballistic feedback micro-pack (Robert: "if somebody shoots a bullet near
 * you, you should hear a whiz or hear it impact something").
 * Standalone — never regenerates the curated pack. CC0 like the rest.
 *
 *   whiz          — the supersonic crack-by: a round passing your ear
 *   impact_dirt   — soil thud + scatter
 *   impact_stone  — sharp chip off masonry
 *   impact_metal  — ring tick off plate
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

let noiseState = 0xbadcafe1;
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
    let x = nrand();
    y += a * (x - y);
    let v = y;
    if (hp > 0) { yh = ah * (yh + v - xPrev); xPrev = v; v = yh; }
    b[i] += v * amp * Math.exp(-decay * t);
  }
  return b;
}

function addTone(b, { freq = 440, freqEnd = null, amp = 0.5, decay = 6, start = 0, dur = Infinity, attack = 0.001 } = {}) {
  const s0 = Math.floor(start * SR);
  const s1 = Math.min(b.length, s0 + Math.floor(Math.min(dur, 1e6) * SR));
  const fEnd = freqEnd ?? freq;
  let phase = 0;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    const k = (i - s0) / Math.max(1, s1 - s0);
    phase += (2 * Math.PI * (freq + (fEnd - freq) * k)) / SR;
    b[i] += Math.sin(phase) * amp * Math.min(1, t / attack) * Math.exp(-decay * t);
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

console.log('Generating ballistic feedback →', OUT);

// the crack-by: a fast high-passed noise sweep, doppler-ish pitch fall
writeWav('whiz', (() => {
  const b = buf(0.14);
  addNoise(b, { amp: 1, decay: 32, hp: 1800, dur: 0.12 });
  addTone(b, { freq: 3200, freqEnd: 900, amp: 0.35, decay: 30, dur: 0.1 });
  return b;
})());

// soil: dull thud, low scatter, no ring
writeWav('impact_dirt', (() => {
  const b = buf(0.18);
  addTone(b, { freq: 160, freqEnd: 70, amp: 1, decay: 34, dur: 0.09 });
  addNoise(b, { amp: 0.6, decay: 40, lp: 1200, dur: 0.1 });
  addNoise(b, { amp: 0.2, decay: 18, lp: 700, start: 0.03, dur: 0.12 }); // scatter
  return b;
})());

// masonry: sharp chip + short gritty tail
writeWav('impact_stone', (() => {
  const b = buf(0.16);
  addNoise(b, { amp: 1, decay: 60, lp: 6000, dur: 0.05 });
  addTone(b, { freq: 900, freqEnd: 500, amp: 0.4, decay: 45, dur: 0.06 });
  addNoise(b, { amp: 0.3, decay: 26, lp: 2600, start: 0.02, dur: 0.12 }); // grit
  return b;
})());

// plate: bright tick with a metallic ring that dies fast
writeWav('impact_metal', (() => {
  const b = buf(0.22);
  addNoise(b, { amp: 0.8, decay: 70, hp: 900, dur: 0.04 });
  addTone(b, { freq: 2100, freqEnd: 1960, amp: 0.55, decay: 26, dur: 0.16 });
  addTone(b, { freq: 3400, freqEnd: 3300, amp: 0.25, decay: 34, dur: 0.1 });
  return b;
})());

console.log('done — 4 sounds, additive only');
