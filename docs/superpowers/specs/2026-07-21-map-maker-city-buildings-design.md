# City Building Map Maker Design

**Status:** Approved for uninterrupted implementation under Robert's standing direction  
**Date:** 2026-07-21  
**Branch:** `codex/science-missions`

## Purpose

Turn the shipped Map Maker and Science Mission map generator into one deterministic building-authoring system capable of producing compact, Hotline-tight operations inside complete residential, commercial, industrial, civic, and military structures. The system must preserve existing battle maps while adding believable city identity, a richer architectural tile vocabulary, three playable storeys, breakable glass, balconies, distinct stairs and ladders, authored encounter zones, and stronger indoor NPC behavior.

The result is a production tool, not a geometry demo. A designer must be able to choose a country and city, generate a complete building, inspect and edit each floor, validate it, preview it in 3D, export it, import it without loss, and launch a representative science operation in it.

## Direction Chosen

Three approaches were considered:

1. **Extend the existing Map Maker and stencil pipeline.** Add a compatible floor-aware building document, deterministic city profiles, and new architectural tiles. This keeps simulation, export, validation, and preview on one substrate.
2. **Build a separate science-only editor.** This would move faster at first but immediately create two map formats, two validators, and two rendering paths.
3. **Replace tiles with freeform mesh geometry.** This offers the most visual freedom but breaks deterministic collision, bot navigation, compact exports, and the procedural low-poly pipeline.

Approach 1 is selected. Existing `GameMap.grid`, `GameMap.grid2`, v1 Map Maker documents, and old stencils remain valid. New maps add optional upper layers and authoring metadata. The renderer still derives structures from simulation data; no bespoke building meshes or GLTF dependencies enter the match loop.

## Product Shape

The existing harness **Map Maker** becomes the single authoring surface. It gains a **City Generator** strip and three synchronized workspaces:

- **District brief:** country, city, culture region, population class, city tags, security pressure, district use, building archetype, seed, and committed print reserve.
- **Floor plan:** Ground, Level 2, and Level 3 tabs over the same tile canvas. The active floor owns its vocabulary and validation overlay.
- **Operation layer:** entry, extraction, objectives, patrol routes, civilian zones, dog/handler posts, reinforcement entries, and section boundaries.

The visual direction is an industrial field-architect's drafting table: near-black blueprint paper, warm amber structure lines, cyan glass and circulation, vermilion threats, ivory labels, small stamped status marks, and restrained grid motion. It must remain dense and fast rather than becoming a card dashboard. Existing keyboard editing, undo/redo, autosave, import/export, and 3D preview remain available.

## Country and City Data

The two supplied source files are normalized at build time into checked-in runtime JSON:

- `Country Master Sheet - Country.csv`: 167 usable country profiles after discarding its explanatory row.
- `Country Master Sheet - Cities.csv`: about 1,050 usable city profiles after discarding its explanatory/header echo rows.

The normalizer keeps only fields that drive generation or presentation:

- country code/name, government perception, corruption, military/law-enforcement/science/digital ratings, cloning policy, LSW activity/regulation, lifestyle, and leader title;
- city sector, country/culture code, name, population class/rating, up to four city tags, crime, and safety.

Source typos and trailing spaces are normalized at the boundary. Runtime code never parses CSV and never depends on a Downloads path. Generated records are sorted by country code then city name for stable diffs. Tests assert record counts, joins, numeric bounds, unique city identity, and deterministic selection.

City tags bias, but do not hard-lock, generation:

| City tag | Strong building/district weights |
|---|---|
| Company | offices, mall sections, executive residential |
| Educational | research annexes, lecture/lab blocks, dormitories |
| Industrial | foundries, factories, depots, worker housing |
| Military | barracks, command villas, armories, checkpoints |
| Mining | processing halls, yards, bunkhouses, buried archives |
| Political | civic offices, villas, secure compounds, plazas |
| Resort | hotels, villas, retail arcades, waterfront balconies |
| Seaport | warehouses, customs halls, markets, worker housing |
| Temple | civic/ceremonial halls, courtyards, markets, housing |

Culture code selects palette-safe facade and plan tendencies—not caricatured national stereotypes. Examples are courtyard frequency, balcony depth, roof/parapet bias, window rhythm, and service-lane width. Country ratings adjust security technology, guard discipline, glass prevalence, electrical locks, civilian density, and dog-handler likelihood. All modifiers are documented numeric weights and remain seed-stable.

## Building Document and Compatibility

`GameMap` keeps `grid` as ground collision and `grid2` as the first upper storey. New maps may provide `upperLayers`, where index 0 aliases the same logical Level 2 content as `grid2` and index 1 is Level 3. Helper functions are the only new code allowed to select a floor layer. Existing generators need no extra allocation and old map output stays byte-compatible.

`BuildingDef` gains optional multi-storey `layers` and architectural metadata while continuing to accept `rows` and `rows2`. Legacy definitions normalize into the new form at stamp time. A generated whole building contains:

- one exterior footprint and facade identity;
- one to three floor stencils aligned on the same tile grid;
- explicit rooms, corridors, doors, windows, stairs, ladder/service shafts, balconies, furniture sockets, and section boundaries;
- entry, extraction-compatible exit, objective, patrol, civilian, cover, and dog-handler sockets;
- a stable generator provenance record: city ID, archetype, seed, and grammar version.

Map Maker JSON advances to v2. The reader accepts v1 and upgrades it in memory. V2 serializes every upper layer and authoring metadata. Round trips must be byte-equivalent for tile layers and value-equivalent for metadata.

## Architectural Vocabulary

Battle-map thick materials retain their present codes and behavior. Indoor structures prefer the thin family:

- horizontal, vertical, and junction thin walls;
- horizontal and vertical hinged/sliding door openings;
- horizontal and vertical framed windows;
- intact and broken glass state for each window orientation;
- upper-floor slab, void, wall, window, door, balcony deck, balcony rail, stair, ladder well, and section shutter;
- ground stair entries in four orientations.

Thin collision and rendering use the same slab profile. A closed window blocks bodies, sight, and projectiles through its glass pane. The first damaging projectile shatters the pane, emits one deterministic glass event, changes the tile to its broken state, and lets later sight/projectiles through while its low sill still blocks ordinary walking. A player may use the existing climb/vault behavior at a broken ground-floor window. Glass state is included in door/tile change replication and snapshots.

Balconies are real upper-floor deck tiles outside the ground footprint, edged by rail tiles. Rails are chest-high cover, do not masquerade as full walls, and may be vaulted. A balcony requires an interior door or broken window connection and a supported/cantilevered span bounded by the grammar.

## Stairs, Ladders, and Three Storeys

Ladders and stairs become intentionally different verbs:

- **Ladder:** a narrow paired shaft. The player faces it and presses `E`; a short climb lock moves the body one storey. Dogs cannot climb ladders. Ordinary guards only use ladders when their archetype permits it.
- **Stair:** a two-tile oriented run with landings. Walking across its center transitions continuously to the adjacent storey while preserving facing and horizontal momentum. Bots path through stairs as graph edges. Dogs can use stairs.

Ground is storey 0, Level 2 is storey 1 at y=4, and Level 3 is storey 2 at y=8. Rendering, movement, bullets, perception, objectives, spawns, cutaway visibility, and minimap/editor selection use the soldier/object's storey rather than checking only `floor === 1`. Falling through a void drops to the highest valid lower slab at that coordinate. Cross-storey sight is only legal through aligned voids, stairs, ladder wells, broken windows, or exterior exposure.

The initial production cap is three storeys. Data helpers accept an indexed upper-layer collection so a fourth storey would be content work rather than another core-map rewrite, but no UI or generator exposes more than three now.

## Whole-Building Grammar

Generation works from the outside inward and always produces the complete building before mission sectioning:

1. Select city profile and building use.
2. Choose a bounded footprint: rectangle, L, courtyard, twin-wing, or arcade.
3. Build structural shell and vertical core.
4. Subdivide each storey into rooms/corridors using archetype rules.
5. Connect every occupied room to an exterior exit through doors and circulation.
6. Place facade windows with rhythmic spacing and privacy/security constraints.
7. Add balconies where culture/use/floor exposure permits.
8. Furnish cover and interaction sockets without blocking doors or stair landings.
9. Place operation sockets and encounter zones.
10. Validate and retry with the next deterministic sub-seed; use a known-valid fallback after the retry cap.

The first complete archetype set is:

- residential: cottage, row house, apartment, command villa;
- commercial: storefront, office, mall section, hotel;
- industrial: workshop, factory, depot, processing hall;
- civic/research: clinic, school/research annex, government office;
- military: barracks, armory, command post, secure archive.

A mall section or large office is still generated as a complete coherent building. Mission sectioning then closes authored shutters/secure doors around the active wing, leaving visible exterior mass and believable inaccessible space rather than generating a severed room fragment. The active section must still have two viable approaches unless the selected operation explicitly calls for a single choke point.

## Mission Scale and Print Reserve

Science operations remain smaller than battles. The committed print reserve is 1–8 and scales encounter composition, not building footprint:

| Prints | Initial defenders | Reinforcement budget | Civilians | Dog chance |
|---:|---:|---:|---:|---:|
| 1–2 | 3–5 | 0–2 | 0–3 | low |
| 3–4 | 5–7 | 2–3 | 1–5 | medium |
| 5–6 | 7–10 | 3–5 | 2–7 | high |
| 7–8 | 10–13 | 5–7 | 3–9 | high, never more than two teams |

Verb, complication, city security, and building size adjust within those ranges. Increasing prints must never merely multiply bodies in the first room. It may add an upper-floor patrol, reserve response, dog team, or second defensive sector. Objective count remains readable.

## NPC and Dog Behavior

