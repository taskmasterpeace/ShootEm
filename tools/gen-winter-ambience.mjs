#!/usr/bin/env node
/**
 * amb_winter — the snowbound-mountains bed (#57). Synthesized like the hardpan
 * bed (its sibling tool), because mountain wind is filtered noise's home game
 * and costs no API call.
 *
 *   The difference from the hardpan: snow MUFFLES. The body sits lower and
 *   darker (heavier low-pass), the gusts are slower and longer (mountain
 *   weather moves in fronts, not flurries), a faint HOWL rides the gust peaks
 *   (wind finding a ridgeline notch — a resonant band, not a whistle), and an
 *   ice-grain shimmer barely dusts the top. No wildlife; altitude is empty.
 *
 * Seamless: tail crossfaded into the head. CC0 like the rest of the pack.
 * Deterministic: fixed LCG seed — same file every run (no RNG-cascade risk;
 * this tool owns its own generator and touches nothing else).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const DUR = 14;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

let noiseState = 0x1ce0c01d; // its own seed — the winter is its own weather
function nrand() {
  noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
  return noiseState / 2147483648 - 1;
}

const n = Math.ceil(DUR * SR);
const b = new Float32Array(n);

// ---- the body: darker than the hardpan — snow eats the mids --------------
let lp = 0, lp2 = 0;
const a1 = 1 - Math.exp((-2 * Math.PI * 300) / SR);  // hardpan sat at 420
const a2 = 1 - Math.exp((-2 * Math.PI * 120) / SR);  // hardpan sat at 180
// ---- the howl: a resonant band ~640Hz that only opens at gust peaks ------
let b0 = 0, b1r = 0;
const howlF = (2 * Math.PI * 640) / SR, howlQ = 0.994;
// ---- the ice grain: a whisper-thin band up top, barely there -------------
let hp = 0, hpPrev = 0;
const ah = Math.exp((-2 * Math.PI * 3400) / SR);

for (let i = 0; i < n; i++) {
  const t = i / SR;
  const x = nrand();
  lp += a1 * (x - lp);
  lp2 += a2 * (lp - lp2);

  // FRONTS, not flurries: three very slow incommensurate LFOs — the wind
  // leans in over ~8-14s spans and never repeats inside the loop
  const gust = 0.50
    + 0.32 * Math.sin(t * 0.117 * Math.PI * 2)
    + 0.14 * Math.sin(t * 0.043 * Math.PI * 2 + 2.1)
    + 0.08 * Math.sin(t * 0.29 * Math.PI * 2 + 0.6);

  // the ridgeline howl: ring a narrow resonator with the band the body left
  const drive = (lp - lp2) * Math.max(0, gust - 0.62) * 1.4;
  b0 = howlQ * (b0 * Math.cos(howlF) - b1r * Math.sin(howlF)) + drive * 0.08;
  b1r = howlQ * (b0 * Math.sin(howlF) + b1r * Math.cos(howlF));

  // ice grain: high shimmer, only at the very top of the biggest fronts
  const hx = lp - lp2;
  hp = ah * (hp + hx - hpPrev);
  hpPrev = hx;
  const grain = hp * Math.max(0, gust - 0.86) * 0.5;

  b[i] = lp2 * 1.7 * gust + b0 * 0.9 + grain;
}

// ---- seamless: crossfade the last 2s over the first 2s -------------------
const x = Math.floor(2 * SR);
for (let i = 0; i < x; i++) {
  const k = i / x;
  const tail = b[n - x + i];
  b[i] = b[i] * k + tail * (1 - k);
}
const out = b.subarray(0, n - x);

// ---- normalize to a BED level: quieter than the hardpan — snow hushes ----
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.5;

const bytes = new ArrayBuffer(44 + out.length * 2);
const dv = new DataView(bytes);
const ws = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
ws(0, 'RIFF'); dv.setUint32(4, 36 + out.length * 2, true); ws(8, 'WAVE');
ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
ws(36, 'data'); dv.setUint32(40, out.length * 2, true);
for (let i = 0; i < out.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i])) * 32767, true);
writeFileSync(join(OUT, 'amb_winter.wav'), Buffer.from(bytes));
console.log(`  amb_winter.wav (${(out.length / SR).toFixed(2)}s, seamless)`);
