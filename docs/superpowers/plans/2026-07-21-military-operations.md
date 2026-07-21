# Military Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship deterministic Military Operations from Scar selection and manifest procurement through playable objectives, persistent losses/rewards, and after-action reporting.

**Architecture:** One serializable `OperationPlan` drives both small procedural skirmishes and dressed authored fronts. A pure runtime state machine observes world facts and emits typed events; pure campaign settlement applies the result once to treasury, motor pool, facilities, front state, dossier, and press.

**Tech Stack:** TypeScript 5.6, Vitest 2.1, Three.js 0.170, Vite 6, DOM/CSS, localStorage JSON saves.

## Global Constraints

- Work only in `D:/git/ShootEM/.claude/worktrees/military-operations` on `codex/military-operations`.
- Keep simulation deterministic from explicit seeds; no `Math.random()` or wall-clock reads in sim modules.
- Preserve byte-equivalent behavior when `WorldOptions.operation` is absent.
- Use the shipped Pike boat and flyer/gunship; carriers and submarines are strategic effects, not playable hulls.
- Hull losses and facilities persist through the current season and reset at armistice.
- Preserve and migrate existing campaign saves.
- Follow the existing steel/amber UI language; introduce no purple.
- Stage files by exact name and make small commits without co-author trailers.
- Completion requires `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.

---

### Task 1: Operation catalog, generator, and manifest rules

**Files:**
- Create: `src/sim/operations.ts`
- Create: `tests/operations.test.ts`

**Interfaces:**
- Produces: `OperationDomain`, `OperationVerbId`, `OperationSiteId`, `OperationComplicationId`, `OperationEffectId`, `OperationScale`, `OperationPlan`, `OperationManifest`, `generateOperation(input)`, `validateManifest(plan, manifest, inventory)`, `manifestCost(manifest)`, and `commitmentFor(plan, manifest)`.
- Consumes: `FrontDef` data values and existing `VehicleKind`.

- [ ] **Step 1: Write catalog and deterministic-generation failures**

Create tests that assert exact catalog cardinality, unique IDs, compatibility, pass escalation, and repeatability:

```ts
expect(OPERATION_VERBS).toHaveLength(15);
expect(OPERATION_SITES).toHaveLength(10);
expect(OPERATION_COMPLICATIONS).toHaveLength(7);
expect(OPERATION_EFFECTS).toHaveLength(50);
expect(new Set(OPERATION_EFFECTS.map((x) => x.id)).size).toBe(50);
expect(generateOperation(input)).toEqual(generateOperation(input));
expect(generateOperation({ ...input, pass: 1 }).domains).toHaveLength(1);
expect(generateOperation({ ...input, pass: 2 }).domains.length).toBeGreaterThanOrEqual(2);
```

- [ ] **Step 2: Run the focused tests and confirm the missing-module failure**

Run: `npx vitest run tests/operations.test.ts`

Expected: FAIL because `../src/sim/operations` does not exist.

- [ ] **Step 3: Implement the typed catalogs and generator**

Define the stable public contract:

```ts
export interface OperationPlan {
  id: string;
  seed: number;
  frontId: string;
  pass: 1 | 2 | 3;
  scale: 'skirmish' | 'standard' | 'large';
  verb: OperationVerbId;
  domains: OperationDomain[];
  site: OperationSiteId;
  complication: OperationComplicationId;
  effect: OperationEffectId;
  codename: string;
  briefing: string;
  phases: OperationPhase[];
  launchCost: number;
  requirements: Partial<Record<OperationDomain, number>>;
}

