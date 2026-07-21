# Vehicle Theater Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship map-owned rectangular geometry, six 600–900-unit Military Operation theaters, four semantic elevation levels, and deterministic vehicle-aware AI telemetry without changing legacy 300-unit battles.

**Architecture:** Keep `TILE=3`, legacy `GRID=100`, and legacy `WORLD=300` as compatibility exports while making `GameMap.geometry` authoritative for every new theater and every runtime consumer. New theater generators live outside the ten legacy fronts and publish domain routes/landing zones through serializable metadata. Elevation and vehicle telemetry each get one focused module so sim, renderer, HUD, tests, and later rotorcraft/naval releases share the same laws.

**Tech Stack:** TypeScript, Three.js, deterministic `Rng`, Vitest, Vite, DOM canvas Map Maker/HUD, authoritative `World` simulation.

## Global Constraints

- Work only in `D:/git/ShootEM/.claude/worktrees/military-operations` on `codex/military-operations`.
- Stage files by explicit path; never use `git add -A`.
- Do not push.
- Tile size remains exactly `3` world units; assets, ranges, and vehicle speeds are never stretched.
- Legacy maps without geometry load as `{ cols: 100, rows: 100, tile: 3 }` and retain their generated terrain and coordinates.
- Fixed-wing-primary missions require at least one 900-unit maneuver axis.
- City is 600×600u; Desert, Countryside, and Ocean are 900×900u; Mountain is 600×900u; Coastal is 900×600u.
- Elevation is exactly `0 Ground`, `1 Building`, `2 Sky`, `3 Clouds`; rotorcraft cap at Sky and jets may use Clouds.
- Submarine depth remains a future separate `DepthState`; this plan must not encode it as negative altitude.
- Telemetry is deterministic, bounded, JSON-serializable, and retains the seed needed to replay violations.
- Foundation acceptance: zero invalid spawns, wrong-surface hulls, unreachable required routes, non-finite positions, or persistent map-caused vehicle stalls in route probes.
- Fixed-wing first contact target: 8–45s. Ground/naval first contact target: 20–120s. Mirrored equal manifests: neither team exceeds 70% wins across seeds.
- 900×900 generation p95 budget: below 750ms across 20 deterministic seeds.
- Five-minute 24v24 authoritative run: mean step below 12ms and p99 below 25ms on the repository's normal test machine.
- Completion requires `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.

## File Structure

| File | Responsibility |
|---|---|
| `src/sim/map-geometry.ts` | Geometry validation, allocation, indexing, coordinate conversion, extents, clamp/wrap |
| `src/sim/map.ts` | Terrain vocabulary, `GameMap`, legacy generators, geometry-aware terrain queries |
| `src/sim/theater-types.ts` | Theater ids, definitions, routes, landing zones, metadata |
| `src/sim/theater-builder.ts` | Shared deterministic stamping, route carving, pads, validation inputs |
| `src/sim/theaters/land.ts` | City, Desert, Countryside generators |
| `src/sim/theaters/domain.ts` | Mountain, Coastal, Ocean generators |
| `src/sim/theaters.ts` | Catalog and `generateTheater()` public boundary |
| `src/sim/elevation.ts` | `ElevationLevel`, labels, render heights, reach/collision rules |
| `src/sim/vehicle-telemetry.ts` | Bounded vehicle samples/incidents/aggregates and report formatting |
| `src/sim/scenario-runner.ts` | Deterministic route/fight scenarios and acceptance evaluation |
| `src/sim/spatial.ts` | Geometry-sized soldier spatial index |
| `src/sim/world.ts` | Runtime geometry, bounds, elevation, telemetry hooks |
| `src/sim/bots.ts` | Route-anchor vehicle piloting and elevation behavior |
| `src/sim/operation-map.ts` | Operation-to-theater selection and metadata |
| `src/sim/mapedit.ts` | Geometry-preserving documents and validation |
| `src/client/renderer.ts` | Rectangular terrain and shared elevation heights |
| `src/client/hud.ts` | Rectangular minimap and named elevation indicator |
| `src/harness/mapmaker.ts` | Rectangular map canvas and theater source picker |
| `tests/map-geometry.test.ts` | Geometry primitive and migration laws |
| `tests/variable-map-runtime.test.ts` | Runtime bounds, collision, snapshots, spatial index |
| `tests/rectangular-presentation.test.ts` | Minimap projection and rectangular editor/presentation laws |
| `tests/theaters.test.ts` | Six-family deterministic generation and domain laws |
| `tests/theater-operations.test.ts` | Operation routing and manifest rejection |
| `tests/elevation.test.ts` | Four-level transitions, collision, reach, labels, wire values |
| `tests/vehicle-telemetry.test.ts` | Recorder determinism, boundedness, incidents, reports |
| `tests/vehicle-scenarios.test.ts` | AI route/fight acceptance matrix |
| `scripts/run-vehicle-scenarios.ts` | JSON and human report command |

---

### Task 1: Map Geometry Primitive and Legacy Migration

**Files:**
- Create: `src/sim/map-geometry.ts`
- Modify: `src/sim/map.ts:9-13,181-229,231-270`
- Modify: `src/sim/fronts.ts:230-255`
- Modify: `src/sim/skirmish.ts` map-construction return
- Modify: `src/sim/mapedit.ts:25-78,80-150`
- Test: `tests/map-geometry.test.ts`
- Test: `tests/mapedit.test.ts`

**Interfaces:**
- Produces: `MapGeometry`, `LEGACY_GEOMETRY`, `geometryLength`, `worldWidth`, `worldDepth`, `halfWidth`, `halfDepth`, `tileIndex`, `worldToTile`, `tileToWorld`, `inBounds`, `clampWorld`, `wrapWorld`, `allocateLayer`, `validateGeometry`.
- Produces: required `GameMap.geometry: MapGeometry`.
- Consumes: no new application interfaces.

- [x] **Step 1: Write failing geometry and migration tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  LEGACY_GEOMETRY, allocateLayer, clampWorld, geometryLength,
  tileIndex, tileToWorld, validateGeometry, worldDepth, worldToTile,
  worldWidth, wrapWorld,
} from '../src/sim/map-geometry';
import { deserializeDoc, serializeDoc, blankDoc } from '../src/sim/mapedit';

describe('map-owned geometry', () => {
  const rect = { cols: 200, rows: 300, tile: 3 } as const;

  it('indexes and converts a 600x900 rectangular world', () => {
    expect(geometryLength(rect)).toBe(60_000);
    expect(worldWidth(rect)).toBe(600);
    expect(worldDepth(rect)).toBe(900);
    expect(tileIndex(rect, 199, 299)).toBe(59_999);
    const p = tileToWorld(rect, 0, 0);
    expect(p).toEqual({ x: -298.5, y: 0, z: -448.5 });
    expect(worldToTile(rect, p.x, p.z)).toEqual([0, 0]);
  });

  it('clamps and wraps each rectangular axis independently', () => {
    expect(clampWorld(rect, { x: 999, y: 0, z: -999 }, 3)).toEqual({ x: 297, y: 0, z: -447 });
    expect(wrapWorld(rect, { x: 301, y: 2, z: -451 }, 1)).toEqual({ x: -299, y: 2, z: 449 });
  });

  it('rejects malformed geometry and layer sizes', () => {
    expect(() => validateGeometry({ cols: 0, rows: 100, tile: 3 })).toThrow(/cols/);
    expect(() => validateGeometry(rect, allocateLayer(rect).subarray(1))).toThrow(/60000/);
  });

  it('serializes geometry and migrates v1 documents to the legacy geometry', () => {
    const doc = blankDoc('small', 44);
    expect(deserializeDoc(serializeDoc(doc)).map.geometry).toEqual(doc.map.geometry);
    const old = serializeDoc(doc) as unknown as Record<string, unknown>;
    delete old.geometry;
    expect(deserializeDoc(old).map.geometry).toEqual(LEGACY_GEOMETRY);
  });
});
```

