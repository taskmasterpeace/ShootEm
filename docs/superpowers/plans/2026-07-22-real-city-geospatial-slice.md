# Real-City Geospatial Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile one real San Francisco Potrero Hill/Dogpatch slice into a deterministic, playable 300×300 War World theater with real roads, OSM building envelopes, USGS relief, native interiors, and offline attribution.

**Architecture:** Network adapters normalize OSM vector features and USGS elevations into a source-neutral `GeoSliceSource`. A pure compiler projects, rotates, rasterizes, quantizes, and gameplay-adapts that source into a versioned artifact with separate geographic and proprietary gameplay sections. Runtime hydrates the checked-in artifact as an ordinary `GameMap`; neither Three.js nor the simulation performs network or GIS work.

**Tech Stack:** TypeScript 5.6, Vitest, built-in `fetch`, OpenStreetMap Overpass JSON, USGS EPQS JSON, existing `GameMap`/theater/building systems, JSON artifacts with byte-run encoding.

## Global Constraints

- Work directly on `main`; never push.
- Stage exact filenames; never use `git add -A`.
- Preserve the user's untracked `.agents/` and `terrain-lab.html`.
- Pilot geometry is exactly `{ cols: 300, rows: 300, tile: 3 }`.
- Browser and match runtime make zero map-service requests.
- Geographic provenance remains separate from proprietary gameplay metadata.
- Google imagery and Photorealistic 3D Tiles are not inputs.
- The pilot supports one checked-in San Francisco slice, not arbitrary runtime coordinates.
- Write a failing test before each implementation slice.
- Before completion run typecheck, full Vitest, lint, and build.

## File Structure

- `src/sim/geospatial/types.ts` — normalized source and artifact types.
- `src/sim/geospatial/geometry.ts` — projection, rotation, and raster helpers.
- `src/sim/geospatial/sources.ts` — Overpass/EPQS parsers and fetchers.
- `src/sim/geospatial/terrain.ts` — elevation interpolation, bands, and ramps.
- `src/sim/geospatial/artifact.ts` — byte runs and `GameMap` hydration.
- `src/sim/geospatial/compiler.ts` — geographic and gameplay compilation.
- `src/sim/theaters/geospatial.ts` — checked-in artifact theater.
- `src/data/geospatial/san-francisco-potrero.json` — generated artifact.
- `scripts/import-geospatial-map.ts` — bounded importer CLI.
- `tests/geospatial-*.test.ts` — unit and integration coverage.

---

### Task 1: Normalized types, projection, and raster core

**Files:**
- Create: `src/sim/geospatial/types.ts`
- Create: `src/sim/geospatial/geometry.ts`
- Create: `tests/geospatial-geometry.test.ts`

**Interfaces:**
- Produces `GeoSliceSource`, `GeoRoad`, `GeoBuilding`, `GeoPolygonFeature`, `GeoElevationGrid`, `GeoAttribution`, `projectSlice()`, `dominantRoadAngle()`, `rasterLine()`, and `rasterPolygon()`.

- [ ] **Step 1: Write failing projection and raster tests**

```ts
const angle = dominantRoadAngle(source.roads);
const projected = projectSlice(source, angle);
expect(projected.origin).toEqual({ x: 0, z: 0 });
expect(Math.abs(projected.roads[0].points.at(-1)!.z - projected.roads[0].points[0].z)).toBeLessThan(0.01);
expect(rasterLine([{ x: -12, z: 0 }, { x: 12, z: 0 }], 6, geometry).size).toBeGreaterThanOrEqual(18);
expect(rasterPolygon(square, geometry).has(centerIndex)).toBe(true);
```

- [ ] **Step 2: Run `npx vitest run tests/geospatial-geometry.test.ts`; expect missing-module failure.**

- [ ] **Step 3: Implement exact source types**

```ts
export interface LonLat { longitude: number; latitude: number }
export interface LocalPoint { x: number; z: number }
export interface GeoRoad { id: string; roadClass: string; points: LonLat[]; width?: number; bridge: boolean; tunnel: boolean }
export interface GeoBuilding { id: string; polygon: LonLat[]; use?: string; height?: number; floors?: number; confidence?: number }
export interface GeoPolygonFeature { id: string; polygon: LonLat[]; kind: string }
export interface GeoElevationGrid { cols: number; rows: number; bbox: [number, number, number, number]; values: number[]; resolution: number }
export interface GeoAttribution { label: string; url: string; license: string; licenseUrl: string }
export interface GeoSliceSource { schemaVersion: 1; id: string; name: string; bbox: [number, number, number, number]; origin: LonLat; roads: GeoRoad[]; buildings: GeoBuilding[]; water: GeoPolygonFeature[]; land: GeoPolygonFeature[]; elevation: GeoElevationGrid; attribution: GeoAttribution[]; retrievedAt: string }
```

