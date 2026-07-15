#!/usr/bin/env node
/**
 * AI sound-pack generator — ElevenLabs text-to-sound-effects → public/audio/*.wav
 *
 * Complements tools/gen-sounds.mjs (the procedural CC0 pack). This one calls
 * ElevenLabs' /v1/sound-generation endpoint with a tuned prompt per sound,
 * then ffmpeg-converts each MP3 to a mono 44.1 kHz WAV named exactly what the
 * game loads (see docs/SOUND-MANIFEST.md).
 *
 * SETUP (one time):
 *   Put your key in D:/git/mkm/ad-lab/.env  →  ELEVENLABS_API_KEY=sk_...
 *   (or set the ELEVENLABS_API_KEY environment variable). Requires ffmpeg on PATH.
 *
 * USAGE:
 *   node tools/gen-sounds-ai.mjs --list                 # print every name+prompt
 *   node tools/gen-sounds-ai.mjs --only rifle,plasma     # prototype a few first
 *   node tools/gen-sounds-ai.mjs                         # generate ALL 53 (spends credits!)
 *   node tools/gen-sounds-ai.mjs --only rifle --keep-mp3 # also keep the raw mp3
 *
 * NOTE ON LICENSE: ElevenLabs output is NOT CC0. If you bake these into the
 * repo, update public/audio/LICENSE-CC0.txt accordingly — the synthesized pack
 * stays CC0, generated replacements do not.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SOUND_SPECS } from './sound-specs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'audio');
const TMP = join(ROOT, 'node_modules', '.cache', 'ai-sounds');
const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation';

// generation prompt = the shared human intent + a dry, one-shot suffix so the
// model doesn't add reverb tails or music beds.
const SUFFIX = 'dry, close-mic, one-shot, no reverb tail';
const promptFor = (name) => `${SOUND_SPECS[name].desc}, ${SUFFIX}`;
const durFor = (name) => SOUND_SPECS[name].dur;

// ---------------------------------------------------------------------------

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  // fall back to a real key in any of the user's projects
  const files = [
    'D:/git/mkm/ad-lab/.env', 'D:/git/mkm/ad-lab/.env.local',
    'D:/git/directors-palette-v2/.env.local', 'D:/git/directors-palette-v2/.env',
    'D:/git/yourehired/.env.local', 'D:/git/yourehired/.env',
  ];
  for (const p of files) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m && !/your_.*_here/.test(m[1])) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

const OUTV = join(OUT, 'variants');

function ffmpegToWav(mp3Path, wavPath) {
  // crop leading + trailing silence, then mono / 44.1 kHz / normalized to ~-1 dBFS.
  // silenceremove trims the dead air ElevenLabs pads around a one-shot; the reverse
  // pair does the tail. -50 dB peak threshold keeps the real attack + decay.
  const crop = 'silenceremove=start_periods=1:start_threshold=-50dB:detection=peak'
    + ',areverse,silenceremove=start_periods=1:start_threshold=-50dB:detection=peak,areverse';
  execFileSync('ffmpeg', [
    '-y', '-i', mp3Path,
    '-ac', '1', '-ar', '44100',
    '-af', `${crop},loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.9`,
    '-c:a', 'pcm_s16le', wavPath,
  ], { stdio: 'ignore' });
}

async function generate(name, key, { keepMp3 = false, outWav, influence = 0.5, tag = name } = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: promptFor(name),
      duration_seconds: Math.max(0.5, Math.min(22, durFor(name))),
      prompt_influence: influence,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
  const mp3 = join(TMP, `${tag}.mp3`);
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
  ffmpegToWav(mp3, outWav ?? join(OUT, `${name}.wav`));
  if (!keepMp3) rmSync(mp3, { force: true });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    for (const n of Object.keys(SOUND_SPECS)) console.log(`${n.padEnd(18)} ${durFor(n)}s  ${promptFor(n)}`);
    console.log(`\n${Object.keys(SOUND_SPECS).length} sounds.`);
    return;
  }
  const onlyArg = args[args.indexOf('--only') + 1];
  const keepMp3 = args.includes('--keep-mp3');
  const variants = args.includes('--variants') ? Math.max(1, Number(args[args.indexOf('--variants') + 1]) || 3) : 1;
  const names = args.includes('--only')
    ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean)
    : Object.keys(SOUND_SPECS);

  const bad = names.filter((n) => !SOUND_SPECS[n]);
  if (bad.length) { console.error('unknown sound(s):', bad.join(', ')); process.exit(1); }

  const key = loadKey();
  if (!key) {
    console.error('ELEVENLABS_API_KEY not found. Put it in an .env of ad-lab / directors-palette-v2 / yourehired (ELEVENLABS_API_KEY=sk_...) or set the env var.');
    process.exit(1);
  }
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  if (variants > 1) {
    // A/B/C candidates per sound → public/audio/variants/<name>-<i>.wav (live wavs untouched)
    mkdirSync(OUTV, { recursive: true });
    const manifestPath = join(OUTV, 'manifest.json');
    let manifest = {};
    try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { /* fresh */ }
    const influences = [0.35, 0.55, 0.75]; // spread the takes so they actually differ
    console.log(`Generating ${variants} variant(s) each for ${names.length} sound(s) → ${OUTV}`);
    let ok = 0;
    for (const name of names) {
      const made = [];
      for (let i = 1; i <= variants; i++) {
        try {
          process.stdout.write(`  ${name} v${i} … `);
          await generate(name, key, { keepMp3, outWav: join(OUTV, `${name}-${i}.wav`), influence: influences[(i - 1) % influences.length], tag: `${name}-${i}` });
          console.log('ok'); made.push(i); ok++;
        } catch (e) { console.log('FAILED —', e.message); }
      }
      if (made.length) manifest[name] = made.length;
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nDone: ${ok} variant file(s). Manifest → ${manifestPath}`);
    return;
  }

  console.log(`Generating ${names.length} sound(s) via ElevenLabs → ${OUT}`);
  let ok = 0;
  for (const name of names) {
    try {
      process.stdout.write(`  ${name} … `);
      await generate(name, key, { keepMp3 });
      console.log('ok');
      ok++;
    } catch (e) {
      console.log('FAILED —', e.message);
    }
  }
  console.log(`\nDone: ${ok}/${names.length} generated.`);
}

main();