- [x] **Step 2: Run the focused tests and verify RED**

Run: `npx vitest run tests/map-geometry.test.ts tests/mapedit.test.ts`

Expected: FAIL because `map-geometry.ts` and `GameMap.geometry` do not exist.

- [x] **Step 3: Implement the geometry boundary**

```ts
// src/sim/map-geometry.ts
import type { Vec3 } from './types';

export interface MapGeometry { cols: number; rows: number; tile: number }
export const LEGACY_GEOMETRY: Readonly<MapGeometry> = Object.freeze({ cols: 100, rows: 100, tile: 3 });
export const geometryLength = (g: MapGeometry) => g.cols * g.rows;
export const worldWidth = (g: MapGeometry) => g.cols * g.tile;
export const worldDepth = (g: MapGeometry) => g.rows * g.tile;
export const halfWidth = (g: MapGeometry) => worldWidth(g) / 2;
export const halfDepth = (g: MapGeometry) => worldDepth(g) / 2;
export const tileIndex = (g: MapGeometry, tx: number, tz: number) => tz * g.cols + tx;
export const inBounds = (g: MapGeometry, tx: number, tz: number) => tx >= 0 && tz >= 0 && tx < g.cols && tz < g.rows;
export const worldToTile = (g: MapGeometry, x: number, z: number): [number, number] =>
  [Math.floor((x + halfWidth(g)) / g.tile), Math.floor((z + halfDepth(g)) / g.tile)];
export const tileToWorld = (g: MapGeometry, tx: number, tz: number): Vec3 =>
  ({ x: (tx + 0.5) * g.tile - halfWidth(g), y: 0, z: (tz + 0.5) * g.tile - halfDepth(g) });
export const allocateLayer = (g: MapGeometry, fill = 0) => new Uint8Array(geometryLength(g)).fill(fill);
export function validateGeometry(g: MapGeometry, ...layers: Uint8Array[]) {
  if (!Number.isInteger(g.cols) || g.cols < 16) throw new Error(`map geometry cols must be an integer >=16; got ${g.cols}`);
  if (!Number.isInteger(g.rows) || g.rows < 16) throw new Error(`map geometry rows must be an integer >=16; got ${g.rows}`);
  if (!Number.isFinite(g.tile) || g.tile <= 0) throw new Error(`map geometry tile must be positive; got ${g.tile}`);
  for (const layer of layers) if (layer.length !== geometryLength(g)) throw new Error(`map layer length ${layer.length}; expected ${geometryLength(g)}`);
  return g;
}
export function clampWorld(g: MapGeometry, p: Vec3, margin = 0): Vec3 {
  return { ...p, x: Math.max(-halfWidth(g) + margin, Math.min(halfWidth(g) - margin, p.x)), z: Math.max(-halfDepth(g) + margin, Math.min(halfDepth(g) - margin, p.z)) };
}
export function wrapWorld(g: MapGeometry, p: Vec3, margin = 0): Vec3 {
  const xEdge = halfWidth(g) - margin, zEdge = halfDepth(g) - margin;
  return { ...p, x: p.x > xEdge ? -xEdge : p.x < -xEdge ? xEdge : p.x, z: p.z > zEdge ? -zEdge : p.z < -zEdge ? zEdge : p.z };
}
```

Add `geometry: MapGeometry` to `GameMap`. Set `geometry: { ...LEGACY_GEOMETRY }` in all legacy constructors. Change Map Maker JSON to `v: 2` with `geometry`; accept `v: 1` by assigning `LEGACY_GEOMETRY` before validating all three layer lengths.

- [x] **Step 4: Run geometry, map, front, skirmish, and editor tests**

Run: `npx vitest run tests/map-geometry.test.ts tests/mapedit.test.ts tests/fronts.test.ts tests/skirmish.test.ts tests/operation-map.test.ts`

Expected: PASS with every legacy front still 100×100×3.

- [x] **Step 5: Commit the geometry primitive**

```bash
git add src/sim/map-geometry.ts src/sim/map.ts src/sim/fronts.ts src/sim/skirmish.ts src/sim/mapedit.ts tests/map-geometry.test.ts tests/mapedit.test.ts
git commit -m "feat: add map-owned geometry"
```

### Task 2: Geometry-Aware Terrain Queries and Runtime Bounds

**Files:**
- Modify: `src/sim/map.ts:65-125,231-385`
- Modify: `src/sim/spatial.ts`
- Modify: `src/sim/world.ts` map-query and boundary call sites
- Modify: `src/sim/bots.ts` map-query and pathfinding call sites
- Modify: `src/sim/perception.ts` geometry-aware LOS inputs
- Test: `tests/variable-map-runtime.test.ts`
- Test: `tests/sim.test.ts`
- Test: `tests/airwar.test.ts`

**Interfaces:**
- Consumes: `MapGeometry` and conversion/extents helpers from Task 1.
- Produces: optional geometry argument on `tileAt`, `surfaceAt`, `houseAt`, `isBlocked`, `losClear`, `losClearUpper`, and path helpers; `SoldierIndex.resize(geometry)`.

- [ ] **Step 1: Write failing rectangular runtime tests**

