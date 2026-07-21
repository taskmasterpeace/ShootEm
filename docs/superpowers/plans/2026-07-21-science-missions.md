# Science Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository is explicitly single-agent; do not dispatch implementation subagents.

**Goal:** Ship deterministic, campaign-connected science missions with compact thin-wall interiors, all ten mission verbs and sites, clone-budget reprinting, scripted objectives, pedestrians, rewards, and Front Courier aftermath.

**Architecture:** Add `science` as a native simulation mode. A pure generator produces a typed mission spec; a stencil-based site generator produces a normal `GameMap`; a small runtime compiles verbs into shared objective primitives and owns clone/alarm/extraction state. Existing `World`, campaign, HUD, and newspaper seams consume that state rather than duplicating combat or presentation systems.

**Tech Stack:** TypeScript 5.6, Vitest 2.1, Three.js 0.170, Vite 6, deterministic `Rng`, DOM/CSS UI.

## Global Constraints

- Work only in `D:/git/ShootEM/.claude/worktrees/science-missions` on `codex/science-missions`.
- Do not push.
- Stage files by exact name; never use `git add -A`.
- Preserve existing modes and stencils byte-for-byte when science mode is not selected.
- Use the shipped weapons, movement, AI, perception, buildings, pedestrians, clone bay, campaign, and Courier systems.
- Every production behavior begins with a failing Vitest assertion.
- Buildings remain stencil-driven; no bespoke GLTF or renderer-only collision.
- Existing battle walls remain full-tile; only explicit science stencil characters use thin collision.
- No purple materials.
- Campaign science windows are two per front per pass.
- Squad commitment is 1–8; one-life missions clamp to one.
- Full completion requires `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.

---

### Task 1: Deterministic Mission Contract and Generator

**Files:**
- Create: `src/sim/science.ts`
- Create: `tests/science-generator.test.ts`

**Interfaces:**
- Produces: `ScienceVerb`, `ScienceSite`, `ScienceComplication`, `ScienceRewardId`, `ScienceMissionSpec`, `SCIENCE_VERBS`, `SCIENCE_SITES`, `SCIENCE_REWARDS`, `generateScienceMission(seed, options?)`, and `validateScienceMission(spec)`.
- Consumes: `Rng` from `src/sim/rng.ts`, `ThemeId` from `src/sim/types.ts`.

- [x] **Step 1: Write generator tests for coverage, bounds, and determinism**

```ts
import { describe, expect, it } from 'vitest';
import {
  SCIENCE_SITES, SCIENCE_VERBS, generateScienceMission, validateScienceMission,
} from '../src/sim/science';

describe('science mission generator', () => {
  it('is deterministic and commits 1–8 clones', () => {
    const a = generateScienceMission(7749, { squadSize: 6 });
    const b = generateScienceMission(7749, { squadSize: 6 });
    expect(a).toEqual(b);
    expect(a.squadSize).toBe(6);
    expect(validateScienceMission(a)).toEqual([]);
  });

  it('can compile every verb and every site', () => {
    for (const verb of SCIENCE_VERBS) {
      expect(generateScienceMission(12, { verb }).verb).toBe(verb);
    }
    for (const site of SCIENCE_SITES) {
      expect(generateScienceMission(13, { site }).site).toBe(site);
    }
  });

  it('one-life clamps the squad to one clone', () => {
    expect(generateScienceMission(14, { squadSize: 8, complication: 'one-life' }).squadSize).toBe(1);
  });
});
```

- [x] **Step 2: Run the generator test and verify RED**

Run: `npx vitest run tests/science-generator.test.ts`

Expected: FAIL because `src/sim/science.ts` does not exist.

- [x] **Step 3: Implement the typed generator**

```ts
export const SCIENCE_VERBS = ['assassinate', 'steal', 'raid', 'deny', 'rescue', 'infiltrate', 'ambush', 'hold', 'hunt', 'decapitate'] as const;
export type ScienceVerb = typeof SCIENCE_VERBS[number];

export const SCIENCE_SITES = ['clone-vault', 'research-annex', 'rail-yard', 'comms-relay', 'field-hospital', 'foundry', 'buried-archive', 'enemy-airfield', 'officer-villa', 'quarantine-zone'] as const;
export type ScienceSite = typeof SCIENCE_SITES[number];

