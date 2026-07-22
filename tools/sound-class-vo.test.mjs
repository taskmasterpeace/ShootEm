import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const moduleUrl = new URL('./sound-class-vo.mjs', import.meta.url);
const classVo = existsSync(moduleUrl) ? await import(moduleUrl.href) : null;
const classQc = await import('./sound-class-qc.mjs');

test('the directed mortal-class manifest module exists', () => {
  assert.ok(classVo, 'tools/sound-class-vo.mjs must define the approved cast and lines');
});

test('the approved roster has seven distinct non-Infiltrator identities', () => {
  assert.ok(classVo);
  const ids = Object.keys(classVo.CLASS_CAST);
  assert.deepEqual(ids.sort(), ['engineer', 'ghost', 'heavy', 'infantry', 'jump', 'medic', 'pathfinder']);
  assert.equal(new Set(Object.values(classVo.CLASS_CAST).map((actor) => actor.voice)).size, 7);
  for (const actor of Object.values(classVo.CLASS_CAST)) {
    assert.ok(actor.name.trim());
    assert.ok(actor.persona.length > 100, `${actor.name} needs a fully directed identity`);
  }
});

test('all 186 approved gameplay moments are unique and fully directed', () => {
  assert.ok(classVo);
  const lines = classVo.allClassLines();
  assert.equal(lines.length, 186);
  assert.equal(new Set(lines.map((line) => line.slot)).size, lines.length);
  for (const line of lines) {
    assert.ok(line.text.trim(), `${line.slot} needs dialogue`);
    assert.ok(line.scene.trim(), `${line.slot} needs a physical scene`);
    assert.ok(line.notes.length >= 2, `${line.slot} needs at least two acting notes`);
    assert.match(line.slot, /^(?:vo_(?:infantry|heavy|jump|engineer|medic|pathfinder|ghost)_[a-z0-9_]+|death_(?:infantry|heavy|jump|engineer|medic|pathfinder|ghost))$/);
  }
});

test('each class introduces itself and replaces its live death slot', () => {
  assert.ok(classVo);
  for (const classId of Object.keys(classVo.CLASS_CAST)) {
    const slots = classVo.CLASS_LINES[classId].map((line) => line.slot);
    assert.ok(slots.includes(`vo_${classId}_intro`), `${classId} needs a match introduction`);
    assert.ok(slots.includes(`death_${classId}`), `${classId} needs its live death slot`);
  }
});

test('quiet recon and emergency moments demand physically different performances', () => {
  assert.ok(classVo);
  const bySlot = new Map(classVo.allClassLines().map((line) => [line.slot, line]));
  for (const slot of ['vo_ghost_drone_mark', 'vo_ghost_hold', 'vo_pathfinder_warp_enter']) {
    assert.match(bySlot.get(slot).notes.join(' ').toLowerCase(), /quiet|low|hush|close|under/);
  }
  for (const slot of ['vo_jump_fuel_empty', 'vo_heavy_shield_failing', 'vo_engineer_grenade_in', 'vo_medic_grenade_in']) {
    assert.match(bySlot.get(slot).notes.join(' ').toLowerCase(), /shout|yell|command|alarm/);
  }
});

test('known high-emotion lines preserve every approved word through articulation notes', () => {
  assert.ok(classVo);
  const bySlot = new Map(classVo.allClassLines().map((line) => [line.slot, line]));
  for (const slot of ['death_infantry', 'death_jump', 'vo_engineer_kill', 'vo_ghost_signal_low']) {
    assert.match(bySlot.get(slot).notes.join(' ').toLowerCase(), /articulate|distinct|every word/);
  }
});

test('problematic reads receive inline performance tags without changing approved copy', () => {
  assert.ok(classVo);
  const jumpDeath = classVo.CLASS_LINES.jump.find((line) => line.slot === 'death_jump');
  const engineerKill = classVo.CLASS_LINES.engineer.find((line) => line.slot === 'vo_engineer_kill');
  assert.match(classVo.performanceTextFor(jumpDeath), /\[strained\].*\[clearly\]/);
  assert.match(classVo.performanceTextFor(engineerKill), /\[clearly\].*Diagnosis.*\[short pause\]/);
  assert.equal(classVo.performanceTextFor(classVo.CLASS_LINES.infantry[0]), classVo.CLASS_LINES.infantry[0].text);
});

test('prompts contain identity, scene, and acting notes but never the dialogue', () => {
  assert.ok(classVo);
  const entry = classVo.CLASS_LINES.jump[0];
  const prompt = classVo.classPrompt('jump', entry);
  assert.match(prompt, /Keisha/);
  assert.ok(prompt.includes(entry.scene));
  assert.ok(prompt.includes(entry.notes[0]));
  assert.ok(!prompt.includes(entry.text));
});

test('the safety fallback keeps vocal identity without demographic or violent scene wording', () => {
  assert.ok(classVo);
  const entry = classVo.CLASS_LINES.ghost.find((line) => line.slot === 'vo_ghost_drone_fpv');
  const prompt = classVo.classPrompt('ghost', entry, { safe: true });
  assert.match(prompt, /Elias|Switch/);
  assert.match(prompt, /Brooklyn|baritone/);
  assert.doesNotMatch(prompt, /35-year-old|Haitian-American|body stays exposed|battle|enemy|weapon|wound/i);
  assert.ok(!prompt.includes(entry.text));
});

test('a generated WAV maps only to its sibling OGG', () => {
  assert.ok(classVo);
  assert.equal(classVo.oggPathFor('public/audio/vo_jump_jet_ignite.wav'), 'public/audio/vo_jump_jet_ignite.ogg');
});

test('generation uses the current API language contract and respects throttle backoff', () => {
  assert.ok(classVo);
  assert.equal(classVo.LANGUAGE_CODE, 'en-US');
  assert.equal(classVo.retryDelayMs(new Error('replicate 429: {"retry_after":5}'), 1), 5000);
  assert.equal(classVo.retryDelayMs(new Error('replicate 422: invalid language_code'), 1), null);
  assert.equal(classVo.retryDelayMs(new Error('temporary network failure'), 2), 3000);
});

test('transcript QC retries a transient service failure inside the same audit', async () => {
  let attempts = 0;
  const heard = await classQc.withQcRetry(async () => {
    attempts++;
    if (attempts === 1) throw new Error('temporary Whisper transport error');
    return 'clean transcript';
  }, { sleep: async () => {} });
  assert.equal(heard, 'clean transcript');
  assert.equal(attempts, 2);
});

test('the game catalog and review dossier contain the complete approved slate', () => {
  assert.ok(classVo);
  const audioSource = readFileSync(new URL('../src/client/audio.ts', import.meta.url), 'utf8');
  const htmlUrl = new URL('../public/audio/casting/mortal-classes-review.html', import.meta.url);
  assert.ok(existsSync(htmlUrl), 'mortal-classes-review.html must exist');
  const html = readFileSync(htmlUrl, 'utf8');
  for (const { slot } of classVo.allClassLines()) {
    const matches = audioSource.match(new RegExp(`['\"]${slot}['\"]`, 'g')) ?? [];
    assert.equal(matches.length, 1, `${slot} must appear exactly once in SOUND_NAMES`);
  }
  assert.match(html, /id="play-all"/);
  assert.match(html, /id="stop"/);
  assert.match(html, /id="volume"/);
  assert.match(html, /mortal-classes-manifest\.json/);
  assert.match(html, /mortal-classes-transcript\.json/);
});
