/**
 * Sound generation core — the shared engine behind the CLI pack generator
 * (gen-sounds-ai.mjs) and the interactive Sound Editor (sound-editor.html via
 * the dev-server plugin). ElevenLabs text-to-sound-effects → a dry mono WAV, and
 * the WAV → Opus .ogg the game actually loads.
 *
 * The API key NEVER reaches the browser: the editor page POSTs a prompt to the
 * dev endpoint, this module reads the key server-side and does the call here.
 *
 * Requires ffmpeg on PATH. Key from ELEVENLABS_API_KEY or an .env of the user's
 * projects (ad-lab / directors-palette / yourehired) — same search as the CLI.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const AUDIO_DIR = join(ROOT, 'public', 'audio');
export const VARIANTS_DIR = join(AUDIO_DIR, 'variants');
const TMP = join(ROOT, 'node_modules', '.cache', 'ai-sounds');
const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation';

/** The prompt tails that keep a one-shot dry and a bed loopable — the CLI's
 *  proven suffixes, shared so the editor's takes match the pack's character. */
export const SUFFIX = 'dry, close-mic, one-shot, no reverb tail';
export const AMB_SUFFIX = 'seamless looping ambient bed, steady consistent level, no melody, no sudden events';

/** the three influences the CLI spreads variants across, so N takes differ */
export const VARIANT_INFLUENCES = [0.35, 0.55, 0.75];

/** Read the ElevenLabs key server-side — env first, then the user's project
 *  .env files. Returns null (never throws) so callers can report it cleanly. */
export function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
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

/** true if ffmpeg answers on PATH — checked once, cached */
let _ffmpegOk;
export function hasFfmpeg() {
  if (_ffmpegOk !== undefined) return _ffmpegOk;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); _ffmpegOk = true; }
  catch { _ffmpegOk = false; }
  return _ffmpegOk;
}

/** Build the ElevenLabs text from a raw description + the sound's category —
 *  ambience beds get the looping suffix, everything else the dry one-shot. */
export function composePrompt(desc, cat) {
  return `${desc}, ${cat === 'ambience' ? AMB_SUFFIX : SUFFIX}`;
}

/** ElevenLabs MP3 → cropped, normalized mono 44.1 kHz WAV (the CLI's filter:
 *  trim the padded silence off both ends, then loudnorm + a safety limiter). */
export function ffmpegToWav(mp3Path, wavPath) {
  const crop = 'silenceremove=start_periods=1:start_threshold=-50dB:detection=peak'
    + ',areverse,silenceremove=start_periods=1:start_threshold=-50dB:detection=peak,areverse';
  execFileSync('ffmpeg', [
    '-y', '-i', mp3Path,
    '-ac', '1', '-ar', '44100',
    '-af', `${crop},loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.9`,
    '-c:a', 'pcm_s16le', wavPath,
  ], { stdio: 'ignore' });
}

/** WAV → sibling Opus .ogg (48 kbps mono) — the format the game loads first
 *  (audio.ts falls back to .wav). Mirrors tools/encode-audio.mjs. */
export function wavToOgg(wavPath, oggPath = wavPath.replace(/\.wav$/i, '.ogg')) {
  execFileSync('ffmpeg', ['-y', '-i', wavPath, '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', oggPath], { stdio: 'ignore' });
  return oggPath;
}

/**
 * Generate ONE take from a text prompt → a dry WAV + its .ogg sibling.
 * `text` is the full ElevenLabs prompt (already composed). Throws on a bad key
 * / API error / missing ffmpeg so the caller can surface the message.
 */
export async function generateTake({ text, durationSeconds, influence = 0.55, outWav, key }) {
  if (!key) throw new Error('ELEVENLABS_API_KEY not configured');
  if (!hasFfmpeg()) throw new Error('ffmpeg not found on PATH');
  mkdirSync(TMP, { recursive: true });
  mkdirSync(dirname(outWav), { recursive: true });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      duration_seconds: Math.max(0.5, Math.min(22, durationSeconds || 1)),
      prompt_influence: influence,
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 180)}`);
  const mp3 = join(TMP, `take-${Date.now()}-${Math.round(influence * 100)}.mp3`);
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
  try {
    ffmpegToWav(mp3, outWav);
    wavToOgg(outWav);
  } finally {
    rmSync(mp3, { force: true });
  }
  return outWav;
}
