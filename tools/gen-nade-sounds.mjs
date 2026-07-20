#!/usr/bin/env node
/**
 * Grenade foley micro-pack (Robert: "the metal ting ting ting sound when it
 * hits the surface"). Standalone — never regenerates the curated pack, and
 * keeps its own noise seed so it can't shift anyone else's RNG stream.
 * CC0 like the rest.
 *
 *   nade_tink — a steel can striking the deck: bright INHARMONIC partials
 *   (real metal rings at non-integer ratios — integer ones sound like a
 *   xylophone, which is a toy, not ordnance), a hard strike transient, and a
 *   fast die-off. The renderer rate-jitters each bounce so the ting-ting-ting
 *   of one grenade never plays as the same sample three times.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

let noiseState = 0x7e57a119;
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

console.log('Generating grenade foley →', OUT);

writeWav('nade_tink', (() => {
  const b = buf(0.24);
  // the strike: a hard, thin transient — the can's shell taking the hit
  addNoise(b, { amp: 0.7, decay: 90, hp: 2400, dur: 0.02 });
  // the ring: four inharmonic partials (ratios ≈ 1 : 1.51 : 2.09 : 2.71 — a
  // bell-ish spread, each drooping ~2% as it decays, the way struck metal
  // sags). The high ones die first; the fundamental carries the "ting".
  addTone(b, { freq: 2620, freqEnd: 2565, amp: 0.6, decay: 22, dur: 0.2 });
  addTone(b, { freq: 3950, freqEnd: 3870, amp: 0.34, decay: 30, dur: 0.14 });
  addTone(b, { freq: 5480, freqEnd: 5370, amp: 0.2, decay: 38, dur: 0.1 });
  addTone(b, { freq: 7110, freqEnd: 6970, amp: 0.1, decay: 48, dur: 0.07 });
  // a whisper of body — the hollow can, not just the shell
  addTone(b, { freq: 620, freqEnd: 560, amp: 0.12, decay: 40, dur: 0.06 });
  return b;
})());

console.log('done — 1 sound, additive only');