export interface OperationManifest {
  hullIds: string[];
  ammunition: number;
  support: 'none' | 'artillery' | 'cas';
}
```

Use `Rng` for every weighted choice. Give each verb explicit compatible domains/sites and phase factories. Reject no valid seed: filter compatible choices before selecting. Generate the Operation ID from front, pass, and unsigned seed.

- [ ] **Step 4: Add manifest validation and commitment scoring tests**

Cover missing domain hulls, duplicate/stale hull IDs, insufficient ammunition, unavailable support, exact cost, and Light/Balanced/Heavy thresholds. Use inventory fixtures with one tank, Falcon, Vulture, Anvil, flyer, and Pike.

- [ ] **Step 5: Implement manifest math and run tests**

`validateManifest` returns `{ ok: boolean; errors: string[]; cost: number; commitment: 'light' | 'balanced' | 'heavy' }`. Price from existing `VEHICLES[kind].cost`, ammunition, and support. Requirements are satisfied by `LAND_KINDS`, `AIR_KINDS`, and `SEA_KINDS` sets.

Run: `npx vitest run tests/operations.test.ts`

Expected: PASS with all catalog and manifest assertions green.

- [ ] **Step 6: Commit the domain slice**

```powershell
git add src/sim/operations.ts tests/operations.test.ts
git commit -m "feat: add military operation generator"
```

---

### Task 2: Operation-shaped maps at both scales

**Files:**
- Create: `src/sim/operation-map.ts`
- Modify: `src/sim/map.ts`
- Modify: `src/sim/skirmish.ts`
- Modify: `src/sim/mapedit.ts`
- Modify: `src/harness/mapmaker.ts`
- Create: `tests/operation-map.test.ts`

**Interfaces:**
- Consumes: `OperationPlan`, `OperationManifest`, `generateSkirmishMap`, `generateFront`, `validateDoc`.
- Produces: `OperationMapObjective`, optional `GameMap.operation`, and `generateOperationMap(plan, manifest): GameMap`.

- [ ] **Step 1: Write lawful-map failures across sites, scales, and seeds**

Generate every site at seeds `7`, `42`, `1337`, and `90210`; assert `validateDoc` passes, objectives exist in phase order, required vehicle pads exist, and output is deterministic.

```ts
const map = generateOperationMap(plan, manifest);
expect(validateDoc(asDoc(map)).ok).toBe(true);
expect(map.operation?.objectives.map((x) => x.phaseId)).toEqual(plan.phases.map((x) => x.id));
expect(Buffer.from(map.grid)).toEqual(Buffer.from(generateOperationMap(plan, manifest).grid));
```

- [ ] **Step 2: Run the focused map tests and confirm failure**

Run: `npx vitest run tests/operation-map.test.ts`

Expected: FAIL because `operation-map.ts` and `GameMap.operation` do not exist.

- [ ] **Step 3: Add serializable map objective metadata**

Add to `GameMap`:

```ts
operation?: {
  operationId: string;
  objectives: Array<{
    id: string;
    phaseId: string;
    kind: 'capture' | 'hold' | 'destroy' | 'escort' | 'arrive' | 'defend';
    pos: Vec3;
    radius: number;
    targetPropIndex?: number;
  }>;
  protectedZones: Array<{ pos: Vec3; radius: number }>;
};
```

Update map serialization/editor cloning so metadata survives copy/import/export.

- [ ] **Step 4: Implement small skirmish site profiles**

Extend `generateSkirmishMap(theme, seed, profile?)` with an optional profile containing site, domains, objective labels, and manifest vehicle kinds. Preserve exact legacy output when `profile` is absent. Replace the fixed LSW-den objective only for Operation calls.

- [ ] **Step 5: Implement authored-front dressing**

Map sites to mature grounds: front line→Eastern Plains, strongpoint→Fort Raven, crossing→Bridge Delta, depot→Refinery, rail hub→The City, airfield→Airbase, coastal battery/port/anchorage→The Port, mountain pass→Highland Pass. Clone typed arrays and arrays before dressing. Create phase markers on existing control points and place only manifest hull pads plus defender counters appropriate to domains.

- [ ] **Step 6: Run map and regression tests**

Run: `npx vitest run tests/operation-map.test.ts tests/skirmish.test.ts tests/mapedit.test.ts tests/fronts.test.ts`

Expected: PASS; legacy skirmish snapshots/laws remain green.

- [ ] **Step 7: Commit the map slice**

```powershell
git add src/sim/operation-map.ts src/sim/map.ts src/sim/skirmish.ts src/sim/mapedit.ts src/harness/mapmaker.ts tests/operation-map.test.ts
git commit -m "feat: build operation mission grounds"
```

---

### Task 3: Fifteen-verb objective runtime

**Files:**
- Create: `src/sim/operation-runtime.ts`
- Modify: `src/sim/types.ts`
- Modify: `src/sim/world.ts`
- Create: `tests/operation-runtime.test.ts`

**Interfaces:**
- Consumes: `OperationPlan`, `GameMap.operation`, soldiers, vehicles, props, projectiles, weather, and LSW calls from `World`.
- Produces: `OperationRuntimeState`, `OperationResult`, `stepOperation(world, dt)`, and `operation_*` `SimEvent` variants.

- [ ] **Step 1: Write one success and one failure scenario per verb**

Use flat deterministic fixtures and direct world state changes. Assert the exact phase transition and terminal result for all 15 verbs. Include sequential Beachhead/Hammer/Anvil Drop and parallel Choke phases.

- [ ] **Step 2: Write complication tests**

Assert storm/night initialization, denied support, defending LSW spawn request, reinforcement deadline, scorched-earth target destruction, collateral treasury penalty facts, and critical-airframe failure.

- [ ] **Step 3: Run the focused runtime tests and confirm failure**

Run: `npx vitest run tests/operation-runtime.test.ts`

Expected: FAIL because the runtime module and Operation world option do not exist.

- [ ] **Step 4: Implement the pure runtime state machine**

Use this terminal contract:

```ts
export interface OperationResult {
  operationId: string;
  won: boolean;
  completedPhaseIds: string[];
  destroyedHullIds: string[];
  survivingHullIds: string[];
  collateral: number;
  elapsed: number;
  cleanSheet: boolean;
}
```

Every phase adapter returns progress from observable world state. `stepOperation` advances completed phases, emits one transition event, and emits one terminal event guarded by `state.result === null`.

- [ ] **Step 5: Wire the runtime into World without changing normal matches**

Add `operation?: OperationPlan` and `operationManifest?: OperationManifest` to `WorldOptions`; call `generateOperationMap` instead of the normal map path when present; initialize/step runtime only when active. Add typed events used by HUD and tests.

- [ ] **Step 6: Run runtime and broad sim regression tests**

Run: `npx vitest run tests/operation-runtime.test.ts tests/sim.test.ts tests/airwar.test.ts tests/antiair.test.ts tests/requisition.test.ts tests/weather.test.ts`

Expected: PASS; non-Operation worlds have no Operation state/events.

- [ ] **Step 7: Commit the runtime slice**

```powershell
git add src/sim/operation-runtime.ts src/sim/types.ts src/sim/world.ts tests/operation-runtime.test.ts
git commit -m "feat: run military operation objectives"
```

---

### Task 4: Campaign treasury, motor pool, windows, and settlement

**Files:**
- Modify: `src/client/campaign.ts`
- Modify: `tests/campaign.test.ts`
- Create: `tests/operation-settlement.test.ts`
- Modify: `src/server/server.ts`

**Interfaces:**
- Consumes: `OperationPlan`, `OperationManifest`, `OperationResult`, `VehicleKind`.
- Produces: `MotorPoolHull`, `OperationWindow`, `CampaignModifier`, `stageCampaignOperation`, `cancelCampaignOperation`, `settleCampaignOperation`, and v1→v2 migration.

- [ ] **Step 1: Write migration and fresh-state failures**

Assert a v1 fixture migrates with control/clones/pass intact; fresh campaigns receive treasury, named hulls across all shipped Operation kinds, empty facilities/modifiers, and one unconsumed window for each front/pass.

- [ ] **Step 2: Write transaction failures**

Cover launch reservation/cost, insufficient treasury, exhausted windows, cancellation returning reservations, success/failure settlement, lost versus returned hulls, facility persistence, clean-sheet payout, and duplicate settlement no-op.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npx vitest run tests/campaign.test.ts tests/operation-settlement.test.ts`

