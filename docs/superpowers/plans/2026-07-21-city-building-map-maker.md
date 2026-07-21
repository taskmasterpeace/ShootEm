# City Building Map Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, country/city-driven Map Maker that generates, edits, validates, previews, exports, and playtests complete one-to-three-storey science-operation buildings with thin construction, windows, breakable glass, balconies, stairs, ladders, and building-aware NPCs.

**Architecture:** Preserve `GameMap.grid` and `grid2`, adding optional indexed upper layers behind floor helper functions. Normalize the supplied CSVs into checked-in JSON, compile city profiles into deterministic building grammars, and extend the existing Map Maker rather than introducing a second format or renderer. Tactical room/portal metadata is derived from the same floor layers used for collision and rendering.

**Tech Stack:** TypeScript 5.6, Three.js 0.170, Vite 6, Vitest 2.1, DOM/canvas Map Maker harness, deterministic `Rng` simulation.

## Global Constraints

- Work only in `D:/git/ShootEM/.claude/worktrees/science-missions` on `codex/science-missions`.
- Preserve byte-compatible behavior for existing map generators unless a new multi-floor document is selected.
- Ground plus at most two upper storeys ship in this slice.
- Runtime never reads the Downloads directory or parses CSV.
- All generation and AI decisions are deterministic for a fixed seed and tick stream.
- Use existing procedural primitives; do not add match-loop GLTF assets.
- Keep Science Mission print reserves at 1–8 and scale encounters within the approved bands.
- Stage files by explicit name, create focused commits, add no `Co-Authored-By`, and do not push.
- Completion requires `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.

---

## File Structure

- `tools/import-map-culture-data.mjs` — one-way CSV normalizer invoked by maintainers.
- `src/data/map-countries.json`, `src/data/map-cities.json` — checked-in normalized runtime data.
- `src/sim/city-profile.ts` — typed lookup, validation, and deterministic architecture/security weights.
- `src/sim/map-layers.ts` — compatibility-safe floor selection, coordinates, and upper-layer allocation.
- `src/sim/building-generator.ts` — whole-building grammar, archetypes, floor plans, sockets, sectioning, and retries.
- `src/sim/building-nav.ts` — rooms, portals, floor transitions, reachability, and authoring laws.
- `src/sim/indoor-ai.ts` — deterministic investigate/search/return and scent utilities.
- `src/sim/map.ts`, `src/sim/buildings.ts`, `src/sim/world.ts`, `src/sim/perception.ts` — tile runtime, stamping, traversal, projectiles, and perception integration.
- `src/client/renderer.ts` — procedural windows/glass, balconies, stairs, third storey, and cutaway.
- `src/sim/mapedit.ts`, `src/harness/mapmaker.ts`, `harness.html` — v2 document/editor/generator/operation workflow.
- `src/sim/science-map.ts`, `src/sim/science-runtime.ts`, `src/sim/bots.ts` — generated building selection and encounter/AI integration.
- Dedicated tests keep data, generator, floors, glass, navigation/AI, scale, and editor contracts isolated.

---

### Task 1: Normalize Country and City Content

**Files:**
- Create: `tools/import-map-culture-data.mjs`
- Create: `src/data/map-countries.json`
- Create: `src/data/map-cities.json`
- Create: `src/sim/city-profile.ts`
- Test: `tests/city-profile.test.ts`

**Interfaces:**
- Produces: `CountryMapProfile`, `CityMapProfile`, `CITY_MAP_PROFILES`, `COUNTRY_MAP_PROFILES`, `cityProfile(id)`, and `architectureProfile(cityId, seed)`.
- `architectureProfile` returns `{ facade, courtyardWeight, balconyWeight, glassWeight, security, guardDiscipline, dogWeight, districtWeights }` with every weight in `[0, 1]`.

- [x] **Step 1: Write the failing data-contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { CITY_MAP_PROFILES, COUNTRY_MAP_PROFILES, architectureProfile, cityProfile } from '../src/sim/city-profile';

describe('map culture data', () => {
  it('ships the complete normalized datasets with valid country joins', () => {
    expect(COUNTRY_MAP_PROFILES.length).toBe(168);
    expect(CITY_MAP_PROFILES.length).toBe(1050);
    const countries = new Set(COUNTRY_MAP_PROFILES.map((c) => c.code));
    for (const city of CITY_MAP_PROFILES) expect(countries.has(city.countryCode), city.id).toBe(true);
  });
  it('selects a deterministic bounded architecture profile', () => {
    const kabul = CITY_MAP_PROFILES.find((c) => c.name === 'Kabul')!;
    expect(cityProfile(kabul.id)).toEqual(kabul);
    expect(architectureProfile(kabul.id, 42)).toEqual(architectureProfile(kabul.id, 42));
    for (const n of Object.values(architectureProfile(kabul.id, 42)).filter((v) => typeof v === 'number')) {
      expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(1);
    }
  });
});
```

