# Miami Gardens 33056 War District Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic Potrero `geocity` deployment with a playable, attributable, visually War World-specific 900 m slice of ZIP 33056 in Miami Gardens.

**Architecture:** Keep real source geography immutable inside the checked-in artifact, and make deterministic gameplay changes in the compiler overlay. Add optional geospatial presentation metadata to `GameMap`; it carries the district style, source classification, background-building heights, and non-colliding decor placements so the renderer can depict a South Florida war district without changing simulation collision.

**Tech Stack:** TypeScript, Three.js, Vitest, Node/tsx importer, OpenStreetMap Overpass, USGS 3DEP, Vite visual harness.

## Global Constraints

- Preserve the source street graph and parcel silhouettes at 1 world unit per meter and 3 m per tile.
- Use `69:miami:e08:2700000`, whose SHT tags are `Resort` and `Seaport`.
- Use artifact ID `miami-gardens-33056-civic-front` and bounds `-80.24827,25.93991,-80.23929,25.94799`.
- Keep source attribution and deterministic gameplay overlay separate.
- Presentation geometry must never create simulation collision.
- Do not use purple; use pale concrete, asphalt, humid blue/teal atmosphere, United Front amber/olive, and Collective cyan/graphite.
- Preserve the San Francisco artifact as the documented technical pilot.
- Do not modify or stage the unrelated `src/main.ts`, `.agents/`, or `terrain-lab.html` worktree changes.
- Run all four repository gates before completion: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.

---

### Task 1: Flat-city terrain policy

**Files:**
- Modify: `src/sim/geospatial/terrain.ts`
- Modify: `scripts/import-geospatial-map.ts`
- Test: `tests/geospatial-terrain.test.ts`
- Test: `tests/geospatial-sources.test.ts`

**Interfaces:**
- Consumes: `compileTerrainSamples(samples, geometry, roadCells)`.
- Produces: relief-sensitive bands where total relief below 2 m is all level 0, relief below 6 m uses levels 0-1, and larger relief may use levels 0-2.

- [ ] **Step 1: Write failing flat-relief tests**

```ts
it('keeps sub-two-meter urban relief on one traversal band', () => {
  const result = compileTerrainSamples([0, 0.2, 0.4, 0.6, 0.8, 1, 0.7, 0.3, 0], GEOMETRY);
  expect([...new Set(result.height)]).toEqual([0]);
  expect(result.ramp.every((value) => value === 0)).toBe(true);
});

it('uses at most two bands for low rolling relief', () => {
  const result = compileTerrainSamples([0, 1, 2, 3, 4, 5, 4, 2, 0], GEOMETRY);
  expect(Math.max(...result.height)).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run tests/geospatial-terrain.test.ts tests/geospatial-sources.test.ts`

Expected: the sub-two-meter case contains quantile-created higher bands, and the importer still demands all three bands.

- [ ] **Step 3: Implement the relief cap and replace the generic importer assertion**

```ts
const totalRelief = Math.max(...smoothedMeters) - base;
const maxBand = totalRelief < 2 ? 0 : totalRelief < 6 ? 1 : 2;
const height = Uint8Array.from(relief, (value) => {
  const band = value >= high ? 2 : value >= middle ? 1 : 0;
  return Math.min(maxBand, band);
});
```

