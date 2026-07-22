# Map Generation — Integration Plan & Reference Review

**Question asked (Robert, 2026-07-22):** "We desperately need a way to generate
maps at scale — forest, plains, city blocks, neighborhoods — plus two branches
coming (small *science* maps, big *military* landscape maps with tanks). Can we
use MiniCity for cities? Should I wait to get to main before building this?"

**Short answer:** You already have ~80% of it. Do **not** start a third parallel
map effort, and do **not** graft the external repos as foundations. The real
work is **merging the two `codex/*` branches into main in the right order** — they
are complementary in design but collide across ~20 shared files. Details below.

---

## 1. What already exists (on `main`, shipped)

War World's procedural map system is mature. `generateMap(seed, mode, theme)`
emits a `GameMap`: a `grid` (tiles), a `grid2` second storey, a `surface` layer,
plus spawns/bases/flags/control-points/vehicle-pads/pickups/props/houses.

- **Region-chunk grammar** (`src/sim/chunks.ts`): a field map is carved into
  regions, each filled by a chunk generator — **forest · neighborhood · farm ·
  industrial · interior · open**. Every chunk guarantees a clear 3-wide
  cross-lane ("choke, not seal"), mirrored for fairness, deterministic.
  → **Forest, neighborhoods, farmland already generate.**
- **Ten authored fronts** (`src/sim/fronts.ts`, 1,984 lines) — hand-placed bones,
  seed only deals dressing. Includes **"Eastern Plains"** (hedgerow tank country)
  and **"The City"** (street grid of *grown, enterable* districts + plaza + canal
  + a working sewer). → **Plains and city-blocks-with-interiors already exist.**
- **Population-scaled sizes** (`MapSize = small | standard | large`,
  62/82/100 tiles): a front authors inside a centered playable box; everything
  outside seals to solid ground. `mapSizeForPlayers(botsPerTeam)` picks the tier.
- **Grown buildings with real interiors** (`buildings.ts`): `generateHouse`
  grows manor/bungalow/hall-house via BSP; every room reachable from the front
  door; real doors the horde breaks down. ~40% of front building stock is grown.

**Implication:** "we desperately need map gen at scale" is partly a *visibility*
gap — a great deal is built. The genuine gaps are (a) maps **bigger than the
100×100 grid** for military, (b) denser **data-driven city buildings**, (c) an
**authoring tool** to make/edit maps at volume. All three are already in flight
on the two branches below.

## 2. The two in-flight branches (the real work)

Both live in worktrees under `.claude/worktrees/`, built by dispatched agents.

### `codex/military-operations` — the BIGGER / landscape / tanks side
Forked from `a1ddcad`. Ships (per its `docs/MAP-STRATEGY.md`, tests passing):

- **`src/sim/map-geometry.ts` — THE KEYSTONE.** Replaces the global
  `GRID=100 / TILE=3 / WORLD=300` constants with a per-map
  **`MapGeometry {cols, rows, tile}`**, plus a `LEGACY_GEOMETRY = {100,100,3}`
  back-compat shim and all the world↔tile/bounds/allocate helpers. **This is the
  "maps at scale" refactor** — and it is *threaded through the sim* (world.ts has
  109 geometry references; perception.ts too), not a prototype.
- **Vehicle-scale theaters — SHIPPED:** City 600², Desert/Countryside/Ocean 900²,
  Mountain/Coastal 600×900 — dimensions owned by the map. This is the military
  "bigger mission + landscape + tanks/rotors/subs" ask.
- **`operation-map.ts`** (`generateOperationMap`) — three scales × ten sites,
  objective/manifest/protected-zone metadata layered onto tested fronts.
- **`elevation.ts`** — four semantic levels (Ground/Building/Sky/Clouds) for
  rotorcraft/fixed-wing/subs.

### `codex/science-missions` — the SMALLER / city-buildings / insides side
Forked from `68ae4af`. Ships / in progress:

- **`building-generator.ts`** (470 lines) — whole-building grammar:
  `BUILDING_ARCHETYPES`, `FOOTPRINT_FAMILIES` (rectangle/l-shape/courtyard/
  twin-wing/arcade), sockets, sections, `generateCityBuilding()`.
- **Real-world data:** `src/data/map-cities.json` (**17k lines**) +
  `map-countries.json` → `city-profile.ts` compiles per-city architecture &
  security weights into deterministic building grammars. (Fits the *Consequences
  of Failure* real-world-origins IP.)
- **`map-layers.ts`** — optional indexed **upper storeys** behind floor helpers,
  **preserving `GameMap.grid`/`grid2`** (deliberately does NOT fork the format).