- [x] **Step 2: Run `npx vitest run tests/city-profile.test.ts` and confirm RED** — expected failure: module `../src/sim/city-profile` does not exist.
- [x] **Step 3: Implement a dependency-free CSV parser/normalizer** that accepts explicit `--countries`, `--cities`, and `--out` arguments, trims keys/values, skips explanatory rows, canonicalizes `Mega City ` / `Small Town `, joins cities by normalized country name (including the explicit `DR Congo` alias), and writes stable sorted JSON containing only spec fields.
- [x] **Step 4: Run the normalizer against the two supplied files**

```powershell
node tools/import-map-culture-data.mjs --countries "C:/Users/taskm/Downloads/Country Master Sheet - Country.csv" --cities "C:/Users/taskm/Downloads/Country Master Sheet - Cities.csv" --out src/data
```

Expected: `168 countries; 1050 cities; 0 missing country joins` and two generated JSON files.

- [x] **Step 5: Implement `city-profile.ts`** using JSON imports, exact typed coercion, a `Map` lookup, `clamp01`, stable city IDs `${countryCode}:${slug(name)}`, documented culture facade tables, tag-based district weights, and country-rating security/dog/glass modifiers.
- [x] **Step 6: Run the focused test and `npx tsc --noEmit`; confirm GREEN.**
- [x] **Step 7: Commit explicit files** with `git commit -m "feat: add city architecture profiles"`.

### Task 2: Add Compatible Indexed Floor Layers

**Files:**
- Create: `src/sim/map-layers.ts`
- Modify: `src/sim/map.ts`
- Modify: `src/sim/mapedit.ts`
- Modify: `src/sim/types.ts`
- Test: `tests/map-layers.test.ts`
- Test: `tests/mapedit-v2.test.ts`

**Interfaces:**
- Produces: `MAX_BUILDING_FLOORS = 3`, `floorHeight(floor)`, `floorLayer(map, floor)`, `ensureUpperFloor(map, floor)`, `tileAtFloor(map, floor, x, z)`, `floorBlocked(map, floor, x, z)`, and `floorShotBlocked(map, floor, x, z, y)`.
- `GameMap.upperLayers?: Uint8Array[]`; logical floor 1 always resolves to `upperLayers?.[0] ?? grid2`.
- Map JSON v2 adds `upperLayers: number[][]` and optional `buildingMeta`; deserializer accepts v1.

- [x] **Step 1: Write failing tests** proving floor 1 aliases `grid2`, floor 2 allocates independently, three-storey v2 round-trips, and a v1 fixture upgrades with no Level 3 allocation.
- [x] **Step 2: Run the two focused files and confirm RED** on missing helpers and v2 fields.
- [x] **Step 3: Implement `map-layers.ts`** with this selection law:

```ts
export const MAX_BUILDING_FLOORS = 3;
export const floorHeight = (floor: number) => floor * 4;
export function floorLayer(map: GameMap, floor: number): Uint8Array {
  if (floor === 0) return map.grid;
  if (floor === 1) return map.upperLayers?.[0] ?? map.grid2;
  const layer = map.upperLayers?.[floor - 1];
  if (!layer) throw new Error(`map has no floor ${floor}`);
  return layer;
}
```

