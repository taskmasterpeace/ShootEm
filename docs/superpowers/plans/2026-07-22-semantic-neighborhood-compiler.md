# Semantic Neighborhood Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert approximately 900 m real-city slices into connected, playable War World neighborhoods whose streets, blocks, lots, buildings, entrances, exteriors, and selected interiors retain recognizable real-world organization.

**Architecture:** The offline importer fuses OSM geometry, optional NSI attributes, and USGS elevation into a versioned `SemanticDistrict`. A deterministic compiler turns that semantic graph into the authoritative tile map plus a compact presentation layer. Runtime only hydrates checked-in artifacts. Street topology is resolved first, then blocks, lots, buildings, entrances, mission anchors, and visuals, so every downstream object has a stable connection to the same network.

**Tech Stack:** TypeScript, Three.js, Vitest, tsx import scripts, cached JSON source data, RLE game artifacts, Playwright/in-app browser verification.

## Global Constraints

- Preserve all unrelated working-tree edits; stage only named geospatial files.
- Work directly on `main`; make small commits; never push.
- Tests precede implementation for every behavior.
- Runtime must perform no GIS/network requests.
- Source provenance and confidence live on individual inferred attributes.
- All retained buildings receive massing, roof/facade semantics, an entrance, and an explicit interior policy.
- All roads, sidewalks, entrances, vehicle anchors, and mission anchors must be connectivity-audited.
- Before completion run `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.

---

## Task 1: Introduce the v2 semantic district contract

**Files:**
- Modify: `src/sim/geospatial/types.ts`
- Modify: `src/sim/map.ts`
- Modify: `src/sim/geospatial/artifact.ts`
- Create: `tests/geospatial-semantic-types.test.ts`
- Modify: `tests/geospatial-artifact.test.ts`

- [x] Write a failing codec test that constructs a minimal v2 district with one connected road, block, lot, building, and entrance; round-trips it through the artifact; and verifies all semantic fields survive.
- [x] Write a failing compatibility test proving the current v1 Miami artifact still hydrates.
- [x] Add the core source and derived types:

```ts
export type DistrictProfileId = 'miami-gardens' | 'lower-manhattan' | 'tarboro';
export type InteriorPolicy = 'embedded' | 'instanced' | 'sealed';
export type SemanticConfidence = 'surveyed' | 'high' | 'medium' | 'low';

export interface AttributeEvidence<T> {
  value: T;
  source: 'osm' | 'overture' | 'nsi' | 'usgs' | 'inferred';
  confidence: SemanticConfidence;
}

export interface SemanticEntrance {
  id: string;
  buildingId: string;
  position: LocalPoint;
  facing: number;
  pedestrianConnector: number[];
}

export interface SemanticBuilding {
  id: string;
  footprint: LocalPoint[];
  blockId: string;
  lotId: string;
  use: AttributeEvidence<string>;
  floors: AttributeEvidence<number>;
  height: AttributeEvidence<number>;
  archetype: string;
  roof: 'flat' | 'gable' | 'hip' | 'mansard' | 'mixed';
  facade: 'detached' | 'porch' | 'storefront' | 'street-wall' | 'podium-tower' | 'industrial';
  entrances: SemanticEntrance[];
  interiorPolicy: InteriorPolicy;
}

