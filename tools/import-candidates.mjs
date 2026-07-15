#!/usr/bin/env node
/**
 * Import your own audio files as A/B/C candidates for a sound — e.g. takes you
 * downloaded from the ElevenLabs web app. Each input is cropped (silence
 * trimmed) and normalized to a game-ready mono 44.1kHz WAV, then dropped into
 * public/audio/variants/ so it shows up in the Sound Lab & Review to A/B + pick.
 *
 *   node tools/import-candidates.mjs rifle "C:/path/take-a.mp3" "C:/path/take-b.mp3"
 *
 * Replaces that sound's existing candidates. Pick the winner in the review page
 * (or bake directly with tools/apply-picks.mjs <name>=<i>).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SOUND_SPECS } from './sound-specs.mjs';

const AUDIO = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
const OUTV = join(AUDIO, 'variants');
const args = process.argv.slice(2);
const capFlag = args.indexOf('--max');           // --max <sec> to override the cap
const maxOverride = capFlag >= 0 ? Number(args[capFlag + 1]) : null;
const rest = capFlag >= 0 ? args.filter((_, i) => i !== capFlag && i !== capFlag + 1) : args;
const [name, ...files] = rest;

if (!name || !files.length) {
  console.error('usage: node tools/import-candidates.mjs [--max <sec>] <sound-name> <file1> [file2] ...');
  process.exit(1);
}
for (const f of files) if (!existsSync(f)) { console.error(`file not found: ${f}`); process.exit(1); }

mkdirSync(OUTV, { recursive: true });
const crop = 'silenceremove=start_periods=1:start_threshold=-50dB:detection=peak'
  + ',areverse,silenceremove=start_periods=1:start_threshold=-50dB:detection=peak,areverse';
// keep one-shots tight: cap at target length + headroom so a padded ElevenLabs
// clip becomes just the shot (not a 3.5s tail that stacks during rapid fire).
const target = SOUND_SPECS[name]?.dur ?? 1.0;
const cap = maxOverride || Math.max(0.8, target * 1.5);
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

files.forEach((src, idx) => {
  const tmp = join(OUTV, `.tmp-${name}-${idx + 1}.wav`);
  const dst = join(OUTV, `${name}-${idx + 1}.wav`);
  // 1) trim silence off both ends
  execFileSync('ffmpeg', ['-y', '-i', src, '-ac', '1', '-ar', '44100', '-af', crop, tmp], { stdio: 'ignore' });
  // 2) hard-cap to the shot with a tiny fade-out, then normalize
  const outlen = Math.min(dur(tmp), cap);
  const fadeSt = Math.max(0, outlen - 0.03).toFixed(3);
  execFileSync('ffmpeg', ['-y', '-i', tmp, '-ac', '1', '-ar', '44100',
    '-af', `atrim=0:${outlen.toFixed(3)},afade=t=out:st=${fadeSt}:d=0.03,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.9`,
    '-c:a', 'pcm_s16le', dst], { stdio: 'ignore' });
  rmSync(tmp, { force: true });
  console.log(`  ${name}-${idx + 1}.wav  ←  ${src.split(/[\\/]/).pop()}  (${outlen.toFixed(2)}s, cap ${cap}s)`);
});

// drop any stale candidates beyond the imported count
for (let i = files.length + 1; i <= 12; i++) rmSync(join(OUTV, `${name}-${i}.wav`), { force: true });

const manifestPath = join(OUTV, 'manifest.json');
let manifest = {};
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { /* fresh */ }
manifest[name] = files.length;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nImported ${files.length} candidate(s) for "${name}". Reload the Sound Lab & Review to A/B them.`);
