#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tts-say — one expressive line from the command line (the skill's CLI).
//
//   node tools/tts-say.mjs --text "eh!" --note "She was punched" --out t.wav
//   node tools/tts-say.mjs --text "[strained] eh!" \
//     --persona "Vex, a wounded scout, voice like torn paper" \
//     --note "She was shot and is dying" --note "Barely any air left" \
//     --voice Achernar --out dying.wav
//
// The same word under different director's notes is a different performance —
// that's the whole trick. Inline tags ([whispering], [shouting], [laughing],
// [short pause], [extremely fast]) go in --text; the direction goes in notes.
// ---------------------------------------------------------------------------
import { buildPrompt, generateClip } from './tts-core.mjs';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const getAll = (flag) => {
  const out = [];
  for (let i = 0; i < args.length - 1; i++) if (args[i] === flag) out.push(args[i + 1]);
  return out;
};

const text = get('--text');
const out = get('--out');
if (!text || !out) {
  console.error('usage: node tools/tts-say.mjs --text "..." --out file.wav [--persona "..."] [--scene "..."] [--note "..."]* [--voice Orus] [--lang en-US]');
  process.exit(1);
}

const prompt = buildPrompt({
  persona: get('--persona'),
  scene: get('--scene'),
  notes: getAll('--note'),
});

generateClip({ text, prompt, voice: get('--voice') ?? 'Orus', language: get('--lang') ?? 'en-US', out })
  .then((f) => console.log(`wrote ${f}`))
  .catch((e) => { console.error(`FAILED: ${e.message}`); process.exit(1); });
