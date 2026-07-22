# Science Stealth Encounters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ordinary Science Missions no-armor, low-count pistol/SMG encounters whose guards report local sightings through an interruptible delay instead of granting facility-wide live tracking.

**Architecture:** Extend the deterministic mission spec with an armor policy, make encounter budgets and guard issue loadouts explicit pure functions, and replace the immediate alarm transition with a small reporting state stored in `ScienceMissionRuntime`. Indoor AI receives one stale last-known-position event only when a report completes; presentation reads the runtime awareness state.

**Tech Stack:** TypeScript, deterministic War World simulation, Vitest, Vite client HUD.

## Global Constraints

- Ordinary Science Missions use `armorPolicy: 'none'` and suppress armor equipment for player and NPC spawns.
- Ordinary guards use only `pistol` or `kuchler`; full military weapons require an explicit later complication.
- Standard initial defenders are four to six; hard cap seven; reserve responders are zero to two; ordinary dog cap is one.
- Guard awareness never distributes a live player coordinate every tick.
- Guard state changes do not change movement speed.
- Keep `science.alarm` as a compatibility boolean while `science.awareness` becomes the presentation/state-machine authority.
- No new runtime dependency and no third-party source or assets.
- Do not change battle-mode encounter, loadout, armor, or indoor behavior.
- Commit each task separately and stage files by explicit name.

---

### Task 1: Science Armor Policy

**Files:**
- Modify: `src/sim/science.ts`
- Modify: `src/sim/world.ts`
- Modify: `tests/science-runtime.test.ts`

**Interfaces:**
- Produces: `ScienceArmorPolicy = 'none' | 'rare-specialist' | 'armored-site'`
- Produces: `ScienceMissionSpec.armorPolicy: ScienceArmorPolicy`
- Consumes: `World.science?.spec.armorPolicy`

- [ ] **Step 1: Write the failing policy and spawn tests**

Add assertions that generated missions default to `none`, an explicit policy remains deterministic, and a Science operator created with `equipment: ['armor_vest', 'power_armor']` has no armor equipment, `armor === 0`, and `maxArmor === 0`. Add a battle-mode control assertion showing the same equipment still yields armor after spawn.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npx vitest run tests/science-generator.test.ts tests/science-runtime.test.ts`

Expected: FAIL because `armorPolicy` does not exist and Science spawns retain armor equipment.

- [ ] **Step 3: Add the typed policy and enforce it at the spawn boundary**

In `science.ts`, add the policy type to mission options/spec and default it to `none` in `generateScienceMission`. In `World.addSoldier`, filter `armor_vest` and `power_armor` from loadout equipment when `mode.kind === 'science'` and the active policy is `none`. In `World.spawn`, clamp issued plate to zero under the same condition so reprints and pre-existing actor records cannot restore it.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/science-generator.test.ts tests/science-runtime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/science.ts src/sim/world.ts tests/science-generator.test.ts tests/science-runtime.test.ts
git commit -m "feat: enforce science no-armor policy"
```

### Task 2: Compact Encounter Budget and Civilian Weapons

**Files:**
- Modify: `src/sim/science.ts`
- Modify: `src/sim/science-runtime.ts`
- Modify: `tests/science-scaling.test.ts`
- Modify: `tests/science-runtime.test.ts`

**Interfaces:**
- Produces: `ScienceGuardRole = 'pistol' | 'smg'`
- Produces: `scienceGuardRole(index: number, total: number, reserve?: boolean): ScienceGuardRole`
- Consumes: explicit `Loadout` passed to `World.addSoldier`

- [ ] **Step 1: Write failing budget and loadout tests**

Change scaling assertions to require initial guards in `[3, 7]`, reserves in `[0, 2]`, dog teams in `[0, 1]`, and the first room cap of two. Add a runtime assertion across multiple seeds that every ordinary guard and responder has `weapons[0]` in `['pistol', 'kuchler']`, no guard uses class `heavy`, and no actor has armor.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npx vitest run tests/science-scaling.test.ts tests/science-runtime.test.ts`

Expected: FAIL because current eight-print missions generate ten-plus guards, two dogs, large reserves, Heavy classes, and random armory weapons.

- [ ] **Step 3: Implement the compact pure budget**

Use deterministic thresholds rather than additional RNG:

```ts
const initialGuards = clamp(
  3 + (prints >= 3 ? 1 : 0) + (prints >= 7 ? 1 : 0)
    + (security >= 0.82 ? 1 : 0) + verbPressure,
  3,
  7,
);
const reserveGuards = clamp(
  (prints >= 4 ? 1 : 0) + (prints >= 8 || options.complication === 'alarm-net' ? 1 : 0),
  0,
  2,
);
const dogTeams = security >= 0.55 && prints >= 3 ? 1 : 0;
```

Keep threat monotonic and based on the resulting counts.

- [ ] **Step 4: Issue explicit guard and response loadouts**

Implement `scienceGuardRole` so roughly one in four actors is an SMG responder and all others are pistol guards. Spawn every ordinary Science guard as `infantry` with `{ primary: role === 'smg' ? 'kuchler' : 'pistol', secondary: 'pistol', equipment: [] }`. Apply the same contract to response actors. Named targets remain civilian-scale unless a mission-specific exception explicitly replaces them.

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run tests/science-scaling.test.ts tests/science-runtime.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/science.ts src/sim/science-runtime.ts tests/science-scaling.test.ts tests/science-runtime.test.ts
git commit -m "fix: scale science encounters to civilian security"
```

### Task 3: Interruptible Local Reporting

