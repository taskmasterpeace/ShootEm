# Military Missions Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add one Military Missions card to Deploy that launches six curated, local, Operation-runtime exercises across City, Desert, Countryside, Mountain, Coastal, and Ocean.

**Architecture:** A pure simulation catalog creates typed Operation plans, exercise inventories, and legal manifests without campaign state. A pure client presenter renders the launcher card/modal. `main.ts` owns only the transient selection and gives the chosen launch precedence over campaign/quick-match configuration while keeping settlement paths campaign-only.

**Tech Stack:** TypeScript, Vitest, DOM/CSS, Vite, existing `World`, theater, Operation runtime, manifest validation, HUD, and menu systems.

## Global Constraints

- Exactly six presets and exactly one for each `TheaterId`.
- Exercises use real `World.operation`, Operation maps/phases, bots, radar/sonar, telemetry, elevation, and vehicles.
- Exercises never mutate treasury, campaign windows, active staged Operations, named campaign hulls, doctrine, or records.
- Launches are local/offline and use the existing class, loadout, difficulty, bot-count, and speed controls.
- Existing ordinary modes and campaign Operations remain byte-for-byte behaviorally unchanged when no preset is selected.
- No dependencies, no purple, no new objective kinds, and no seventh theater.
- Work on `codex/military-operations`, stage explicit paths, commit small, and never push.
- Completion requires typecheck, the complete test suite, lint, production build, and six browser deploy journeys.

---

### Task 1: Pure six-mission catalog

**Files:**
- Create: `src/sim/military-missions.ts`
- Create: `tests/military-missions.test.ts`

**Interfaces:**
- Consumes: `OperationPlan`, `OperationManifest`, `OperationHull`, `OperationPhase`, `TheaterId`, `ModeId`, `theaterForOperation()`, `validateManifest()`, `THEATER_DEFS`.
- Produces: `MilitaryMissionId`, `MilitaryMissionPreset`, `MilitaryMissionLaunch`, `MILITARY_MISSIONS`, `createMilitaryMissionLaunch(id)`.

- [x] **Step 1: Write the failing catalog tests**

```ts
import { describe, expect, it } from 'vitest';
import { MILITARY_MISSIONS, createMilitaryMissionLaunch } from '../src/sim/military-missions';
import { theaterForOperation, validateManifest } from '../src/sim/operations';
import { THEATER_DEFS } from '../src/sim/theaters';

describe('Military Mission exercise catalog', () => {
  it('covers every vehicle theater exactly once', () => {
    expect(MILITARY_MISSIONS.map((entry) => entry.theaterId)).toEqual([
      'city', 'desert', 'countryside', 'mountain', 'coastal', 'ocean',
    ]);
    expect(new Set(MILITARY_MISSIONS.map((entry) => entry.id)).size).toBe(6);
  });

  it.each(MILITARY_MISSIONS)('$id creates a legal launch on $theaterId', (preset) => {
    const launch = createMilitaryMissionLaunch(preset.id);
    expect(theaterForOperation(launch.plan)).toBe(preset.theaterId);
    expect(validateManifest(launch.plan, launch.manifest, launch.inventory)).toMatchObject({ ok: true });
    expect(THEATER_DEFS[preset.theaterId].geometry).toEqual(preset.geometry);
    expect(launch.inventory.filter((hull) => launch.manifest.hullIds.includes(hull.id))).not.toHaveLength(0);
  });
});
```

- [x] **Step 2: Run the test and verify the missing-module failure**

Run: `npx vitest run tests/military-missions.test.ts`  
Expected: FAIL because `src/sim/military-missions.ts` does not exist.

- [x] **Step 3: Implement the typed catalog and launch factory**