Use a local equirectangular projection (`111_320` meters per latitude degree; longitude scaled by `cos(latitude)`). Fold road bearings into `[0, π/2)` and compute a segment-length-weighted dominant axis. Raster lines at half-tile intervals with a tile-space disc. Raster polygons by tile-center point-in-polygon.

- [ ] **Step 4: Re-run the test and commit**

```powershell
npx vitest run tests/geospatial-geometry.test.ts
git add -- src/sim/geospatial/types.ts src/sim/geospatial/geometry.ts tests/geospatial-geometry.test.ts
git commit -m "feat: add geospatial projection and raster core"
```

### Task 2: OSM and USGS source adapters

**Files:**
- Create: `src/sim/geospatial/sources.ts`
- Create: `tests/geospatial-sources.test.ts`

**Interfaces:**
- Produces `parseOverpass()`, `parseEpqs()`, `fetchOverpassSlice()`, and `fetchElevationGrid()`.

- [ ] **Step 1: Write failing parser tests**

```ts
expect(parseOverpass({ elements: [
  { type: 'way', id: 1, geometry: [{ lon: -122.4, lat: 37.75 }, { lon: -122.39, lat: 37.75 }], tags: { highway: 'primary', bridge: 'yes' } },
  { type: 'way', id: 2, geometry: closedRing, tags: { building: 'industrial', 'building:levels': '3' } },
] })).toMatchObject({ roads: [{ id: 'way/1', roadClass: 'primary', bridge: true }], buildings: [{ id: 'way/2', use: 'industrial', floors: 3 }] });
expect(parseEpqs({ value: '65.498779297' })).toBeCloseTo(65.4988, 3);
expect(() => parseEpqs({ value: 'NoData' })).toThrow(/elevation/i);
```

- [ ] **Step 2: Run the focused test; expect missing exports.**

- [ ] **Step 3: Implement parsers and bounded fetchers**

Overpass requests ways for `highway`, `building`, `natural=water`, `waterway=riverbank`, and green `landuse`/`leisure`, ending in `out geom;`. POST URL-encoded data with an identifying user agent. EPQS uses `https://epqs.nationalmap.gov/v1/json?x={lon}&y={lat}&units=Meters&wkid=4326&includeDate=false`. Sample no denser than 25×25, cap concurrency at eight, retry once, and fail if more than 5% of points remain unavailable.

- [ ] **Step 4: Re-run and commit**

```powershell
npx vitest run tests/geospatial-sources.test.ts
git add -- src/sim/geospatial/sources.ts tests/geospatial-sources.test.ts
git commit -m "feat: normalize OSM and USGS map sources"
```

### Task 3: Semantic terrain and ramps

**Files:**
- Create: `src/sim/geospatial/terrain.ts`
- Create: `tests/geospatial-terrain.test.ts`

**Interfaces:**
- Produces `compileTerrain(elevation, projection, geometry, roadTiles): { height: Uint8Array; ramp: Uint8Array; thresholds: [number, number] }`.

- [ ] **Step 1: Write a failing hilly-grid test**

```ts
const result = compileTerrain(slopeGrid, projection, geometry, roadTiles);
expect(new Set(result.height)).toEqual(new Set([0, 1, 2]));
expect(result.thresholds[0]).toBeLessThan(result.thresholds[1]);
expect([...roadTransitions(result.height, roadTiles)].every((i) => result.ramp[i] === 1)).toBe(true);
```

- [ ] **Step 2: Verify failure.**

- [ ] **Step 3: Implement bilinear sampling, a deterministic 3×3 median pass, relative relief, 40th/78th percentile thresholds with two-meter minimum separation, removal of non-road height islands below nine tiles, and ramp flags on road-side `0↔1` or `1↔2` transitions. Keep `0↔2` transitions as cliffs.**

- [ ] **Step 4: Re-run and commit**

```powershell
npx vitest run tests/geospatial-terrain.test.ts
git add -- src/sim/geospatial/terrain.ts tests/geospatial-terrain.test.ts
git commit -m "feat: compile real elevation into terrain bands"
```

### Task 4: Artifact codec and editor terrain round-trip

**Files:**
- Create: `src/sim/geospatial/artifact.ts`
- Create: `tests/geospatial-artifact.test.ts`
- Modify: `src/sim/mapedit.ts:215-274`
- Modify: `tests/mapedit-v2.test.ts`