`ensureUpperFloor` validates integer floors 1–2, creates `upperLayers` with `grid2` at index 0, and allocates exactly `GRID * GRID` bytes.

- [x] **Step 4: Add the optional map metadata and v2 serializer** while preserving v1 import. Clone every upper layer and building metadata in undo snapshots.
- [x] **Step 5: Replace new multi-floor code paths with floor helpers; do not mass-rewrite legacy ground generators.**
- [x] **Step 6: Run focused tests plus existing `tests/mapedit.test.ts`, `tests/twostory.test.ts`, and typecheck; confirm GREEN.**
- [x] **Step 7: Commit with `git commit -m "feat: add three-storey map layers"`.**

### Task 3: Generate Complete City Buildings

**Files:**
- Create: `src/sim/building-generator.ts`
- Modify: `src/sim/buildings.ts`
- Test: `tests/building-generator.test.ts`

**Interfaces:**
- Produces `BuildingArchetype`, `BuildingUse`, `GeneratedBuilding`, `BuildingSocket`, `BuildingSection`, and `generateCityBuilding({ cityId, archetype, seed, floors, missionSection? })`.
- `GeneratedBuilding` contains aligned `layers: string[][]`, `def: BuildingDef`, sockets, sections, provenance, and `validationSeed`.

- [x] **Step 1: Write a seed-matrix failing test** across all 19 archetypes, five footprint families, floors 1–3, and representative culture codes. Assert determinism, full exterior shell, one legal exit, aligned layers, at least one circulation path per upper storey, and `stencilConnected` ground space.
- [x] **Step 2: Run `npx vitest run tests/building-generator.test.ts`; confirm RED** on missing module.
- [x] **Step 3: Implement footprint and BSP room grammar** with exact bounded sizes: cottages 7–10×6–9; houses 10–15×8–12; apartments/offices 14–21×11–17; mall/factory 18–25×13–19. Emit thin exterior/interior walls, room doors, window rhythm, one main stair, and optional service ladder.
- [x] **Step 4: Implement archetype rules** for residential cottage/row-house/apartment/villa, commercial storefront/office/mall/hotel, industrial workshop/factory/depot/processing, civic clinic/research/government, and military barracks/armory/command/archive.
- [x] **Step 5: Implement complete-building mission sectioning** with shutters around inactive rooms, while retaining exterior layers and two active approaches except `single-choke` sections.
- [x] **Step 6: Add deterministic retry up to 8 sub-seeds and a compact known-valid two-storey fallback.**
- [x] **Step 7: Run generator, building, dynamic-house, and science-map tests plus typecheck; confirm GREEN.**
- [x] **Step 8: Commit with `git commit -m "feat: generate complete city buildings"`.**

### Task 4: Add Windows, Glass, Balconies, and Architectural Stamping

**Files:**
- Modify: `src/sim/map.ts`
- Modify: `src/sim/buildings.ts`
- Modify: `src/sim/world.ts`
- Modify: `src/sim/snapshot.ts`
- Modify: `src/client/renderer.ts`
- Test: `tests/architectural-tiles.test.ts`
- Test: `tests/glass.test.ts`

**Interfaces:**
- Produces ground tile constants for oriented windows/intact/broken, stair entries, and section shutters; upper tile constants for floor/wall/window/broken-window/door/balcony/rail/stair/ladder.
- Produces `isWindowTile`, `windowIsBroken`, `breakWindowTile`, `isBalconyRail`, and `glassChanges` replication records.