In the importer, assert only that every height byte is in `0..2`; do not require unused bands to exist.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/geospatial-terrain.test.ts tests/geospatial-sources.test.ts`

Expected: both files pass.

- [ ] **Step 5: Commit**

```powershell
git add -- src/sim/geospatial/terrain.ts scripts/import-geospatial-map.ts tests/geospatial-terrain.test.ts tests/geospatial-sources.test.ts
git commit -m "fix: preserve flat real-city terrain"
```

### Task 2: Geospatial presentation contract

**Files:**
- Modify: `src/sim/map.ts`
- Modify: `src/sim/geospatial/artifact.ts`
- Modify: `src/sim/mapedit.ts`
- Test: `tests/geospatial-artifact.test.ts`

**Interfaces:**
- Produces: `GeospatialMapMeta`, `GeospatialDecor`, and artifact presentation metadata.
- Later tasks consume: `map.geospatial.style`, `map.geospatial.classification`, `map.geospatial.buildingHeight`, and `map.geospatial.decor`.

- [ ] **Step 1: Write a failing artifact round-trip test**

```ts
doc.map.geospatial = {
  sourceId: 'fixture',
  cityId: '69:miami:e08:2700000',
  style: 'miami-gardens',
  classification,
  buildingHeight: Uint8Array.from({ length: 256 }, (_, index) => index % 4),
  decor: [{ kind: 'palm', pos: { x: 3, y: 0, z: 6 }, scale: 1, rot: 0 }],
};
const artifact = artifactFromMap(doc.map, { classification, source: source() });
expect(mapFromArtifact(artifact).geospatial).toEqual(doc.map.geospatial);
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run tests/geospatial-artifact.test.ts`

Expected: TypeScript/Vitest reports that `geospatial` does not exist.

- [ ] **Step 3: Add the optional map contract**

```ts
export interface GeospatialDecor {
  kind: 'palm' | 'streetlight' | 'barrier';
  pos: Vec3;
  scale: number;
  rot: number;
}

export interface GeospatialMapMeta {
  sourceId: string;
  cityId: string;
  style: 'default' | 'miami-gardens';
  classification: Uint8Array;
  buildingHeight: Uint8Array;
  decor: GeospatialDecor[];
}
```

Add `geospatial?: GeospatialMapMeta` to `GameMap`. Encode `buildingHeight` as byte runs beside the existing classification, copy decor as JSON, decode both into an independent map object, and deep-clone this field in `mapedit.ts`.

- [ ] **Step 4: Run the artifact and map-editor tests**

Run: `npx vitest run tests/geospatial-artifact.test.ts tests/mapedit.test.ts`

Expected: both files pass and mutations to a hydrated map do not affect the artifact.

- [ ] **Step 5: Commit**

```powershell
git add -- src/sim/map.ts src/sim/geospatial/artifact.ts src/sim/mapedit.ts tests/geospatial-artifact.test.ts
git commit -m "feat: carry geospatial district presentation"
```

### Task 3: Multi-route, multi-interior gameplay compiler

**Files:**
- Modify: `src/sim/geospatial/compiler.ts`
- Test: `tests/geospatial-compiler.test.ts`

**Interfaces:**
- Extends: `CompileGeospatialOptions` with `style?: GeospatialMapMeta['style']`, `controlPointNames?: [string, string, string]`, and working `maxPlayableBuildings`.
- Produces: three theater routes, several distributed enterable houses when parcels allow, source-derived background heights, and deterministic decor placements.

- [ ] **Step 1: Write failing compiler behavior tests**

```ts
const result = compileGeospatialMap(fixtureWithSixParcels(), {
  seed: 33056,
  cityId: '69:miami:e08:2700000',
  geometry: { cols: 96, rows: 96, tile: 3 },
  style: 'miami-gardens',
  maxPlayableBuildings: 4,
  controlPointNames: ['183RD STREET', 'CIVIC CENTER', 'CAROL CITY EAST'],
});
expect(result.map.theater?.routes.filter((route) => route.domain === 'ground')).toHaveLength(2);
expect(result.map.theater?.routes.some((route) => route.domain === 'foot')).toBe(true);
expect(result.map.houses.length).toBeGreaterThanOrEqual(2);
expect(result.map.controlPoints.map((point) => point.name)).toEqual(['183RD STREET', 'CIVIC CENTER', 'CAROL CITY EAST']);
expect(result.map.geospatial?.style).toBe('miami-gardens');
expect(result.map.geospatial?.decor.some((decor) => decor.kind === 'palm')).toBe(true);
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run tests/geospatial-compiler.test.ts`

Expected: one ground route, one house, old Potrero labels, and no presentation metadata.

- [ ] **Step 3: Implement distributed interiors**

Refactor `stampPlayableBuilding` into `stampPlayableBuildings`. Iterate sorted candidate parcels until the requested cap, reject a placement if its generated rectangle intersects a road cell or an already stamped rectangle, stamp every accepted building, and connect every door to the nearest road. Return the accepted count instead of returning after the first stamp.

```ts
const limit = Math.max(0, options.maxPlayableBuildings ?? 4);
const playableBuildings = stampPlayableBuildings(
  map, source.buildings, projected.buildings, options.cityId,
  options.seed, roadCells, overlay, limit,
);
```

- [ ] **Step 4: Implement route and presentation generation**

Create the primary route from the largest road component, a secondary ground route from the next viable connected road path, and a foot route from residential/footway cells. Fall back to offset points from the primary route when the source has only one component. Populate `buildingHeight` from source floors/height, and place deterministic decor only on open/grass cells adjacent to roads and outside spawn discs.

```ts
map.geospatial = {
  sourceId: source.id,
  cityId: options.cityId,
  style: options.style ?? 'default',
  classification,
  buildingHeight,
  decor: buildDistrictDecor(map, classification, roadCells, options.seed),
};
map.controlPoints = (options.controlPointNames ?? ['WEST APPROACH', 'CIVIC CENTER', 'EAST APPROACH'])
  .map((name, index) => ({ name, pos: tileToWorld(geometry, routeAt((index + 1) / 4) % geometry.cols, Math.floor(routeAt((index + 1) / 4) / geometry.cols)) }));