export const SCIENCE_COMPLICATIONS = ['alarm-net', 'god-on-guard', 'storm', 'third-party', 'no-kill', 'one-life'] as const;
export type ScienceComplication = typeof SCIENCE_COMPLICATIONS[number];

export interface ScienceMissionSpec {
  id: string;
  seed: number;
  verb: ScienceVerb;
  site: ScienceSite;
  theme: ThemeId;
  complication?: ScienceComplication;
  reward: ScienceRewardId;
  squadSize: number;
  briefing: string;
}

export function generateScienceMission(seed: number, options: ScienceMissionOptions = {}): ScienceMissionSpec {
  const rng = new Rng(seed ^ 0x51c1e);
  const verb = options.verb ?? SCIENCE_VERBS[rng.int(0, SCIENCE_VERBS.length - 1)];
  const site = options.site ?? SCIENCE_SITES[rng.int(0, SCIENCE_SITES.length - 1)];
  const complication = options.complication ?? (rng.next() < 0.55 ? SCIENCE_COMPLICATIONS[rng.int(0, SCIENCE_COMPLICATIONS.length - 1)] : undefined);
  const squadSize = complication === 'one-life' ? 1 : Math.max(1, Math.min(8, Math.round(options.squadSize ?? 4)));
  const reward = options.reward ?? SCIENCE_REWARDS[rng.int(0, SCIENCE_REWARDS.length - 1)].id;
  const id = `SM-${seed.toString(36).toUpperCase().padStart(4, '0').slice(-4)}`;
  return { id, seed, verb, site, theme: options.theme ?? themeForSite(site), complication, reward, squadSize, briefing: briefingFor(verb, site, complication) };
}
```

- [x] **Step 4: Run generator tests and the typecheck**

Run: `npx vitest run tests/science-generator.test.ts && npx tsc --noEmit`

Expected: generator tests PASS and TypeScript exits 0.

- [x] **Step 5: Commit the generator slice**

```powershell
git add src/sim/science.ts tests/science-generator.test.ts
git commit -m "feat: add science mission generator"
```

---

### Task 2: Thin Stencil Geometry and Compact Mission Sites

**Files:**
- Modify: `src/sim/map.ts`
- Modify: `src/sim/buildings.ts`
- Create: `src/sim/science-map.ts`
- Modify: `src/client/renderer.ts`
- Create: `tests/science-map.test.ts`

**Interfaces:**
- Produces: `T_THIN_WALL_H`, `T_THIN_WALL_V`, `T_THIN_DOOR_H`, `T_THIN_DOOR_V`, open variants, `isDoorTile(t)`, `doorIsOpen(t)`, `toggleDoorType(t)`, `thinTileBlocks(t, x, z)`, `generateScienceMap(spec)` returning `{ map, entry, extraction, objectiveSockets, guardPosts, civilianSpawns }`.
- Extends stencil legend with `-`, `|`, `h`, and `v` while preserving all existing characters.

- [x] **Step 1: Write failing thin-wall and map-law tests**

```ts
it('thin walls block only their visible slab', () => {
  const g = new Uint8Array(GRID * GRID);
  const idx = 50 * GRID + 50;
  g[idx] = T_THIN_WALL_V;
  const cx = toWorld(50);
  expect(isBlocked(g, cx, cx)).toBe(true);
  expect(isBlocked(g, cx + TILE * 0.42, cx)).toBe(false);
  expect(blocksShot(g, cx, cx, 1.4)).toBe(true);
});

it.each(SCIENCE_SITES)('%s produces connected compact ground', (site) => {
  const spec = generateScienceMission(4207, { site, squadSize: 4 });
  const layout = generateScienceMap(spec);
  expect(layout.map.props.filter((p) => p.type === 'clone_bay')).toHaveLength(1);
  expect(layout.objectiveSockets.length).toBeGreaterThan(0);
  expect(reachable(layout.map, layout.entry, layout.objectiveSockets[0])).toBe(true);
});

