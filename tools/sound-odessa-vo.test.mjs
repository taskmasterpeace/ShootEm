import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ODESSA_LINES,
  ODESSA_PERSONA,
  oggPathFor,
  odessaPrompt,
} from './sound-odessa-vo.mjs';
import { normalizeTranscript, transcriptSimilarity } from './sound-odessa-qc.mjs';

test('Odessa has a complete, uniquely named first-pass bark pack', () => {
  assert.ok(ODESSA_LINES.length >= 40, `expected at least 40 lines, got ${ODESSA_LINES.length}`);
  const slots = ODESSA_LINES.map((line) => line.slot);
  assert.equal(new Set(slots).size, slots.length, 'every Odessa slot must be unique');
  assert.ok(slots.includes('vo_infiltrator_intro'));
  assert.ok(slots.includes('death_infiltrator'));
  assert.ok(slots.every((slot) => slot === 'death_infiltrator' || slot.startsWith('vo_infiltrator_')));
});

test('every line carries playable dialogue and moment-specific acting direction', () => {
  for (const line of ODESSA_LINES) {
    assert.ok(line.text.trim(), `${line.slot} needs dialogue`);
    assert.ok(line.scene.trim(), `${line.slot} needs a scene`);
    assert.ok(line.notes.length >= 2, `${line.slot} needs at least two acting notes`);
    assert.ok(line.notes.every((note) => note.trim()), `${line.slot} has an empty acting note`);
  }
});

test('cloaking whispers and emergencies genuinely call for different performances', () => {
  const cloak = ODESSA_LINES.filter((line) => /cloak_(on|move)|rail_shot/.test(line.slot));
  assert.ok(cloak.length >= 3);
  assert.ok(cloak.every((line) => line.notes.join(' ').toLowerCase().includes('whisper')));

  for (const slot of ['vo_infiltrator_grenade_in', 'vo_infiltrator_cloak_broken', 'vo_infiltrator_vehicle_bail']) {
    const line = ODESSA_LINES.find((candidate) => candidate.slot === slot);
    assert.ok(line, `missing emergency slot ${slot}`);
    assert.match(line.notes.join(' ').toLowerCase(), /shout|yell|command voice/);
  }
});

test('Odessa is endearing without making her age the running joke', () => {
  const ageReferences = ODESSA_LINES.filter((line) => /\b(old|older|age|aged|years old)\b/i.test(line.text));
  assert.equal(ageReferences.length, 0, `age references found in ${ageReferences.map((line) => line.slot).join(', ')}`);
  assert.match(ODESSA_PERSONA, /New Orleans/i);
  assert.match(ODESSA_PERSONA, /68/);
});

test('the generated prompt separates identity, physical scene, and line performance', () => {
  const line = {
    slot: 'vo_infiltrator_test',
    text: 'Test line.',
    scene: 'A test battlefield moment.',
    notes: ['Whisper this test.', 'Keep the thought private.'],
  };
  const prompt = odessaPrompt(line);
  assert.match(prompt, /Odessa Broussard/);
  assert.match(prompt, /A test battlefield moment/);
  assert.match(prompt, /Whisper this test/);
  assert.doesNotMatch(prompt, /Test line\./);
});

test('the death prompt keeps Odessa identity without the rejected demographic wording', () => {
  const death = ODESSA_LINES.find((line) => line.slot === 'death_infiltrator');
  const prompt = odessaPrompt(death);
  assert.match(prompt, /Odessa Broussard/);
  assert.match(prompt, /New Orleans/);
  assert.doesNotMatch(prompt, /68-year-old|Black American/);
  assert.doesNotMatch(prompt, /fatal|\bdies?\b/i);
});

test('a generated WAV maps to its sibling game-ready OGG only', () => {
  assert.equal(oggPathFor('public/audio/vo_infiltrator_intro.wav'), 'public/audio/vo_infiltrator_intro.ogg');
});

test('transcript QC tolerates punctuation but rejects spoken direction bleed', () => {
  assert.equal(normalizeTranscript("That's our capture."), 'that s our capture');
  assert.equal(transcriptSimilarity("That's our capture.", 'Thats our capture!'), 1);
  assert.ok(transcriptSimilarity('Hold still.', 'Audio profile Odessa Broussard director notes hold still') < 0.7);
});

test('the Odessa review booth exposes complete playback and review controls', () => {
  const html = readFileSync(new URL('../public/audio/casting/odessa-review.html', import.meta.url), 'utf8');
  assert.match(html, /id="play-all"/);
  assert.match(html, /id="stop"/);
  assert.match(html, /id="volume"/);
  assert.match(html, /id="filter"/);
  assert.match(html, /fetch\('odessa-manifest\.json'/);
  assert.match(html, /odessa-transcript\.json/);
});