```

- [ ] **Step 5: Run compiler and theater validation tests**

Run: `npx vitest run tests/geospatial-compiler.test.ts tests/theaters.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add -- src/sim/geospatial/compiler.ts tests/geospatial-compiler.test.ts
git commit -m "feat: make real-city slices combat-ready"
```

### Task 4: Miami Gardens renderer treatment

**Files:**
- Create: `src/client/geospatial-visuals.ts`
- Modify: `src/client/renderer.ts`
- Test: `tests/geospatial-visuals.test.ts`

**Interfaces:**
- Consumes: `GeospatialMapMeta` and `MapGeometry`.
- Produces: `paletteForMap(map)`, `backgroundWallStyle(meta, index)`, and `buildGeospatialDecor(meta)`.

- [ ] **Step 1: Write failing pure-style tests**

```ts
expect(paletteKeyForMap({ theme: 'titan', geospatial: { style: 'miami-gardens' } } as GameMap)).toBe('miami-gardens');
expect(backgroundWallStyle(meta, buildingIndex)).toMatchObject({ color: expect.any(Number), storeys: expect.any(Number) });
expect(backgroundWallStyle(meta, roadIndex)).toBeUndefined();
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run tests/geospatial-visuals.test.ts`

Expected: module/functions do not exist.

- [ ] **Step 3: Implement the Miami palette and pure helpers**

Add a `miami-gardens` palette with blue-gray sky `0xa9c4ce`, turquoise haze `0x91b8bd`, warm sun `0xffe1ae`, pale concrete walls `0xb8ad96`, and charcoal road/open colors. `paletteKeyForMap` chooses the district style before the global theme. `backgroundWallStyle` returns deterministic pale-stucco/roof equipment variants only for `GEO_CLASS_BUILDING` cells.

- [ ] **Step 4: Build non-colliding district decor**

Render palms from a tapered brown trunk plus five low-poly dark-green fronds, streetlights from a charcoal pole plus warm lamp head, and barriers from pale concrete blocks with alternating faction-color end caps. Build all shapes from Three.js primitives under one `THREE.Group`; do not alter `grid` or `propCovered`.

- [ ] **Step 5: Integrate with `Renderer.buildStaticWorld`**

Select the map-aware palette, separate geospatial background walls into height/color instance groups, add flat-roof/parapet lips to non-enterable building masses, and add the decor group after ground/walls. Keep existing house wall and roof rendering unchanged for enterable buildings.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run tests/geospatial-visuals.test.ts tests/walls.test.ts tests/roofs.test.ts && npx tsc --noEmit`

Expected: all pass with no invisible-wall or roof regression.

- [ ] **Step 7: Commit**

```powershell
git add -- src/client/geospatial-visuals.ts src/client/renderer.ts tests/geospatial-visuals.test.ts
git commit -m "feat: render the Miami Gardens war district"
```

### Task 5: Import the checked-in 33056 artifact

