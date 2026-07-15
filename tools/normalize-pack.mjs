#!/usr/bin/env node
/**
 * Loudness pass — bring every shipped sound to a consistent peak ceiling so
 * none is buried and the in-game per-sound volumes do the actual mix. Pure
 * gain (measure true peak, scale to target); no limiting/regeneration, so it
 * doesn't change which take or its character — just its level.
 *
 *   node tools/normalize-pack.mjs            # normalize all live wavs to -1 dBFS
 *   node tools/normalize-pack.mjs -1.5       # custom target dBFS
 *
 * Skips files already within 0.15 dB of target (leaves the hot ones untouched).
 */
import { execSync } from 'node:child_process';
import { readdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIO = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
const TARGET = Number(process.argv[2]) || -1.0;

const peakOf = (f) => {
  const out = execSync(`ffmpeg -hide_banner -i "${f}" -af volumedetect -f null - 2>&1`, { encoding: 'utf8' });
  const m = out.match(/max_volume:\s*(-?[\d.]+) dB/);
  return m ? Number(m[1]) : null;
};

const files = readdirSync(AUDIO).filter((f) => f.endsWith('.wav'));
let changed = 0;
for (const name of files) {
  const f = join(AUDIO, name);
  const peak = peakOf(f);
  if (peak == null) { console.log(`  ${name}: (no peak — skipped)`); continue; }
  const gain = TARGET - peak;
  if (Math.abs(gain) < 0.15) { console.log(`  ${name}: ${peak} dB → ok`); continue; }
  const tmp = join(AUDIO, `.norm-${name}`);
  execSync(`ffmpeg -y -hide_banner -loglevel error -i "${f}" -af "volume=${gain.toFixed(2)}dB" -c:a pcm_s16le "${tmp}"`);
  renameSync(tmp, f);
  console.log(`  ${name}: ${peak} dB → ${TARGET} dB (${gain > 0 ? '+' : ''}${gain.toFixed(2)})`);
  changed++;
}
console.log(`\nNormalized ${changed} / ${files.length} sound(s) to ${TARGET} dBFS peak.`);