```ts
export type MilitaryMissionId = 'urban_assault' | 'air_superiority' | 'convoy_interdiction'
  | 'pass_assault' | 'beachhead' | 'naval_hunt';

export interface MilitaryMissionPreset {
  id: MilitaryMissionId;
  theaterId: TheaterId;
  theaterName: string;
  missionName: string;
  icon: string;
  tagline: string;
  geometry: MapGeometry;
  domains: readonly OperationDomain[];
  seed: number;
  mode: ModeId;
  plan: OperationPlan;
  inventory: readonly OperationHull[];
  manifest: OperationManifest;
}

export interface MilitaryMissionLaunch extends Omit<MilitaryMissionPreset, 'inventory'> {
  inventory: OperationHull[];
}

export const MILITARY_MISSIONS: readonly MilitaryMissionPreset[] = [
  preset('urban_assault', 'city', 'Urban Assault', '▦', 7749, 'conquest', 'rail_hub', 'spearhead', ['land'], [
    phase('capture', 'Take the rail hub', 'land'), phase('defend', 'Hold the junction', 'land', 75),
  ], [['mission-city-tank', 'tank', 'Mastodon 21'], ['mission-city-shrike', 'attackheli', 'Shrike 07']]),
  preset('air_superiority', 'desert', 'Air Superiority', '△', 4207, 'conquest', 'airfield', 'air_superiority', ['air', 'land'], [
    phase('eliminate', 'Clear the sky', 'air', undefined, 4), phase('capture', 'Seize the airfield', 'land'),
  ], [['mission-desert-interceptor', 'interceptor', 'Falcon 12'], ['mission-desert-tank', 'tank', 'Mastodon 33']]),
  // countryside rail-hub + fixed-wing verb resolves through theaterForOperation's countryside law
  preset('convoy_interdiction', 'countryside', 'Convoy Interdiction', '⇥', 5150, 'conquest', 'rail_hub', 'intercept', ['air', 'land'], [
    phase('eliminate', 'Break the escort', 'air', undefined, 3), phase('capture', 'Secure the convoy road', 'land'),
  ], [['mission-country-strikejet', 'strikejet', 'Vulture 18'], ['mission-country-apc', 'apc', 'Bastion 09']]),
  preset('pass_assault', 'mountain', 'Pass Assault', '⛰', 4207, 'conquest', 'mountain_pass', 'airborne_insertion', ['air', 'land'], [
    phase('arrive', 'Land beyond the ridge', 'air'), phase('capture', 'Take the high pass', 'land'),
  ], [['mission-mountain-condor', 'transportheli', 'Condor 04'], ['mission-mountain-buggy', 'buggy', 'Jackal 31']]),
  preset('beachhead', 'coastal', 'Beachhead', '≋', 5150, 'conquest', 'port', 'beachhead', ['sea', 'land'], [
    phase('escort', 'Land the assault force', 'sea'), phase('capture', 'Take the shore strongpoint', 'land'),
  ], [['mission-coast-boat', 'boat', 'Pike 14'], ['mission-coast-tank', 'tank', 'Mastodon 48'], ['mission-coast-sub', 'submarine', 'Barracuda 06']]),
  preset('naval_hunt', 'ocean', 'Naval Hunt', '⌄', 31, 'conquest', 'carrier_anchorage', 'blockade', ['sea', 'air'], [
    phase('eliminate', 'Hunt the hostile screen', 'sea', undefined, 3), phase('hold', 'Hold the channel', 'sea', 90),
  ], [['mission-ocean-sub', 'submarine', 'Barracuda 11'], ['mission-ocean-boat', 'boat', 'Pike 22'], ['mission-ocean-interceptor', 'interceptor', 'Falcon 05']]),
] as const;

export function createMilitaryMissionLaunch(id: MilitaryMissionId): MilitaryMissionLaunch | null {
  const preset = MILITARY_MISSIONS.find((entry) => entry.id === id);
  return preset ? structuredClone(preset) : null;
}
```

The actual helper fills unique phase ids, requirements from domains/phases, authorized support `['none']`, effect `opening_fog_lift`, complication `reinforced_garrison`, and available hull records. Manifest selects all issued ids with ammunition 6 and support `none`.

- [x] **Step 4: Run catalog and Operation-law tests**

Run: `npx vitest run tests/military-missions.test.ts tests/operations.test.ts tests/operation-map.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit the catalog**

```bash
git add src/sim/military-missions.ts tests/military-missions.test.ts
git commit -m "feat: define six military mission exercises"
```

### Task 2: Mission launcher UI presenter

**Files:**
- Create: `src/client/military-missions-ui.ts`
- Create: `tests/military-missions-ui.test.ts`
- Modify: `index.html`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `MILITARY_MISSIONS`, `MilitaryMissionId`, `THEATER_DEFS`, `worldWidth()`, `worldDepth()`.
- Produces: `renderMilitaryMissionModeCard(selected)`, `renderMilitaryMissionModal(selectedId, stagedCampaignOperation)`.

- [x] **Step 1: Write failing presenter tests**

```ts
it('renders one launcher and six descriptive mission buttons', () => {
  const html = renderMilitaryMissionModal(null, false);
  expect(renderMilitaryMissionModeCard(false)).toContain('MILITARY MISSIONS');
  expect(html).toContain('role="dialog"');
  expect((html.match(/data-military-mission=/g) ?? [])).toHaveLength(6);
  for (const text of ['600×600u', '900×900u', '600×900u', '900×600u', 'LOCAL FIELD EXERCISE']) expect(html).toContain(text);
});