**Files:**
- Create: `src/data/geospatial/miami-gardens-33056.json`
- Modify: `scripts/import-geospatial-map.ts`
- Test: `tests/geospatial-sources.test.ts`

**Interfaces:**
- Adds CLI arguments: `--style` and `--control-points`.
- Produces: a deterministic artifact below 2 MB with Miami city ID, district style, several enterable buildings, routes, presentation metadata, and attribution.

- [ ] **Step 1: Add failing CLI parsing tests**

```ts
expect(parseImportArgs([
  '--id', 'miami-gardens-33056-civic-front',
  '--name', 'Miami Gardens 33056 / Civic Front',
  '--bbox', '-80.24827,25.93991,-80.23929,25.94799',
  '--city', '69:miami:e08:2700000', '--seed', '33056',
  '--retrieved-at', '2026-07-22', '--style', 'miami-gardens',
  '--control-points', '183RD STREET|CIVIC CENTER|CAROL CITY EAST',
  '--output', 'src/data/geospatial/miami-gardens-33056.json',
])).toMatchObject({ style: 'miami-gardens', controlPointNames: ['183RD STREET', 'CIVIC CENTER', 'CAROL CITY EAST'] });
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run tests/geospatial-sources.test.ts`

Expected: new fields are absent.

- [ ] **Step 3: Parse and pass the district options**

Accept only `default` or `miami-gardens`, require exactly three non-empty pipe-separated control point names, and pass `style`, `controlPointNames`, and `maxPlayableBuildings: 6` to `compileGeospatialMap`.

- [ ] **Step 4: Run the live import**

```powershell
npx tsx scripts/import-geospatial-map.ts --id miami-gardens-33056-civic-front --name "Miami Gardens 33056 / Civic Front" --bbox "-80.24827,25.93991,-80.23929,25.94799" --city "69:miami:e08:2700000" --seed 33056 --retrieved-at 2026-07-22 --style miami-gardens --control-points "183RD STREET|CIVIC CENTER|CAROL CITY EAST" --output src/data/geospatial/miami-gardens-33056.json
```

Expected: 368-class road input and roughly 343 building footprints, at least two enterable buildings, valid routes, attribution, and an artifact below 2 MB. Exact source counts may vary if OpenStreetMap changes before retrieval; the checked-in artifact fixes the reviewed data.

- [ ] **Step 5: Re-run from cache and compare hash**

Run the identical command twice, then run `git hash-object src/data/geospatial/miami-gardens-33056.json` after each execution.

Expected: identical hashes.

- [ ] **Step 6: Commit**

```powershell
git add -- scripts/import-geospatial-map.ts tests/geospatial-sources.test.ts src/data/geospatial/miami-gardens-33056.json
git commit -m "feat: import the Miami Gardens 33056 battlefield"
```

### Task 6: Deploy 33056 as the geocity theater

**Files:**
- Modify: `src/sim/theaters/geospatial.ts`
- Modify: `src/sim/theaters.ts`
- Modify: `tests/geospatial-theater.test.ts`
- Modify: `docs/GEOSPATIAL-MAPS.md`

**Interfaces:**
- `generateTheater('geocity', seed)` hydrates Miami Gardens while preserving independent mutable match layers.

- [ ] **Step 1: Update the integration test first**

```ts
expect(first.theater?.name).toContain('Miami Gardens');
expect(first.geospatial?.sourceId).toBe('miami-gardens-33056-civic-front');
expect(first.geospatial?.style).toBe('miami-gardens');
expect(first.houses.length).toBeGreaterThanOrEqual(2);
expect(first.controlPoints.map((point) => point.name)).toEqual(['183RD STREET', 'CIVIC CENTER', 'CAROL CITY EAST']);
```

- [ ] **Step 2: Verify the test fails against Potrero**

Run: `npx vitest run tests/geospatial-theater.test.ts`

Expected: Potrero name/source assertions fail.

- [ ] **Step 3: Switch the artifact and catalog identity**

Import `miami-gardens-33056.json` in `src/sim/theaters/geospatial.ts`. Rename `THEATER_DEFS.geocity` to `Miami Gardens 33056 / Civic Front` and choose `hardpan` as the fallback simulation theme; the renderer's district style provides the actual palette.

