// ---------------------------------------------------------------------------
// AUDIO ENCODE (opt #1 / L3) — the WAV pack is 94% of the build. Opus at 48k
// mono is ~15× smaller with no audible loss at this use. This encodes every
// public/audio/**/*.wav → a sibling .ogg (Opus), keeping the WAV as the
// pipeline/test source. The loader tries .ogg first and falls back to .wav;
// the Vite build prunes dist/audio/*.wav so dist actually shrinks.
//
//   node tools/encode-audio.mjs         (skips up-to-date .ogg)
//   node tools/encode-audio.mjs --force
// ---------------------------------------------------------------------------
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = 'public/audio';
const FORCE = process.argv.includes('--force');
const CONCURRENCY = 6;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.toLowerCase().endsWith('.wav')) out.push(p);
  }
  return out;
}

function encode(wav) {
  const ogg = wav.replace(/\.wav$/i, '.ogg');
  if (!FORCE && existsSync(ogg) && statSync(ogg).mtimeMs >= statSync(wav).mtimeMs) {
    return Promise.resolve('skip');
  }
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-i', wav, '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', ogg],
      { stdio: 'ignore' });
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve('done') : reject(new Error(`ffmpeg ${code} on ${wav}`))));
  });
}

const files = walk(ROOT);
let done = 0, skipped = 0, i = 0;
console.log(`encoding ${files.length} WAV → OGG (Opus 48k mono), concurrency ${CONCURRENCY}…`);

async function worker() {
  while (i < files.length) {
    const wav = files[i++];
    try {
      const r = await encode(wav);
      if (r === 'skip') skipped++; else done++;
    } catch (e) { console.error(String(e.message || e)); }
    if ((done + skipped) % 50 === 0) console.log(`  ${done + skipped}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: ${done} encoded, ${skipped} up-to-date.`);
