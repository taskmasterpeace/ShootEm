# Military Operations Rotorcraft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship distinct attack and transport helicopters with production flight laws, mission integration, AI, procedural models, and measured scenario evidence.

**Architecture:** Add two stable `VehicleKind` identifiers that reuse the shared vehicle, elevation, crew, weapon, telemetry, and theater-route systems. Extend those systems only where rotorcraft have a real new law: grounded-only mobile spawn and support/insertion AI profiles.

**Tech Stack:** TypeScript, deterministic World simulation, Three.js procedural models, Vitest, Vite.

## Global Constraints

- Preserve `flyer` and all existing serialized vehicle identifiers.
- Rotorcraft cap at Sky (`band === 2`) and have no minimum airspeed.
- Condor mobile spawn operates only at Ground with live comms and a crew.
- Models face +X, expose named working parts, stay below 1,500 triangles, and use no purple.
- Use test-first development and commit each independently green slice.

---

### Task 1: Rotorcraft Definitions, Weapons, and Flight Law

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/data.ts`
- Modify: `src/sim/operations.ts`
- Modify: `src/sim/world.ts`
- Modify: `tests/flight.test.ts`
- Modify: `tests/operations.test.ts`
- Create: `tests/rotorcraft.test.ts`

**Interfaces:**
- Produces: `VehicleKind` values `attackheli` and `transportheli`; `VEHICLES.attackheli`; `VEHICLES.transportheli`; weapons `heli_rockets` and `heli_cannon`; `vehicleMobileSpawnActive(vehicle)`.
- Consumes: `maxElevationFor`, `AIR_KINDS`, shared crew and mounted-weapon behavior.

- [ ] **Step 1: Write failing definition and flight tests**

```ts
it.each(['attackheli', 'transportheli'] as const)('%s is a rotorcraft capped at Sky', (kind) => {
  expect(VEHICLES[kind].flies).toBe(true);
  expect(VEHICLES[kind].minAirspeed).toBeUndefined();
  expect(maxElevationFor(VEHICLES[kind])).toBe(2);
  expect(AIR_KINDS.has(kind)).toBe(true);
});