- **`indoor-ai.ts` / `building-navigation.ts` / `k9-orders.ts`** — building-aware
  search/investigate AI, portals, floor transitions, K9 clearing.
- **The Map Maker** (`mapmaker.ts` rewrite): a country/city-driven tool to
  generate, edit, validate, preview, export, and playtest 1–3 storey buildings
  with windows, breakable glass, balconies, stairs. **This is literally "a way to
  generate maps at scale."**

### Why they're complementary (the good news)
Military generalizes the map's **outer shell** (any dimensions). Science enriches
the **inner content** (multi-storey city buildings) *within* the existing
grid/grid2 format. Different axes of the same system — no design contradiction.

### Why the merge is non-trivial (the real problem)
They forked from **different** points of main and both rewrite the **same ~20
files**: `map.ts` (~200 lines each), `buildings.ts`, `mapedit.ts`, `mapmaker.ts`,
`fronts.ts`, `modes.ts`, `perception.ts`, `bots.ts`, `snapshot.ts`, `types.ts`,
`world.ts`, `main.ts`, + client files. A naïve "merge both" is a hard 3-way
conflict; worse, science's new code assumes the **legacy `GRID=100`** while
military **generalized that away**.

## 3. Recommended sequence (turns a 3-way collision into two steps)

1. **Land `codex/military-operations` first.** Its `map-geometry.ts` is the
   architectural keystone everything else needs — you cannot have 900×900
   military theaters *or* tiny science pockets without map-owned dimensions.
   Merge/verify against main (mind the shared client files — `reticle.ts`,
   `renderer.ts`, `settings.ts` also diverged this session).
2. **Rebase `codex/science-missions` onto the new main.** Update any `GRID=100`
   assumptions in `building-generator.ts` / `map-layers.ts` to `MapGeometry`;
   reconcile the shared `map.ts`/`buildings.ts`/`mapedit.ts`/`mapmaker.ts` edits.
3. **Result on main:** variable-dimension maps (tiny science pockets → 900×900u
   military theaters) + rich multi-storey city buildings + the real-cities
   data-driven generator + the Map Maker. Then any *new* biome work is additive.

**Do not, until (1)–(2) land:** start new map generators on main, or hand-merge
piecemeal. **Merge readiness checklist:** both branches green on
`tsc`/`vitest`/`build`; confirm geometry is threaded (not just in operation maps);
confirm science's upper-layers survive a non-legacy geometry.

> **STATUS (2026-07-22):** Step 1 **DONE** — `codex/military-operations` merged to
> main (`9a2df89`, gated tsc/vitest-1974/build). Step 2 **IN FLIGHT** — the science
> agent is reconciling `codex/science-missions` onto the new main (17-file union
> merge, its own tests as the guard), then it lands clean.

## 4. The four reference repos — verdicts (deep-dived 2026-07-22)

| Repo | License | What it actually is | Graft | When |
|---|---|---|---|---|
| **dungeon-forge** (majidmanzarpour) | **MIT** | Real room-graph algo: Delaunay + MST + loop edges + BFS critical-path/difficulty tagging, ~650 THREE-free LOC. Interiors only. | **3/5** | **Later** — best donor for a **science-lab / bunker interior** generator; slots into science's `building-generator.ts`. Richer than template-grown interiors. |
| **house-builder** (ch-bas) | **MIT** | Real authoring ergonomics: anchor→commit→re-anchor wall-draw, shape-stamp-as-one-undo, point-onto-segment snap, decoupled snapshot-undo hook. Zero procgen. | **3/5** | **Later** — portable *patterns* (not code) for the Map Maker / `mapedit.ts`. Hand to whoever finishes the editor. |
| **MiniCity** (fabioarnold) | MIT | City layout is a one-line modulo lattice; solid-facade buildings, no interiors, unseeded `Math.random`. Our neighborhood chunk + The City already surpass it. | **2/5** | **Skip** — only the NESW road-autotile bitmask is a 5-min glance if we ever want road tiles. Not a graft. |
| **room-designer** (CodeHole7) | **NONE** | 959 MB: 784 MB vendored assets + 174 MB binary git history + 1.3 MB *minified build output*. Zero first-party source. No license. | **1/5** | **Discard** — nothing to take, and nothing we legally could. |

**Net:** the repos don't change the plan. Two are later donors (interiors,
editor UX), two are drops. Nothing here is a foundation — the foundation is the
two branches above.

