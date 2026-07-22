#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findToken } from './tts-core.mjs';
import { ODESSA_LINES } from './sound-odessa-vo.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = join(ROOT, 'public', 'audio');
const REPORT = join(AUDIO_DIR, 'casting', 'odessa-transcript.json');
const WHISPER = 'vaibhavs10/incredibly-fast-whisper';

export function normalizeTranscript(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function charDice(a, b) {
  const grams = (value) => {
    const out = new Map();
    const text = normalizeTranscript(value).replace(/ /g, '');
    for (let i = 0; i < text.length - 1; i++) {
      const gram = text.slice(i, i + 2);
      out.set(gram, (out.get(gram) || 0) + 1);
    }
    return out;
  };
  const left = grams(a);
  const right = grams(b);
  let leftCount = 0;
  let rightCount = 0;
  let intersection = 0;
  for (const value of left.values()) leftCount += value;
  for (const [gram, value] of right) {
    rightCount += value;
    if (left.has(gram)) intersection += Math.min(value, left.get(gram));
  }
  if (!leftCount && !rightCount) return 1;
  return (2 * intersection) / (leftCount + rightCount);
}

export function transcriptSimilarity(scripted, heard) {
  const left = new Set(normalizeTranscript(scripted).split(' ').filter(Boolean));
  const right = new Set(normalizeTranscript(heard).split(' ').filter(Boolean));
  let wordScore = 1;
  if (left.size || right.size) {
    let intersection = 0;
    for (const word of left) if (right.has(word)) intersection++;
    wordScore = intersection / (left.size + right.size - intersection);
  }
  return Math.max(wordScore, charDice(scripted, heard));
}

let whisperVersionId;
async function whisperVersion(token) {
  if (whisperVersionId) return whisperVersionId;
  const response = await fetch(`https://api.replicate.com/v1/models/${WHISPER}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`model lookup ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const model = await response.json();
  whisperVersionId = model.latest_version?.id;
  if (!whisperVersionId) throw new Error(`no latest version for ${WHISPER}`);
  return whisperVersionId;
}

async function transcribe(token, wavPath) {
  const version = await whisperVersion(token);
  const audio = `data:audio/wav;base64,${readFileSync(wavPath).toString('base64')}`;
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ version, input: { audio, task: 'transcribe', language: 'english', batch_size: 64 } }),
  });
  if (!response.ok) throw new Error(`whisper ${response.status}: ${(await response.text()).slice(0, 200)}`);
  let prediction = await response.json();
  for (let tries = 0; ['starting', 'processing'].includes(prediction.status) && tries < 120; tries++) {
    await new Promise((done) => setTimeout(done, 1200));
    prediction = await (await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json();
  }
  if (prediction.status !== 'succeeded') throw new Error(`whisper ${prediction.status}: ${prediction.error ?? 'no detail'}`);
  const output = prediction.output;
  return (typeof output === 'string' ? output : (output?.text ?? '')).trim();
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const token = findToken();
  if (!token) throw new Error('No REPLICATE_API_TOKEN/REPLICATE_API_KEY found.');
  const only = argValue('--only');
  const limit = Math.max(0, Number(argValue('--limit')) || 0);
  const threshold = Number(argValue('--threshold')) || 0.78;
  const concurrency = Math.max(1, Math.min(5, Number(argValue('--concurrency')) || 4));
  let queue = only ? ODESSA_LINES.filter((line) => line.slot === only) : [...ODESSA_LINES];
  if (only && !queue.length) throw new Error(`unknown Odessa slot: ${only}`);
  if (limit) queue = queue.slice(0, limit);
  const rows = [];
  let cursor = 0;
  console.log(`Transcribing ${queue.length} Odessa take(s)...`);

  async function worker() {
    while (cursor < queue.length) {
      const entry = queue[cursor++];
      const wav = join(AUDIO_DIR, `${entry.slot}.wav`);
      if (!existsSync(wav)) {
        rows.push({ slot: entry.slot, scripted: entry.text, heard: null, similarity: 0, status: 'MISSING' });
        process.stdout.write('m');
        continue;
      }
      try {
        const heard = await transcribe(token, wav);
        const similarity = +transcriptSimilarity(entry.text, heard).toFixed(2);
        const status = similarity >= threshold ? 'ok' : 'OFF';
        rows.push({ slot: entry.slot, scripted: entry.text, heard, similarity, status });
        process.stdout.write(status === 'ok' ? '.' : 'x');
      } catch (error) {
        rows.push({ slot: entry.slot, scripted: entry.text, heard: null, similarity: 0, status: 'ERR', error: error.message });
        process.stdout.write('!');
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  rows.sort((a, b) => a.slot.localeCompare(b.slot));
  const summary = {
    total: rows.length,
    clean: rows.filter((row) => row.status === 'ok').length,
    off: rows.filter((row) => row.status === 'OFF').length,
    missing: rows.filter((row) => row.status === 'MISSING').length,
    errors: rows.filter((row) => row.status === 'ERR').length,
  };
  writeFileSync(REPORT, `${JSON.stringify({ generated: new Date().toISOString(), threshold, summary, rows }, null, 2)}\n`);
  console.log(`\n${JSON.stringify(summary)}`);
  for (const row of rows.filter((candidate) => candidate.status !== 'ok')) {
    console.log(`${row.status} ${row.slot} [${row.similarity}] scripted=${JSON.stringify(row.scripted)} heard=${JSON.stringify(row.heard)}`);
  }
  console.log(`Wrote ${REPORT}`);
  if (summary.off || summary.missing || summary.errors) process.exitCode = 1;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
