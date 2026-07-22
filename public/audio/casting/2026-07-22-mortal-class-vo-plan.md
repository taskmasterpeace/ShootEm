# Mortal Class Voice Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship the seven approved non-Infiltrator mortal personalities as directed, transcript-checked WAV/OGG assets in the War World audio catalog.

**Architecture:** One `tools/sound-class-vo.mjs` module owns character identity, exact dialogue, moment scenes, performance notes, generation, targeted OGG encoding, and the review manifest. A separate QC tool transcribes the recorded WAVs and scores them against the approved copy. `src/client/audio.ts` catalogs the slots without touching the renderer or sim files reserved for the reconciliation merge.

**Tech Stack:** Node.js ESM, the existing Gemini expressive-TTS helper in `tools/tts-core.mjs`, Replicate Whisper QC, ffmpeg Opus encoding, Web Audio-compatible game assets.

## Global Constraints

- Work only in `D:/git/ShootEM/.claude/worktrees/audio` on branch `audio-work`.
- Touch only `src/client/audio.ts`, `src/client/soundscape.ts`, `sound-editor.html`, `tools/sound-*.mjs`, and `public/audio/**`.
- Do not edit `map.ts`, `world.ts`, `bots.ts`, `perception.ts`, `buildings.ts`, `mapedit.ts`, `renderer.ts`, or `main.ts`.
- Do not generate Living Super Weapon dialogue.
- Encode only the WAV generated for the current slot; never run the repository-wide encoder.
- Do not push and do not add `Co-Authored-By`.

---

### Task 1: Directed Cast Manifest

**Files:**
- Create: `tools/sound-class-vo.test.mjs`
- Create: `tools/sound-class-vo.mjs`

**Interfaces:**
- Produces: `CLASS_CAST`, `CLASS_LINES`, `allClassLines()`, `classPrompt()`, `validateClassManifest()`, and `oggPathFor()`.

- [x] Write tests requiring seven distinct class identities, 186 unique gameplay slots, exact approved dialogue, moment-specific scenes, at least two acting notes per line, quiet recon direction, emergency yelling, and target-only OGG paths.
- [x] Run `node --test tools/sound-class-vo.test.mjs` and confirm it fails because the manifest does not exist.
- [x] Implement the seven personas and approved lines with distinct Gemini seed voices.
- [x] Run the targeted test and confirm the manifest tests pass.

### Task 2: Generation and Transcript QC

**Files:**
- Modify: `tools/sound-class-vo.mjs`
- Create: `tools/sound-class-qc.mjs`
- Create: `public/audio/casting/mortal-classes-manifest.json`
- Create: `public/audio/casting/mortal-classes-transcript.json`

**Interfaces:**
- Consumes: existing `buildPrompt()`, `generateClip()`, and `findToken()` from `tools/tts-core.mjs`.
- Produces: one 44.1 kHz mono WAV and sibling 48 kbps Opus OGG for every approved slot, plus auditable transcript scores.

- [x] Add `--check`, `--list`, `--class`, `--only`, `--force`, and bounded `--concurrency` generation options.
- [x] Generate every approved class slot with persona, physical scene, and line-specific acting direction kept separate from dialogue.
- [x] Transcribe all generated WAVs with Whisper at similarity threshold `0.78`.
- [x] Regenerate only OFF or errored takes and repeat QC until every slot is clean.

### Task 3: Game Catalog and Review Dossier

**Files:**
- Modify: `src/client/audio.ts`
- Create: `public/audio/casting/mortal-classes-review.html`

**Interfaces:**
- Consumes: slot names from `allClassLines()`.
- Produces: lazy-loadable positional VO entries in `SOUND_NAMES` and a browser review page with filtering, playback, direction, and transcript status.

- [x] Add all 179 new `vo_<class>_<moment>` slots to `SOUND_NAMES`; preserve the seven existing `death_<class>` slots.
- [x] Confirm normal gameplay continues to skip VO during initial preload and loads a spoken slot on demand.
- [x] Build review controls for character filters, text search, per-line playback, play-all, stop, and volume.
- [x] Verify every manifest slot appears exactly once in `SOUND_NAMES`.

### Task 4: Verification and Commit

**Files:**
- Modify only the files named above and generated `public/audio/**` class assets.

- [x] Run `node --test tools/sound-class-vo.test.mjs`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npx vitest run`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Stage only the named mortal-class audio files; leave prior auditions and incidental unrelated OGG refreshes unstaged.
- [x] Commit with a focused message and do not push.