## 5. Genuine gaps to build *after* the merge (not before)
- Forest/plains at the new *vehicle scale* (the chunks assume ~100-grid regions).
- Open design Qs from `MAP-STRATEGY.md`: neighborhood streets grid-vs-organic;
  how many arena pockets to open with.
- (Earmark) dungeon-forge's room-graph for lab/bunker interiors; house-builder's
  wall-draw ergonomics for the Map Maker.

---

# PART II — What these could actually SOLVE (the opportunity map)

Part I answered *"do I graft these, and in what order."* Part II answers the
bigger question: *"what game do these let us build?"* Each asset isn't a library
score — it's a capability that closes a specific gap. Read this as: **problem →
what it unlocks → the fight it creates.**

## 6. Asset by asset — the problem each one kills

### A · Military geometry (`MapGeometry`) — solves **SCALE + SHAPE**
- **Problem it kills:** every fight happened on the same 300×300 square. A tank
  had nowhere to be a tank; a one-room infiltration had to rattle around a field.
- **Unlocks:** the map's *dimensions express the mission.* 900² armor theaters →
  real gunnery duels, flanking runs, air corridors over ground (combined arms
  that needs room). 60² facility pockets → claustrophobic single-building
  infiltration. Non-square (mountain 600×900, coastal 900×600) → *directional*
  pressure: a pass you can't flank, a shore where the sea is a wall.
- **The fight it creates:** a recon deep in a 900² forest feels *vast and alone*;
  a science lab feels *tight and airless.* Scale becomes a mood, not a constant.
- This is the foundation; everything below rides on it.

### B · Science buildings (`building-generator` + `city-profile` + `indoor-ai` + real-cities data) — solves **DEPTH + PLACE + LIFE**
- **Problem it kills:** buildings were shells; cities were generic; interiors were
  furniture that couldn't fight back.
- **Unlocks:** (1) **vertical CQB** — windows, breakable glass, balconies, stairs:
  breach a window, snipe a balcony, clear a stairwell. The building is a *puzzle*,
  not a wall. (2) **specific places** — the 17k real-city profiles make a dense
  old-European lane-and-courtyard town play nothing like a US grid or an Asian
  megablock; it ties the map to the *Consequences of Failure* real-world faction
  origins ([[consequences-of-failure-universe]]). (3) **living interiors** —
  indoor-AI + building-nav + K9 mean enemies *clear rooms, search, take stairs,
  chase noise.* The dog finds the scientist you hid in the server room.
- **The fight it creates:** house-to-house urban war where the insides *matter* and
  the enemy hunts you through them — the exact thing you asked for, with teeth.

### C · Dungeon Forge (room-graph: Delaunay → MST → loops → BFS role/depth tagging) — solves **LAYOUT MEANING + MISSION FLOW + CAVES**
This is the richest one — the missing *brain* for procedural spaces.
- **Problem it kills:** our procedural interiors have connectivity but no *meaning*
  — rooms are random, no flow, no objective structure. And there is **no cave
  generator** (you asked for one).
- **Unlocks:**
  - **Objective-shaped layouts.** The graph tags rooms by role (entrance / combat /
    elite / treasure / boss) along a BFS critical path. Map that to us:
    *entrance → search rooms → the keycard/containment/intel room → the objective
    lab → extraction.* The *layout itself encodes the mission* — every facility is
    different, every facility has FLOW. This is the brain **Science Missions / the
    Scientist Hunt** were missing.
  - **A difficulty ramp for free.** BFS depth = escalating resistance: guards thin
    at the door, thick at the objective. The raid *builds.*
  - **Loot placed to make decisions.** elite/treasure tags → the better gun sits in
    the room that costs you a detour. Choices, not scatter.
  - **CAVES — your ask, answered.** The same graph with the SDF organic room
    shapes (ellipse/octagon) + tunnel carving = a **cave-system generator**:
    chambers, connecting tunnels, a boss cavern, dead-end pockets. Deterministic,
    seed-stable, drops straight into the tile grid.
  - **Bunkers, sewers, fortress guts** for the military side — underground
    complexes with real room logic instead of a maze.
- **Where it slots:** *inside* science's `building-generator`. The building-gen
  makes the SHELL (footprint, floors, façade); the graph decides the *room
  connectivity + roles* within. Neither alone does this — **together they're the
  engine** (see §7.1). MIT-licensed, ~650 THREE-free lines — a real graft, not
  inspiration.

### D · House Builder (authoring ergonomics) — solves **CONTENT VELOCITY + PROCEDURAL-MEETS-AUTHORED**
- **Problem it kills:** hand-authoring a map is slow, and a Map Maker nobody enjoys
  using is a Map Maker nobody uses.