- [x] **Step 1: Write failing glass tests**: intact pane blocks sight/projectile/body; first projectile changes state and emits one `glass` event; later projectile/sight passes; sill remains blocked; repeated damage emits no second event; snapshot applies the broken state.
- [x] **Step 2: Write failing balcony/stamp tests**: balcony deck is walkable on its floor, rail is cover, unsupported long spans fail structural validation, and generated stencil characters map to the intended tile codes.
- [x] **Step 3: Run both focused tests and confirm RED.**
- [x] **Step 4: Implement collision/shot/LOS tile functions** with a thin framed pane profile and broken-state sill. Register every new stencil character in `isLegalStencilChar` and stamp ground/upper tiles through one table-driven translator.
- [x] **Step 5: Integrate projectile shatter before ordinary wall impact** and replicate changed pane indices/state alongside doors using a distinct tagged compact record.
- [x] **Step 6: Render shared-material window frames/panes, broken shards, balcony decks/rails, and section shutters** within the existing procedural geometry budgets.
- [x] **Step 7: Run focused tests, `tests/visual.test.ts`, `tests/visibility.test.ts`, `tests/projectile-fx.test.ts`, and typecheck; confirm GREEN.**
- [x] **Step 8: Commit with `git commit -m "feat: add breakable building facades"`.**

### Task 5: Make Stairs and Ladders Distinct Across Three Storeys

**Files:**
- Modify: `src/sim/map-layers.ts`
- Modify: `src/sim/map.ts`
- Modify: `src/sim/world.ts`
- Modify: `src/sim/perception.ts`
- Modify: `src/client/renderer.ts`
- Modify: `src/sim/bots.ts`
- Test: `tests/multistorey.test.ts`
- Test: `tests/stairs-ai.test.ts`

**Interfaces:**
- Produces `transitionAt(map, floor, x, z)`, storey-aware `losBetweenFloors`, and stair graph edges.
- Ladder remains `E`; stair transitions on crossing its oriented center and preserves velocity/facing.

- [x] **Step 1: Write failing movement tests** for ground→Level 2→Level 3 and back by stairs, ladder requiring `E`, momentum preservation on stairs, explicit climb lock on ladder, falling to the highest lower slab, and no transition beyond floors 0–2.
- [x] **Step 2: Write failing bot/dog tests** proving guards path through stairs, permitted guards can use ladders, dogs use stairs, and dogs reject ladder-only targets.
- [x] **Step 3: Run focused tests and confirm RED.**
- [x] **Step 4: Generalize movement, projectile height bands, perception, cross-floor LOS, and objective floor checks** from boolean `floor === 1` logic to indexed layers.
- [x] **Step 5: Add automatic oriented stair transition and timed ladder state.** Use y values `0`, `4`, and `8`; stairs preserve x/z velocity, ladders zero it during the climb.
- [x] **Step 6: Render stair runs and every upper storey, then generalize per-building cutaway** so storeys above the focused actor fade while adjacent buildings remain intact.
- [x] **Step 7: Run focused tests, all existing ladder/two-storey/upper-LOS tests, visual tests, and typecheck; confirm GREEN.**
- [x] **Step 8: Commit with `git commit -m "feat: add three-storey circulation"`.**

### Task 6: Derive Building Navigation and Authoring Laws

**Files:**
- Create: `src/sim/building-nav.ts`
- Modify: `src/sim/mapedit.ts`
- Test: `tests/building-nav.test.ts`
- Test: `tests/mapedit-laws.test.ts`

**Interfaces:**
- Produces `deriveBuildingGraph(map, houseId)`, `validateBuilding(map, metadata)`, `BuildingGraph`, `BuildingRoom`, `BuildingPortal`, and floor-aware `BuildingLawIssue`.
- Law issues carry `{ law, detail, floor, tiles }`.

- [x] **Step 1: Write failing fixtures** for a valid three-storey villa and one invalid fixture per STRUCTURE, ROOMS, CIRCULATION, FACADE, GLASS, SECTIONS, ENCOUNTERS, and PERFORMANCE law.
- [x] **Step 2: Run focused tests and confirm RED.**
- [x] **Step 3: Flood-fill rooms per floor and derive door/window/stair/ladder portals.** Construct cross-floor edges only from aligned circulation pairs.
- [x] **Step 4: Implement all eight laws** with exact budgets: maximum 3 storeys, 650 occupied tiles per building, 220 facade segments, 48 encounter sockets, and 16 NPCs in a science operation's initial wave.
- [x] **Step 5: Merge building issues into `validateDoc`** without changing the six legacy law results for v1 maps.
- [x] **Step 6: Run focused tests plus existing map/front law suites and typecheck; confirm GREEN.**
- [x] **Step 7: Commit with `git commit -m "feat: validate whole building maps"`.**

