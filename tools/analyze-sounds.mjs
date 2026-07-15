#!/usr/bin/env node
/**
 * Sound QA — meter every sound the way an audio engineer would, since we can't
 * ear-check in this environment. Measures peak/RMS level, crest factor
 * (transient punch), duration vs its spec target, and leading/trailing dead air.
 *
 *   node tools/analyze-sounds.mjs --live            # QA table for the shipped pack + flags
 *   node tools/analyze-sounds.mjs --pick a,b,c      # score each sound's candidates, print best
 *
 * Flags (objective, not taste):
 *   CLIP   peak ≥ -0.1 dBFS (risk of clipping)
 *   QUIET  peak < -6 dBFS (under-leveled vs the rest)
 *   LONG   one-shot longer than target ×2 (will stack/smear in rapid fire)
 *   DEADAIR ≥60ms silence at head or tail (needs a tighter crop)
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUND_SPECS } from './sound-specs.mjs';

const AUDIO = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
const OUTV = join(AUDIO, 'variants');

function analyze(file) {
  const out = execSync(`ffmpeg -hide_banner -i "${file}" -af astats=metadata=1:reset=0,silencedetect=n=-50dB:d=0.03 -f null - 2>&1`, { encoding: 'utf8' });
  const num = (re) => { const m = out.match(re); return m ? Number(m[1]) : null; };
  const dur = Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`, { encoding: 'utf8' }).trim());
  // last (Overall) occurrence of each metric
  const grabLast = (label) => { const ms = [...out.matchAll(new RegExp(`${label}:\\s*(-?[\\d.]+)`, 'g'))]; return ms.length ? Number(ms[ms.length - 1][1]) : null; };
  const peak = grabLast('Peak level dB');
  const rms = grabLast('RMS level dB');
  const crest = grabLast('Crest factor');
  // leading/trailing silence
  const sStart = num(/silence_end:\s*([\d.]+)/);           // first sound onset
  const lastSilStart = [...out.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1])).pop();
  const lead = sStart ?? 0;
  const tail = lastSilStart != null ? Math.max(0, dur - lastSilStart) : 0;
  return { dur, peak, rms, crest, lead, tail };
}

function flags(name, a) {
  const spec = SOUND_SPECS[name] || {};
  const oneShot = ['weapons', 'impacts', 'deaths', 'movement'].includes(spec.cat);
  const f = [];
  if (a.peak != null && a.peak >= -0.1) f.push('CLIP');
  if (a.peak != null && a.peak < -6) f.push('QUIET');
  if (oneShot && spec.dur && a.dur > spec.dur * 2) f.push('LONG');
  if (a.lead >= 0.06) f.push('DEADAIR-head');
  if (a.tail >= 0.06) f.push('DEADAIR-tail');
  return f;
}

const args = process.argv.slice(2);

if (args.includes('--live')) {
  console.log('sound              dur    peak    rms   crest  flags');
  const issues = [];
  for (const name of Object.keys(SOUND_SPECS)) {
    const f = join(AUDIO, `${name}.wav`);
    if (!existsSync(f)) { console.log(`${name.padEnd(18)} (missing)`); continue; }
    const a = analyze(f);
    const fl = flags(name, a);
    if (fl.length) issues.push(name);
    console.log(`${name.padEnd(18)} ${a.dur.toFixed(2)}  ${String(a.peak).padStart(6)}  ${String(a.rms).padStart(6)}  ${String(a.crest).padStart(5)}  ${fl.join(' ')}`);
  }
  console.log(`\n${issues.length} sound(s) flagged: ${issues.join(', ') || 'none'}`);
} else if (args.includes('--pick')) {
  const names = args[args.indexOf('--pick') + 1].split(',').map((s) => s.trim()).filter(Boolean);
  let manifest = {};
  try { manifest = JSON.parse(readFileSync(join(OUTV, 'manifest.json'), 'utf8')); } catch { /* none */ }
  const picks = [];
  for (const name of names) {
    const n = manifest[name] || 0;
    const spec = SOUND_SPECS[name] || {};
    const weapon = ['weapons', 'impacts'].includes(spec.cat);
    const cands = [];
    for (let i = 1; i <= n; i++) {
      const f = join(OUTV, `${name}-${i}.wav`);
      if (!existsSync(f)) continue;
      const a = analyze(f);
      // score: close to target, punchy (weapons), well-leveled, tight
      const durErr = spec.dur ? Math.abs(a.dur - spec.dur) / spec.dur : 0;
      const level = a.peak != null ? -Math.abs(a.peak - -1.0) : 0;      // want ~-1 dBFS
      const punch = weapon && a.crest != null ? Math.min(a.crest, 20) / 20 : 0;
      const score = -1.5 * durErr + 0.15 * level + 0.6 * punch - 0.5 * (a.lead + a.tail);
      cands.push({ i, ...a, score });
    }
    cands.sort((x, y) => y.score - x.score);
    console.log(`\n${name} (target ${spec.dur}s, ${spec.cat}):`);
    for (const c of cands) console.log(`  v${c.i}: ${c.dur.toFixed(2)}s peak ${c.peak} crest ${c.crest} lead ${c.lead.toFixed(2)} tail ${c.tail.toFixed(2)}  score ${c.score.toFixed(3)}${c === cands[0] ? '  ← best' : ''}`);
    if (cands[0]) picks.push(`${name}=${cands[0].i}`);
  }
  console.log(`\nBest-by-analysis picks:\n  node tools/apply-picks.mjs ${picks.join(' ')}`);
} else {
  console.error('usage: node tools/analyze-sounds.mjs --live | --pick <name,name,...>');
  process.exit(1);
}
