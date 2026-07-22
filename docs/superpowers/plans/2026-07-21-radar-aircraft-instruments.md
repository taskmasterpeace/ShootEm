# Radar and Aircraft Instruments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship deterministic last-known radar/sonar tracks on the minimap, AI-visible sensor truth and telemetry, and a PixelLab-derived aircraft instrument plate with airspeed, heading, altitude, radar, and lock state.

**Architecture:** A focused `src/sim/radar.ts` module owns emitter profiles, detection classification, weather/ECM modifiers, and serializable tracks. `World` schedules per-emitter sweeps and exposes team tracks without letting HUD or AI inspect hidden live targets. Pure HUD presenters derive instrument state, while the existing minimap canvas renders radar records and the DOM overlays live data on the PixelLab gunmetal dial frame.

**Tech Stack:** TypeScript, Vitest, HTML canvas, DOM/CSS, Vite, existing deterministic `World` simulation and vehicle telemetry.

## Global Constraints

- Radar positions update only on deterministic sweeps; between sweeps contacts stay at their recorded last-known coordinates.
- Fixed-wing range/cadence: 125 units / 1.25 seconds; rotorcraft: 90 / 1.5; staffed sensors: 160 / 2; surface naval: 105 / 1.75; submerged sonar: 80 / 2.25.
- Live enemy ECM reduces effective range to 65% and produces uncertain hollow returns; dead ECM restores full resolution.
- Submerged sonar resolves only surface/submerged contacts and never air contacts.
- The minimap remains square and north-up; rectangular theater projection must stay correct.
- Reuse `docs/reference/hud/hud-B-gunmetal-dial.png` as decorative PixelLab chrome; all changing values must be live DOM/canvas data with a vector fallback.
- Preserve all current LOS, ping, ghost, objective, waypoint, pad, and gate minimap behavior.
- Do not add dependencies, purple UI colors, manual radar keybinds, BVR firing, or campaign-save fields.
- Work on `codex/military-operations`; commit explicit paths only and never push.
- Completion requires `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.

---

### Task 1: Pure radar truth model

**Files:**
- Create: `src/sim/radar.ts`
- Create: `tests/radar.test.ts`

**Interfaces:**
- Produces: `RadarDomain`, `RadarSource`, `RadarEmitterProfile`, `RadarTrack`, `RADAR_PROFILES`, `radarDomainForVehicle()`, `weatherRadarMultiplier()`, `radarTrackKey()`, `trackAlpha()`, `headingDegrees()`.
- Consumes: `Vehicle`, `VehicleDef`, `VehicleKind`, `Vec3`, `WeatherState`, `ElevationLevel`.

- [ ] **Step 1: Write the failing pure-rule tests**

```ts
import { describe, expect, it } from 'vitest';
import { RADAR_PROFILES, headingDegrees, radarDomainForVehicle, trackAlpha, weatherRadarMultiplier } from '../src/sim/radar';