- **Unlocks:** wall-draw (anchor→commit→chain), room-shape stamps as one undo,
  door/window snapping → the Map Maker becomes a *real editor.* You (or a designer)
  crank authored fronts, arena pockets, and campaign set-pieces in minutes. And the
  **hybrid** move: generate a base, then hand-tune the signature moment (the bridge
  you defend, the boss lab) — *authored ground, at procedural volume.*
- **The payoff:** the campaign gets deeper because a level gets cheap to make.

### E · MiniCity — solves **ONE** small thing
- The 16-entry NESW **road-autotile bitmask** picks the right street mesh/rotation
  at each junction. If the city theater ever paints *visible connected roads* on the
  surface layer, that's a 5-minute lift. Everything else MiniCity does, we do better.
  (room-designer: solves nothing — no code, no license.)

## 7. The fusions — what EMERGES (bigger than the parts)

1. **The Procedural Facility Engine** = military geometry × science building-gen ×
   dungeon-forge room-graph. → multi-floor facilities (labs, bunkers, apartment
   stacks, **caves**) at *any* scale, with objective-driven room flow and living
   indoor AI. **This single fusion delivers Science Missions, the Scientist Hunt,
   urban CQB, bunker assaults, AND caves.** Biggest unlock on the board.
2. **The Real-World Level Studio** = science Map Maker × House-Builder ergonomics ×
   city-profile data × military geometry. → generate a 900² city *from a real
   place*, hand-author the signature fights, playtest, ship. Velocity + authored
   quality + real-world flavor in one tool.
3. **The Biome Continuum** = existing chunk grammar × military geometry × the
   surface layer (+ MiniCity road-autotile). → forest / plains / farm /
   neighborhood scale from a 62² skirmish pocket to a 900² theater on the *same*
   grammar, sized to the mission.

## 8. The biome × mission matrix (your exact asks, mapped)

| You wanted… | Delivered by | Science (small) | Military (big) |
|---|---|---|---|
| **Forest** | existing forest chunk + geometry scale | tense recon pocket | 900² ambush country, treeline vs armor |
| **Plains** | Eastern Plains front + geometry | — | 900² hedgerow tank duels, air lanes |
| **City blocks** | The City front + science city-profile + dungeon-forge interiors + MiniCity roads | a few blocks, one objective building | 600² urban theater, block-by-block |
| **Neighborhood** | neighborhood chunk + science houses-with-insides | house-to-house hunt | suburb sprawl approach |
| **Caves** *(your ask)* | **dungeon-forge graph + organic rooms** → to build | lab-under-the-mountain | bunker/tunnel network |
| **Facility / lab** | **Procedural Facility Engine** (§7.1) | **the Scientist Hunt** | secure-site assault |
| **Landscape + tanks** | military theaters + geometry | — | desert/mountain/coastal, armor + rotors + subs |

Every row you named already has a path. The two *new builds* are **caves** and
the **facility engine** — and both are the same graft (dungeon-forge), so one
piece of work lights up half the table.

## 9. Honest gaps — what NONE of these solve yet

- **Terrain relief (hills, valleys, ridgelines).** The grid is flat; `elevation.ts`
  is *air bands*, not ground height. "Landscape with hills" for the military
  theaters is **not** solved — this is the biggest gap for a real-feeling
  battlefield, and it's a genuine new system (height field + LOS/movement/vehicle
  physics that read it).
- **Organic (non-grid) streets.** MiniCity and our grids are lattices; sprawl and
  old-towns need curved/L-system roads or the city-profile to encode them. Partial.
- **City-scale destruction.** materials/rubble exist per-tile; a *block* coming down
  is unbuilt.
- **Rivers/water as terrain-shaping** at 900² — tiles today, not carved valleys.

## 10. What I'd build, in order (the punchline)

1. **Land science** (in flight) → building depth + the Map Maker arrive.
2. **Graft dungeon-forge's room-graph into `building-generator`** → the Procedural
   Facility Engine → *Science Missions + Scientist Hunt + bunkers + CAVES* in one
   stroke. Highest leverage on the board.
3. **Graft House-Builder ergonomics into the Map Maker** → content velocity; start
   hand-authoring signature fights on procedural bases.
4. **Build terrain elevation** (the real gap) → true landscapes for the theaters.
5. **MiniCity road-autotile** → clean city streets (a garnish, do it last).

---
*Companion to `codex/military-operations:docs/MAP-STRATEGY.md` (the design roster).
This doc owns the **integration order**, the **reference-repo verdicts**, and (Part
II) the **opportunity map** — what these assets let us build.*