```ts
import { describe, expect, it } from 'vitest';
import { T_OPEN, T_WALL, isBlocked, tileAt } from '../src/sim/map';
import { allocateLayer, tileIndex } from '../src/sim/map-geometry';
import { SoldierIndex } from '../src/sim/spatial';

describe('rectangular runtime geometry', () => {
  const geometry = { cols: 200, rows: 300, tile: 3 } as const;
  const grid = allocateLayer(geometry, T_OPEN);
  grid[tileIndex(geometry, 199, 299)] = T_WALL;

  it('terrain queries use the map extents, not 100x100 compatibility constants', () => {
    expect(tileAt(grid, 298.5, 448.5, geometry)).toBe(T_WALL);
    expect(isBlocked(grid, 298.5, 448.5, false, geometry)).toBe(true);
    expect(tileAt(grid, 0, 400, geometry)).toBe(T_OPEN);
  });

  it('the spatial index finds soldiers near the far rectangular edge', () => {
    const index = new SoldierIndex(geometry);
    const soldier = { id: 77, team: 0, pos: { x: 250, y: 0, z: 400 }, alive: true } as never;
    index.rebuild([soldier]);
    expect(index.near(0, 250, 400, 5)).toContain(soldier);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/variable-map-runtime.test.ts`

Expected: FAIL because queries and `SoldierIndex` still assume 300 units.

- [ ] **Step 3: Thread geometry through map and runtime consumers**

Keep legacy-compatible defaults:

```ts
export function tileAt(grid: Uint8Array, x: number, z: number, geometry: MapGeometry = LEGACY_GEOMETRY): number {
  const [tx, tz] = worldToTile(geometry, x, z);
  return inBounds(geometry, tx, tz) ? grid[tileIndex(geometry, tx, tz)] : T_WALL;
}

export function isBlocked(
  grid: Uint8Array, x: number, z: number, hover = false,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean {
  const t = tileAt(grid, x, z, geometry);
  return hover ? t === T_WALL || t === T_METAL : BLOCKING.has(t);
}
```

The snippet illustrates geometry threading only; preserve the current complete
tile/hover blocking decision table byte-for-byte. Construct `SoldierIndex`
with `this.map.geometry`. Replace World X/Z clamps and aircraft wrap with
`clampWorld(this.map.geometry, ...)` and `wrapWorld(this.map.geometry, ...)`.
Pass `this.map.geometry` to every runtime terrain query. Update bot BFS
allocation/indexing to `cols × rows`; keep iteration order row-major so
deterministic tie behavior remains stable.

- [ ] **Step 4: Run targeted regression tests**

Run: `npx vitest run tests/variable-map-runtime.test.ts tests/sim.test.ts tests/airwar.test.ts tests/botbrain.test.ts tests/bots-nav.test.ts tests/visionfade.test.ts tests/upperlos.test.ts tests/range.test.ts`

Expected: PASS; legacy flight wrap and bot decisions retain their existing assertions.

- [ ] **Step 5: Commit runtime geometry**

```bash
git add src/sim/map.ts src/sim/spatial.ts src/sim/world.ts src/sim/bots.ts src/sim/perception.ts tests/variable-map-runtime.test.ts
git commit -m "feat: honor rectangular maps in the simulation"
```

### Task 3: Rectangular Renderer, Minimap, and Map Maker

**Files:**
- Modify: `src/client/renderer.ts` terrain/cloud/breach coordinate paths
- Modify: `src/client/hud.ts:150-175,890-930` minimap transforms
- Modify: `src/harness/mapmaker.ts:205-270,310-490`
- Modify: `src/sim/mapedit.ts` geometry-aware edit and validation loops
- Test: `tests/mapedit.test.ts`
- Test: `tests/map-geometry.test.ts`
- Create: `tests/rectangular-presentation.test.ts`

**Interfaces:**
- Consumes: `GameMap.geometry` and Task 1 helpers.
- Produces: `minimapPoint(geometry, size, worldPos)`, `blankGeometryDoc(geometry, seed, theme)`, and geometry-preserving Map Maker documents.

- [ ] **Step 1: Add failing projection and rectangular editor tests**

```ts
import { minimapPoint } from '../src/client/hud';
import { blankGeometryDoc, deserializeDoc, serializeDoc, validateDoc } from '../src/sim/mapedit';

it('projects rectangular corners independently', () => {
  const g = { cols: 300, rows: 200, tile: 3 };
  expect(minimapPoint(g, 240, { x: -450, y: 0, z: -300 })).toEqual([0, 0]);
  expect(minimapPoint(g, 240, { x: 450, y: 0, z: 300 })).toEqual([240, 240]);
});

it('round-trips and validates a 900x600 Map Maker document', () => {
  const doc = blankGeometryDoc({ cols: 300, rows: 200, tile: 3 }, 77, 'savanna');
  expect(doc.map.grid).toHaveLength(60_000);
  expect(validateDoc(doc).ok).toBe(true);
  expect(deserializeDoc(serializeDoc(doc)).map.geometry).toEqual(doc.map.geometry);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/map-geometry.test.ts tests/mapedit.test.ts tests/rectangular-presentation.test.ts`

Expected: FAIL because projection and rectangular documents do not exist.

- [ ] **Step 3: Implement rectangular presentation and editing**

Use `cols`, `rows`, `worldWidth`, and `worldDepth` independently:

```ts
export function minimapPoint(g: MapGeometry, size: number, p: Vec3): [number, number] {
  return [((p.x + halfWidth(g)) / worldWidth(g)) * size, ((p.z + halfDepth(g)) / worldDepth(g)) * size];
}
```

Renderer terrain planes use `PlaneGeometry(worldWidth(g), worldDepth(g))`; loops index `z * g.cols + x`; clouds distribute across the two extents; breach/rubble lookup uses `g.cols`. Map Maker chooses pixels from both dimensions, sizes its canvas `cols × rows`, converts pointer positions independently, and shows `600 × 900u` in the document header. `validateDoc` allocates and floods `geometryLength(g)` cells.

- [ ] **Step 4: Run presentation/editor regressions**

Run: `npx vitest run tests/map-geometry.test.ts tests/mapedit.test.ts tests/rectangular-presentation.test.ts tests/walls.test.ts tests/visual.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit rectangular presentation**

```bash
git add src/client/renderer.ts src/client/hud.ts src/harness/mapmaker.ts src/sim/mapedit.ts tests/map-geometry.test.ts tests/mapedit.test.ts tests/rectangular-presentation.test.ts
git commit -m "feat: render and edit rectangular theaters"
```

### Task 4: Theater Catalog and Shared Builder

**Files:**
- Create: `src/sim/theater-types.ts`
- Create: `src/sim/theater-builder.ts`
- Create: `src/sim/theaters.ts`
- Modify: `src/sim/map.ts` `GameMap.theater`
- Test: `tests/theaters.test.ts`

**Interfaces:**
- Produces: `TheaterId`, `TheaterDomain`, `TheaterRoute`, `LandingZone`, `TheaterMetadata`, `THEATER_DEFS`, `createTheaterBase`, `carveRoute`, `placeDomainPad`, `finalizeTheater`, `generateTheater`.
- Consumes: geometry helpers, terrain constants, `Rng`, `GameMap`, `VehicleKind`.

- [ ] **Step 1: Write failing catalog and base-builder tests**

```ts
import { describe, expect, it } from 'vitest';
import { THEATER_DEFS, generateTheater } from '../src/sim/theaters';