it('the officer villa is guaranteed two-storey', () => {
  const layout = generateScienceMap(generateScienceMission(7, { site: 'officer-villa' }));
  expect(layout.map.houses.some((h) => h.floors === 2)).toBe(true);
  expect(layout.map.grid.includes(T_LADDER)).toBe(true);
  expect(layout.map.grid2.includes(F2_WELL)).toBe(true);
});
```

- [x] **Step 2: Run the map test and verify RED**

Run: `npx vitest run tests/science-map.test.ts`

Expected: FAIL on missing thin tile constants and `generateScienceMap`.

- [x] **Step 3: Implement shared thin collision and door helpers**

```ts
export const THIN_WALL = 0.32;
export const T_THIN_WALL_H = 14;
export const T_THIN_WALL_V = 15;
export const T_THIN_DOOR_H = 16;
export const T_THIN_DOOR_V = 17;
export const T_THIN_DOOR_H_OPEN = 18;
export const T_THIN_DOOR_V_OPEN = 19;

export function thinTileBlocks(t: number, x: number, z: number): boolean {
  const lx = positiveTileOffset(x);
  const lz = positiveTileOffset(z);
  if (t === T_THIN_WALL_H || t === T_THIN_DOOR_H) return Math.abs(lz - TILE / 2) <= THIN_WALL / 2;
  if (t === T_THIN_WALL_V || t === T_THIN_DOOR_V) return Math.abs(lx - TILE / 2) <= THIN_WALL / 2;
  return false;
}
```

Update `isBlocked`, `blocksShot`, destruction/door helpers, renderer classification, thin instanced geometry, and live door animation to use the same constants.

- [x] **Step 4: Implement science stencil profiles and map assembly**

Create explicit site profiles that emit `BuildingDef` rows with `-`, `|`, `h`, `v`, objective sockets, guards, civilians, and a safe western entry. Stamp them through `stampBuilding`; use a fixed valid two-storey villa definition with a matching `L`/`rows2` well. Return a normal `GameMap` with one clone-bay claim and no second faction printer.

- [x] **Step 5: Run focused map, building, door, wall, and visual tests**

Run: `npx vitest run tests/science-map.test.ts tests/buildings.test.ts tests/twostory.test.ts tests/autodoor.test.ts tests/walls.test.ts tests/visual.test.ts`

Expected: all listed test files PASS.

- [x] **Step 6: Commit the map slice**

```powershell
git add src/sim/map.ts src/sim/buildings.ts src/sim/science-map.ts src/client/renderer.ts tests/science-map.test.ts
git commit -m "feat: add compact science mission sites"
```

---

### Task 3: Mission Runtime, Objectives, Alarm, Pedestrians, and Clone Reprinting

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/world.ts`
- Modify: `src/sim/modes.ts`
- Modify: `src/sim/bots.ts`
- Create: `src/sim/science-runtime.ts`
- Create: `tests/science-runtime.test.ts`

**Interfaces:**
- Adds `science` to `ModeId` and `isCoopMode`.
- Adds `scienceMission?: ScienceMissionSpec` to `WorldOptions`.
- Adds `science?: ScienceMissionRuntime` to `World`.
- Produces: `createScienceRuntime`, `populateScienceMission`, `stepScienceMission`, `tryScienceInteraction`, `onScienceDeath`, `scienceObjectiveText`, `scienceResult`.

- [ ] **Step 1: Write failing runtime tests for every compiled verb**

Use table tests to assert the primitive created by each verb:

```ts
const primitive = {
  assassinate: 'eliminate', steal: 'interact', raid: 'interact', deny: 'interact',
  rescue: 'escort', infiltrate: 'interact', ambush: 'eliminate', hold: 'survive',
  hunt: 'eliminate', decapitate: 'eliminate',
} as const;

it.each(Object.entries(primitive))('%s compiles to %s', (verb, kind) => {
  const w = missionWorld({ verb: verb as ScienceVerb });
  expect(w.science?.objective.kind).toBe(kind);
});
```

Add separate tests that interaction progress unlocks extraction, Rescue attaches named scientist actors, detection raises alarm exactly once, and returning to extraction wins only after the primary objective is complete.

- [ ] **Step 2: Write failing clone-loop tests**