**Files:**
- Modify: `src/sim/science-runtime.ts`
- Modify: `src/sim/indoor-ai.ts`
- Modify: `src/sim/world.ts`
- Modify: `tests/science-runtime.test.ts`
- Modify: `tests/indoor-ai.test.ts`

**Interfaces:**
- Produces: `ScienceAwareness = 'ghost' | 'searching' | 'alarmed'`
- Produces: `SciencePendingReport { guardId: number; lastKnown: Vec3; floor: number; completeAt: number }`
- Produces: `ScienceMissionRuntime.awareness`, `.pendingReport`, and `.lastReported`
- Consumes: `noteIndoorAlert(state, stalePosition, floor, reportTime)` exactly once per completed report

- [ ] **Step 1: Write failing local-report tests**

Add tests proving that direct sight starts `searching` without immediately setting `alarm`, a living reporter completes after 1.5 seconds, killing the reporter before completion cancels the report, the completed report stores the sighting coordinate, and moving the operator afterward does not mutate that coordinate. Update the old immediate-alarm test to the new transition.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/science-runtime.test.ts tests/indoor-ai.test.ts`

Expected: FAIL because sight currently sets `alarm` immediately and `World.step` overwrites the facility alert with the operator's current position every tick.

- [ ] **Step 3: Add runtime awareness and pending-report state**

Initialize `awareness: 'ghost'`, `pendingReport: undefined`, and `lastReported: undefined`. On first guard perception, increment detections, store reporter ID and a copied sighting position, set `completeAt = world.time + 1.5`, set `awareness = 'searching'`, and emit a non-big `SECURITY REPORTING` announcement.

- [ ] **Step 4: Complete or cancel the report deterministically**

Each Science step checks the pending reporter. If dead, clear the pending report and return to `ghost` unless another report already alarmed the facility. If alive and the deadline passes, copy its stale position to `lastReported`, set both `alarm = true` and `awareness = 'alarmed'`, schedule responders, clear the pending report, call `noteIndoorAlert` once, and emit the facility alarm announcement.

- [ ] **Step 5: Remove live global tracking**

Delete the `World.step` branch that calls `noteIndoorAlert` with the current operator position whenever `science.alarm` is true. Keep scent recording unchanged. Indoor guard search memory continues to consume the one reported position.

- [ ] **Step 6: Preserve alarm-net behavior**

Initialize alarm-net missions with `alarm = true`, `awareness = 'alarmed'`, one detection, and their deterministic response time. They do not require a reporter.

- [ ] **Step 7: Run focused tests**

Run: `npx vitest run tests/science-runtime.test.ts tests/indoor-ai.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/sim/science-runtime.ts src/sim/indoor-ai.ts src/sim/world.ts tests/science-runtime.test.ts tests/indoor-ai.test.ts
git commit -m "feat: add interruptible science guard reports"
```

### Task 4: Awareness Presentation

**Files:**
- Modify: `src/client/science.ts`
- Modify: `src/client/hud.ts`
- Modify: `src/styles.css`
- Modify: `tests/science-presentation.test.ts`

**Interfaces:**
- Consumes: `ScienceMissionRuntime.awareness`
- Produces: stable labels `GHOST`, `SEARCHING`, and `ALARMED`

- [ ] **Step 1: Write failing HTML tests**

Extend the presentation fixture with the new runtime fields. Assert that each awareness value renders the correct visible label and CSS class while the clone and objective copy remains unchanged.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/science-presentation.test.ts`

Expected: FAIL because the client currently derives only `GHOST` or `ALARM` from the compatibility boolean.

- [ ] **Step 3: Render the three awareness states**

Use `runtime.awareness` in both compact HUD and mission panel. Add a searching amber state and rename the completed state to `ALARMED`. Preserve `is-alarm` and `is-ghost` compatibility classes while adding `is-searching`.

- [ ] **Step 4: Run presentation and focused integration tests**

Run: `npx vitest run tests/science-presentation.test.ts tests/science-runtime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/science.ts src/client/hud.ts src/styles.css tests/science-presentation.test.ts
git commit -m "feat: show science search and alarm states"
```

### Task 5: Slice Verification

**Files:**
- Modify: `docs/STATUS.md`
- Modify: `docs/SHIPPING-LOG.md`

**Interfaces:**
- Consumes: all previous task contracts.
- Produces: verified no-armor/local-report Science encounter slice.

- [ ] **Step 1: Run the focused Science and indoor suites**

Run: `npx vitest run tests/science-generator.test.ts tests/science-scaling.test.ts tests/science-runtime.test.ts tests/science-presentation.test.ts tests/indoor-ai.test.ts`

Expected: PASS.

- [ ] **Step 2: Run all four repository gates**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: all commands exit zero.

- [ ] **Step 3: Live-check the existing Science quick-deploy missions**

Use the already-running local game to launch representative villa and annex missions. Confirm four-to-six no-armor defenders, only pistols/SMGs, no entry-room spawn pile, `SEARCHING` before report, an interruptible reporter, `ALARMED` after completion, and no facility-wide live tracking when the operator moves.

- [ ] **Step 4: Record evidence and commit**

```bash
git add docs/STATUS.md docs/SHIPPING-LOG.md
git commit -m "docs: verify science stealth encounters"
```

## Follow-on Plans

This plan intentionally leaves two independently reviewable systems for separate plans:

1. operation-graph generation, patrol routes, permanent floor-aware waypoints, report nodes, and Map Maker overlays;
2. shared unarmed AI plus baseball bat, katana, and held fire axe weapon families.
