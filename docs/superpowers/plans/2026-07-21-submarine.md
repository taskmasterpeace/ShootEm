# Military Operations Submarine Implementation Plan

**Execution status:** COMPLETE — Barracuda ships with deep staging, Q depth
control, sonar concealment, torpedo combat, Operation manifests, procedural
presentation, and 20 passing submerged duel scenarios.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship the Barracuda submarine with real deep-water movement, torpedo combat, sonar concealment, AI fights, and production evidence.

**Architecture:** Add a separate boolean naval depth state to the shared vehicle object and a `submersible` definition capability. Deep routing, torpedo reach, sonar culling, rendering, and telemetry consume that state without overloading aircraft elevation.

**Tech Stack:** TypeScript, deterministic World simulation, Three.js procedural models, snapshot interest management, Vitest, Vite.

## Global Constraints

- Preserve all existing vehicle identifiers and Pike surface behavior.
- Submerged movement is legal only on `T_DEEP`; surfaced naval movement accepts `T_WATER` and `T_DEEP`.
- Only torpedo-class damage reaches submerged hulls.
- Undetected submerged enemies are absent from enemy snapshots.
- The model faces +X, uses no purple, fits radius law, and stays below 1,500 triangles.
- Follow test-first development and commit every green slice.

---

### Task 1: Barracuda Definition, Dive Control, and Torpedo Law

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/data.ts`
- Modify: `src/sim/operations.ts`
- Modify: `src/sim/world.ts`
- Create: `tests/submarine.test.ts`
- Modify: `tests/waterline.test.ts`

**Interfaces:**
- Produces: `VehicleKind` `submarine`; `VehicleDef.submersible`; `Vehicle.submerged`; `WeaponDef.torpedo`; `WEAPONS.torpedo`; dive control on Q.
- Consumes: mounted-weapon launch, water collision, vehicle damage, ability debounce.

- [x] **Step 1: Write failing depth and weapon tests**

```ts
it('dives only over deep water and moves slower underwater', () => {
  const rig = crewSubmarineOn(T_DEEP);
  step(rig, cmd({ ability: true }));
  expect(rig.vehicle.submerged).toBe(true);
  expect(measuredSpeed(rig)).toBeCloseTo(VEHICLES.submarine.speed * 0.72, 0);
  moveHullTo(rig, T_WATER);
  expect(canRemainSubmerged(rig.world, rig.vehicle)).toBe(false);
});

it('rejects surface fire and accepts torpedoes while submerged', () => {
  expect(damageFrom('boat_mg', submergedTarget())).toBe(0);
  expect(damageFrom('torpedo', submergedTarget())).toBeGreaterThan(0);
});
```

- [x] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/submarine.test.ts tests/waterline.test.ts`  
Expected: FAIL because the Barracuda, depth state, and torpedo law are absent.

- [x] **Step 3: Implement minimal naval depth law**

Add a 320 HP, 17u/s, four-seat Barracuda with weapons/sensors/comms crew, radius 2.8, cost 4, `boat: true`, and `submersible: true`. Q dives only when center plus four collision-radius probes are `T_DEEP`; Q always surfaces. Apply a 0.72 submerged speed multiplier and deep-only collision. Mark torpedo projectiles/definitions and reject every non-torpedo direct or splash hit against submerged vehicles.

- [x] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run tests/submarine.test.ts tests/waterline.test.ts tests/vehicle-telemetry.test.ts tests/operations.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/sim/types.ts src/sim/data.ts src/sim/operations.ts src/sim/world.ts tests/submarine.test.ts tests/waterline.test.ts
git commit -m "feat: add submarine depth combat"
```

### Task 2: Deep Pads, Route Domain, and Procedural Hull

**Files:**
- Modify: `src/sim/theater-builder.ts`
- Modify: `src/sim/theaters.ts`
- Modify: `src/sim/theaters/domain.ts`
- Modify: `src/sim/bots.ts`
- Modify: `src/client/models/vehicles.ts`
- Modify: `src/client/renderer.ts`
- Modify: `tests/theaters.test.ts`
- Modify: `tests/ai-vehicles.test.ts`
- Modify: `tests/visual.test.ts`

**Interfaces:**
- Produces: one deep Barracuda pad per team in Coastal/Ocean; deep route selection; named `propeller`; submerged render depth.
- Consumes: `placeDomainPad`, authored deep routes, `buildVehicle`, renderer vehicle update.

- [x] **Step 1: Add failing pad, route, and visual tests**

```ts
submarine: ['turret', 'gunRecoil', 'propeller'],
```

Assert Coastal/Ocean have two submarine pads on `T_DEEP`, dry theaters have none, and `vehicleRouteFor` returns a `deep` route for Barracuda.

- [x] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/theaters.test.ts tests/ai-vehicles.test.ts tests/visual.test.ts`  
Expected: FAIL because pads, deep routing, and model are absent.

- [x] **Step 3: Implement map integration and model**

Map `submarine` pads to the `deep` domain and validate `T_DEEP`. Stage pads on the first/last points of authored deep routes. Select `deep` in vehicle AI. Build the long pressure hull, sail, planes, tubes, team stripe, torpedo recoil group, and named propeller. Ease rendered height between -0.25u and -2.4u and spin the propeller with speed.