Expected: FAIL on missing campaign fields/functions.

- [ ] **Step 4: Implement versioned campaign state and migration**

Persist `v: 2`, `treasury`, `motorPool`, `facilities`, `modifiers`, `operationWindows`, `activeOperation`, `operationHistory`, and `fiscalEfficiency`. Loader validation keeps valid v1 data and reconstructs missing derived records deterministically.

- [ ] **Step 5: Implement stage/cancel/settle transactions**

Stage validates the manifest, reserves hull IDs, charges launch cost, and records the immutable plan. Settlement checks ID and settled history, consumes the correct pass window, updates hull service/loss state, applies effect dispatch, and clears the active record. Return a structured receipt used by UI and press.

- [ ] **Step 6: Apply all 50 effect IDs**

Group effect handlers by territory, facility, materiel, control, and doctrine/intel. Numeric effects update explicit fields; future-battle effects create typed `CampaignModifier` records with `scope`, `uses`, and value. No effect may resolve to flavor text alone.

- [ ] **Step 7: Reset seasonal state at armistice**

Replenish the motor pool, clear facilities/modifiers/windows/active Operation, preserve Operation history and Fiscal Efficiency career totals, and increment the season exactly once.

- [ ] **Step 8: Run campaign, War Room, and ledger tests**

Run: `npx vitest run tests/campaign.test.ts tests/operation-settlement.test.ts tests/warroom.test.ts tests/warledger.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit the strategy slice**

```powershell
git add src/client/campaign.ts src/server/server.ts tests/campaign.test.ts tests/operation-settlement.test.ts
git commit -m "feat: persist operation strategy consequences"
```

---

### Task 5: Apply campaign modifiers to battle setup

**Files:**
- Modify: `src/sim/world.ts`
- Modify: `src/main.ts`
- Create: `tests/operation-effects.test.ts`

**Interfaces:**
- Consumes: staged Operation, facilities, and `CampaignModifier[]`.
- Produces: `OperationBattleBonuses` passed through `WorldOptions` and consumed once where applicable.

- [ ] **Step 1: Write effect-consumption failures**

Assert cheaper requisition, opening purse, air denial, early warning, fog lift, forward spawn, repair/rearm pads, SAM cover, CAS/escort, artillery, hazards, and captured vehicle availability alter the exact World/map field they promise.

- [ ] **Step 2: Run the effect tests and confirm failure**

Run: `npx vitest run tests/operation-effects.test.ts`

Expected: FAIL because battle bonuses are not wired.

- [ ] **Step 3: Implement one typed battle-bonus adapter**

Convert campaign facilities/modifiers into a serializable `OperationBattleBonuses` before constructing World. Consume bonuses at existing single doors: initial materiel, vehicle pads, weather/fog, automatic AA, map objective dressing, requisition price, and off-map support.

- [ ] **Step 4: Run effect and regression tests**

Run: `npx vitest run tests/operation-effects.test.ts tests/finish-list.test.ts tests/antiair.test.ts tests/weather.test.ts tests/requisition.test.ts tests/frostbridge.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the effects slice**