```ts
it('burns one clone and reprints at the field printer without a downed wait', () => {
  const w = missionWorld({ squadSize: 2 });
  const me = human(w);
  w.damageSoldier(me, 9999, -1, 'test');
  expect(w.science?.clonesRemaining).toBe(1);
  expect(me.downed).toBe(false);
  stepFor(w, 0.5);
  expect(me.alive).toBe(true);
  expect(distance(me.pos, w.science!.entry)).toBeLessThan(6);
});

it('the final clone ends the operation with no reprint', () => {
  const w = missionWorld({ squadSize: 1 });
  const me = human(w);
  w.damageSoldier(me, 9999, -1, 'test');
  expect(w.mode.over).toBe(true);
  expect(w.mode.winner).toBe(1);
  stepFor(w, 1);
  expect(me.alive).toBe(false);
});
```

- [ ] **Step 3: Run runtime tests and verify RED**

Run: `npx vitest run tests/science-runtime.test.ts`

Expected: FAIL because science mode/runtime is absent.

- [ ] **Step 4: Implement runtime population and shared objective state machine**

```ts
export interface ScienceMissionRuntime {
  spec: ScienceMissionSpec;
  phase: 'briefing' | 'objective' | 'extract' | 'won' | 'failed';
  objective: ScienceObjective;
  entry: Vec3;
  extraction: Vec3;
  clonesRemaining: number;
  clonesSpent: number;
  detections: number;
  alarm: boolean;
  civilianIds: number[];
  targetIds: number[];
  applied: boolean;
}
```

Populate ordinary bots at guard sockets, named officer bots for eliminate objectives, scientist actors for rescue, zombies for quarantine/third-party, and an existing transport vehicle for ambush. `stepScienceMission` evaluates perception, objective completion, hold clocks, extraction, and deterministic scripted beats.

- [ ] **Step 5: Integrate science mode into World without changing other mode behavior**

Generate the science map before `initMode`, skip normal vehicle-map assumptions where needed, call `populateScienceMission` after world collections exist, route `E` through `tryScienceInteraction` after downed aid and before doors, call `onScienceDeath` once in the lethal branch, use the field-printer spawn list in `spawn`, and call `stepScienceMission` from `stepMode`.

- [ ] **Step 6: Give science guards stable mission goals**

Add a `science` case to bot objective selection: team 1 holds runtime guard/objective sockets; any friendly mission NPC follows its existing target or extraction behavior. Keep combat, weapons, perception, pathfinding, doors, and ladders unchanged.

- [ ] **Step 7: Run focused runtime and regression tests**

Run: `npx vitest run tests/science-runtime.test.ts tests/sim.test.ts tests/bots-nav.test.ts tests/downed.test.ts tests/reprint.test.ts tests/visibility.test.ts tests/twostory.test.ts`

Expected: all listed test files PASS.

- [ ] **Step 8: Commit the runtime slice**

```powershell
git add src/sim/types.ts src/sim/world.ts src/sim/modes.ts src/sim/bots.ts src/sim/science-runtime.ts tests/science-runtime.test.ts
git commit -m "feat: make science missions playable"
```

---

### Task 4: Campaign Windows, Clone Spend, and Real Rewards

**Files:**
- Modify: `src/client/campaign.ts`
- Create: `tests/science-campaign.test.ts`

**Interfaces:**
- Adds `scienceWindows`, `scienceWindowPass`, and typed science bonuses to `FrontState`/`Campaign` with v1 migration.
- Produces: `SCIENCE_WINDOWS_PER_PASS`, `scienceWindowsFor`, `spendScienceWindow`, `applyScienceResult`.
- Consumes: `ScienceMissionSpec`, `ScienceMissionResult`, `SCIENCE_REWARDS`.

- [ ] **Step 1: Write failing campaign transaction tests**

```ts
it('spends one of two windows and replenishes on a new pass', () => {
  const c = freshCampaign(1);
  expect(spendScienceWindow(c, 'bridge_delta', 1)).toBe(true);
  expect(c.fronts.bridge_delta.scienceWindows).toBe(1);
  expect(spendScienceWindow(c, 'bridge_delta', 2)).toBe(true);
  expect(c.fronts.bridge_delta.scienceWindows).toBe(1);
});

it('applies a successful result exactly once', () => {
  const c = freshCampaign(1);
  const result = resultFixture({ id: 'SM-TEST', won: true, clonesSpent: 2, ghost: false, reward: 'front-reinforcement' });
  const before = c.fronts.bridge_delta.clones;
  expect(applyScienceResult(c, 'bridge_delta', result, 2)).toBe(true);
  expect(applyScienceResult(c, 'bridge_delta', result, 3)).toBe(false);
  expect(c.fronts.bridge_delta.clones).toBeGreaterThan(before - 2);
});
```

