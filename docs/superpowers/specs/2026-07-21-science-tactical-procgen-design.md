# Science Tactical Procgen Design

**Status:** Approved for autonomous implementation under Robert's standing direction to follow the recommended design without further routine questions  
**Date:** 2026-07-21  
**Branch:** `codex/science-missions`

## Outcome

Science Missions become compact, lethal infiltrations rather than small military battles. Most operations contain four to six defenders, no armor on any actor, civilian-scale weapons, local perception, authored patrols, an interruptible reporting chain, permanent mission waypoints, and a deterministic objective-to-extraction route. The player's movement speed remains the same in every awareness state.

The procedural system generates a mission graph before it stamps geometry. That graph assigns room purpose, critical path, optional loops, patrol routes, alarm infrastructure, response entrances, insertion, objective, and extraction. War World's existing building document, navigation graph, tile laws, renderer, and simulation remain authoritative.

## External Project Deep Dive

The four supplied repositories are references, not dependencies.

### `threejs-sims-house-builder`

Repository: <https://github.com/ch-bas/threejs-sims-house-builder>

Useful ideas:

- building-level document with per-floor state;
- thin wall drawing with vertex and right-angle snapping;
- door and window snapping/cutouts;
- rotation-aware OBB placement collision;
- reusable room/furniture templates;
- reversible edits, schema migration, JSON import/export, floor switching, 2D/3D views, cutaway, and camera coverage overlays;
- clean separation between pure domain helpers, Three.js builders, hooks, and presentation.

Rejected as a gameplay substrate because its interior walls are drawn segments and do not define enclosed rooms. It has no authoritative room/portal topology, mission reachability, combat collision contract, multi-actor pathing, or deterministic encounter grammar. War World already has the stronger gameplay document and validator. We will adapt selected editor interactions and schema habits, not its React application or geometry ownership.

License posture: MIT, but implementation should be original and contract-driven. No code copy is required.

### `threejs-procedural-dungeon`

Repository: <https://github.com/majidmanzarpour/threejs-procedural-dungeon>

This is the strongest algorithmic reference. Its pipeline scatters rooms, separates overlaps, derives a Delaunay candidate graph, guarantees connectivity with a minimum spanning tree, restores a controlled number of loop edges, assigns semantic depth with breadth-first search, identifies a critical path, carves tiles, validates reachability, and exposes graph/heatmap telemetry.

The ideas worth adapting are:

- generate topology before geometry;
- guarantee connectivity first, then add bounded loopiness;
- assign semantics from graph position rather than random decoration;
- preserve dead ends for meaningful side rooms;
- validate generated output and retry from a deterministic sub-seed;
- expose graph overlays and generation metrics in Map Maker.

The code itself is not a production donor. It is a one-commit prototype whose RNG, generator, renderer, effects, camera, and HUD live in one large JavaScript module. It is single-floor dungeon grammar with no building facade, doors/windows behavior, stairs, patrols, mission sockets, or tests. War World will implement the concepts as small typed pure modules against its existing building laws.

License posture: MIT. Concepts may be reimplemented; wholesale import is unnecessary.

### `threejs-3d-room-designer`

Repository: <https://github.com/CodeHole7/threejs-3d-room-designer>

The repository contains a bundled production build and assets, not the editable React source. Its visible ideas are a 2D wall/corner editor, product placement in 2D and 3D, and configurable dimensions/materials/styles.

It is a visual interaction reference only. There is no root source license, no maintainable source tree, and no safe code-integration path. No code or assets will be copied.

### `MiniCity`

Repository: <https://github.com/fabioarnold/MiniCity>

MiniCity is intentionally tiny. It creates a fixed orthogonal street grid using row/column modulo, chooses one of sixteen road meshes from the four neighboring street bits, places a random building only on lots adjacent to a street, and lets cars choose non-reversing directions at intersections with simple tile occupancy avoidance.

Useful ideas:

- a four-bit neighbor mask for road visual selection;
- orienting a building toward an adjacent street;
- simple route-following actors on a tile graph;
- decoupling city-block dressing from building interiors.

It is not a meaningful procedural city planner: it has no seed, parcels, zoning, hierarchy, block subdivision, sidewalks, entrances, mission topology, or building interiors. Its road-mask idea can support a later district macro-layer, but it should not delay the Science tactical foundation.

License posture: MIT; credited models are external assets. No dependency or asset import is needed.

## Integration Decision

Do not wait for the Science branch to merge before defining the procedural contracts. The operation graph, local-alert system, encounter profile, and melee AI belong in the current isolated Science worktree because they directly replace behavior already implemented here.

Do not add a city-scale generator in this slice. After Science lands on `main`, a separate follow-up can add street parcels and neighboring building shells using the stable whole-building and operation contracts. That avoids coupling district generation to tactical rules that are still changing.

## Science Ruleset

