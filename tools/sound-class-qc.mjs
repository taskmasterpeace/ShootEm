#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findToken } from './tts-core.mjs';
import { allClassLines } from './sound-class-vo.mjs';
import { transcriptSimilarity } from './sound-odessa-qc.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = join(ROOT, 'public', 'audio');
const REPORT = join(AUDIO_DIR, 'casting', 'mortal-classes-transcript.json');
const WHISPER = 'vaibhavs10/incredibly-fast-whisper';

export async function withQcRetry(operation, {
  attempts = 3,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      const message = error?.message ?? String(error);
      const seconds = Number(message.match(/retry_after["']?\s*:\s*(\d+)/i)?.[1]);
      await sleep(seconds ? seconds * 1000 : 1200 * attempt);
    }
  }
  throw lastError;
}

let whisperVersionId;
async function whisperVersion(token) {
  if (whisperVersionId) return whisperVersionId;
  const response = await fetch('https://api.replicate.com/v1/models/' + WHISPER, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!response.ok) throw new Error('model lookup ' + response.status + ': ' + (await response.text()).slice(0, 200));
  const model = await response.json();
  whisperVersionId = model.latest_version?.id;
  if (!whisperVersionId) throw new Error('no latest version for ' + WHISPER);
  return whisperVersionId;
}

async function transcribe(token, wavPath) {
  const version = await whisperVersion(token);
  const audio = 'data:audio/wav;base64,' + readFileSync(wavPath).toString('base64');
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ version, input: { audio, task: 'transcribe', language: 'english', batch_size: 64 } }),
  });
  if (!response.ok) throw new Error('whisper ' + response.status + ': ' + (await response.text()).slice(0, 200));
  let prediction = await response.json();
  for (let tries = 0; ['starting', 'processing'].includes(prediction.status) && tries < 120; tries++) {
    await new Promise((done) => setTimeout(done, 1200));
    prediction = await (await fetch(prediction.urls.get, { headers: { Authorization: 'Bearer ' + token } })).json();
  }
  if (prediction.status !== 'succeeded') throw new Error('whisper ' + prediction.status + ': ' + (prediction.error ?? 'no detail'));
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
  const requestedClass = argValue('--class');
  const limit = Math.max(0, Number(argValue('--limit')) || 0);
  const threshold = Number(argValue('--threshold')) || 0.78;
  const concurrency = Math.max(1, Math.min(5, Number(argValue('--concurrency')) || 4));
  let queue = allClassLines();
  if (requestedClass) queue = queue.filter((line) => line.classId === requestedClass);
  if (only) queue = queue.filter((line) => line.slot === only);
  if (limit) queue = queue.slice(0, limit);
  if (!queue.length) throw new Error('no mortal class slots matched the requested filter');

  const rows = [];
  let cursor = 0;
  console.log('Transcribing ' + queue.length + ' mortal-class take(s)...');
  async function worker() {
    while (cursor < queue.length) {
      const entry = queue[cursor++];
      const wav = join(AUDIO_DIR, entry.slot + '.wav');
      if (!existsSync(wav)) {
        rows.push({ classId: entry.classId, slot: entry.slot, scripted: entry.text, heard: null, similarity: 0, status: 'MISSING' });
        process.stdout.write('m');
        continue;
      }
      try {
        const heard = await withQcRetry(() => transcribe(token, wav));
        const similarity = +transcriptSimilarity(entry.text, heard).toFixed(2);
        const status = similarity >= threshold ? 'ok' : 'OFF';
        rows.push({ classId: entry.classId, slot: entry.slot, scripted: entry.text, heard, similarity, status });
        process.stdout.write(status === 'ok' ? '.' : 'x');
      } catch (error) {
        rows.push({ classId: entry.classId, slot: entry.slot, scripted: entry.text, heard: null, similarity: 0, status: 'ERR', error: error.message });
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
  writeFileSync(REPORT, JSON.stringify({ generated: new Date().toISOString(), threshold, summary, rows }, null, 2) + '\n');
  console.log('\n' + JSON.stringify(summary));
  for (const row of rows.filter((candidate) => candidate.status !== 'ok')) {
    console.log(row.status + ' ' + row.slot + ' [' + row.similarity + '] scripted=' + JSON.stringify(row.scripted) + ' heard=' + JSON.stringify(row.heard));
  }
  console.log('Wrote ' + REPORT);
  if (summary.off || summary.missing || summary.errors) process.exitCode = 1;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