```powershell
git add src/sim/world.ts src/main.ts tests/operation-effects.test.ts
git commit -m "feat: apply operation rewards to battles"
```

---

### Task 6: Scar Operations board and manifest modal

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/main.ts`
- Create: `src/client/operations-ui.ts`
- Create: `tests/operations-ui.test.ts`

**Interfaces:**
- Consumes: campaign state, generated Operation cards, motor pool, `validateManifest`, and stage/cancel functions.
- Produces: `renderOperationsBoard(model)`, `renderManifestDialog(model)`, and a validated staged Operation used by deploy.

- [ ] **Step 1: Write DOM-rendering and interaction failures**

Using the repository's DOM test pattern, assert front selection reveals a card, exhausted windows disable it, the modal lists named available hulls, domain errors are visible, commitment/cost update, Escape closes, and a valid launch stages the exact plan/manifest.

- [ ] **Step 2: Run the UI tests and confirm failure**

Run: `npx vitest run tests/operations-ui.test.ts`

Expected: FAIL because `operations-ui.ts` does not exist.

- [ ] **Step 3: Build the board and modal**

Keep DOM rendering isolated in `operations-ui.ts`; inject callbacks for stage/cancel so tests need no storage. Use semantic buttons/dialog labels, keyboard focus, and escaped mission text. Display briefing, domains, site, complication, reward, launch cost, and window state.

- [ ] **Step 4: Wire staging and deploy**

The Map tab owns selection. `DEPLOY OPERATION` sets `activeFrontId`, builds World with the staged plan/manifest/bonuses, and prevents generic lobby controls from silently changing its required scale or mode. Canceling returns reserved hulls.

- [ ] **Step 5: Add War World visual treatment**

Use steel cards, amber accents, `0.625rem` radii, focus-visible rings, hover elevation, responsive two-column-to-one-column layout, and a modal overlay. Reuse Inter/system fallbacks and existing CSS variables where present.

- [ ] **Step 6: Run UI and campaign tests**

Run: `npx vitest run tests/operations-ui.test.ts tests/campaign.test.ts tests/operation-settlement.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the Operations board**

```powershell
git add index.html src/styles.css src/main.ts src/client/operations-ui.ts tests/operations-ui.test.ts
git commit -m "feat: add operation planning board"
```

---

### Task 7: Objective HUD, after-action report, press, and vehicle records

