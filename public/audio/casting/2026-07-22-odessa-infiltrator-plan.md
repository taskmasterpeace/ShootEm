# Odessa Broussard Infiltrator VO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author and render one complete, expressive Infiltrator voice pack for Odessa Broussard, using the proven Gacrux/New Orleans recipe and moment-specific Gemini direction.

**Architecture:** `tools/sound-odessa-vo.mjs` owns the immutable persona, slot manifest, performance directions, validation, and generation CLI. Each slot renders to `public/audio/<slot>.wav`; the existing encoder creates sibling Opus files. `src/client/audio.ts` catalogs every new slot so the Sound Editor can review the full pack, while the existing `death_infiltrator` slot is replaced for immediate gameplay use.

**Tech Stack:** Node.js ESM, Gemini 3.1 Flash TTS through `tools/tts-core.mjs`, ffmpeg/Opus, TypeScript sound catalog, Node test runner.

## Global Constraints

- Work only in `D:/git/ShootEM/.claude/worktrees/audio` on branch `audio-work`.
- Modify only `src/client/audio.ts`, `tools/sound-*.mjs`, and `public/audio/**` for this slice.
- Do not edit any sim file or Living Super Weapon script.
- Do not push and do not add `Co-Authored-By` trailers.
- Before committing, run `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.
- Human ear approval is required before minting Odessa as a permanent Dramatis character.

---

### Task 1: Define and validate the Odessa manifest

**Files:**
- Create: `tools/sound-odessa-vo.test.mjs`
- Create: `tools/sound-odessa-vo.mjs`

**Interfaces:**
- Produces: `ODESSA_PERSONA`, `ODESSA_LINES`, `odessaPrompt(line)`, and CLI flags `--check`, `--list`, `--only <slot>`, `--force`.
- Each manifest row is `{ slot, text, scene, notes }` and every slot is unique.

- [ ] Write a Node test asserting a minimum of 40 unique slots, one introduction, whispered cloak direction, yelled emergency direction, non-empty text/scene/notes, and the existing `death_infiltrator` slot.
- [ ] Run `node --test tools/sound-odessa-vo.test.mjs`; expect failure because the manifest module does not exist.
- [ ] Implement the persona, complete slot manifest, prompt builder, and non-generating CLI modes.
- [ ] Run the Node test again; expect all assertions to pass.

### Task 2: Catalog the pack in the audio engine

**Files:**
- Modify: `src/client/audio.ts`

**Interfaces:**
- Consumes: every manifest slot from `ODESSA_LINES`.
- Produces: matching `SoundName` entries so the Sound Editor and lazy loader recognize the assets.

- [ ] Run a one-off comparison between `ODESSA_LINES` and `SOUND_NAMES`; expect every new slot except the already-existing death slot to be missing.
- [ ] Add the Odessa slots together under an Infiltrator VO comment in `SOUND_NAMES`.
- [ ] Re-run the comparison; expect zero missing or extra Odessa catalog entries.

### Task 3: Render and encode the pack

**Files:**
- Modify by generation: `public/audio/vo_infiltrator_*.wav`, `public/audio/death_infiltrator.wav`
- Modify by encoding: sibling `.ogg` files
- Create: `public/audio/casting/odessa-manifest.json`

**Interfaces:**
- Consumes: Gacrux, `en-US`, the New Orleans identity profile, and per-line performance direction.
- Produces: 44.1 kHz mono 16-bit WAV plus 48 kbps mono Opus for every slot.

- [ ] Run `node tools/sound-odessa-vo.mjs --check` and `--list`; expect a valid manifest and readable slot table.
- [ ] Run the generator with bounded concurrency and retry failed external predictions without changing successful takes.
- [ ] Run `node tools/encode-audio.mjs`; expect sibling OGG files for every generated WAV.
- [ ] Validate all WAV/OGG files with ffprobe and compare disk assets against the manifest; expect no missing, corrupt, or zero-length clips.

### Task 4: Verify and commit

**Files:**
- Review all files from Tasks 1-3.

- [x] Run `node --test tools/sound-odessa-vo.test.mjs`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npx vitest run`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Stage only the named Odessa/audio files.