- [ ] **Step 4: Document both artifacts**

Update `docs/GEOSPATIAL-MAPS.md` with the chosen bounds, SHT Miami tags, import command, attribution, gameplay overlay rules, visual treatment, and a note that San Francisco remains the original pipeline pilot but is no longer deployed by `geocity`.

- [ ] **Step 5: Run theater tests**

Run: `npx vitest run tests/geospatial-theater.test.ts tests/theaters.test.ts tests/theater-network.test.ts`

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add -- src/sim/theaters/geospatial.ts src/sim/theaters.ts tests/geospatial-theater.test.ts docs/GEOSPATIAL-MAPS.md
git commit -m "feat: deploy 33056 as the real-city theater"
```

### Task 7: Visual and gameplay iteration

**Files:**
- Modify as defects require: `src/sim/geospatial/compiler.ts`
- Modify as defects require: `src/client/geospatial-visuals.ts`
- Modify as defects require: `src/client/renderer.ts`
- Modify as defects require: focused tests from Tasks 1-6

**Interfaces:**
- Consumes: the deployed `geocity` map through the normal `World`/renderer path.
- Produces: verified command-height and street-height presentation with traversable routes.

- [ ] **Step 1: Start the Vite harness and launch `geocity` conquest**

Run: `npm run dev -- --host 127.0.0.1`

Open the game harness, choose theater `geocity`, conquest mode, and seed `33056`.

- [ ] **Step 2: Inspect command height**

Verify all three routes are visually legible, both bases have clearance, control points are distributed, background roofs vary without becoming towers, water reads as drainage water, and palms/poles/barriers are sparse landmarks rather than visual noise.

- [ ] **Step 3: Inspect street height and move through the map**

Walk and drive the primary route from both bases. Enter every generated interior. Test one secondary route and one foot flank. Check door approaches, camera terrain following, roof silhouettes, vehicle clearance, and absence of invisible collision.

- [ ] **Step 4: Record each defect as a failing focused test before changing code**

For each observed defect, add the smallest deterministic assertion to the owning test file, run that test to see it fail, make the smallest compiler/renderer fix, and rerun it. Do not commit temporary camera or harness controls.

- [ ] **Step 5: Run focused regression tests and commit the iteration**

Run: `npx vitest run tests/geospatial-*.test.ts tests/walls.test.ts tests/roofs.test.ts tests/theaters.test.ts`

Expected: all pass.

```powershell
git add -- src/sim/geospatial/compiler.ts src/client/geospatial-visuals.ts src/client/renderer.ts tests
git commit -m "fix: polish the 33056 combat district"
```

Stage `tests` only if every staged test change belongs to this task; otherwise stage test files by exact name.

### Task 8: Final gates and requirement audit

**Files:**
- Modify if the audit finds a gap: the exact owning file and focused test only

**Interfaces:**
- Produces: a fully gated, documented, reviewable 33056 battlefield.

- [ ] **Step 1: Run the four gates in order**

```powershell
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: all commands exit 0; Vitest runs the full repository suite.

- [ ] **Step 2: Audit the design contract**

Confirm the artifact uses the exact ZIP bounds and Miami city ID, attribution exists, geography/overlay are separate, two ground routes and one foot route exist, both sides have legal spawns and vehicle pads, at least two interiors are enterable, Miami labels replace Potrero labels, flat relief is not forced into mountains, the district style is hydrated, no purple is present, and San Francisco remains documented.

- [ ] **Step 3: Inspect repository scope**

Run: `git status --short` and `git diff HEAD --stat`.

Expected: only the pre-existing unrelated `src/main.ts`, `.agents/`, and `terrain-lab.html` changes remain outside committed work.

- [ ] **Step 4: If the audit required a fix, repeat all four gates and commit it**

Stage only the individual source and test paths changed by the audit (never `git add -A` and never the unrelated paths named in Global Constraints), then commit with `git commit -m "fix: close the 33056 battlefield audit"`.

Expected: all four gates still exit 0 after the fix and the commit contains no unrelated file.