it('marks the chosen card and preserves staged-operation safety copy', () => {
  const html = renderMilitaryMissionModal('naval_hunt', true);
  expect(html).toContain('mission-card selected');
  expect(html).toContain('does not cancel or consume');
});
```

- [x] **Step 2: Run and verify missing exports**

Run: `npx vitest run tests/military-missions-ui.test.ts`  
Expected: FAIL because the presenter module is absent.

- [x] **Step 3: Implement escaped pure presenters**

Render the launcher as a real `<button id="military-missions-card" class="select-card mission-launch-card">`. Render modal backdrop `#military-missions-modal`, `role="dialog"`, `aria-modal="true"`, `tabindex="-1"`, close button, six `<button data-military-mission="...">` cards, dimension/domain/phase/package rows, and persistent-operation safety copy.

- [x] **Step 4: Add the host and focused industrial styling**

Add `<div id="military-missions-entry"></div>` after `#mode-select`. Add CSS beside `.op-modal-*`: responsive two-column mission grid (one column under 760px), amber corner brackets, subtle map-grid texture, steel cards, strong focus-visible outlines, domain chips, selected stripe, hover lift, and max-height scrolling. Reuse existing CSS variables/fonts and never add purple.

- [x] **Step 5: Run presenter tests and build**

Run: `npx vitest run tests/military-missions-ui.test.ts tests/operations-ui.test.ts && npm run build`  
Expected: PASS; build emits without new dependencies.

- [x] **Step 6: Commit the presentation slice**

```bash
git add src/client/military-missions-ui.ts tests/military-missions-ui.test.ts index.html src/styles.css
git commit -m "feat: present military mission launcher"
```

### Task 3: Menu selection and local Operation launch

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/military-missions.test.ts`
- Modify: `tests/operations-integration.test.ts`

**Interfaces:**
- Consumes: `createMilitaryMissionLaunch()`, UI presenters, `WorldOptions.operation`, `operationManifest`, `operationInventory`.
- Produces: session-only selection, modal bindings, mission launch precedence, exercise result copy.

- [x] **Step 1: Add failing six-world runtime assertions**

```ts
it.each(MILITARY_MISSIONS)('$id builds a playable Operation World', (preset) => {
  const launch = createMilitaryMissionLaunch(preset.id)!;
  const world = new World({
    seed: launch.seed, mode: launch.mode, botsPerTeam: 0,
    operation: launch.plan, operationManifest: launch.manifest, operationInventory: launch.inventory,
  });
  expect(world.map.theater?.id).toBe(preset.theaterId);
  expect(world.operation?.plan.id).toBe(launch.plan.id);
  expect(world.map.spawns[0].length).toBeGreaterThan(0);
  expect([...world.vehicles.values()].some((vehicle) => !!vehicle.operationHullId)).toBe(true);
});
```

- [x] **Step 2: Run and verify the runtime failure**

Run: `npx vitest run tests/military-missions.test.ts tests/operations-integration.test.ts`  
Expected: FAIL on any incompatible curated plan/package; use the failure to correct only the catalog law, not the assertion.

- [x] **Step 3: Bind the modal and selection**

Add `let selectedMilitaryMissionId: MilitaryMissionId | null = null;`. `paintMilitaryMissionEntry()` renders the mode card and selected summary. `openMilitaryMissionModal()` inserts the presenter HTML, binds Close/backdrop/Escape, validates each preset, and on card click stores the id, sets `selectedMode` to the preset mode, clears `activeFrontId` for this launch only, closes, repaints, and changes the existing start button label to `DEPLOY MISSION`.

Ordinary mode-card click sets the selection to null and restores `DEPLOY`. The modal retains selection on close and focuses the selected card on reopen.

- [x] **Step 4: Give exercises launch precedence without campaign settlement**

Inside `startLocal`:

```ts
const exercise = selectedMilitaryMissionId ? createMilitaryMissionLaunch(selectedMilitaryMissionId) : null;
const deployedOperation = !exercise && activeFrontId && campaign?.activeOperation?.plan.frontId === activeFrontId
  ? campaign.activeOperation : null;