- [ ] **Step 2: Run campaign tests and verify RED**

Run: `npx vitest run tests/science-campaign.test.ts`

Expected: FAIL on missing science campaign helpers.

- [ ] **Step 3: Implement migration, windows, idempotency, and reward adapters**

Store applied mission IDs in a capped campaign list. On result: subtract `clonesSpent`; add ghost bonus; if won, apply the selected reward to a value visible on the front/campaign record; prepend signed dispatch lines; return `false` for an already-applied ID. Keep `applyResult` behavior unchanged for ordinary battles.

- [ ] **Step 4: Run campaign suites and typecheck**

Run: `npx vitest run tests/science-campaign.test.ts tests/campaign.test.ts tests/warledger.test.ts && npx tsc --noEmit`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit campaign integration**

```powershell
git add src/client/campaign.ts tests/science-campaign.test.ts
git commit -m "feat: connect science missions to the campaign"
```

---

### Task 5: Mission HUD and Front Courier Editions

**Files:**
- Modify: `src/client/newspaper.ts`
- Create: `src/client/science.ts`
- Modify: `index.html`
- Modify: `src/styles.css`
- Create: `tests/science-presentation.test.ts`

**Interfaces:**
- Adds optional `science` data to `PressIssue`.
- Produces pure `scienceHeadline(issue)`, `scienceMissionHTML(runtime)`, `scienceDebriefHTML(result)`, and `renderSciencePanel(root, runtime)`.

- [ ] **Step 1: Write failing pure presentation tests**

```ts
it('prints the operation, clone bill, ghost status, and reward', () => {
  const html = renderIssueHTML(scienceIssueFixture());
  expect(html).toContain('OPERATION SM-TEST');
  expect(html).toContain('GHOST RUN');
  expect(html).toContain('CLONES SPENT');
  expect(html).toContain('FRONT REINFORCEMENT');
});

it('escapes generated operation copy', () => {
  expect(scienceDebriefHTML(resultFixture({ briefing: '<script>x</script>' }))).not.toContain('<script>');
});
```

- [ ] **Step 2: Run presentation tests and verify RED**

Run: `npx vitest run tests/science-presentation.test.ts`

Expected: FAIL because science issue/presenter fields do not exist.

- [ ] **Step 3: Implement science newspaper copy and pure HUD markup**

Branch the headline/field/ledger copy only when `issue.science` exists. Preserve the current battle issue structure and archive. Escape every generated string through the existing `esc` seam.

- [ ] **Step 4: Add the in-match mission card**

Add one hidden `#science-mission-panel` overlay to `index.html`. Style it with the existing War World palette, 10px radii, compact clone pips, alarm/ghost states, responsive placement, hover-free noninteractive semantics, and no new font dependency. `renderSciencePanel` updates text/classes only.

- [ ] **Step 5: Run presentation and newspaper regressions**

Run: `npx vitest run tests/science-presentation.test.ts tests/record.test.ts tests/campaign.test.ts && npm run lint`

Expected: all tests PASS and lint reports zero errors.

- [ ] **Step 6: Commit presentation integration**

```powershell
git add src/client/newspaper.ts src/client/science.ts index.html src/styles.css tests/science-presentation.test.ts
git commit -m "feat: present science mission operations"
```

---

### Task 6: Free-Play and Scar Launch Flow

**Files:**
- Modify: `src/sim/data.ts`
- Modify: `src/main.ts`
- Modify: `src/client/hud.ts`
- Modify: `src/client/record.ts` only if exhaustive mode typing requires it
- Modify: `src/server/server.ts` to explicitly keep science missions offline/friends-path-disabled in v1
- Create: `tests/science-flow.test.ts`

**Interfaces:**
- Produces: `prepareScienceMission(seed, front, squadSize)`, a single launch state consumed by `startLocal`, and one-shot result finalization.
- Free play generates a mission from selected theme and squad size.
- Scar launch spends a window before start and binds mission result to the selected front.

- [ ] **Step 1: Write failing launch-state tests**