describe('radar profiles', () => {
  it('keeps the approved ranges and cadences', () => {
    expect(RADAR_PROFILES.fixedWing).toMatchObject({ range: 125, cadence: 1.25 });
    expect(RADAR_PROFILES.rotorcraft).toMatchObject({ range: 90, cadence: 1.5 });
    expect(RADAR_PROFILES.staffedSensors).toMatchObject({ range: 160, cadence: 2 });
    expect(RADAR_PROFILES.surfaceNaval).toMatchObject({ range: 105, cadence: 1.75 });
    expect(RADAR_PROFILES.sonar).toMatchObject({ range: 80, cadence: 2.25 });
  });

  it('classifies air, surface, ground and submerged hulls', () => {
    expect(radarDomainForVehicle('interceptor', 3, false)).toBe('air');
    expect(radarDomainForVehicle('boat', 0, false)).toBe('surface');
    expect(radarDomainForVehicle('submarine', 0, true)).toBe('submerged');
    expect(radarDomainForVehicle('tank', 0, false)).toBe('ground');
  });

  it('normalizes heading and fades from hold to expiry', () => {
    expect(headingDegrees(-Math.PI / 2)).toBe(270);
    expect(trackAlpha({ observedAt: 10, expiresAt: 14 } as never, 10)).toBe(1);
    expect(trackAlpha({ observedAt: 10, expiresAt: 14 } as never, 14)).toBe(0);
  });

  it('penalizes visibility weather but not sonar', () => {
    expect(weatherRadarMultiplier({ kind: 'storm', intensity: 0.9, until: 99 }, 'air')).toBeLessThan(1);
    expect(weatherRadarMultiplier({ kind: 'storm', intensity: 0.9, until: 99 }, 'submerged')).toBe(1);
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm the missing-module failure**

Run: `npx vitest run tests/radar.test.ts`

Expected: FAIL because `../src/sim/radar` does not exist.

- [ ] **Step 3: Implement the radar types and pure rules**

```ts
export type RadarDomain = 'ground' | 'air' | 'surface' | 'submerged';
export type RadarSource = 'fixedWing' | 'rotorcraft' | 'staffedSensors' | 'surfaceNaval' | 'sonar';
export interface RadarEmitterProfile { source: RadarSource; range: number; cadence: number; domains: readonly RadarDomain[]; }
export interface RadarTrack {
  key: string; targetId: number; targetType: 'soldier' | 'vehicle'; receivingTeam: Team;
  pos: Vec3; heading: number; band: ElevationLevel; domain: RadarDomain; source: RadarSource;
  observedAt: number; expiresAt: number; precision: number; jammed: boolean;
}
export const RADAR_PROFILES = {
  fixedWing: { source: 'fixedWing', range: 125, cadence: 1.25, domains: ['air', 'ground', 'surface'] },
  rotorcraft: { source: 'rotorcraft', range: 90, cadence: 1.5, domains: ['air', 'ground'] },
  staffedSensors: { source: 'staffedSensors', range: 160, cadence: 2, domains: ['air', 'ground', 'surface'] },
  surfaceNaval: { source: 'surfaceNaval', range: 105, cadence: 1.75, domains: ['air', 'surface'] },
  sonar: { source: 'sonar', range: 80, cadence: 2.25, domains: ['surface', 'submerged'] },
} as const satisfies Record<RadarSource, RadarEmitterProfile>;
```

Complete the module with these exact rules: `submerged` wins over every other domain; `flies && band > 0` is air; `boat || submersible` is surface; everything else is ground. `headingDegrees(yaw)` returns `Math.round((yaw * 180 / Math.PI + 360) % 360)`. Storm/dust/fog/snow scale non-sonar range by `1 - intensity * 0.35`; sonar returns `1`. Keys are `v:<id>` and `s:<id>`. Track alpha is `clamp((expiresAt - now) / (expiresAt - observedAt), 0, 1)`.

- [ ] **Step 4: Run the pure tests**

Run: `npx vitest run tests/radar.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the truth model**

```bash
git add src/sim/radar.ts tests/radar.test.ts
git commit -m "feat: define deterministic radar tracks"
```

### Task 2: World sweep scheduling, masking, ECM and sonar

**Files:**
- Modify: `src/sim/radar.ts`
- Modify: `src/sim/world.ts`
- Create: `tests/radar-world.test.ts`

**Interfaces:**
- Consumes: Task 1 `RADAR_PROFILES`, `RadarTrack`, `RadarSource`, `radarDomainForVehicle()`, existing `losClear()`, `houseAt()`, `World.weather`, vehicle systems/crew.
- Produces: `World.radarTracks: [Map<string, RadarTrack>, Map<string, RadarTrack>]`, `World.nextRadarSweep`, `World.stepRadar()`, `World.radarTracksFor(team)`.

- [ ] **Step 1: Write failing world integration tests**

```ts
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

it('holds a swept aircraft at its last-known point until the next sweep', () => {
  const w = quiet();
  const pilot = w.addSoldier('Pilot', 'infantry', 0, 'human');
  const jet = w.spawnVehicle('interceptor', 0, { x: 0, y: 0, z: 0 });
  jet.seats[0] = pilot.id; pilot.vehicleId = jet.id; jet.band = 3;
  const foe = w.spawnVehicle('strikejet', 1, { x: 60, y: 0, z: 0 }); foe.band = 3;
  w.stepRadar();
  const first = structuredClone([...w.radarTracksFor(0).values()][0]);
  foe.pos.z += 20; w.time += 0.5; w.stepRadar();
  expect([...w.radarTracksFor(0).values()][0].pos).toEqual(first.pos);
});

it('degrades live-ECM returns and resolves dead-ECM returns', () => {
  const w = quiet();
  const pilot = w.addSoldier('Pilot', 'infantry', 0, 'human');
  const jet = w.spawnVehicle('interceptor', 0, { x: 0, y: 0, z: 0 });
  jet.seats[0] = pilot.id; pilot.vehicleId = jet.id; pilot.seat = 0; jet.band = 3;
  const target = w.spawnVehicle('transportheli', 1, { x: 100, y: 0, z: 0 }); target.band = 2;
  w.stepRadar();
  expect(w.radarTracksFor(0).has(`v:${target.id}`)).toBe(false);
  target.systems.ecm = 0; w.time = 1.25; w.stepRadar();
  expect(w.radarTracksFor(0).get(`v:${target.id}`)).toMatchObject({ jammed: false, precision: 1 });
});

it('sonar resolves submerged/surface hulls and rejects air', () => {
  const w = new World({ seed: 42, mode: 'ctf', botsPerTeam: 0, map: generateTheater('ocean', 42) });
  w.vehicles.clear();
  const p = w.map.theater!.routes.find((route) => route.domain === 'deep')!.points[0];
  const pilot = w.addSoldier('Helm', 'infantry', 0, 'human');
  const sub = w.spawnVehicle('submarine', 0, p); sub.seats[0] = pilot.id; sub.submerged = true;
  pilot.vehicleId = sub.id; pilot.seat = 0;
  const foeSub = w.spawnVehicle('submarine', 1, { ...p, x: p.x + 25 }); foeSub.submerged = true;
  const boat = w.spawnVehicle('boat', 1, { ...p, x: p.x + 35 });
  const jet = w.spawnVehicle('interceptor', 1, { ...p, x: p.x + 40 }); jet.band = 3;
  w.stepRadar();
  const tracks = w.radarTracksFor(0);
  expect(tracks.has(`v:${foeSub.id}`)).toBe(true);
  expect(tracks.has(`v:${boat.id}`)).toBe(true);
  expect(tracks.has(`v:${jet.id}`)).toBe(false);
});
```

- [ ] **Step 2: Run the world tests and confirm missing API failures**

Run: `npx vitest run tests/radar-world.test.ts`

Expected: FAIL on missing `stepRadar()` / `radarTracksFor()`.

- [ ] **Step 3: Implement emitters and deterministic sweeps**

Add sorted emitter discovery in `World.stepRadar()`:

```ts
const emitters = [...this.vehicles.values()]
  .filter((v) => v.alive && v.seats[0] >= 0)
  .sort((a, b) => a.id - b.id)
  .flatMap((v) => radarEmittersForVehicle(this, v));
for (const emitter of emitters) {
  const key = `${emitter.vehicle.id}:${emitter.profile.source}`;
  if (this.time + 1e-9 < (this.nextRadarSweep.get(key) ?? 0)) continue;
  this.nextRadarSweep.set(key, this.time + emitter.profile.cadence);
  this.sweepRadar(emitter);
}
```

Aircraft/ships require a live pilot and live sensors; `staffedSensors` additionally requires `crewAt(v, 'sensors')`. A submerged submarine yields sonar only. Detection applies range, weather, domain, roof/LOS masking, and target ECM. Copy the observed position/yaw/band into the track; do not retain a target object reference. Expire stale tracks after the emitter loop. Call `stepRadar()` once per deterministic world step after vehicle movement.

- [ ] **Step 4: Run radar and nearby regression tests**

Run: `npx vitest run tests/radar.test.ts tests/radar-world.test.ts tests/elevation.test.ts tests/submarine.test.ts tests/culling.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit world radar**

```bash
git add src/sim/radar.ts src/sim/world.ts tests/radar-world.test.ts
git commit -m "feat: sweep battlefield radar tracks"
```

### Task 3: Radar-aware AI and vehicle telemetry

**Files:**
- Modify: `src/sim/bots.ts`
- Modify: `src/sim/vehicle-telemetry.ts`
- Modify: `scripts/vehicle-scenarios.ts`
- Modify: `tests/radar-world.test.ts`
- Modify: `tests/vehicle-telemetry.test.ts`

**Interfaces:**
- Consumes: `World.radarTracksFor(team)`, `RadarTrack`.
- Produces: `World.freshRadarTrackFor(team, targetId)`, telemetry fields `radarSweeps`, `radarContacts`, `radarJammed`, `radarReacquired`, and radar scenario report rows.

- [ ] **Step 1: Add failing AI and telemetry assertions**

```ts
it('gives AI a frozen last-known radar destination without leaking live position', () => {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  const bot = w.addSoldier('Radar Bot', 'infantry', 0, 'bot');
  const foe = w.addSoldier('Hidden Foe', 'infantry', 1, 'human');
  bot.pos = { x: 0, y: 0, z: 0 }; foe.pos = { x: 70, y: 0, z: 0 };
  w.radarTracks[0].set(`s:${foe.id}`, {
    key: `s:${foe.id}`, targetId: foe.id, targetType: 'soldier', receivingTeam: 0,
    pos: { x: 30, y: 0, z: 4 }, heading: 0, band: 0, domain: 'ground', source: 'staffedSensors',
    observedAt: w.time, expiresAt: w.time + 4, precision: 1, jammed: false,
  });
  stepBot(w, bot, 1 / 60);
  expect(bot.botGoal).toMatchObject({ x: 30, z: 4 });
  expect(bot.botGoal).not.toMatchObject({ x: 70, z: 0 });
});

it('counts sweeps, resolved contacts, jammed returns and reacquisition', () => {
  const telemetry = createVehicleTelemetry();
  recordVehicleEvent(telemetry, radarEvent('radar_sweep'));
  recordVehicleEvent(telemetry, radarEvent('radar_contact'));
  recordVehicleEvent(telemetry, radarEvent('radar_jammed'));
  expect(telemetry.summary.radarSweeps).toBe(1);
  expect(telemetry.summary.radarContacts).toBe(1);
  expect(telemetry.summary.radarJammed).toBe(1);
});
```

- [ ] **Step 2: Run the focused failures**

Run: `npx vitest run tests/radar-world.test.ts tests/vehicle-telemetry.test.ts`

Expected: FAIL because radar telemetry event kinds and AI track lookup are absent.

- [ ] **Step 3: Wire last-known AI and telemetry**

Extend the aggregate and event kind unions with exact radar counters. Record one `radar_sweep` per active scheduled emitter, one `radar_contact` per precise observation, `radar_jammed` per uncertain observation, and `radar_reacquired` when a previously expired/absent key returns. In bot target planning, use a fresh team radar track only when normal perception has no target and navigate toward `{ ...track.pos }`; firing still requires the existing direct acquisition/LOS rules.

Add scenario cases named `fixed-wing-radar`, `sensor-ecm`, and `submarine-sonar` that assert acquisition, jam/precision transition, expiry, and domain exclusions and emit their counts in the report.

- [ ] **Step 4: Run AI, telemetry and scenario verification**

Run: `npx vitest run tests/radar-world.test.ts tests/vehicle-telemetry.test.ts tests/ai-behavior.test.ts && npm run test:vehicle-scenarios`

Expected: Vitest PASS and all vehicle scenario groups PASS with radar counts present.

- [ ] **Step 5: Commit AI and data gathering**

```bash
git add src/sim/bots.ts src/sim/vehicle-telemetry.ts scripts/vehicle-scenarios.ts tests/radar-world.test.ts tests/vehicle-telemetry.test.ts
git commit -m "feat: train AI on radar memory"
```

### Task 4: Minimap radar overlay and PixelLab instrument plate

**Files:**
- Modify: `index.html`
- Modify: `src/client/hud.ts`
- Modify: `src/styles.css`
- Create: `tests/vehicle-instruments.test.ts`
- Modify: `tests/operation-hud.test.ts`

**Interfaces:**
- Consumes: radar tracks/profiles and live `Vehicle` data.
- Produces: `VehicleInstrumentState`, `vehicleInstrumentState()`, `renderVehicleInstruments()`, `radarDisplayState()`, DOM ids `vehicle-instruments`, `airspeed-needle`, `instrument-speed`, `instrument-heading`, `instrument-altitude`, `instrument-radar`, `instrument-threat`.

- [ ] **Step 1: Write failing presenter tests**

```ts
it('normalizes heading and exposes speed, stall, altitude and radar', () => {
  const state = vehicleInstrumentState({
    kind: 'interceptor', yaw: -Math.PI / 2, vel: { x: 0, y: 0, z: -30 },
    band: 3, burnerOn: false, sensorsHp: 60, sensorsMax: 60,
    radar: { source: 'fixedWing', range: 125, freshTracks: 2, jammed: false }, locked: false,
  });
  expect(state.heading).toBe(270);
  expect(state.headingText).toBe('W 270°');
  expect(state.altitudePips).toEqual([false, false, false, true]);
  expect(state.radarText).toContain('RDR AIR 125');
});

it('renders lock danger and afterburner without losing textual redundancy', () => {
  const html = renderVehicleInstruments({ ...state, locked: true, burnerOn: true });
  expect(html).toContain('MISSILE INBOUND');
  expect(html).toContain('AB');
});
```

- [ ] **Step 2: Run presenter tests and confirm missing exports**

Run: `npx vitest run tests/vehicle-instruments.test.ts tests/operation-hud.test.ts`

Expected: FAIL on missing instrument exports.

- [ ] **Step 3: Implement instrument DOM and pure presenters**

Insert the plate directly between `#minimap` and `#weapon-block`. Use a decorative background `url('../docs/reference/hud/hud-B-gunmetal-dial.png')`, with a solid steel vector background/border underneath as fallback. Overlay the needle with CSS transform from `-132deg` to `132deg` based on clamped top-speed fraction. Keep speed/heading/altitude/radar/threat as text and ARIA labels. Hide the plate unless the local soldier occupies seat 0 of a flying vehicle; use a compact sonar state for a submerged submarine.

- [ ] **Step 4: Draw radar tracks/range/sweep on the minimap**

In `updateMinimap`, select the local onboard source first, then strongest active team source. Convert world range to independent X/Z canvas radii so rectangular theaters remain correct. Render rings, sweep, state label and tracks from `world.radarTracksFor(local.team)` only. Never read a hidden track's target entity. Use `ctx.save()` / `ctx.restore()` around each overlay and hollow domain glyphs with band/depth tags. Preserve existing map marks and draw the local-player mark last.

- [ ] **Step 5: Run HUD tests and build**

Run: `npx vitest run tests/vehicle-instruments.test.ts tests/operation-hud.test.ts tests/radar.test.ts tests/radar-world.test.ts && npx tsc --noEmit && npm run build`

Expected: all tests PASS, typecheck exit 0, production bundle emits.

- [ ] **Step 6: Commit the radar HUD**

```bash
git add index.html src/client/hud.ts src/styles.css tests/vehicle-instruments.test.ts tests/operation-hud.test.ts
git commit -m "feat: render radar flight instruments"
```

### Task 5: Harness, documentation and production certification

**Files:**
- Modify: `harness.html`
- Modify: `src/client/harness.ts`
- Modify: `docs/UX-LANGUAGE.md`
- Modify: `docs/UI-MASTER.md`
- Modify: `docs/STATUS.md`
- Create: `docs/reference/vehicle-theaters/radar-certification.md`

**Interfaces:**
- Consumes: complete radar and instrument implementation.
- Produces: fixed-wing, rotorcraft, jammed, lock, and sonar harness states plus final certification evidence.

- [ ] **Step 1: Add harness fixtures and documentation records**

Add selectable fixtures for `INTERCEPTOR / CRUISE`, `STRIKEJET / AB`, `SHRIKE / SPOOL`, `CONDOR / TEAM RADAR`, `BARRACUDA / SONAR`, `SENSOR DAMAGED`, `JAMMED`, and `MISSILE INBOUND`. Update UX inventory rows from backlog/future to shipped and document radar glyphs, range rings, last-known fade, instrument plate primitives, and the PixelLab asset provenance.

- [ ] **Step 2: Run focused automated verification**

Run: `npm run test:vehicle-scenarios && npx vitest run tests/radar.test.ts tests/radar-world.test.ts tests/vehicle-instruments.test.ts tests/vehicle-telemetry.test.ts`

Expected: every radar/scenario group PASS.

- [ ] **Step 3: Verify harness and live game visually**

Start the app on an unused localhost port. In the harness, inspect desktop and short-window fixtures for clipping, legibility, live needle position, altitude pips, jam/lock danger, and PixelLab asset fallback. In the live game, fly a jet and helicopter, move a hostile between sweeps and confirm the mark freezes/fades, destroy ECM and confirm resolution improves, then dive the Barracuda and confirm sonar excludes air. Record screenshots and console status in `docs/reference/vehicle-theaters/radar-certification.md`.

- [ ] **Step 4: Run all production gates from a clean command prompt**

Run:

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: typecheck exit 0; full Vitest suite PASS; lint zero errors; build emits.

- [ ] **Step 5: Audit requirements and commit certification**

Compare each explicit design requirement with source, tests, telemetry/scenario output, and live screenshots. Fix every missing or indirect item and rerun the affected evidence. Then:

```bash
git add harness.html src/client/harness.ts docs/UX-LANGUAGE.md docs/UI-MASTER.md docs/STATUS.md docs/reference/vehicle-theaters/radar-certification.md
git commit -m "docs: certify tactical radar systems"
```

- [ ] **Step 6: Confirm final branch state**

Run: `git status --short && git log --oneline -8`

Expected: empty status and small coherent radar commits at branch tip; do not push.