export interface SemanticDistrict {
  schemaVersion: 2;
  id: string;
  name: string;
  profile: DistrictProfileId;
  source: GeoSliceSource;
  roads: SemanticRoad[];
  blocks: SemanticBlock[];
  lots: SemanticLot[];
  buildings: SemanticBuilding[];
  diagnostics: DistrictDiagnostics;
  attribution: GeoAttribution[];
}
```

- [x] Extend `GeospatialMapMeta` with `district?: SemanticDistrict`, add the two new style values, and keep old fields for v1 hydration.
- [x] Define `GeoMapArtifactV2` with semantic district data and make `mapFromArtifact` accept `GeoMapArtifactV1 | GeoMapArtifactV2`.
- [x] Run `npx vitest run tests/geospatial-semantic-types.test.ts tests/geospatial-artifact.test.ts`.
- [x] Commit: `feat: add semantic district artifact schema`

## Task 2: Capture rich source tags and optional NSI enrichment

**Files:**
- Modify: `src/sim/geospatial/types.ts`
- Modify: `src/sim/geospatial/sources.ts`
- Create: `src/sim/geospatial/nsi.ts`
- Create: `tests/fixtures/geospatial/nsi-sample.json`
- Modify: `tests/geospatial-sources.test.ts`
- Create: `tests/geospatial-nsi.test.ts`

- [x] Add failing parser tests for road lanes/surface/sidewalk/service/access and building material/roof/address/name/entrance-related tags.
- [x] Add failing NSI tests covering valid records, missing values, occupancy mapping, stories, square footage, height, construction category, and deterministic spatial matching.
- [x] Extend normalized source records without discarding unknown source tags:

```ts
export interface GeoRoad {
  id: string;
  roadClass: string;
  points: LonLat[];
  width?: number;
  lanes?: number;
  surface?: string;
  sidewalk?: string;
  service?: string;
  access?: string;
  bridge: boolean;
  tunnel: boolean;
}

export interface NsiBuildingRecord {
  id: string;
  longitude: number;
  latitude: number;
  occupancy?: string;
  stories?: number;
  squareFeet?: number;
  height?: number;
  construction?: string;
}
```

- [x] Implement `parseNsiFeatures(payload)` and `matchNsiBuildings(buildings, records, origin, maxDistanceMeters)` with one-to-one nearest-centroid matching and stable ID tie-breaking.
- [x] Keep NSI optional: imports must succeed with explicit diagnostics when the source is unavailable.
- [x] Extend the Overpass query to request relevant entrance nodes and building relations/parts where practical; preserve a deterministic way-only fallback.
- [x] Run `npx vitest run tests/geospatial-sources.test.ts tests/geospatial-nsi.test.ts`.
- [x] Commit: `feat: enrich real city source semantics`

## Task 3: Build a connected street graph and complete street surfaces

**Files:**
- Create: `src/sim/geospatial/street-network.ts`
- Create: `tests/geospatial-street-network.test.ts`
- Modify: `src/sim/geospatial/compiler.ts`

- [x] Write failing tests for snapped endpoints, crossing connectors, road-class width resolution, intersection unions, sidewalks, driveways/service roads, and deterministic connected-component IDs.
- [x] Define the network output:

```ts
export interface StreetNetwork {
  connectors: Array<{ id: string; point: LocalPoint; roadIds: string[] }>;
  segments: Array<{
    id: string;
    roadId: string;
    from: string;
    to: string;
    kind: 'carriageway' | 'service' | 'driveway' | 'path';
    width: number;
    points: LocalPoint[];
  }>;
  carriagewayCells: Set<number>;
  sidewalkCells: Set<number>;
  pedestrianCells: Set<number>;
  vehicleComponents: number[][];
  pedestrianComponents: number[][];
}
```

- [x] Implement endpoint snapping at a scale derived from `geometry.tile`; split polylines at geometric crossings; do not connect bridge/tunnel grade separations.
- [x] Resolve effective width in priority order: explicit width, lanes, profile/class defaults.
- [x] Rasterize carriageways and service access independently; union intersection discs; derive sidewalks from outer road bands instead of painting every road cell alike.
- [x] Replace compiler-local `ROAD_WIDTHS`/`largestConnectedRoad` ownership with the new module.
- [x] Run `npx vitest run tests/geospatial-street-network.test.ts tests/geospatial-compiler.test.ts`.
- [x] Commit: `feat: compile connected complete streets`

## Task 4: Derive interlocking blocks, lots, frontage, and entrances

**Files:**
- Create: `src/sim/geospatial/neighborhood.ts`
- Create: `tests/geospatial-neighborhood.test.ts`
- Modify: `src/sim/geospatial/compiler.ts`

- [x] Write failing synthetic-grid tests for four differently sized blocks separated by connected streets, deterministic lot assignment, frontage orientation, driveway creation, and entrance-to-sidewalk reachability.
- [x] Compute blocks as bounded non-carriageway regions after sealing the map rim; discard the exterior region and record holes/degenerate regions in diagnostics.
- [x] Assign each retained footprint centroid to a block. Generate lots by deterministic multi-source growth from building footprints to block boundaries, preserving yards and avoiding overlaps.
- [x] Select frontage from the closest accessible road/sidewalk edge, then infer setback, yard depth, parking likelihood, and entrance position.
- [x] Connect entrances using a collision-aware shortest path. If no path exists, add a narrow walkway or driveway and audit it again.
- [x] Export pure audit helpers:

```ts
export function auditEntranceConnectivity(
  district: SemanticDistrict,
  pedestrianCells: ReadonlySet<number>,
  geometry: MapGeometry,
): string[];