describe('vehicle theater catalog', () => {
  it('locks the six approved dimensions', () => {
    expect(Object.fromEntries(Object.entries(THEATER_DEFS).map(([id, d]) => [id, d.geometry]))).toEqual({
      city: { cols: 200, rows: 200, tile: 3 },
      desert: { cols: 300, rows: 300, tile: 3 },
      countryside: { cols: 300, rows: 300, tile: 3 },
      mountain: { cols: 200, rows: 300, tile: 3 },
      coastal: { cols: 300, rows: 200, tile: 3 },
      ocean: { cols: 300, rows: 300, tile: 3 },
    });
  });

  it('publishes typed routes and matching geometry', () => {
    const map = generateTheater('desert', 42);
    expect(map.geometry).toEqual(THEATER_DEFS.desert.geometry);
    expect(map.theater?.id).toBe('desert');
    expect(map.theater?.routes.some((r) => r.domain === 'air' && r.points.length >= 4)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the catalog test and verify RED**

Run: `npx vitest run tests/theaters.test.ts`

Expected: FAIL because the theater modules do not exist.

- [ ] **Step 3: Implement types, definitions, and builder invariants**

```ts
export type TheaterId = 'city' | 'desert' | 'countryside' | 'mountain' | 'coastal' | 'ocean';
export type TheaterDomain = 'foot' | 'ground' | 'air' | 'surface' | 'deep';
export interface TheaterRoute { id: string; domain: TheaterDomain; width: number; points: Vec3[] }
export interface LandingZone { id: string; pos: Vec3; radius: number; slope: number; side: Team | null }
export interface TheaterMetadata {
  id: TheaterId;
  routes: TheaterRoute[];
  landingZones: LandingZone[];
  deepWater: number[];
}
```

`createTheaterBase` allocates three layers, seals the rim, initializes empty entities, and attaches metadata. `carveRoute` stamps a disc of the declared width along each segment. `placeDomainPad` verifies surface/domain before appending. `finalizeTheater` validates layer lengths, prunes stale claims/props, and throws `theater <id> seed <seed>: <law>` on failure.

- [ ] **Step 4: Run the catalog test**

Run: `npx vitest run tests/theaters.test.ts -t "catalog|base"`

Expected: PASS.

- [ ] **Step 5: Commit theater infrastructure**

```bash
git add src/sim/theater-types.ts src/sim/theater-builder.ts src/sim/theaters.ts src/sim/map.ts tests/theaters.test.ts
git commit -m "feat: add vehicle theater catalog"
```

### Task 5: City, Desert, and Countryside Generators

**Files:**
- Create: `src/sim/theaters/land.ts`
- Modify: `src/sim/theaters.ts`
- Test: `tests/theaters.test.ts`

**Interfaces:**
- Consumes: Task 4 builder functions and existing building stencils.
- Produces: `generateCityTheater(seed)`, `generateDesertTheater(seed)`, `generateCountrysideTheater(seed)`.

- [ ] **Step 1: Add failing land-family laws over ten seeds**

```ts
const seeds = [7, 31, 42, 99, 4207, 5150, 7749, 1337, 90210, 606];
it.each(['city', 'desert', 'countryside'] as const)('%s carries its vehicle grammar', (id) => {
  for (const seed of seeds) {
    const m = generateTheater(id, seed);
    expect(validateTheater(m).issues).toEqual([]);
    expect(routesConnectBases(m, 'ground')).toBe(true);
    expect(m.theater!.routes.filter((r) => r.domain === 'ground').length).toBeGreaterThanOrEqual(3);
    expect(m.theater!.routes.filter((r) => r.domain === 'air').some((r) => routeSpan(m, r) >= 540)).toBe(true);
  }
});

it('city has districts and two heavy through-routes but is not a dogfight site', () => {
  const m = generateTheater('city', 7749);
  expect(m.controlPoints.map((x) => x.name)).toEqual(expect.arrayContaining(['DOWNTOWN', 'RAIL YARD', 'RESIDENTIAL']));
  expect(heavyVehicleRouteCount(m)).toBeGreaterThanOrEqual(2);
  expect(m.theater?.freeDogfight).toBe(false);
});
```

- [ ] **Step 2: Run land-family tests and verify RED**

Run: `npx vitest run tests/theaters.test.ts -t "city|desert|countryside|land"`

Expected: FAIL because generators and validators are absent.

- [ ] **Step 3: Implement the three distinct grammars**

City: stamp a 12-tile primary avenue cross, two 8-tile bypasses, 16–24 deterministic blocks with existing commercial/residential/industrial buildings, three named districts, bases on opposite avenue ends, and two 30-tile-wide air approaches that terminate outside the dense core.

Desert: carve two diagonal armor axes and a wadi route; stamp rock/dune cover in elongated bands rather than uniform scatter; place 2–4 sparse compounds; publish two 900u air loops and a terrain-masked Building-level run.

Countryside: carve a primary paved S-route plus two farm tracks; stamp 3–5 villages, hedgerow field rectangles with gated breaks, woods outside vehicle lanes, and at least six landing zones split behind/on/ahead of the front.

Use deterministic counts derived only from `Rng(seed)`. Mirror strategic assets by team, then allow cosmetic asymmetry. Every road width comes from `requiredLaneTiles(maxHullRadius, passing)` instead of a literal smaller than the Ares clearance.

- [ ] **Step 4: Run land and legacy map laws**

Run: `npx vitest run tests/theaters.test.ts tests/fronts.test.ts tests/buildings.test.ts tests/walls.test.ts`

Expected: PASS across all 30 land-theater seeds and all legacy fronts.

- [ ] **Step 5: Commit land theaters**

```bash
git add src/sim/theaters/land.ts src/sim/theaters.ts tests/theaters.test.ts
git commit -m "feat: build city desert and countryside theaters"
```

### Task 6: Mountain, Coastal, and Ocean Generators

**Files:**
- Create: `src/sim/theaters/domain.ts`
- Modify: `src/sim/theaters.ts`
- Test: `tests/theaters.test.ts`

**Interfaces:**
- Consumes: Task 4 builder functions and water/deep terrain constants.
- Produces: `generateMountainTheater(seed)`, `generateCoastalTheater(seed)`, `generateOceanTheater(seed)`.

- [ ] **Step 1: Add failing domain-family laws**

```ts
it.each(['mountain', 'coastal', 'ocean'] as const)('%s carries its domain grammar', (id) => {
  for (const seed of seeds) expect(validateTheater(generateTheater(id, seed)).issues).toEqual([]);
});

it('mountain exposes pass ridge and valley alternatives', () => {
  const m = generateTheater('mountain', 4207);
  expect(new Set(m.theater!.routes.filter((r) => r.domain === 'ground').map((r) => r.id)))
    .toEqual(new Set(['mountain:pass', 'mountain:ridge', 'mountain:valley']));
});

it.each(['coastal', 'ocean'] as const)('%s has connected surface and deep water', (id) => {
  const m = generateTheater(id, 5150);
  expect(routesConnectBases(m, 'surface')).toBe(true);
  expect(deepWaterConnected(m)).toBe(true);
  expect(m.theater!.deepWater.length).toBeGreaterThan(500);
});
```

- [ ] **Step 2: Run domain-family tests and verify RED**

Run: `npx vitest run tests/theaters.test.ts -t "mountain|coastal|ocean|domain"`

Expected: FAIL because the generators do not exist.

- [ ] **Step 3: Implement the three domain grammars**

Mountain: build visible rock massifs from `T_METAL`/rock props, carve one 12-tile pass, one 8-tile ridge road, and one 10-tile valley road from opposing bases; publish ridge AA anchors and four valid landing zones; preserve a 900u north-south air axis.

Coastal: allocate roughly 45% continuous sea and 55% land; cut a port channel, two beach landing corridors, an offshore route around defenses, and three inland objective routes; mark deep cells outside shallows; place boat pads only on connected water and ground hulls only beyond the beach margin.

Ocean: start deep, add 3–6 islands/shoals without severing surface/deep connectivity, publish two convoy lanes and two opposing patrol loops, place ports on two largest islands, and ensure island foot objectives have landing zones connected to surface routes.

- [ ] **Step 4: Run domain and water regressions**

Run: `npx vitest run tests/theaters.test.ts tests/waterline.test.ts tests/operation-map.test.ts tests/frostbridge.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit domain theaters**

```bash
git add src/sim/theaters/domain.ts src/sim/theaters.ts tests/theaters.test.ts
git commit -m "feat: build mountain coastal and ocean theaters"
```

### Task 7: Theater Validation and Performance Guard

**Files:**
- Modify: `src/sim/theater-builder.ts`
- Modify: `tests/theaters.test.ts`
- Create: `tests/theater-performance.test.ts`

**Interfaces:**
- Produces: `validateTheater(map): TheaterValidation`, `routesConnectBases`, `deepWaterConnected`, `heavyVehicleRouteCount`, `measureTheaterGeneration`.
- Consumes: `GameMap.theater`, vehicle radii, terrain/domain rules.

- [ ] **Step 1: Write failing corruption and performance tests**

```ts
it('names the theater seed and violated law', () => {
  const m = generateTheater('coastal', 42);
  const boat = m.vehiclePads.find((p) => p.kind === 'boat')!;
  boat.pos = { ...m.basePos[0] };
  expect(validateTheater(m).issues.join('\n')).toMatch(/coastal seed 42.*wrong surface/i);
});

it('generates 900x900 theaters under the approved p95 budget', () => {
  const samples = ['desert', 'countryside', 'ocean'].flatMap((id) =>
    Array.from({ length: 20 }, (_, seed) => measureTheaterGeneration(id as TheaterId, seed).ms));
  samples.sort((a, b) => a - b);
  expect(samples[Math.floor(samples.length * 0.95)]).toBeLessThan(750);
});
```

- [ ] **Step 2: Run validation/performance tests and verify RED**

Run: `npx vitest run tests/theaters.test.ts tests/theater-performance.test.ts`

Expected: FAIL because complete validation and timing helper are absent.

- [ ] **Step 3: Implement all shared theater laws**

Validate layer sizes; rims; finite coordinates; foot/ground/surface/deep route reachability; objective-domain reachability; pad surfaces and separation; indoor pads; landing-zone slope/clearance; largest-hull lane clearance sampled along routes; rendered-blocker claims; fixed-wing axis length; and route ids/point counts. Cache flood fields by `(map, domain, startIndex)` during validation so the matrix does not repeat full-grid BFS.

- [ ] **Step 4: Run full map-law suite**

Run: `npx vitest run tests/theaters.test.ts tests/theater-performance.test.ts tests/fronts.test.ts tests/skirmish.test.ts tests/mapedit.test.ts tests/walls.test.ts`

Expected: PASS with p95 printed by the performance test on failure only.

- [ ] **Step 5: Commit theater laws**

```bash
git add src/sim/theater-builder.ts tests/theaters.test.ts tests/theater-performance.test.ts
git commit -m "test: enforce vehicle theater laws"
```

### Task 8: Military Operation Theater Selection

**Files:**
- Modify: `src/sim/world.ts` `WorldOptions`
- Modify: `src/sim/world.ts` map selection
- Modify: `src/sim/operation-map.ts`
- Modify: `src/sim/operations.ts` theater compatibility helpers
- Modify: `src/sim/snapshot.ts` puppet theater construction and map identity
- Modify: `src/server/server.ts` welcome payload
- Modify: `src/client/net.ts` welcome validation
- Modify: `src/client/replay.ts` theater-aware replay worlds
- Modify: `src/client/operations-ui.ts`
- Modify: `src/harness/mapmaker.ts`
- Create: `tests/theater-network.test.ts`
- Test: `tests/theater-operations.test.ts`
- Test: `tests/operation-map.test.ts`
- Test: `tests/operations-ui.test.ts`

**Interfaces:**
- Produces: `theaterForOperation(plan): TheaterId | null`, `operationRequiresVehicleTheater(plan, manifest, inventory): boolean`, `mapIdentity(map): string`, `assertMapIdentity(map, expected): void`.
- Produces: `WorldOptions.theaterId?: TheaterId` for direct scenarios, multiplayer puppets, and replays.
- Consumes: `generateTheater`, Operation sites/verbs/domains, manifest hull definitions.

- [ ] **Step 1: Write failing operation selection tests**

```ts
const inventory: OperationHull[] = [
  { id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' },
  { id: 'falcon-01', kind: 'interceptor', name: 'Falcon One', status: 'available' },
  { id: 'pike-01', kind: 'boat', name: 'Pike One', status: 'available' },
];
const operationPlan = (overrides: Partial<OperationPlan>): OperationPlan => ({
  ...generateOperation({ seed: 42, frontId: 'the_port', frontName: 'The Port', pass: 3 }),
  ...overrides,
});
const manifestFor = (plan: OperationPlan): OperationManifest => ({
  hullIds: inventory.filter((h) => h.kind !== 'boat' || plan.domains.includes('sea')).map((h) => h.id),
  ammunition: 2,
  support: 'none',
});

it.each([
  ['air_superiority', 'airfield', 'desert'],
  ['intercept', 'mountain_pass', 'mountain'],
  ['amphibious_assault', 'port', 'coastal'],
  ['blockade', 'carrier_anchorage', 'ocean'],
  ['spearhead', 'rail_hub', 'city'],
] as const)('%s at %s selects %s', (verb, site, theater) => {
  const plan = operationPlan({ verb, site });
  expect(theaterForOperation(plan)).toBe(theater);
  expect(generateOperationMap(plan, manifestFor(plan), inventory).theater?.id).toBe(theater);
});

it('never puts fixed-wing Air Superiority into the 600u City', () => {
  const plan = operationPlan({ verb: 'air_superiority', site: 'rail_hub' });
  expect(theaterForOperation(plan)).toBe('countryside');
});

it('rejects a blue-water boat manifest from a dry legacy pocket', () => {
  const plan = operationPlan({ site: 'strongpoint', scale: 'skirmish', domains: ['land'] });
  expect(() => generateOperationMap(plan, { hullIds: ['pike-01'], ammunition: 1, support: 'none' }, inventory))
    .toThrow(/Pike.*strongpoint|strongpoint.*water/i);
});

it('rejects a client theater whose deterministic map identity differs', () => {
  const serverMap = generateTheater('mountain', 4207);
  const clientMap = generateTheater('mountain', 4208);
  expect(() => assertMapIdentity(clientMap, mapIdentity(serverMap))).toThrow(/map identity mismatch/i);
  expect(() => assertMapIdentity(generateTheater('mountain', 4207), mapIdentity(serverMap))).not.toThrow();
});
```

- [ ] **Step 2: Run operation tests and verify RED**

Run: `npx vitest run tests/theater-operations.test.ts tests/theater-network.test.ts tests/operation-map.test.ts tests/operations-ui.test.ts`

Expected: FAIL because operation theater selection is absent.

- [ ] **Step 3: Implement selection, dressing, and briefing details**

Map site/verb combinations exactly:

```ts
const SITE_THEATER: Record<OperationSiteId, TheaterId> = {
  front_line: 'countryside', strongpoint: 'desert', river_crossing: 'coastal',
  supply_depot: 'desert', rail_hub: 'city', airfield: 'desert',
  coastal_battery: 'coastal', port: 'coastal', carrier_anchorage: 'ocean',
  mountain_pass: 'mountain',
};
```

Override City to Countryside for fixed-wing-primary verbs. Preserve legacy maps for small land-only Spearhead/Siege plans. Dress objectives and committed hulls using geometry-aware candidate scans. Show theater name, `width × depth`, supported domains, weather, and `GROUND / BUILDING / SKY / CLOUDS` access in the planning modal. Add six theater sources to Map Maker.

Hash the theater id, seed, geometry, and three terrain layers with a stable
32-bit FNV-1a implementation. Server welcome messages include `theaterId` and
`mapIdentity`. `createPuppetWorld` regenerates that theater and throws before
snapshot application when the identity differs. Replay constructors retain
the same theater id and identity; legacy welcome/replay data without them uses
the classic generator unchanged.

- [ ] **Step 4: Run Operation integration tests**

Run: `npx vitest run tests/theater-operations.test.ts tests/theater-network.test.ts tests/operation-map.test.ts tests/operation-runtime.test.ts tests/operations-ui.test.ts tests/operations-integration.test.ts tests/sim.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Operation integration**

```bash
git add src/sim/world.ts src/sim/operation-map.ts src/sim/operations.ts src/sim/snapshot.ts src/server/server.ts src/client/net.ts src/client/replay.ts src/client/operations-ui.ts src/harness/mapmaker.ts tests/theater-operations.test.ts tests/theater-network.test.ts tests/operation-map.test.ts tests/operations-ui.test.ts
git commit -m "feat: route military operations to vehicle theaters"
```

### Task 9: Four Semantic Elevation Levels

**Files:**
- Create: `src/sim/elevation.ts`
- Modify: `src/sim/types.ts` `Vehicle.band`
- Modify: `src/sim/world.ts` flight transitions/collision/reach
- Modify: `src/sim/snapshot.ts`
- Modify: `src/client/renderer.ts` aircraft height/cloud visibility
- Modify: `src/client/hud.ts` elevation chip
- Modify: `tests/airwar.test.ts`
- Create: `tests/elevation.test.ts`

**Interfaces:**
- Produces: `ElevationLevel = 0 | 1 | 2 | 3`, `ElevationWeaponClass`, `ELEVATION_LABEL`, `ELEVATION_ALT`, `maxElevationFor`, `canWeaponReachElevation`, `collidesAtElevation`.
- Consumes: `VehicleDef`, terrain/tall-obstacle lookup, projectile `airScaled`.

- [ ] **Step 1: Write failing elevation-law tests**

```ts
import { ELEVATION_ALT, ELEVATION_LABEL, canWeaponReachElevation } from '../src/sim/elevation';

it('names and orders all four levels from one source of truth', () => {
  expect(ELEVATION_LABEL).toEqual(['GROUND', 'BUILDING', 'SKY', 'CLOUDS']);
  expect(ELEVATION_ALT[0]).toBeLessThan(ELEVATION_ALT[1]);
  expect(ELEVATION_ALT[1]).toBeLessThan(ELEVATION_ALT[2]);
  expect(ELEVATION_ALT[2]).toBeLessThan(ELEVATION_ALT[3]);
});

it('rotors cap at Sky while jets can climb to Clouds', () => {
  expect(maxElevationFor(VEHICLES.flyer)).toBe(2);
  expect(maxElevationFor(VEHICLES.interceptor)).toBe(3);
});

it('ordinary fire stops at Building, MANPADS at Sky, and Lance reaches Clouds', () => {
  expect(canWeaponReachElevation('ground', 2)).toBe(false);
  expect(canWeaponReachElevation('manpads', 2)).toBe(true);
  expect(canWeaponReachElevation('lance', 3)).toBe(true);
});
```

- [ ] **Step 2: Run elevation tests and verify RED**

Run: `npx vitest run tests/elevation.test.ts tests/airwar.test.ts`

Expected: FAIL because the semantic module does not exist.

- [ ] **Step 3: Implement the shared elevation law**

```ts
export type ElevationLevel = 0 | 1 | 2 | 3;
export type ElevationWeaponClass = 'ground' | 'manpads' | 'lance' | 'aircraft';
export const ELEVATION_LABEL = ['GROUND', 'BUILDING', 'SKY', 'CLOUDS'] as const;
export const ELEVATION_ALT: Record<ElevationLevel, number> = { 0: 0.12, 1: 5.4, 2: 14, 3: 28 };
export const maxElevationFor = (v: VehicleDef): ElevationLevel => v.flies ? (v.minAirspeed ? 3 : 2) : 0;
export const canWeaponReachElevation = (kind: ElevationWeaponClass, level: ElevationLevel) =>
  level <= (kind === 'ground' ? 1 : kind === 'manpads' ? 2 : 3);
```

Use typed values for transitions and snapshots. Building checks tall structures/ridges and deals speed-scaled crash damage. Sky clears ordinary roofs. Clouds apply weather/cloud target-lock penalties but remain hittable by Lance/air weapons. Jets at Ground/Building retain minimum airspeed and cannot hover; rotors cap at Sky. Renderer removes its local `BAND_ALT`; HUD prints `ALT SKY 2/3` and Q/E hints from the shared labels.

- [ ] **Step 4: Run air, AA, snapshot, HUD, and renderer-law tests**

Run: `npx vitest run tests/elevation.test.ts tests/airwar.test.ts tests/antiair.test.ts tests/flight.test.ts tests/sim.test.ts tests/operation-hud.test.ts tests/visual.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit elevation semantics**

```bash
git add src/sim/elevation.ts src/sim/types.ts src/sim/world.ts src/sim/snapshot.ts src/client/renderer.ts src/client/hud.ts tests/elevation.test.ts tests/airwar.test.ts
git commit -m "feat: formalize four elevation levels"
```

### Task 10: Vehicle Route Anchors and AI Piloting

**Files:**
- Modify: `src/sim/bots.ts`
- Modify: `src/sim/types.ts` bot route state
- Modify: `src/sim/world.ts` deterministic vehicle-role assignment
- Create: `src/sim/scenario-runner.ts`
- Create: `tests/vehicle-scenarios.test.ts`
- Create: `tests/ai-vehicles.test.ts`

**Interfaces:**
- Produces: `vehicleRouteFor(world, soldier, vehicle): TheaterRoute | null`, `vehicleWaypoint`, `assignVehicleRoles`, `runScenario`, `makeRouteProbe`, `makeAirProbe`.
- Consumes: `GameMap.theater.routes`, landing zones, vehicle domain and elevation.

- [ ] **Step 1: Write failing deterministic route-probe tests**

```ts
it.each(['city', 'desert', 'countryside', 'mountain', 'coastal', 'ocean'] as const)
('a bot completes a declared %s vehicle route', (theater) => {
  const probe = makeRouteProbe(theater, 42);
  runScenario(probe.world, 180);
  expect(probe.result().nonFinite).toBe(0);
  expect(probe.result().persistentStalls).toBe(0);
  expect(probe.result().routeCompleted).toBe(true);
});

it('a jet uses Building Sky and Clouds during a strike profile', () => {
  const probe = makeAirProbe('desert', 7749, 'strike');
  runScenario(probe.world, 150);
  expect(probe.result().elevationUsed).toEqual(expect.arrayContaining([1, 2, 3]));
});
```

- [ ] **Step 2: Run AI vehicle tests and verify RED**

Run: `npx vitest run tests/vehicle-scenarios.test.ts tests/ai-vehicles.test.ts`

Expected: FAIL because route probes and theater-aware piloting are absent.

- [ ] **Step 3: Implement domain route following**

Choose routes by stable hash `(soldier.id, vehicle.id, route.id)`, not iteration accident. Ground vehicles use geometry-aware BFS to the next route point. Boats follow surface routes rather than a hard-coded 33u moat. Aircraft follow patrol/approach points with wrap-aware steering; strike AI descends Clouds→Sky→Building on approach, fires, then climbs. A route point advances inside `max(6, route.width/2)`. After two three-second low-displacement windows, reverse/repath; the third files a persistent stall and exits only when the vehicle can lawfully disembark.

- [ ] **Step 4: Run AI route and legacy behavior tests**

Run: `npx vitest run tests/vehicle-scenarios.test.ts tests/ai-vehicles.test.ts tests/ai-behavior.test.ts tests/botbrain.test.ts tests/bots-nav.test.ts tests/waterline.test.ts tests/airwar.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit vehicle AI**

```bash
git add src/sim/bots.ts src/sim/types.ts src/sim/world.ts src/sim/scenario-runner.ts tests/vehicle-scenarios.test.ts tests/ai-vehicles.test.ts
git commit -m "feat: teach vehicle AI theater routes"
```

### Task 11: Vehicle-Aware Black Box

**Files:**
- Create: `src/sim/vehicle-telemetry.ts`
- Modify: `src/sim/blackbox.ts`
- Modify: `src/sim/world.ts`
- Modify: `src/sim/scenario-runner.ts`
- Modify: `src/main.ts`
- Test: `tests/vehicle-telemetry.test.ts`
- Modify: `tests/blackbox.test.ts`

**Interfaces:**
- Produces: `VehicleSample`, `VehicleIncident`, `VehicleAggregate`, `VehicleTelemetry`, `createVehicleTelemetry`, `stepVehicleTelemetry`, `recordVehicleEvent`, `vehicleTelemetryReport`; scenario helpers `runTelemetryProbe`, `boxedVehicleProbe`, `runDuel`.
- Consumes: live World vehicles, elevation, operation/theater metadata, damage/death/objective events.

- [ ] **Step 1: Write failing recorder tests**

```ts
it('records bounded deterministic movement and elevation data', () => {
  const a = runTelemetryProbe('desert', 42, 180);
  const b = runTelemetryProbe('desert', 42, 180);
  expect(a).toEqual(b);
  expect(a.samples.length).toBeLessThanOrEqual(VEHICLE_SAMPLE_LIMIT);
  expect(a.summary.distanceByKind.interceptor).toBeGreaterThan(0);
  expect(a.summary.elevationSeconds[3]).toBeGreaterThan(0);
});

it('files a reproducible persistent vehicle stall', () => {
  const { world, vehicle } = boxedVehicleProbe();
  runScenario(world, 8);
  expect(world.vehicleTelemetry.incidents).toContainEqual(expect.objectContaining({
    kind: 'stuck', vehicleId: vehicle.id, theaterId: 'city', seed: world.map.seed,
  }));
});

it('reports combat by attacker and victim hull kind', () => {
  const result = runDuel('tank', 'tank', 31);
  expect(result.summary.lossesByKind.tank).toBeGreaterThan(0);
  expect(vehicleTelemetryReport(result)).toMatch(/first contact|tank.*loss/i);
});
```

- [ ] **Step 2: Run recorder tests and verify RED**

Run: `npx vitest run tests/vehicle-telemetry.test.ts tests/blackbox.test.ts`

Expected: FAIL because vehicle telemetry does not exist.

- [ ] **Step 3: Implement bounded sampling, incidents, and event counters**

Sample every two sim seconds. Store prior vehicle position per id and count alive/crewed/moving/engaged by team/domain/kind; distance; commanded speed versus displacement; elevation seconds; route progress. File incidents for six seconds of commanded movement with less than 1.2u displacement, wrong surface, non-finite position, crash, bailout, abandon, and boundary wrap. Hook projectile shots/hits, vehicle deaths, objective progress, landing, and route completion through explicit `recordVehicleEvent` calls. Cap samples at 600 and incidents at 80. Extend `__ww.blackbox()` and saved last-flight data with a `vehicles` member.

- [ ] **Step 4: Run telemetry and combat regressions**

Run: `npx vitest run tests/vehicle-telemetry.test.ts tests/blackbox.test.ts tests/airwar.test.ts tests/antiair.test.ts tests/requisition.test.ts tests/operation-runtime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit vehicle telemetry**

```bash
git add src/sim/vehicle-telemetry.ts src/sim/blackbox.ts src/sim/world.ts src/sim/scenario-runner.ts src/main.ts tests/vehicle-telemetry.test.ts tests/blackbox.test.ts
git commit -m "feat: record vehicle battle telemetry"
```

### Task 12: Scenario Runner, Balance Matrix, and Performance Evidence

**Files:**
- Modify: `src/sim/scenario-runner.ts`
- Create: `scripts/run-vehicle-scenarios.ts`
- Modify: `package.json`
- Modify: `tests/vehicle-scenarios.test.ts`
- Modify: `tests/theater-performance.test.ts`
- Create: `docs/reference/vehicle-theaters/foundation-report.json`
- Create: `docs/reference/vehicle-theaters/foundation-report.md`

**Interfaces:**
- Produces: `VehicleScenario`, `VehicleScenarioResult`, `runVehicleScenario`, `runFoundationMatrix`, `evaluateFoundationMatrix`.
- Consumes: theater generation, World, route AI, vehicle telemetry.

- [ ] **Step 1: Add failing matrix acceptance tests**

```ts
it('passes the foundation scenario matrix', () => {
  const report = runFoundationMatrix({ seeds: [7, 31, 42, 99, 4207, 5150, 7749, 1337, 90210, 606] });
  const verdict = evaluateFoundationMatrix(report);
  expect(verdict.structuralFailures).toEqual([]);
  expect(verdict.routeFailures).toEqual([]);
  expect(verdict.fixedWingFirstContact).toEqual(expect.objectContaining({ min: expect.any(Number), max: expect.any(Number) }));
  expect(verdict.fixedWingFirstContact.min).toBeGreaterThanOrEqual(8);
  expect(verdict.fixedWingFirstContact.max).toBeLessThanOrEqual(45);
  expect(verdict.groundNavalFirstContact.min).toBeGreaterThanOrEqual(20);
  expect(verdict.groundNavalFirstContact.max).toBeLessThanOrEqual(120);
  expect(verdict.maxMirroredWinRate).toBeLessThanOrEqual(0.70);
});
```

- [ ] **Step 2: Run matrix test and verify RED**

Run: `npx vitest run tests/vehicle-scenarios.test.ts`

Expected: FAIL because the runner and evaluator do not exist.

- [ ] **Step 3: Implement deterministic route, duel, and combined-arms scenarios**

The matrix includes six theaters × ten seeds for route probes; mirrored tank duels in City/Desert/Countryside/Mountain; Falcon superiority and Vulture strike/intercept runs on every 900u air axis; Pike pursuit/blockade/beach-support runs in Coastal/Ocean; and one three-domain Operation sequence per compatible theater. Each result stores scenario id, seed, theater, manifests, duration, winner, first contact, objective completion, telemetry summary, structural violations, and timing samples.

Add package script:

```json
"test:vehicle-scenarios": "tsx scripts/run-vehicle-scenarios.ts"
```

The script writes stable-key JSON and a Markdown table. It exits non-zero on any acceptance violation.

- [ ] **Step 4: Run, tune, and preserve the real report**

Run: `npm run test:vehicle-scenarios`

Expected: exit 0; report records all scenarios, zero structural/route failures, contact times inside bands, maximum mirrored win rate ≤0.70, and performance inside budgets. If a band fails, tune map route distance, AI steering, or existing vehicle combat data; do not weaken the band or omit the seed.

- [ ] **Step 5: Run the focused foundation suite**

Run: `npx vitest run tests/map-geometry.test.ts tests/variable-map-runtime.test.ts tests/theaters.test.ts tests/theater-performance.test.ts tests/theater-operations.test.ts tests/elevation.test.ts tests/vehicle-telemetry.test.ts tests/vehicle-scenarios.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit runner and measured evidence**

```bash
git add src/sim/scenario-runner.ts scripts/run-vehicle-scenarios.ts package.json tests/vehicle-scenarios.test.ts tests/theater-performance.test.ts docs/reference/vehicle-theaters/foundation-report.json docs/reference/vehicle-theaters/foundation-report.md
git commit -m "test: measure vehicle theater battles"
```

### Task 13: Foundation Documentation, Manual Smoke, and Production Gates

**Files:**
- Modify: `docs/MAP-STRATEGY.md`
- Modify: `docs/MILITARY-MISSIONS.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/superpowers/plans/2026-07-21-vehicle-theater-foundation.md`

**Interfaces:**
- Consumes: all foundation implementation and evidence.
- Produces: accurate shipped documentation and checked plan state.

- [ ] **Step 1: Update docs with exact shipped behavior and evidence**

Document the six dimensions, map-owned geometry, theater selection table,
Ground/Building/Sky/Clouds rules, scenario command, measured report path, and
performance results. Mark only the foundation shipped. Keep attack/transport
helicopters and submarine/naval expansion explicitly next; do not mark the
overall active goal complete.

- [ ] **Step 2: Run the full automated production gates**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: all commands exit 0; the full Vitest suite reports zero failed files and zero failed tests.

- [ ] **Step 3: Run manual browser smokes**

Start Vite with the repository's normal command. In the Map Maker open City,
Mountain, Coastal, and Ocean at seeds `7749`, `4207`, `5150`, and `31`.
Verify the rectangular canvas, named routes/objectives, vehicle pads, dimensions,
and 3D preview. Stage one Air Superiority and one Beachhead Operation. Verify
briefing dimensions/domains, deployment, rectangular minimap, elevation chip,
aircraft wrap, objective progress, and `__ww.blackbox('report')` vehicle data.
Expected: no console errors, invalid pads, visible freezes, or broken controls.

- [ ] **Step 4: Inspect git scope and commit docs**

Run: `git status --short` and `git diff --check`.

Expected: only intended documentation/plan updates remain and diff check is clean.

```bash
git add docs/MAP-STRATEGY.md docs/MILITARY-MISSIONS.md docs/STATUS.md docs/superpowers/plans/2026-07-21-vehicle-theater-foundation.md
git commit -m "docs: mark vehicle theater foundation shipped"
```

- [ ] **Step 5: Begin the mandatory rotorcraft design cycle**

Read the shipped foundation report and start
`docs/superpowers/specs/2026-07-21-rotorcraft-design.md` through the brainstorming
workflow. The overall goal remains active; foundation completion is not the
terminal condition.
