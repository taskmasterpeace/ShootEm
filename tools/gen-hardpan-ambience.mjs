#!/usr/bin/env node
/**
 * V5 THE HARDPAN's ambience bed — the one theme whose atmosphere is
 * synthesized rather than AI-generated, because a wind bed is exactly what
 * filtered noise is good at and it costs no API call.
 *
 *   amb_hardpan — wind over cracked open flats: a low steady rush with slow
 *   GUSTS riding it, a thin high whistle for the dust, and no wildlife at all
 *   (that is the difference from the savanna bed — the savanna has insects
 *   and birds because it is alive; the hardpan is empty, and the emptiness
 *   is the point of an armour map).
 *
 * Seamless: the tail is crossfaded into the head so a 12s loop never clicks.
 * CC0 like the rest of the pack.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const DUR = 12;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

let noiseState = 0x5eed1a11;
function nrand() {
  noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
  return noiseState / 2147483648 - 1;
}

const n = Math.ceil(DUR * SR);
const b = new Float32Array(n);

// ---- the body: brown-ish noise through a low pass = a steady rush --------
let lp = 0, lp2 = 0;
const a1 = 1 - Math.exp((-2 * Math.PI * 420) / SR);
const a2 = 1 - Math.exp((-2 * Math.PI * 180) / SR);
// ---- the whistle: a narrow band up high, for grit moving over stone ------
let hp = 0, hpPrev = 0;
const ah = Math.exp((-2 * Math.PI * 2200) / SR);

for (let i = 0; i < n; i++) {
  const t = i / SR;
  const x = nrand();
  lp += a1 * (x - lp);
  lp2 += a2 * (lp - lp2);

  // GUSTS: two slow incommensurate LFOs so the wind never sounds like it is
  // on a timer (a single sine reads as a machine, not weather)
  const gust = 0.55
    + 0.30 * Math.sin(t * 0.23 * Math.PI * 2)
    + 0.15 * Math.sin(t * 0.071 * Math.PI * 2 + 1.7);

  // the thin high edge, present only at the top of a gust
  const hx = lp - lp2;
  hp = ah * (hp + hx - hpPrev);
  hpPrev = hx;
  const whistle = hp * Math.max(0, gust - 0.7) * 0.9;

  b[i] = lp2 * 1.6 * gust + whistle;
}

// ---- seamless: crossfade the last 1.5s over the first 1.5s ---------------
const x = Math.floor(1.5 * SR);
for (let i = 0; i < x; i++) {
  const k = i / x;                       // 0 → 1
  const tail = b[n - x + i];
  b[i] = b[i] * k + tail * (1 - k);
}
const out = b.subarray(0, n - x);

// ---- normalize to a BED level: ambience must never fight the mix ---------
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.55;

const bytes = new ArrayBuffer(44 + out.length * 2);
const dv = new DataView(bytes);
const ws = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
ws(0, 'RIFF'); dv.setUint32(4, 36 + out.length * 2, true); ws(8, 'WAVE');
ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
ws(36, 'data'); dv.setUint32(40, out.length * 2, true);
for (let i = 0; i < out.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i])) * 32767, true);
writeFileSync(join(OUT, 'amb_hardpan.wav'), Buffer.from(bytes));
console.log(`  amb_hardpan.wav (${(out.length / SR).toFixed(2)}s, seamless)`);