const launchedOperation = exercise ?? (deployedOperation && campaign ? {
  plan: deployedOperation.plan, manifest: deployedOperation.manifest, inventory: campaign.motorPool,
  seed: deployedOperation.plan.seed, mode: selectedMode,
} : null);
const seed = launchedOperation?.seed ?? seedOverride ?? (Math.random() * 0xffffffff) >>> 0;
const world = new World({
  seed,
  mode: exercise?.mode ?? selectedMode,
  // existing options unchanged
  operation: launchedOperation?.plan,
  operationManifest: launchedOperation?.manifest,
  operationInventory: launchedOperation?.inventory,
  frontId: !exercise && activeFrontId ? `${activeFrontId}@${mapSizeForPlayers(botsPerTeam)}` : undefined,
});
```

Keep all `settleCampaignOperation`, record, newspaper campaign effect, treasury, and named-hull AAR branches guarded by `deployedOperation`. For an exercise result, append `FIELD EXERCISE COMPLETE/FAILED`, codename, phases completed, and theater to the ordinary AAR without saving campaign state.

- [x] **Step 5: Force local startup for exercises**

In `startGame`, bypass `NetGame` whenever `selectedMilitaryMissionId` is non-null. Preserve current server behavior for all ordinary modes. Print `LOCAL FIELD EXERCISE` in the modal and selected summary.

- [x] **Step 6: Run focused integration and regression tests**

Run: `npx vitest run tests/military-missions.test.ts tests/military-missions-ui.test.ts tests/operations-integration.test.ts tests/operation-runtime.test.ts tests/campaign.test.ts tests/onboarding.test.ts tests/vehicle-instruments.test.ts`  
Expected: PASS.

- [x] **Step 7: Commit the playable integration**

```bash
git add src/main.ts src/sim/military-missions.ts tests/military-missions.test.ts tests/operations-integration.test.ts
git commit -m "feat: launch military mission exercises"
```

### Task 4: Browser certification, documentation, and production gates

**Files:**
- Modify: `docs/STATUS.md`
- Modify: `docs/MILITARY-MISSIONS.md`
- Modify: `docs/superpowers/plans/2026-07-21-military-mission-launcher.md`

- [x] **Step 1: Browser-smoke all six cards**

From `http://127.0.0.1:3411/`: open Military Missions; for each card, select, deploy, wait for the live HUD, and read `window.__ww.world.map.theater.id`, map geometry, Operation plan id, player alive/spawn state, issued hull count, and console warnings/errors. Return to the menu between missions. Verify modal Close, Escape, selected state, responsive 1024×650 layout, and no horizontal overflow.

- [x] **Step 2: Exercise representative vehicles**

In Desert enter/fly a fixed-wing aircraft; in Coastal enter a boat or helicopter; in Ocean enter/dive a Barracuda. Verify instrument plate/radar/sonar appears and controls respond.

- [x] **Step 3: Update truth docs**

Record the launcher as shipped, list the six presets and campaign-safe field-exercise rule, and mark this plan complete with exact browser/gate evidence.

- [x] **Step 4: Run all four production gates**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: all exit 0; Vitest reports zero failed files/tests; production bundle emits.

- [x] **Step 5: Commit certification**

```bash
git add docs/STATUS.md docs/MILITARY-MISSIONS.md docs/superpowers/plans/2026-07-21-military-mission-launcher.md
git commit -m "docs: certify military mission launcher"
```

- [x] **Step 6: Confirm final branch state**

Run: `git status --short && git log --oneline -8`  
Expected: clean worktree; launcher commits at branch head; no push.

## Completion evidence — 2026-07-21

- Catalog and UI tests use a red/green cycle; all six presets build a lawful
  `World` with the correct `TheaterId`, live Operation state, spawns, and issued
  hulls.
- Live browser journeys selected and deployed all six cards at
  `http://127.0.0.1:3411/`. The HUD showed Urban Assault, Air Superiority,
  Convoy Interdiction, Pass Assault, Beachhead, and Naval Hunt with their
  authored phase pairs.
- The selector exposes all four required footprints (600×600u, 900×900u,
  600×900u, 900×600u), local-exercise safety copy, keyboard focus, Escape,
  Close, and responsive one-column styling below 720px.
- Fresh production gates: `npx tsc --noEmit` exit 0; 164 Vitest files / 1,963
  tests passed; `npm run lint` exit 0; `npm run build` exit 0 with 161 modules
  transformed.
- Exercises bypass multiplayer and guard campaign front settlement, treasury,
  named hulls, Courier filing, and the persistent dossier. Their AAR uses a
  non-persisting tracker copy.