**Interfaces:**
- Produces `ByteRuns`, `encodeByteRuns()`, `decodeByteRuns()`, `GeoMapArtifactV1`, `artifactFromMap()`, and `mapFromArtifact()`.

- [ ] **Step 1: Write failing codec and map-editor tests**

```ts
const bytes = Uint8Array.from([0, 0, 0, 4, 4, 2, 2, 2, 2]);
expect(decodeByteRuns(encodeByteRuns(bytes), bytes.length)).toEqual(bytes);
expect(() => decodeByteRuns([0, 3, 1], 4)).toThrow(/run/i);
const reopened = deserializeDoc(serializeDoc(docWithHeightAndRamp()));
expect(reopened.map.height).toEqual(doc.map.height);
expect(reopened.map.ramp).toEqual(doc.map.ramp);
```

- [ ] **Step 2: Verify both failures.**

- [ ] **Step 3: Implement `[value,count,...]` byte runs. Define artifact sections exactly as `geography: { geometry, classification, height, ramp, source, attribution }` and `gameplay: { seed, theme, grid, grid2, upperLayers, surface, objects, overlay }`. Validate every decoded layer length and deep-clone object arrays. Extend `MapJSONV2` with optional `height`/`ramp` arrays and preserve them in both directions.**

- [ ] **Step 4: Re-run and commit**

```powershell
npx vitest run tests/geospatial-artifact.test.ts tests/mapedit-v2.test.ts
git add -- src/sim/geospatial/artifact.ts tests/geospatial-artifact.test.ts src/sim/mapedit.ts tests/mapedit-v2.test.ts
git commit -m "feat: preserve compiled geospatial map artifacts"
```

### Task 5: Deterministic geography and gameplay compiler

**Files:**
- Create: `src/sim/geospatial/compiler.ts`
- Create: `tests/geospatial-compiler.test.ts`

**Interfaces:**
- Produces `compileGeoSlice(source, options): GeoMapArtifactV1` and `validateGeoCompilation(artifact): GeoCompileReport`.

- [ ] **Step 1: Write a failing synthetic-city acceptance test**

```ts
const a = compileGeoSlice(syntheticHillyCity(), options);
const b = compileGeoSlice(syntheticHillyCity(), options);
expect(a).toEqual(b);
const map = mapFromArtifact(a, 4207);
expect(map.houses.length).toBeGreaterThan(0);
expect(new Set(map.height)).toEqual(new Set([0, 1, 2]));
expect(validateGeoCompilation(a).issues).toEqual([]);
expect(validateDoc(asMakerDoc(map)).issues).toEqual([]);
```

- [ ] **Step 2: Verify failure.**

- [ ] **Step 3: Implement classification `0=unclassified, 1=road, 2=water, 3=building, 4=green`. Begin as open `S_GRIT`, seal the rim, rasterize water, fill background buildings with `T_WALL`, and repaint roads last as `T_OPEN/S_PLATE`. Road buffers are 18/15/12/10/8/6/3 meters for motorway-or-trunk/primary/secondary/tertiary/residential/service/foot.**

- [ ] **Step 4: Add native buildings and gameplay adaptation. Rank parcels by frontage plus area. For at most twelve parcels, retry `generateCityBuilding` deterministically until its footprint fits, stamp it, and connect its door to the nearest road. Flood the road network; wall off unreachable open pockets below 32 tiles and connect larger pockets with three-tile corridors. Pick opposing base points from the reached road component, clear spawn discs, publish two ground routes plus a 90-meter air route, and stage tanks/rotorcraft. Record changes as `open_flank`, `armor_clearance`, `mission_anchor`, `connect_building`, or `remove_orphan`.**

- [ ] **Step 5: Re-run and commit**

```powershell
npx vitest run tests/geospatial-compiler.test.ts
git add -- src/sim/geospatial/compiler.ts tests/geospatial-compiler.test.ts
git commit -m "feat: compile real city data into playable maps"
```

### Task 6: Bounded importer and checked-in San Francisco artifact

**Files:**
- Create: `scripts/import-geospatial-map.ts`
- Create: `src/data/geospatial/san-francisco-potrero.json`
- Modify: `package.json`
- Modify: `tests/geospatial-sources.test.ts`

- [ ] **Step 1: Test `parseImportArgs()` with `--bbox -122.4045,37.7520,-122.3943,37.7601`, require numeric four-value bounds, and reject any slice above 1.2 km per side.**

- [ ] **Step 2: Implement the CLI and package command**

