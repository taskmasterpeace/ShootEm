# Terrain Elevation — Design Spec (v1)

**Status:** approved design, 2026-07-22. Next: implementation plan (writing-plans).
**Goal:** give the ground *height* — hills, ridges, mountains, valleys — so the big
maps read as terrain, not a flat plane. Threaded through LOS, cover, movement,
the air war, and the camera. One unified vertical scale shared with `elevation.ts`.

---

## 1. The model (locked with Robert)

**Four bands, one vertical scale** — the same `elevation.ts` bands the air war
already flies on: `Ground(0) · Building(1) · Sky(2) · Clouds(3)`.

- **Terrain climbs only the lower three:** `Ground → Building → Sky (the mountain)`.
- **Clouds is jet-only air** — no terrain and no building ever reaches it.
- **Non-linear heights** (world units): `Ground 0u · Building 4u · Sky 16u`
  (mountain ≈ 4× a building) · the Clouds air band sits far above (~50u), unchanged.
- **Terrain height is its OWN thing, separate from building floors.** A tile carries
  a terrain height 0–2; a building standing on it keeps its own storeys in `grid2`.
  We do **not** fuse "Sky mountain" with "2nd floor" — deliberately kept simple.

## 2. Data representation

Add one layer to `GameMap`, sized by `MapGeometry` like every other layer:

- **`height: Uint8Array`** — value `0|1|2` per tile (Ground/Building/Sky). Default
  **all zeros = today's flat map**, so every existing/legacy map is byte-identical
  until terrain is placed (the `LEGACY_GEOMETRY` discipline, repeated for height).
- **`ramp: Uint8Array`** — `0 = step/cliff edge`, `1 = graded slope`. A tile flagged
  `ramp` means its level boundaries are drivable. Generators and the Map Maker place
  ramps; default all-zero (no ramps) on legacy maps (moot while height is flat).
- **`export const TERRAIN_U = [0, 4, 16]`** in `map.ts` — level → world units, the
  single source both sim and renderer read. `terrainTopAt(height, geometry, x, z)`
  returns the tile's ground height in units (0 out of bounds).

Everything on a tile is **offset by its terrain top**: a wall on a Sky mountain
stands at `16 + WALL_H`; a soldier's feet rest at `terrainTop`.

## 3. Rules

### 3.1 Line of sight & cover — high ground wins
LOS marches already take `y` and `geometry` (post-merge). Thread `height` in:
at each step the ray is blocked if the sampled tile's **terrain top rises above the
ray line**, and wall/cover/slit checks shift up by that tile's terrain top. Result,
for free: a stander on a Sky ridge sees and fires **over** lower terrain and cover;
a taller ridge between two units blocks; a soldier in a valley is hidden from the
plain. `blocksShot`, `losClear`, `losClearXZ`, `losCrossFloor` gain the `height`
layer (same threading pattern as `geometry`). LEGACY all-Ground → byte-identical.

### 3.2 Movement — infantry scramble, vehicles ramp (Robert's call)
Per step between adjacent tiles with level delta `d = h(dest) − h(src)`:

- **Infantry, up:** `d ≤ 1` allowed, with an **uphill speed penalty** (steeper =
  slower). `d ≥ 2` (a sheer cliff) is **blocked** in v1 (climbing is Phase 2).
- **Infantry, down:** `d ≤ −1` allowed (drop). (Fall handling: v1 = free; tune later.)
- **Vehicles, up or down:** a level change is allowed **only across a `ramp` tile**;
  otherwise blocked. So **ramp tiles are the armor lanes** up a mountain.
- Movement integrator vetoes the destination (mirrors the existing statue-law veto),
  so a blocked climb just stops you — no teleport, deterministic.

### 3.3 The air war — heli blocked, jet clears (free from the unified scale)
A tile's terrain top maps to an **elevation obstacle**: a Sky (16u) tile occupies the
Sky band. Rotorcraft cap at Sky (`elevation.ts` already: rotors use the lower three
bands) → a Sky mountain **blocks the helicopter, it can't fly over.** Fixed-wing fly
Clouds → **clear.** No new air rules — terrain just contributes obstacles at its band
via the existing `collidesAtElevation`.

### 3.4 Camera — follows your elevation (v1, answers Robert's Y-plane question)
The renderer's `camPos` target Y gains the **local unit's terrain top**, so climbing a
mountain keeps you framed and aircraft up high stay in view when zoomed out. Eased
like the existing camera lerp; no snap.

## 4. Integration points (where height threads)

| System | File | Change |
|---|---|---|
| Map format | `sim/map.ts` | `GameMap.height` + `ramp`; `TERRAIN_U`, `terrainTopAt`; height into `blocksShot`/`losClear*` |
| Vision | `sim/perception.ts` | pass `height` to the LOS calls (already take geometry) |
| Movement/physics | `sim/world.ts` | ground-Y baseline = `terrainTopAt`; climb/ramp gating in the move veto |
| Air | `sim/elevation.ts` | terrain-top → obstacle band feeding `collidesAtElevation` |
| Authoring | `sim/fronts.ts`, generators, `chunks.ts` | emit `height` + `ramp` (mountains, ridges, ramps) |
| Render | `client/renderer.ts` | draw terrain relief + raise meshes/soldiers by terrain top; elevation-follow camera |
| Editor hook | `sim/mapedit.ts`, `harness/mapmaker.ts` | paint height + ramps (lightweight; Map Maker build is separate) |

## 5. Determinism & back-compat (non-negotiable)
- `height`/`ramp` default all-zero → **every current map is byte-identical**; the
  1974+ sim tests must stay green untouched until a map actually places terrain.
- Height is authored or seeded — **no `Math.random`/wall-clock**; the sim stays
  deterministic across clients. `snapshot.ts` replicates the two layers (static after
  gen, so a one-time send).

## 6. Deferred — Phase 2 (Robert named these)
- **Cliff-climbing as an ability** — the height layer makes it trivial: grappling
  hooks, jetpacks, and superpowers scale a sheer `d ≥ 2` face (jetpack finally onto
  rooftops / over walls). Not v1.
- **Fall damage** tuning for big drops.
- **Altitude UI meter** (bottom readout, per aircraft family) — belongs to Robert's
  **UI-evaluation track**, not this sim spec; v1 leaves a clean `terrainTopAt`/band
  hook the meter reads.

## 7. Testing (v1 gates)
- **LOS-over-hill:** a unit on Sky sees a valley tile a ridge hides from a Ground unit.
- **High-ground %:** eye on Sky sees strictly more tiles than the same eye on Ground.
- **Ramp gating:** a vehicle ascends a level across a ramp tile, is blocked without one.
- **Cliff block:** infantry blocked ascending `d ≥ 2`; allowed on `d = 1` (slower).
- **Air:** a heli is stopped by a Sky mountain tile; a jet at Clouds passes over it.
- **Legacy flat:** an all-Ground map generates and simulates **byte-identical** to
  pre-elevation (determinism guard).
- **Camera:** `camPos.y` rises with the local unit's terrain top.

## 8. Open defaults (call out to change)
- Ramp = a per-tile `ramp` flag (not a derived gradient) — explicit, authorable.
- Terrain heights `[0, 4, 16]` u — tune in play; the table is one constant.
- v1 fall = free (no damage); drops always allowed.

---
*Interactive design explorer used to lock this model: `terrain-lab.html` (throwaway).
Companion to `docs/MAP-STRATEGY.md` (§ terrain) and the air system in `sim/elevation.ts`.*