**Files:**
- Modify: `src/client/hud.ts`
- Modify: `src/client/record.ts`
- Modify: `src/client/newspaper.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Create: `tests/operation-hud.test.ts`
- Create: `tests/operation-record.test.ts`

**Interfaces:**
- Consumes: Operation sim events, `OperationResult`, settlement receipt, and named hull records.
- Produces: current objective presentation, after-action itemization, vehicle ace history, Fiscal Efficiency, Command Certification, and Courier Operation facts.

- [ ] **Step 1: Write HUD and record failures**

Assert the current/next phase, progress, timer, and complication appear only during Operations. Assert result rendering itemizes committed/returned/lost hulls and payout. Simulate a named tank destroying tank/boat/aircraft targets and verify kills by target kind, sortie count, clean sheet, and certification progress persist.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/operation-hud.test.ts tests/operation-record.test.ts`

Expected: FAIL on missing Operation presentation and dossier fields.

- [ ] **Step 3: Implement the event-driven HUD**

Add one compact objective stack updated by `operation_phase`, `operation_progress`, and `operation_complete` events. Do not poll DOM from sim state. Announce phase changes once and surface failure reasons in plain language.

- [ ] **Step 4: Persist hull and officer records**

Extend dossier migration with Operation totals, clean sheets, efficiency, certification progress, and vehicle-ace summaries. Fold target vehicle kinds from combat events into the committed hull record during settlement.

- [ ] **Step 5: Extend after-action and Courier facts**

Pass structured Operation facts to newspaper generation: codename, site, outcome, hulls lost, ace hull, objectives, and reward. Produce faction-spin headlines without storing HTML.

- [ ] **Step 6: Run focused and regression tests**

Run: `npx vitest run tests/operation-hud.test.ts tests/operation-record.test.ts tests/record.test.ts tests/press-corrections.test.ts tests/blackbox.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the presentation slice**

```powershell
git add src/client/hud.ts src/client/record.ts src/client/newspaper.ts src/main.ts src/styles.css tests/operation-hud.test.ts tests/operation-record.test.ts
git commit -m "feat: report operation objectives and records"
```

---

### Task 8: Integration hardening, documentation, and production verification

**Files:**
- Modify: `docs/META-LAYER.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/MAP-STRATEGY.md`
- Modify: `docs/MILITARY-MISSIONS.md`
- Modify: feature files only when verification exposes a defect
- Create: `tests/operations-integration.test.ts`

**Interfaces:**
- Consumes: the complete feature.
- Produces: end-to-end evidence, current documentation, and a clean production branch.

- [ ] **Step 1: Add end-to-end headless journeys**

Test one Pass-1 land skirmish and one Pass-2 Beachhead from generation through map, runtime result, campaign settlement, next-battle modifier, and idempotent reload. Assert each moves front/treasury/motor-pool/facility values exactly once.

- [ ] **Step 2: Run integration tests and repair only evidenced defects**

Run: `npx vitest run tests/operations-integration.test.ts`

Expected: PASS after integration corrections.

- [ ] **Step 3: Update living documentation**

Mark Military Operations shipped with exact file/test evidence, add the two-scale map family to map strategy, pair Operations and Expeditions in META-LAYER, and retain explicit carrier/submarine boundaries.

- [ ] **Step 4: Run the complete repository gates**

```powershell
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: all four commands exit `0`; every test passes; Vite emits the bundle.

- [ ] **Step 5: Run live browser smoke journeys**

Launch Vite, open the Map tab, stage and deploy a land skirmish, then stage and deploy a combined Beachhead. Verify board, modal, objective HUD, completion, settlement, reload persistence, responsive layout, and zero console errors. Capture screenshots under `docs/reference/military-operations/` if the existing reference workflow expects them.

- [ ] **Step 6: Audit the feature against the source brief**

Check evidence for all 15 verbs, 10 sites, 7 complications, 50 effects, 4 signatures, two scales, manifest stake, facilities, escalation, vehicle records, certification, Courier, Pike-only naval gameplay, and all four gates. Any missing or indirect evidence returns to the owning task.

- [ ] **Step 7: Commit the production-ready integration**

```powershell
git add docs/META-LAYER.md docs/STATUS.md docs/MAP-STRATEGY.md docs/MILITARY-MISSIONS.md tests/operations-integration.test.ts
git commit -m "docs: mark military operations production ready"
```
