// ---------------------------------------------------------------------------
// EXPRESSIVE TTS CORE — google/gemini-3.1-flash-tts on Replicate.
// Robert's director's-notes pattern: the same "eh!" reads completely
// differently under "She was punched" vs "She was shot and is dying".
// The model takes TWO channels: `prompt` (the direction — persona, scene,
// notes) and `text` (the words, with inline tags like [strained], [shouting],
// [short pause]). This module composes both and returns a WAV on disk.
//
// Auth: REPLICATE_API_TOKEN or REPLICATE_API_KEY from the environment, or
// from the house .env chain (yourehired — ad-lab's documented fallback).
// The token is never printed.
// ---------------------------------------------------------------------------
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const ENV_FILES = [
  'D:/git/ShootEM/.env',
  'D:/git/mkm/ad-lab/.env',
  'D:/git/yourehired/.env.local',
  'D:/git/yourehired/.env',
];

export function findToken() {
  for (const name of ['REPLICATE_API_TOKEN', 'REPLICATE_API_KEY']) {
    if (process.env[name]) return process.env[name];
  }
  for (const f of ENV_FILES) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(REPLICATE_API_TOKEN|REPLICATE_API_KEY)\s*=\s*("?)(.+?)\2\s*$/);
      if (m) return m[3];
    }
  }
  return null;
}

/** Compose the model's `prompt` from persona + scene + director's notes —
 *  the structure Robert's research settled on. The base is a hard wall: the
 *  prompt is DIRECTION, never lines to read. `gemini-3.1-flash-tts` will
 *  occasionally speak a prompt that opens with "Say the following." (caught
 *  by tools/transcribe-vo.mjs — e.g. the Titan announcer read its whole
 *  profile aloud), so we tell it plainly to voice only the separate line. */
export function buildPrompt({ persona, scene, notes = [], base = 'Voice ONLY the separate line of dialogue. Everything below is DIRECTION for how to perform it — never read any of it aloud.' }) {
  const lines = [base];
  if (persona) lines.push(`AUDIO PROFILE: ${persona}`);
  if (scene) lines.push(`THE SCENE: ${scene}`);
  if (notes.length) {
    lines.push("DIRECTOR'S NOTES:");
    for (const n of notes) lines.push(`- ${n}`);
  }
  return lines.join(' ');
}

/**
 * Generate one clip. Returns the output path (WAV 44.1k mono s16).
 * opts: { text, prompt, voice, language, out }
 */
export async function generateClip({ text, prompt, voice = 'Orus', language = 'en-US', out }) {
  const token = findToken();
  if (!token) throw new Error('No REPLICATE_API_TOKEN/REPLICATE_API_KEY found (env or house .env chain)');
  const tBytes = Buffer.byteLength(text, 'utf8');
  const pBytes = Buffer.byteLength(prompt ?? '', 'utf8');
  if (tBytes > 4000) throw new Error(`text is ${tBytes} bytes (limit 4000)`);
  if (tBytes + pBytes > 8000) throw new Error(`text+prompt is ${tBytes + pBytes} bytes (limit 8000)`);

  // model-name endpoint: no version hash to chase; Prefer: wait blocks up to
  // 60s which covers short barks — poll as fallback
  const res = await fetch('https://api.replicate.com/v1/models/google/gemini-3.1-flash-tts/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ input: { text, prompt, voice, language_code: language } }),
  });
  if (!res.ok) throw new Error(`replicate ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let pred = await res.json();
  while (pred.status === 'starting' || pred.status === 'processing') {
    await new Promise((r) => setTimeout(r, 1200));
    const poll = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    pred = await poll.json();
  }
  if (pred.status !== 'succeeded') throw new Error(`tts ${pred.status}: ${pred.error ?? 'no detail'}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!url) throw new Error('no audio in output');

  const audio = Buffer.from(await (await fetch(url)).arrayBuffer());
  mkdirSync(dirname(out), { recursive: true });
  const raw = out.replace(/\.wav$/i, '') + '.dl';
  writeFileSync(raw, audio);
  // normalize container to the game's format regardless of what came back
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-ar', '44100', '-ac', '1', '-sample_fmt', 's16', out]);
  execFileSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', raw.replace(/\//g, '\\')] : [raw]);
  return out;
}