### Armor

`ScienceRuleset.armorPolicy` has three values:

- `none` — default for most operations; player, guards, civilians, targets, and responders start at zero armor and armor equipment is suppressed;
- `rare-specialist` — one visually explicit named specialist may have armor;
- `armored-site` — an uncommon authored complication for a military/secure site.

Ordinary generated operations use `none`. Armor is never silently added by class defaults or random loadout generation. A mission briefing and actor silhouette must disclose either exception.

### Encounter Scale

Committed clone count controls retry budget and optional response pressure, not a room full of enemies.

- standard: four to six initial defenders;
- quiet: three to four;
- hot: six to seven only when the operation says so;
- reserve: zero to two responders;
- dogs: zero or one team by default, never more than two in an explicit kennel complication.

Initial defenders are distributed across rooms/floors and never all placed on the critical path. A generated encounter is invalid if the insertion point begins inside a guard's vision cone or if more than two defenders cover the same doorway from the same side.

### Civilian-Scale Loadouts

Science guard loadouts are explicit weighted roles instead of normal class-armory randomization:

- unarmed staff/security;
- melee guard;
- pistol guard;
- SMG responder;
- dog handler with pistol or SMG;
- rare mission-defined specialist.

Rifles, machine guns, launchers, military shotguns, and LSW weapons are excluded unless the mission complication names them. A normal six-defender operation targets one unarmed actor, one melee actor, three pistol actors, and zero or one SMG responder.

## Operation Graph

Generation produces an `OperationGraph` independent of renderer and world mutation:

- nodes are rooms, exterior pockets, stair landings, balconies, and service routes;
- edges are doors, broken-window/vault routes, stairs, ladders, and open passages;
- node roles include insertion, buffer, patrol, objective, alarm, response, civilian, optional-loot, and extraction;
- edges carry traversal permissions for humans, dogs, civilians, and ladders;
- one critical route joins insertion to the objective and then extraction;
- zero to two optional loop routes create flanks without making every room equally connected.

The graph compiler assigns:

1. a safe insertion/reprint node outside immediate sight;
2. a buffer node before the first defended space;
3. one or more objective nodes appropriate to the verb;
4. an extraction node that remains locked until objective completion;
5. alarm/report nodes and one response entrance;
6. guard posts and two-to-four-point patrol loops;
7. civilian/loot side rooms and optional approach loops.

The graph is then bound to an existing `GeneratedBuilding` and its derived `BuildingNavigation`. Geometry remains the consequence of the building grammar; mission semantics remain the consequence of the operation graph.

## Deterministic Generation Pipeline

1. Select city, site, verb, complication, armor policy, and encounter profile from the mission seed.
2. Generate or load a valid whole building with aligned floors, doors, windows, stairs, ladders, and balconies.
3. Derive its room/portal navigation graph.
4. Select a safe entry and a distant objective candidate.
5. Build the critical route with breadth-first path data.
6. Score non-critical edges and retain bounded loops that create flanks, alternate stairs, balcony entries, or service routes.
7. Assign room semantics by depth, degree, size, site type, and objective verb.
8. Place operation sockets, patrol loops, reporting nodes, civilians, props, and response entrances.
9. Validate reachability, actor-specific traversal, sight safety, patrol spacing, alarm connectivity, encounter budgets, and extraction.
10. Retry with a deterministic sub-seed; fall back to a known-valid authored operation after the cap.

The same mission seed must reproduce byte-equivalent mission graph data and value-equivalent world placement.

## Local Awareness and Alarm

Science guards never receive a live global player position.

Each guard owns memory:

- current post and patrol index;
- suspicion meter;
- last personally seen/heard position and timestamp;
- report state and report target;
- search rooms already visited;
- known facility alarm report, containing a stale last-known position.

States are:

`patrol -> suspicious -> investigate -> engaged -> reporting -> searching -> returning`

Rules:

- direct sight engages only that guard;
- non-suppressed shots, glass, impacts, doors, barks, and shouts create local sound events with radii and timestamps;
- nearby guards may investigate a sound or hear a guard's shout;
- a guard must reach a radio/alarm node or complete an interruptible personal radio action to report;
- only a completed report raises the facility alarm;
- the facility alarm distributes the reported last-known position once, never the player's current position every tick;
- searches expand through adjacent rooms and expire back to posts;
- new personal evidence can update a guard's own memory without updating everyone else.

Movement speed remains identical in all states. Readability comes from facing, destinations, weapon posture, door interaction, radio animation, cover choice, and iconography—not a walk/run speed split.

### Player Readability

- `?` means suspicion/investigation;
- `!` means personal visual confirmation/engagement;
- a radio waveform means reporting is in progress and can be interrupted;
- facility HUD states are `GHOST`, `SEARCHING`, and `ALARMED`;
- alarm lights/sirens activate only after a successful report;
- insertion, current objective, report/alarm node when relevant, and extraction use permanent floor-aware waypoints.