it('Condor only provides a mobile spawn while landed, crewed, and connected', () => {
  const { world, vehicle } = crewRotorcraft('transportheli');
  vehicle.band = 2;
  expect(world.vehicleMobileSpawnActive(vehicle)).toBe(false);
  vehicle.band = 0;
  expect(world.vehicleMobileSpawnActive(vehicle)).toBe(true);
  vehicle.systems.comms = 0;
  expect(world.vehicleMobileSpawnActive(vehicle)).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/rotorcraft.test.ts tests/flight.test.ts tests/operations.test.ts`  
Expected: FAIL because both kinds and `vehicleMobileSpawnActive` are absent.

- [ ] **Step 3: Add minimal definitions and law**

Add Shrike (105 HP, speed 27, two seats, rocket primary, cannon alt, 3s spool, cost 3) and Condor (260 HP, speed 21, nine seats, gunner/sensors/comms crew, door gun, 4s spool, cost 4). Both set `hover` and `flies`; neither sets `minAirspeed`. Add them to `AIR_KINDS`. Centralize the existing mobile-spawn predicate in `World.vehicleMobileSpawnActive`; require `(vehicle.band ?? 0) === 0` only for flying mobile spawns.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run tests/rotorcraft.test.ts tests/flight.test.ts tests/operations.test.ts tests/elevation.test.ts tests/spawn.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/types.ts src/sim/data.ts src/sim/operations.ts src/sim/world.ts tests/rotorcraft.test.ts tests/flight.test.ts tests/operations.test.ts tests/spawn.test.ts
git commit -m "feat: add military rotorcraft"
```

### Task 2: Rotorcraft Models and Pads

**Files:**
- Modify: `src/client/models/vehicles.ts`
- Modify: `src/client/renderer.ts`
- Modify: `src/sim/map.ts`
- Modify: `src/sim/theaters.ts`
- Modify: `src/sim/theaters/land.ts`
- Modify: `src/sim/theaters/domain.ts`
- Modify: `tests/visual.test.ts`
- Modify: `tests/airfield.test.ts`
- Modify: `tests/theaters.test.ts`

**Interfaces:**
- Produces: procedural Shrike and Condor models with `turret`, `gunRecoil`, `rotorL`, and `rotorR`; valid pads on five land-capable theaters.
- Consumes: `buildVehicle`, `placeDomainPad`, named-part renderer animation.

- [ ] **Step 1: Enroll both airframes in failing visual and pad tests**

```ts
attackheli: ['turret', 'gunRecoil', 'rotorL', 'rotorR'],
transportheli: ['turret', 'gunRecoil', 'rotorL', 'rotorR'],
```

Assert City, Desert, Countryside, Mountain, and Coastal each contain at least one rotorcraft pad and that Ocean contains none by default.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/visual.test.ts tests/airfield.test.ts tests/theaters.test.ts`  
Expected: FAIL because the builders and pads are missing.

- [ ] **Step 3: Build silhouettes and pad placement**

Add a coaxial narrow Shrike with short rocket wings and a tandem-rotor long Condor. Reuse the renderer's `rotorL`/`rotorR` animation. Add classic-map flight-line pads without hangars, and place theater pads near authored air-route/LZ anchors after structure stamping. Update default theater pad metadata.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run tests/visual.test.ts tests/airfield.test.ts tests/theaters.test.ts tests/theater-performance.test.ts`  
Expected: PASS with valid extents, named parts, triangle budgets, and unblocked pads.

- [ ] **Step 5: Commit**

```bash
git add src/client/models/vehicles.ts src/client/renderer.ts src/sim/map.ts src/sim/theaters.ts src/sim/theaters/land.ts src/sim/theaters/domain.ts tests/visual.test.ts tests/airfield.test.ts tests/theaters.test.ts
git commit -m "feat: stage rotorcraft across theaters"
```

### Task 3: Support and Insertion AI

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/bots.ts`
- Modify: `src/sim/vehicle-telemetry.ts`
- Modify: `src/sim/scenario-runner.ts`
- Modify: `tests/ai-vehicles.test.ts`
- Modify: `tests/vehicle-telemetry.test.ts`
- Create: `tests/rotorcraft-scenarios.test.ts`

**Interfaces:**
- Produces: air profiles `support` and `insertion`; `runRotorcraftMatrix({ seeds })`; landing incidents and insertion results.
- Consumes: authored air routes and landing zones, building look-ahead, route telemetry.

- [ ] **Step 1: Write failing real-simulation tests**

```ts
it('a Condor reaches and lands in a friendly insertion zone', () => {
  const result = runRotorcraftInsertion('mountain', 4207, 180);
  expect(result.landed).toBe(true);
  expect(result.persistentStalls).toBe(0);
  expect(result.crashes).toBe(0);
});

it('a Shrike acquires and damages enemy armor', () => {
  const result = runRotorcraftSupport('countryside', 7749, 120);
  expect(result.firstContact).not.toBeNull();
  expect(result.damageByKind.attackheli).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/rotorcraft-scenarios.test.ts tests/ai-vehicles.test.ts tests/vehicle-telemetry.test.ts`  
Expected: FAIL because the profiles and probes are absent.

- [ ] **Step 3: Implement profiles and evidence**

Support pilots follow air anchors at Sky, descend to Building only with a clear look-ahead volume, react, fire, and climb after a pass. Insertion pilots select a side-compatible LZ by stable id order, fly at Sky, descend inside its radius, stop at Ground, mark route/objective complete, and record `landing`. Add deterministic ten-seed matrix aggregation.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run tests/rotorcraft-scenarios.test.ts tests/ai-vehicles.test.ts tests/vehicle-telemetry.test.ts tests/airwar.test.ts tests/vehicle-scenarios.test.ts`  
Expected: PASS with zero missing contacts, stalls, non-finite positions, and insertion crashes.

- [ ] **Step 5: Commit**

```bash
git add src/sim/types.ts src/sim/bots.ts src/sim/vehicle-telemetry.ts src/sim/scenario-runner.ts tests/ai-vehicles.test.ts tests/vehicle-telemetry.test.ts tests/rotorcraft-scenarios.test.ts
git commit -m "feat: fly rotorcraft missions"
```

### Task 4: Rotorcraft Report and Production Checkpoint

**Files:**
- Modify: `scripts/run-vehicle-scenarios.ts`
- Create: `docs/reference/vehicle-theaters/rotorcraft-report.json`
- Create: `docs/reference/vehicle-theaters/rotorcraft-report.md`
- Modify: `docs/superpowers/plans/2026-07-21-rotorcraft.md`

**Interfaces:**
- Produces: reproducible rotorcraft acceptance report and an updated scenario command.
- Consumes: `runRotorcraftMatrix`, telemetry summaries, all rotorcraft tests.

- [ ] **Step 1: Add report acceptance to the scenario command and verify RED**

Require five theaters × ten seeds for both support and insertion, zero route/structure/contact failures, and no accepted insertion crashes. Run `npm run test:vehicle-scenarios`; expect non-zero until rotorcraft report generation is wired.

- [ ] **Step 2: Generate stable JSON and Markdown evidence**

Write deterministic scenario rows and a compact gate table beside the foundation report. Exit non-zero for any rotorcraft violation.

- [ ] **Step 3: Run focused and production checkpoint gates**

Run: `npm run test:vehicle-scenarios`  
Run: `npx tsc --noEmit`  
Run: `npx vitest run tests/rotorcraft.test.ts tests/rotorcraft-scenarios.test.ts tests/visual.test.ts tests/flight.test.ts tests/airwar.test.ts tests/antiair.test.ts tests/requisition.test.ts tests/operations.test.ts`  
Run: `npm run lint`  
Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-vehicle-scenarios.ts docs/reference/vehicle-theaters/rotorcraft-report.json docs/reference/vehicle-theaters/rotorcraft-report.md docs/superpowers/plans/2026-07-21-rotorcraft.md
git commit -m "test: certify military rotorcraft"
```

- [ ] **Step 5: Continue to naval design**

Start `docs/superpowers/specs/2026-07-21-submarine-design.md`. Do not mark the active Military Operations goal complete.