Test that free play does not mutate campaign state, Scar launch refuses zero windows, one-life locks squad size to one, and finalization calls campaign/Courier adapters once even across repeated end frames.

- [ ] **Step 2: Run flow tests and verify RED**

Run: `npx vitest run tests/science-flow.test.ts`

Expected: FAIL because launch/finalization helpers do not exist.

- [ ] **Step 3: Add mode metadata and setup controls**

Add `science` to `MODE_INFO`. Reuse the setup area for a clone stepper shown only for science mode. On the Scar, render the selected front's windows, the deterministic briefing card, clone commitment, and a `RUN SCIENCE MISSION` action. Disable with an explicit reason at zero windows.

- [ ] **Step 4: Wire local world creation and mission population**

Pass `scienceMission` through `WorldOptions`; science mode spawns only the player on team 0 and the runtime's enemy/civilian roster. Keep online `MODES` unchanged so a science request cannot silently enter an incompatible public room.

- [ ] **Step 5: Wire frame presentation and one-shot aftermath**

Update the science panel each frame, show mission context hints in HUD, append the science debrief to the closing panel, call `applyScienceResult` once for Scar missions, file one science `PressIssue`, save/render campaign, and hide the mission panel on exit.

- [ ] **Step 6: Run flow, HUD, record, and core mode tests**

Run: `npx vitest run tests/science-flow.test.ts tests/science-runtime.test.ts tests/campaign.test.ts tests/record.test.ts tests/sim.test.ts`

Expected: all listed test files PASS.

- [ ] **Step 7: Commit launch flow**

```powershell
git add src/sim/data.ts src/main.ts src/client/hud.ts src/client/record.ts src/server/server.ts tests/science-flow.test.ts
git commit -m "feat: launch science missions from the war"
```

---

### Task 7: Harness Verification, Documentation, and Full Gates

**Files:**
- Modify: `src/harness/harness.ts` only if Building Lab needs explicit science site entries
- Modify: `docs/SCIENCE-MISSIONS.md`
- Modify: `docs/STATUS.md` or `docs/SHIPPING-LOG.md` following the repository's current shipped-feature convention
- Modify: plan checkboxes in `docs/superpowers/plans/2026-07-21-science-missions.md`

**Interfaces:**
- Produces no new runtime API; validates and documents the shipped contract.

- [ ] **Step 1: Run the focused complete science suite**

Run: `npx vitest run tests/science-generator.test.ts tests/science-map.test.ts tests/science-runtime.test.ts tests/science-campaign.test.ts tests/science-presentation.test.ts tests/science-flow.test.ts`

Expected: all science tests PASS with zero failures.

- [ ] **Step 2: Verify Building Lab and live game**

Run the Vite app, inspect at least clone vault, officer villa, and quarantine zone in Building Lab or a science selector, then drive `window.__ww` through:

- a death/reprint with clone pips decrementing at the field printer;
- a villa objective upstairs and extraction downstairs;
- an infiltrate alarm transition;
- final-clone mission failure;
- one successful operation producing a campaign dispatch and Courier issue.

Record exact observations and any fixes in the shipping log. Any discovered bug first receives a failing regression test.

- [ ] **Step 3: Update the locked science document with shipped behavior**

Mark the production slice shipped, list controls and campaign window rules, describe the configurable failure policy, and distinguish implemented rewards from future catalog expansion without vague placeholders.

- [ ] **Step 4: Run all four fresh repository gates**

```powershell
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: all commands exit 0; Vitest reports zero failing files/tests; lint reports zero errors; Vite emits the bundle.

- [ ] **Step 5: Review requirements and repository diff**

Run:

```powershell
git diff --check
git status --short
git log --oneline -10
```

Confirm all ten verbs/sites, clone loop, maps, doors/floors, pedestrians, scripts, campaign, rewards, and Courier are represented by code and tests. Confirm no unrelated main-worktree files are present.

- [ ] **Step 6: Commit final verification/docs slice**

```powershell
git add docs/SCIENCE-MISSIONS.md docs/SHIPPING-LOG.md docs/superpowers/plans/2026-07-21-science-missions.md src/harness/harness.ts
git commit -m "docs: ship science missions"
```

Omit any unchanged path from the `git add` command. Do not push.