## Unarmed and Melee Combat

The existing shared melee simulation remains authoritative. Science adds explicit weapons and ordinary-bot decision logic rather than a separate minigame.

Damage vocabulary:

| Weapon | Primary damage identity | Tactical identity |
|---|---|---|
| Unarmed | force/control | fast strike, guard, grapple, disarm, takedown |
| Baseball bat | force | knockback, stagger, guard break; poor against armor |
| Katana | edge/blood | bleed and cleave; vulnerable to blocks and hard armor |
| Fire axe | piercing/breach | slow committed hit, doors and armor; punishable recovery |

Bot melee behavior evaluates distance, opponent telegraph, held weapon, dropped weapons, ammunition, cover, and allies. It can strike, guard/parry, grapple a blocker, flank, disengage to a pistol, reload only when safe, and pick up a nearby dropped weapon after disarm or empty ammunition. It uses the same combat commands and cooldowns as the player.

Science defenders prefer melee in close rooms instead of firing through allies. They do not receive reaction-time cheats, animation skips, or awareness unavailable to the player.

## K9 Interaction

Dogs retain the existing building scent and stair logic:

- dogs use stairs and ordinary open passages;
- dogs cannot use ladders or open doors;
- intact glass blocks them and causes hesitation;
- handlers or the player can open a path, then issue `SIC` to search/attack or `STAY` to hold;
- a searching dog follows the strongest reachable scent/last-known trace, barks on confirmation, and can reveal a hiding actor without granting every guard live vision.

Dog alert information is local until a handler or alarm node successfully reports it.

## Map Maker Support

Map Maker gains an operation-graph overlay on top of the existing floor-aware building editor:

- critical route and optional loops;
- node roles and objective/extraction sequence;
- guard patrol polylines with direction arrows;
- vision cones at patrol stops;
- sound and shout radii;
- radio/alarm network edges;
- responder entry routes;
- floor-specific law violations;
- seed, graph metrics, critical-path length, loop count, guard count, armor policy, weapon mix, and validation result.

Generation controls should tune site, seed, room count band, loopiness band, security profile, patrol density, and complication. They do not expose raw Delaunay/MST implementation details as gameplay settings.

## Validation Laws

A playable Science operation must satisfy:

1. insertion, all required objectives, and extraction are reachable by the player;
2. every patrol route is reachable by its assigned actor and returns to its start;
3. dog routes contain no ladder-only edge;
4. extraction remains distinct from insertion and objective;
5. insertion is not initially visible to a guard or camera;
6. default armor policy leaves every spawned actor at zero armor;
7. all common guard weapons belong to the approved civilian-scale pool;
8. facility alarm cannot obtain a continuously refreshed player coordinate;
9. at least one report path is interruptible;
10. defenders are distributed across rooms/floors and obey encounter caps;
11. the critical route and at least one optional approach remain viable after section shutters;
12. no required portal is blocked by furniture, spawn, or objective props.

## Test and Simulation Contract

Automated coverage includes:

- deterministic operation graph generation and sub-seed retries;
- seed matrices across every site/verb, one through three floors, and every footprint family;
- no-armor default for player, guards, targets, civilians, dogs, and responders;
- explicit pistol/SMG/melee role distribution and forbidden weapon exclusion;
- local sight, local sound, shout radius, interruptible reporting, stale facility reports, search expiry, and return to patrol;
- unchanged movement speed across awareness states;
- route/waypoint reachability and floor markers;
- unarmed/bat/katana/axe player and bot actions, damage identity, drops, pickup, block, grapple, and disarm;
- K9 stair use, ladder refusal, door refusal, scent search, `SIC`, and `STAY`;
- generation performance and actor budgets.

Simulation soak tests run many deterministic missions and reject seeds with invalid paths, spawn vision, over-budget encounters, omniscient tracking, stuck searches, portal crowds, or melee deadlocks.

Visual verification covers at least:

1. a no-armor villa infiltration with four defenders and a balcony flank;
2. a two-floor research annex with patrols, local suspicion, an interrupted radio call, and extraction;
3. a dog clearing a building after its handler opens the door;
4. an unarmed guard escalating through guard, grapple, disarm, and weapon pickup;
5. a bat/katana/axe comparison against flesh, blocking, doors, and an explicit armored specialist;
6. Map Maker graph overlays and deterministic seed regeneration.

Completion requires the full repository gates:

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

## Production Boundary

This slice ships tactical building procgen, local alerts, civilian-scale encounter generation, no-armor defaults, patrol/waypoint/report systems, and shared unarmed/melee AI. It does not ship a whole-city simulation, arbitrary freeform wall geometry, imported third-party assets, or a replacement renderer. The later city-block layer may consume these stable contracts after this branch lands on `main`.