export function auditBuildingRoadOverlap(
  buildings: readonly SemanticBuilding[],
  carriagewayCells: ReadonlySet<number>,
  geometry: MapGeometry,
): string[];
```

- [x] Assert the synthetic district has varied block/lot areas, zero unexplained road overlap, and every entrance connected.
- [x] Run `npx vitest run tests/geospatial-neighborhood.test.ts`.
- [x] Commit: `feat: derive connected blocks lots and entrances`

## Task 5: Apply regional building and neighborhood grammars

**Files:**
- Create: `src/sim/geospatial/profiles.ts`
- Create: `tests/geospatial-profiles.test.ts`
- Modify: `src/sim/geospatial/compiler.ts`

- [x] Write failing table tests that distinguish representative Miami, Lower Manhattan, and Tarboro buildings from identical sparse source tags.
- [x] Encode explicit deterministic profiles:

```ts
export interface DistrictProfile {
  id: DistrictProfileId;
  roadWidths: Record<string, number>;
  defaultSetback: number;
  defaultFloors: [number, number];
  detachedBias: number;
  attachedBias: number;
  porchBias: number;
  storefrontBias: number;
  roofWeights: Partial<Record<SemanticBuilding['roof'], number>>;
  decor: Array<'palm' | 'streetlight' | 'street-tree' | 'stoop' | 'porch'>;
}
```

- [x] Miami grammar: detached low-rise homes, deep setbacks, yards/driveways, palms.
- [x] Lower Manhattan grammar: attached street walls, shallow setbacks, podium/tower massing, dense sidewalks, flat roofs.
- [x] Tarboro grammar: detached historic homes with porches/pitched roofs plus Main Street storefronts and Town Common greenery.
- [x] Fuse use/floors/height/material/roof evidence in order of measured source confidence; record inferred fallback evidence rather than pretending it was sourced.
- [x] Assign `embedded` to 6–12 route-relevant suitable footprints, `instanced` to usable buildings without embedded layouts, and `sealed` only where geometry is too small/unsafe.
- [x] Run `npx vitest run tests/geospatial-profiles.test.ts`.
- [x] Commit: `feat: add regional neighborhood grammars`

## Task 6: Integrate semantic compilation and structural diagnostics

**Files:**
- Modify: `src/sim/geospatial/compiler.ts`
- Modify: `src/sim/geospatial/artifact.ts`
- Modify: `scripts/import-geospatial-map.ts`
- Modify: `tests/geospatial-compiler.test.ts`
- Create: `tests/geospatial-diagnostics.test.ts`

- [x] Write failing end-to-end fixture tests for the required acceptance metrics.
- [x] Change `compileGeospatialMap` to produce `district` and drive compilation in this order: project → street graph → terrain/water → blocks → lots → building semantics → entrances/access → embedded interiors → mission anchors → audits.
- [x] Preserve source footprints whenever they clear the confidence threshold. Mark a footprint removed only with a diagnostic reason.
- [x] Replace the hard six-interior default with profile-aware `minPlayableBuildings: 6` and `maxPlayableBuildings: 12`.
- [x] Add diagnostics for footprint retention, overlaps, entrances, mission reachability, vehicle anchors, walkable islands, source/type/height distributions, and render batches.
- [x] Make the importer fail before writing an artifact when any hard invariant fails:

```ts
if (district.diagnostics.footprintRetention < 0.95) throw new Error('footprint retention below 95%');
if (district.diagnostics.unexplainedRoadOverlaps.length) throw new Error('building/carriageway overlap');
if (district.diagnostics.disconnectedEntrances.length) throw new Error('entrance disconnected');
if (!district.diagnostics.vehicleAnchorsConnected) throw new Error('vehicle anchors disconnected');
if (district.diagnostics.walkableIslands.length) throw new Error('inaccessible walkable island');
```

- [x] Print a concise semantic/audit report at import time and store it in the artifact.
- [x] Run `npx vitest run tests/geospatial-compiler.test.ts tests/geospatial-diagnostics.test.ts tests/geospatial-artifact.test.ts`.
- [x] Commit: `feat: compile audited semantic districts`

## Task 7: Render full semantic building exteriors efficiently

**Files:**
- Modify: `src/client/geospatial-visuals.ts`
- Modify carefully: `src/client/renderer.ts`
- Create: `tests/geospatial-visuals.test.ts`

- [ ] Write failing pure tests for palette/profile selection, true-height preservation, roof selection, facade module counts, and embedded-building exclusion from background shells.
- [ ] Extend palette/style support to `lower-manhattan` and `tarboro`.
- [ ] Add `buildSemanticDistrictVisuals(meta)` that creates footprint-aligned low-poly shells, roofs, doors, and instanced window/facade modules from `meta.district.buildings`.
- [ ] Batch repeated facade/roof modules by profile/material/storey band; do not instantiate one raw four-meter cube per footprint cell.
- [ ] Preserve tall Lower Manhattan heights; remove the existing two-storey visual cap in `backgroundWallStyle`.
- [ ] Exclude embedded buildings from background shells so authored interiors and semantic exteriors never z-fight.
- [ ] In `renderer.ts`, integrate the semantic group beside existing geospatial decor while leaving unrelated renderer edits intact.
- [ ] Run `npx vitest run tests/geospatial-visuals.test.ts` and `npx tsc --noEmit`.
- [ ] Commit: `feat: render semantic real city exteriors`

## Task 8: Import the three real-city districts

**Files:**
- Modify: `package.json`
- Modify: `scripts/import-geospatial-map.ts`
- Replace: `src/data/geospatial/miami-gardens-33056.json`
- Create: `src/data/geospatial/lower-manhattan-civic-financial.json`
- Create: `src/data/geospatial/tarboro-town-common-main-street.json`
- Create as needed: `src/data/geospatial/cache/*.json`
- Create: `tests/geospatial-city-artifacts.test.ts`

- [ ] Add scripts using equal 300 × 300 × 3 m geometry:

```json
"map:import:nyc": "tsx scripts/import-geospatial-map.ts --id lower-manhattan-civic-financial --name \"Lower Manhattan Civic / Financial District\" --bbox -74.01235,40.70695,-74.00165,40.71505 --city 40.711,-74.007 --seed 212 --profile lower-manhattan --output src/data/geospatial/lower-manhattan-civic-financial.json",
"map:import:tarboro": "tsx scripts/import-geospatial-map.ts --id tarboro-town-common-main-street --name \"Tarboro Town Common / Main Street\" --bbox -77.54080,35.89275,-77.53080,35.90085 --city 35.897,-77.536 --seed 27886 --profile tarboro --output src/data/geospatial/tarboro-town-common-main-street.json"
```

- [ ] Add explicit `--cache-dir`, `--profile`, and optional `--nsi` import arguments. Cache raw fetched source payloads with retrieval timestamps and attribution.
- [ ] Attempt current authoritative live imports first. If a source is unavailable, use only previously cached real-source payloads and make the fallback visible in diagnostics.
- [ ] Add artifact tests that hydrate all three, assert source IDs/styles/profile differences, require 6–12 embedded interiors, and enforce every hard diagnostic.
- [ ] Compare distribution signatures: median floors, attached/detached ratio, setback, block area, and green-space ratio must differ in the expected direction.
- [ ] Run all three import commands, inspect reports, and run `npx vitest run tests/geospatial-city-artifacts.test.ts`.
- [ ] Commit: `feat: import three semantic real city districts`

## Task 9: Expose three launchable military operations

**Files:**
- Modify: `src/sim/theater-types.ts`
- Modify: `src/sim/theaters.ts`
- Modify: `src/sim/theaters/geospatial.ts`
- Modify: `src/sim/military-missions.ts`
- Modify: `tests/geospatial-theater.test.ts`
- Modify: `tests/military-missions.test.ts`
- Modify: `tests/theaters.test.ts`

- [ ] Add failing catalog tests for theater IDs `geocity`, `geocity_nyc`, and `geocity_tarboro` and their source/profile metadata.
- [ ] Parameterize artifact hydration so each theater returns a fresh map with matching theater metadata and launch seed.
- [ ] Add `Lower Manhattan Counterstrike` and `Tarboro Common Defense` mission presets alongside `33056 Civic Front`.
- [ ] Assert all three worlds launch through normal `World` construction, validate, contain route-reachable embedded interiors, and do not share mutable artifact arrays.
- [ ] Run `npx vitest run tests/geospatial-theater.test.ts tests/military-missions.test.ts tests/theaters.test.ts`.
- [ ] Commit: `feat: launch three real city operations`

## Task 10: Launch, inspect, capture, and tune all three cities

**Files:**
- Create: `artifacts/geospatial/miami-command.png`
- Create: `artifacts/geospatial/miami-street.png`
- Create: `artifacts/geospatial/nyc-command.png`
- Create: `artifacts/geospatial/nyc-street.png`
- Create: `artifacts/geospatial/tarboro-command.png`
- Create: `artifacts/geospatial/tarboro-street.png`
- Create: `docs/geospatial/semantic-city-verification.md`
- Modify implementation files only when a captured defect requires a fix.

- [ ] Start the app using the project dev command and open each operation in the browser.
- [ ] Capture command-scale and street-scale images for each city; also inspect at least one embedded interior and one tactical/playthrough route per city.
- [ ] Tune until unlabeled screenshots visibly separate Miami detached suburban fabric, Manhattan street-wall/tower density, and Tarboro historic/green small-town fabric.
- [ ] Record source timestamps, artifact diagnostics, visual observations, FPS/render batch counts, and screenshot paths in the verification report.
- [ ] If browser inspection finds a defect, write a focused regression test before fixing it.
- [ ] Commit: `test: verify semantic real city operations`

## Task 11: Full gates and approved-requirement audit

**Files:**
- Modify: `docs/geospatial/semantic-city-verification.md`

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npx vitest run`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Audit the approved design line by line and record evidence for: three equal slices; recognizable interconnected road/block organization; building retention; profile-specific lots/massing; complete exteriors; 6–12 embedded interiors; explicit policy and reachable entrance for every retained building; vehicle/pedestrian/mission connectivity; offline runtime; attribution; performance; screenshots.
- [ ] Check `git status --short`, ensure unrelated pre-existing edits remain unstaged, and commit only the verification report or necessary final fixes by exact path.
- [ ] Report completion only after every hard requirement has evidence and all four gates pass.
