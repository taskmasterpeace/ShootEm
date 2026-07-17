#!/usr/bin/env node
// ---------------------------------------------------------------------------
// THE CAST RECORDS — generate every LSW voice line + announcer call via
// google/gemini-3.1-flash-tts (see .claude/skills/expressive-tts), then run
// the sound-designer FX pass and deliver game-ready WAVs to public/audio.
//
//   node tools/gen-lsw-vo.mjs              # generate missing slots only
//   node tools/gen-lsw-vo.mjs --force      # re-record everything
//   node tools/gen-lsw-vo.mjs --only vo_frostbite_death
//
// FX (pure-Node PCM, after ffmpeg normalizes to 44.1k mono s16):
//   radio — 300–3400Hz bandpass + soft clip (the military net)
//   beast — pitched-down double (×0.82) mixed underneath
//   ice   — tight comb shimmer (~11ms) — crystal in the throat
//   haz   — 4.5kHz lowpass + faint respirator hiss bed
// ---------------------------------------------------------------------------
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANN, ANN_NOTES, CAST, VO } from './lsw-vo-script.mjs';
import { buildPrompt, generateClip } from './tts-core.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
const force = process.argv.includes('--force');
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

// ---- WAV plumbing (16-bit mono 44.1k, the game's format) ----
function readWav(path) {
  const b = readFileSync(path);
  // find the data chunk (ffmpeg sometimes writes LIST before data)
  let off = 12;
  while (off < b.length - 8) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = size / 2;
      const f = new Float32Array(n);
      for (let i = 0; i < n; i++) f[i] = b.readInt16LE(off + 8 + i * 2) / 32768;
      return f;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${path}`);
}
function writeWav(path, f) {
  // normalize to -1.5 dB so the pack sits level
  let m = 0;
  for (const v of f) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? 0.84 / m : 1;
  const n = f.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(88200, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(f[i] * g * 32767))), 44 + i * 2);
  writeFileSync(path, b);
}

// ---- the FX rack ----
function onePole(f, cutoffHz, high = false) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / 44100);
  let y = 0;
  const out = new Float32Array(f.length);
  for (let i = 0; i < f.length; i++) {
    y += a * (f[i] - y);
    out[i] = high ? f[i] - y : y;
  }
  return out;
}
function fxRadio(f) {
  let x = onePole(f, 300, true);   // strip the body
  x = onePole(x, 3400, false);     // strip the air
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * 2.6); // net compression
  // squelch tail: a 60ms noise tick at the end of transmission
  const tail = Math.min(x.length, 2646);
  let seed = 0x5eed;
  for (let i = 0; i < tail; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    x[x.length - tail + i] += ((seed / 2147483648 - 1) * 0.05) * (i / tail);
  }
  return x;
}
function fxBeast(f) {
  // pitched-down double: naive resample ×0.82, lowpassed, under the dry
  const out = Float32Array.from(f);
  for (let i = 0; i < f.length; i++) {
    const src = i * 0.82;
    const i0 = Math.floor(src), t = src - i0;
    const v = i0 + 1 < f.length ? f[i0] * (1 - t) + f[i0 + 1] * t : 0;
    out[i] = f[i] * 0.72 + v * 0.55;
  }
  return onePole(out, 7000, false);
}
function fxIce(f) {
  // tight comb (~11ms) with highpassed feedback — crystal in the throat
  const d = 485;
  const out = Float32Array.from(f);
  for (let i = d; i < f.length; i++) out[i] += out[i - d] * 0.34;
  const air = onePole(out, 2000, true);
  for (let i = 0; i < out.length; i++) out[i] = out[i] * 0.85 + air[i] * 0.3;
  return out;
}
function fxHaz(f) {
  const x = onePole(f, 4500, false); // through the mask
  let seed = 0xbadA55;
  for (let i = 0; i < x.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    x[i] += (seed / 2147483648 - 1) * 0.012; // respirator hiss bed
  }
  return x;
}
const FX = { radio: fxRadio, beast: fxBeast, ice: fxIce, haz: fxHaz, none: (f) => f };

// ---- the session ----
const jobs = [];
for (const line of VO) {
  const c = CAST[line.who];
  jobs.push({
    slot: line.slot, voice: c.voice, fx: c.fx, text: line.text,
    prompt: buildPrompt({ persona: c.persona, scene: c.scene, notes: line.notes }),
  });
}
for (const line of ANN) {
  const c = CAST.announcer;
  jobs.push({
    slot: line.slot, voice: c.voice, fx: c.fx, text: line.text,
    prompt: buildPrompt({ persona: c.persona, scene: c.scene, notes: ANN_NOTES }),
  });
}

let done = 0, skipped = 0, failed = 0;
for (const j of jobs) {
  if (only && j.slot !== only) continue;
  const out = join(OUT, `${j.slot}.wav`);
  if (existsSync(out) && !force && !only) { skipped++; continue; }
  try {
    await generateClip({ text: j.text, prompt: j.prompt, voice: j.voice, out });
    const fx = FX[j.fx] ?? FX.none;
    writeWav(out, fx(readWav(out)));
    console.log(`  ✓ ${j.slot} (${j.voice}${j.fx !== 'none' ? ' + ' + j.fx : ''})`);
    done++;
  } catch (e) {
    console.error(`  ✗ ${j.slot}: ${e.message}`);
    failed++;
  }
}
console.log(`\n${done} recorded, ${skipped} kept, ${failed} failed — ${jobs.length} slots total`);
if (failed > 0) process.exit(1);