- [x] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run tests/theaters.test.ts tests/theater-performance.test.ts tests/ai-vehicles.test.ts tests/visual.test.ts tests/waterline.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/sim/theater-builder.ts src/sim/theaters.ts src/sim/theaters/domain.ts src/sim/bots.ts src/client/models/vehicles.ts src/client/renderer.ts tests/theaters.test.ts tests/ai-vehicles.test.ts tests/visual.test.ts
git commit -m "feat: stage submarines on deep routes"
```

### Task 3: Sonar and Server-Side Concealment

**Files:**
- Modify: `src/sim/world.ts`
- Modify: `src/sim/snapshot.ts`
- Modify: `src/client/renderer.ts`
- Modify: `tests/culling.test.ts`
- Modify: `tests/sim.test.ts`

**Interfaces:**
- Produces: `World.submarineDetectedForTeam(target, team)`; snapshot conceal/reveal rules.
- Consumes: vehicle crew station layout, systems health, distances, local renderer team.

- [x] **Step 1: Write failing sonar tests**

```ts
it('removes an undetected submerged enemy from the wire', () => {
  expect(cullSnapshotFor(world, snapshot, viewer.id).vehicles).not.toContainEqual(expect.objectContaining({ id: enemySub.id }));
});

it('reveals it to a staffed live sensor station in sonar range', () => {
  staffSensors(friendlySensorVehicle);
  expect(cullSnapshotFor(world, takeSnapshot(world, []), viewer.id).vehicles).toContainEqual(expect.objectContaining({ id: enemySub.id }));
  friendlySensorVehicle.systems.sensors = 0;
  expect(cullSnapshotFor(world, takeSnapshot(world, []), viewer.id).vehicles).not.toContainEqual(expect.objectContaining({ id: enemySub.id }));
});
```

- [x] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/culling.test.ts tests/sim.test.ts`  
Expected: FAIL because submerged contacts are still serialized normally.

- [x] **Step 3: Implement shared sonar predicate**

Friendly targets always return true. Surface targets return true. For an enemy submerged target, return true for a friendly submarine within 65u or a friendly alive vehicle within 55u whose `sensors` station seat is staffed and sensor system HP is positive. Use the predicate in both snapshot culling and local renderer visibility.

- [x] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run tests/culling.test.ts tests/sim.test.ts tests/visual.test.ts`  
Expected: PASS without leaking hidden coordinates.

- [x] **Step 5: Commit**

```bash
git add src/sim/world.ts src/sim/snapshot.ts src/client/renderer.ts tests/culling.test.ts tests/sim.test.ts
git commit -m "feat: conceal submarines behind sonar"
```

### Task 4: Submarine AI Matrix and Evidence

**Files:**
- Modify: `src/sim/bots.ts`
- Modify: `src/sim/vehicle-telemetry.ts`
- Modify: `src/sim/scenario-runner.ts`
- Modify: `scripts/run-vehicle-scenarios.ts`
- Create: `tests/submarine-scenarios.test.ts`
- Create: `docs/reference/vehicle-theaters/submarine-report.json`
- Create: `docs/reference/vehicle-theaters/submarine-report.md`

**Interfaces:**
- Produces: `runSubmarineBattle`, `runSubmarineMatrix`, `evaluateSubmarineMatrix`; stable naval report.
- Consumes: deep route AI, sonar, torpedo telemetry, existing scenario command.

- [x] **Step 1: Write failing real-simulation matrix tests**

```ts
it('passes Coastal and Ocean submarine fights over ten seeds', () => {
  const report = runSubmarineMatrix({ seeds: MATRIX_SEEDS });
  expect(report.scenarios).toHaveLength(20);
  expect(evaluateSubmarineMatrix(report)).toEqual({ failures: [] });
});
```

Each row requires route completion, dive, first contact, torpedo shots/hits, finite position, zero wrong-depth incidents, and damage or loss.

- [x] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/submarine-scenarios.test.ts`  
Expected: FAIL because submarine scenario APIs are absent.

- [x] **Step 3: Implement deep-route combat AI and matrix**

Barracuda bots dive after clearing the pad, follow deep anchors, acquire detectable naval hulls, fire torpedoes after the shared reaction delay, and never steer through shallow water while submerged. Add dive/surface/wrong-depth telemetry and compact matrix rows.

- [x] **Step 4: Generate and verify reports**

Run: `npm run test:vehicle-scenarios`  
Expected: foundation 210 PASS, rotorcraft 100 PASS, submarine 20 PASS; stable JSON/Markdown reports written.

- [x] **Step 5: Run focused gates and commit**

Run: `npx tsc --noEmit`  
Run: `npx vitest run tests/submarine.test.ts tests/submarine-scenarios.test.ts tests/waterline.test.ts tests/culling.test.ts tests/visual.test.ts tests/theaters.test.ts tests/vehicle-scenarios.test.ts`  
Run: `npm run lint`  
Expected: all exit 0.

```bash
git add src/sim/bots.ts src/sim/vehicle-telemetry.ts src/sim/scenario-runner.ts scripts/run-vehicle-scenarios.ts tests/submarine-scenarios.test.ts docs/reference/vehicle-theaters/submarine-report.json docs/reference/vehicle-theaters/submarine-report.md
git commit -m "test: certify submarine warfare"
```

### Task 5: Military Operations Production Completion

Update `docs/MILITARY-MISSIONS.md`, `docs/MAP-STRATEGY.md`, `docs/STATUS.md`, and all plan checkboxes with exact shipped behavior and evidence. Run the four repository gates, then use the game/harness browser surfaces to inspect rotorcraft, submarine, rectangular maps, air elevation, sonar, and Operation staging. Commit only after all automated and manual checks pass.