### Task 7: Scale Science Encounters to Print Reserve

**Files:**
- Modify: `src/sim/science-map.ts`
- Modify: `src/sim/science-runtime.ts`
- Modify: `src/sim/science.ts`
- Test: `tests/science-encounters.test.ts`

**Interfaces:**
- Produces `scienceEncounterBudget(spec, architecture)` returning initial defenders, reserve defenders, civilians, dog teams, patrol sectors, and reinforcement entries within the design table.
- Science layouts carry building metadata and floor-aware sockets.

- [x] **Step 1: Write failing table tests** for print commitments 1–8 at low/high security, asserting each approved defender/reserve/civilian band, monotonic threat, at most two dog teams, and no first-room body multiplication.
- [x] **Step 2: Write failing integration tests** generating every verb against residential, commercial, and military archetypes with all objectives/extraction reachable across floors.
- [x] **Step 3: Run focused tests and confirm RED.**
- [x] **Step 4: Implement the budget function** with clamped city-security, verb, complication, and storey modifiers; spread additional threat across patrol sectors and reinforcement waves.
- [x] **Step 5: Replace generic science site boxes with generated whole-building layouts** for villa/annex/vault/hospital/archive/comms, retaining yard/airfield exterior hybrids.
- [x] **Step 6: Run all science tests plus building generation/navigation tests and typecheck; confirm GREEN.**
- [x] **Step 7: Commit with `git commit -m "feat: scale science building encounters"`.**

### Task 8: Improve Indoor NPCs and Dogs

**Files:**
- Create: `src/sim/indoor-ai.ts`
- Modify: `src/sim/bots.ts`
- Modify: `src/sim/world.ts`
- Modify: `src/sim/bot-tuning.ts`
- Test: `tests/indoor-ai.test.ts`
- Test: `tests/indoor-dogs.test.ts`

**Interfaces:**
- Produces `IndoorIntent = 'post' | 'patrol' | 'investigate' | 'search' | 'respond' | 'fallback' | 'evacuate'`, `updateScentTrail`, `strongestReachableScent`, `advanceIndoorIntent`, and portal reservations keyed by tick.

- [ ] **Step 1: Write failing deterministic behavior tests** for hear→investigate→room-search→return, two guards not crowding one portal, alarm response across stairs, civilian safe-room/exit choice, and blocked-door recovery.
- [ ] **Step 2: Write failing dog tests** for recent player scent through cloak/darkness, handler pull, stairs, ladder rejection, window hesitation, a short bite drag, and louder alarm bark without increasing HP.
- [ ] **Step 3: Run focused tests and confirm RED.**
- [ ] **Step 4: Implement immutable graph inputs and small per-actor indoor memory** (`intent`, `roomId`, `lastKnown`, `searchQueue`, `post`, `portalClaimUntil`) without replacing the existing combat brain.
- [ ] **Step 5: Add a capped 24-node scent ring per tracked hostile** with 8-second decay; dogs choose the strongest reachable node and notify the handler group.
- [ ] **Step 6: Integrate the tactical layer only when building metadata is present.** Existing open battle bot behavior and dog tests must remain unchanged.
- [ ] **Step 7: Run focused tests, existing bot/dog/navigation/AI suites, deterministic replay tests, and typecheck; confirm GREEN.**
- [ ] **Step 8: Commit with `git commit -m "feat: add indoor tactical AI"`.**

### Task 9: Build the City Map Maker Workflow

**Files:**
- Modify: `src/harness/mapmaker.ts`
- Modify: `src/sim/mapedit.ts`
- Modify: `src/harness/harness.ts`
- Modify: `harness.html`
- Test: `tests/mapmaker-ui.test.ts`

**Interfaces:**
- Produces pure UI helpers `mapMakerCityOptions`, `mapMakerArchetypeOptions`, `floorTabs`, `canLaunchOperation`, and `generateBuildingDoc` for DOM-light testing.
- `mountMaker` adds city generation, floor tabs, building/operation layers, exploded preview, and Launch Science Operation.