```json
"map:import:sf": "tsx scripts/import-geospatial-map.ts --id sf-potrero --name \"Potrero Hill / Dogpatch\" --bbox -122.4045,37.7520,-122.3943,37.7601 --city 69:san-francisco:cr7:896047 --seed 4207 --retrieved-at 2026-07-22 --output src/data/geospatial/san-francisco-potrero.json"
```

Print feature counts, skipped features, elevation range, band/ramp counts, enterable buildings, overlays, artifact bytes, and validation issues. Write stable pretty JSON plus a trailing newline; never use the wall clock in the artifact.

- [ ] **Step 3: Run `npm run map:import:sf`. Require nonzero roads/buildings, all three height bands, at least one enterable building, zero validation issues, and output below 2 MB.**

- [ ] **Step 4: Prove deterministic regeneration by comparing `git hash-object` before and after a second import.**

- [ ] **Step 5: Commit exact files**

```powershell
git add -- scripts/import-geospatial-map.ts src/data/geospatial/san-francisco-potrero.json package.json tests/geospatial-sources.test.ts
git commit -m "feat: import the San Francisco geospatial pilot"
```

### Task 7: Theater and `World` integration

**Files:**
- Create: `src/sim/theaters/geospatial.ts`
- Create: `tests/geospatial-theater.test.ts`
- Modify: `src/sim/theater-types.ts:4`
- Modify: `src/sim/theaters.ts:7-40`
- Modify: `tests/theaters.test.ts`

- [ ] **Step 1: Write failing integration tests**

```ts
const map = generateTheater('geocity', 4207);
expect(map.geometry).toEqual({ cols: 300, rows: 300, tile: 3 });
expect(map.theater?.name).toContain('Potrero');
expect(map.houses.length).toBeGreaterThan(0);
expect(validateTheater(map).issues).toEqual([]);
const world = new World({ seed: 4207, mode: 'conquest', theaterId: 'geocity', botsPerTeam: 0 });
expect(world.map.grid).toHaveLength(90_000);
```

- [ ] **Step 2: Verify failure.**

- [ ] **Step 3: Add `geocity` to `TheaterId` and `THEATER_DEFS` with name `Potrero Hill / Dogpatch`, 300×300×3 geometry, `titan` theme, foot/ground/air domains, no free dogfight, and tank/attackheli/transportheli defaults. Hydrate a fresh artifact per call, replace only the match seed, verify geometry, and finalize it. Add `geocity` to dimension, land, rotorcraft, no-submarine, and validation test matrices.**

- [ ] **Step 4: Re-run and commit**

```powershell
npx vitest run tests/geospatial-theater.test.ts tests/theaters.test.ts
git add -- src/sim/theaters/geospatial.ts tests/geospatial-theater.test.ts src/sim/theater-types.ts src/sim/theaters.ts tests/theaters.test.ts
git commit -m "feat: deploy the real-city pilot as a theater"
```

### Task 8: Attribution, docs, and visual verification

**Files:**
- Modify: `index.html:461-467`
- Modify: `README.md`

- [ ] **Step 1: Add permanent attribution by the deploy links**

```html
<p class="controls-hint" id="map-data-attribution">Real-city pilot: map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL · elevation: <a href="https://www.usgs.gov/3d-elevation-program">USGS 3DEP</a>, public domain.</p>
```

- [ ] **Step 2: Document `npm run map:import:sf`, the artifact path, no-runtime-network rule, and `geography`/`gameplay.overlay` licensing separation in README.**

- [ ] **Step 3: Run `npm run dev -- --host 127.0.0.1`; launch `theaterId: 'geocity'` and inspect command-height streets/relief, a complete tank route, one enterable multi-storey building, camera elevation following, and absence of invisible walls or exterior props indoors. Do not commit temporary harness controls.**

- [ ] **Step 4: Commit**

```powershell
git add -- index.html README.md
git commit -m "docs: attribute the real-city map pilot"
```

### Task 9: Full verification and measured handoff

- [ ] **Step 1: Run focused tests**

```powershell
npx vitest run tests/geospatial-geometry.test.ts tests/geospatial-sources.test.ts tests/geospatial-terrain.test.ts tests/geospatial-artifact.test.ts tests/geospatial-compiler.test.ts tests/geospatial-theater.test.ts tests/mapedit-v2.test.ts tests/theaters.test.ts
```

- [ ] **Step 2: Run all repository gates**

```powershell
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

- [ ] **Step 3: Report artifact bytes, source road/building counts, terrain-band counts, ramp count, enterable buildings, route count, validation status, and full-suite test count. Do not claim arbitrary-city generation, runtime streaming, exact interiors, or survey-grade elevation.**

- [ ] **Step 4: Commit only verification corrections, staged by exact filename, with a focused message. Do not push.**