Indoor NPC behavior gains a building-aware tactical layer rather than bespoke mission scripts:

- room/section IDs and portal adjacency are derived from generated floors;
- guards receive patrol routes, posts, response sectors, and fallback points;
- hearing creates a last-known-position investigation, then a room-by-room search, then a return to post;
- alarm response uses stairs and doors, avoids crowding portals, and reserves firing lanes;
- civilians choose a safe room or marked exit, avoid gunfire and dogs, and stop oscillating at blocked doors;
- objective actors preserve mission-specific behavior but use the same circulation graph;
- NPCs may open ordinary doors, respect locked section shutters, traverse stairs, and only use ladders when allowed.

Dogs become a substantial indoor threat without becoming bullet sponges:

- scent persists briefly along the player's recent path, including through darkness and cloak;
- a dog investigates the strongest reachable scent node and can pull its handler/search group with it;
- close bites cause a short movement drag and louder alarm bark;
- dogs use stairs, cannot use ladders, hesitate at intact windows, and pass broken door/window routes only when physically navigable;
- dog health remains readable; threat comes from detection, speed, flanking, and handler coordination rather than large HP inflation;
- science operations may deploy zero, one, or two dog-handler teams according to the table above and city/military weights.

All tactical choices are deterministic for a fixed world seed and tick stream.

## Validation Laws

The existing six map laws remain. Whole buildings add live authoring laws:

1. **STRUCTURE:** occupied upper tiles have valid support or a bounded balcony exception.
2. **ROOMS:** every usable room reaches a legal exterior exit.
3. **CIRCULATION:** every occupied storey connects by stairs or ladder; stairs have clear landings.
4. **FACADE:** windows/doors occur in walls, not isolated floor.
5. **GLASS:** glass state belongs only to a window frame and every breakable pane has a stable tile transition.
6. **SECTIONS:** active mission space contains all required sockets and remains extractable.
7. **ENCOUNTERS:** posts, patrol paths, civilians, objectives, and reinforcement entries stand on compatible floor tiles.
8. **PERFORMANCE:** a generated three-storey building stays within explicit tile, mesh, and actor budgets.

Selecting a violation highlights its exact floor and tiles. Export remains available for diagnostic work, but the Launch Operation action is disabled until all required laws pass.

## Rendering and Cutaway

Each storey is built as a per-building group from its tile layer. The renderer shows all exterior facades from command height, then cuts away only roofs and storeys above the focused actor's current storey inside the focused building. Neighboring buildings remain intact to preserve streetscape readability. Windows use shared transparent materials and cheap pane geometry; broken state removes the pane and leaves frame shards. Balconies use thin deck/rail primitives. Stairs use a low-triangle stepped ramp, ladders retain their vertical rung silhouette.

Map Maker 3D preview can solo one floor, show the automatic cutaway, or explode storeys vertically. Collision overlays distinguish full wall, thin wall, glass/sill, rail, stair, and void.

## Error Handling and Determinism

- Invalid CSV rows are discarded with counted reasons by the normalizer; missing country joins fail generation tests.
- Unknown city IDs and archetypes produce descriptive errors before map mutation.
- Generation uses a fixed retry cap and deterministic sub-seeds.
- Failed generation leaves the current editor document untouched.
- V1 imports upgrade without writing back until the user edits or exports.
- Optional balcony/detail placement may be skipped when validation cannot satisfy it; circulation, objectives, and exits may not.
- Runtime glass changes are idempotent and emit at most one shatter event per pane.

## Test and Playtest Contract

Automated tests cover:

- normalized country/city counts, joins, ranges, and deterministic profile selection;
- each archetype, footprint family, and culture tendency across a seed matrix;
- legacy stencil and Map Maker v1 compatibility;
- v2 multi-floor serialization and undo/redo;
- thin windows, glass break transitions, sight, bullets, movement, vaulting, and replication;
- balcony support/rails and falls;
- three-storey movement, projectile/perception floors, continuous stairs, explicit ladders, and dog restrictions;
- room/portal/section validation and objective reachability;
- guard investigate/search/return, portal deconfliction, civilian escape, scent tracking, and dog-handler response;
- 1–8 print encounter budgets;
- editor city generation, floor switching, law display, import/export, and launch eligibility.

Visual verification covers at least:

1. a three-storey command villa with windows and an upper balcony;
2. a commercial mall/office section showing the complete exterior and closed inactive wings;
3. a military/research building with a ladder service route and stair main route;
4. intact and shattered glass under fire;
5. a guard/dog search moving across floors;
6. Map Maker floor editing, exploded 3D preview, save/import, and direct science playtest.

Completion requires the full repository gates:

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

## Production Boundary

This slice ships deterministic whole-building authoring and playable three-storey science maps. It does not add arbitrary freeform meshes, curved walls, elevators, procedural furniture art, fourth storeys, online collaborative editing, or runtime CSV loading. Those are separate product decisions and are not required for this map maker to be useful, stable, or production-ready.