- [ ] **Step 1: Write failing presentation tests** asserting country→city filtering, all archetype groups, Ground/L2/L3 tabs, floor-aware violation labels, print reserve 1–8, v1 import notice, and launch disabled on invalid docs.
- [ ] **Step 2: Run `npx vitest run tests/mapmaker-ui.test.ts` and confirm RED.**
- [ ] **Step 3: Add the drafting-table UI**: city/district generator bar; compact selectors; seed/prints controls; floor tabs; layer switch; provenance stamp; room/portal/operation overlays; generated-building replace confirmation; floor-aware laws; generate, preview, explode, export, import, and launch actions.
- [ ] **Step 4: Extend canvas rendering and tools** with distinct amber walls, cyan windows/glass/stairs, pale balcony deck, red shutters/threats, and floor ghosting. Preserve keyboard editing, undo/redo, autosave, and exact-grid hit testing.
- [ ] **Step 5: Connect 3D preview options and science launch** through typed deps; a valid generated map enters science mode with selected prints and city briefing.
- [ ] **Step 6: Add responsive/accessibility behavior**: visible focus, labeled controls, 44px primary actions, reduced-motion respect, keyboard floor switching, and no color-only law state.
- [ ] **Step 7: Run focused UI/presentation tests, all Map Maker tests, typecheck, lint, and build; confirm GREEN.**
- [ ] **Step 8: Commit with `git commit -m "feat: build city map maker workflow"`.**

### Task 10: Visual Playtest, Regression Fixes, and Shipping Documentation

**Files:**
- Modify as failures require, always with a new failing regression test first.
- Modify: `docs/SCIENCE-MISSIONS.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/MASTER-BACKLOG.md`
- Modify: `docs/SHIPPING-LOG.md`
- Modify: `docs/superpowers/plans/2026-07-21-city-building-map-maker.md`

**Interfaces:** None new; this task verifies the complete product story.

- [ ] **Step 1: Start Vite and inspect Map Maker in the in-app browser.** Generate and save a three-storey command villa, commercial mall section, and military/research building.
- [ ] **Step 2: Verify each required visual/runtime scene** from the design: floor editing, complete facades, balcony, intact/broken glass, stairs versus ladder, exploded preview, validation highlight, save/import, and direct science launch.
- [ ] **Step 3: Play a low-print and high-print mission.** Confirm encounter scaling, multi-floor objective/extraction, guard search, dog scent/stairs, and no ladder use by dogs.
- [ ] **Step 4: For every defect, write a focused failing regression test, observe RED, implement the smallest fix, and observe GREEN.**
- [ ] **Step 5: Update docs with exact shipped behavior and boundaries.** Check every completed plan box; include normalized data counts, supported archetypes/floors, AI behaviors, editor workflow, and remaining non-goals.
- [ ] **Step 6: Run fresh focused suites, then all four gates in order:**

```powershell
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: all commands exit 0, full Vitest count has zero failures, lint has zero errors, and Vite emits the bundle.

- [ ] **Step 7: Verify `git diff --check`, branch status, `main...HEAD`, no untracked production files, no original-checkout mutations, and no push.**
- [ ] **Step 8: Commit documentation and any verified final regressions** with focused messages, ending with `git commit -m "docs: ship city building map maker"` for the doc-only slice.

---

## Plan Self-Review

- Every design requirement maps to a task: data (1), layers/compatibility (2), whole buildings/sections (3), facade vocabulary (4), circulation/third storey (5), laws (6), print scaling (7), brains/dogs (8), tool workflow (9), and visual/full verification (10).
- Public type and function names are consistent across producer/consumer tasks.
- The plan contains no deferred implementation placeholders; its explicit non-goals remain outside the production boundary.
- Existing maps remain on their current paths, while new behavior is opt-in through upper layers and building metadata.

## Execution Choice

Robert requested uninterrupted work. Execute inline in this session with `superpowers:executing-plans`; do not dispatch subagents and do not stop for batch checkpoints unless an external blocker makes safe progress impossible.
