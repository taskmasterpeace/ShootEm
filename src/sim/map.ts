import { Rng } from './rng';
import { generateHouse, placeBuildings, stampBuilding, type StampCtx } from './buildings';
import { stampBaseCompound } from './base';
import { carveInterior } from './interior';
import { fillRegions } from './chunks';
import { THEMES } from './data';
import type { ModeId, Team, ThemeId, Vec3, VehicleKind } from './types';

export const TILE = 3;          // world units per tile (33C: standard fronts ~300u)
export const GRID = 100;        // tiles per side
export const WORLD = TILE * GRID; // 200 units square, centered on origin

export const T_OPEN = 0;
export const T_WALL = 1;   // tall — blocks movement, bullets, sight
export const T_COVER = 2;  // low crate/sandbag — blocks movement, not railgun sight... (blocks projectiles too, simple)
export const T_WATER = 3;  // SHALLOW water: everyone wades (slow); wheels ford
export const T_SLIT = 4;   // firing slit (§8.4): blocks movement ALWAYS; blocks
                           // fire/sight everywhere EXCEPT the 1.2–1.8 height band
export const T_DOOR = 5;       // closed door — blocks movement + sight; E opens it
export const T_DOOR_OPEN = 6;  // open door — walk through, shoot through
export const T_METAL = 7;      // metal wall — blocks like a wall, and the breacher
                               // CANNOT grind it: the drill just throws sparks
export const T_LADDER = 8;     // ladder foot — walkable ground; E climbs to the
                               // second storey (the grid2 layer, §8.4 Phase-2)
export const T_DEEP = 9;       // deep water: soldiers SWIM (slow, no shooting);
                               // only hover craft and boats cross; wheels drown
export const T_CLIMB = 10;     // §8.7 CLIMB tier: a 2.5u container wall/barricade.
                               // Blocks boots and blocks fire below the lip — but a
                               // jump trooper's jet carries OVER it. Hop can't (apex
                               // ~1.1); nobody hops a 4u wall. Obstacles as verbs.
export const T_RUBBLE = 11;    // DESTRUCTION (the shared mechanic): breached masonry.
export const T_GRASS = 12;     // TALL GRASS (finish-list 18): walkable, stops
                               // nothing -- but standing in it you are a RUMOR
                               // (perception.ts: the cone loses you at 14u; at
                               // the footstep RING itself if you duck).
                               // Walkable — SLOW — for both sides, knee-high cover,
                               // eyes see over it. The monotonic law: destruction only
                               // ever OPENS paths, so reachability never re-runs.

export const T_METAL_DOOR = 13; // the toughest breach — a safe-room door: blocks
                                // like metal, drills the slowest of anything (materials.ts)

// SCIENCE MISSIONS: compact indoor maps need walls that occupy a wall's
// thickness, not an entire 3x3-metre tile. Orientation is data so collision,
// sight, doors, and rendering all agree without guessing from neighbours.
export const T_THIN_WALL_H = 14;       // spans the tile's X axis
export const T_THIN_WALL_V = 15;       // spans the tile's Z axis
export const T_THIN_DOOR_H = 16;
export const T_THIN_DOOR_V = 17;
export const T_THIN_DOOR_H_OPEN = 18;
export const T_THIN_DOOR_V_OPEN = 19;
export const T_THIN_WALL_HV = 20;      // corner / junction: both axes
export const T_WINDOW_H = 21;           // framed pane spanning X
export const T_WINDOW_V = 22;           // framed pane spanning Z
export const T_WINDOW_H_BROKEN = 23;    // frame + low sill; sight/fire pass
export const T_WINDOW_V_BROKEN = 24;
export const T_STAIRS_N = 25;           // oriented continuous storey transitions
export const T_STAIRS_E = 26;
export const T_STAIRS_S = 27;
export const T_STAIRS_W = 28;
export const T_SECTION_SHUTTER = 29;    // mission section boundary
export const T_SECTION_SHUTTER_OPEN = 30;
export const THIN_WALL = 0.42;

/** §8.7 heights, one place: what each tier stops below. HOP-tier cover at
 *  1.2, CLIMB barricades at 2.5, WALL at 4 — the tiers separate cleanly:
 *  a running hop (~1.1) clears cover only; a jetpack climbs past 2.5. */
export const COVER_H = 1.2;
export const CLIMB_H = 2.5;
export const WALL_H = 4;
export const RUBBLE_H = 0.6;   // a breach pile: stops rounds at the shins, not the eyes

/** What the breacher's drill grinds to rubble — the ONE authoritative menu,
 *  shared by the sim (digTile + drill face) and the harness Terrain tab.
 *  Structure is dinner: walls, cover, slits, doors, CLIMB barricades. Not
 *  on the menu: METAL (sparks, zero progress), water (nothing to eat),
 *  ladders, open ground, and the map border. */
export const DRILL_EATS: ReadonlySet<number> = new Set([
  T_WALL, T_COVER, T_SLIT, T_DOOR, T_DOOR_OPEN, T_CLIMB, T_RUBBLE,
  T_THIN_WALL_H, T_THIN_WALL_V, T_THIN_WALL_HV,
  T_THIN_DOOR_H, T_THIN_DOOR_V, T_THIN_DOOR_H_OPEN, T_THIN_DOOR_V_OPEN,
  T_WINDOW_H, T_WINDOW_V, T_WINDOW_H_BROKEN, T_WINDOW_V_BROKEN,
  T_SECTION_SHUTTER, T_SECTION_SHUTTER_OPEN,
]);

// ---- the SURFACE layer (§8.6): what the ground IS, orthogonal to blocking ----
export const S_DIRT = 0;   // bare rock/dirt — the neutral surface
export const S_GRASS = 1;  // savanna fields
export const S_ICE = 2;    // triton — slick
export const S_GRIT = 3;   // titan colony grit
export const S_PLATE = 4;  // starship deck plate
export const S_WET = 5;    // europa dome floor
export const S_MUD = 6;    // water margins — wheels hate it

/** per-surface speed multipliers: soldiers/striders, wheels, tracks (§8.6). Hover ignores. */
export const SURF_SOLDIER: Record<number, number> = { [S_DIRT]: 1, [S_GRASS]: 1, [S_ICE]: 1, [S_GRIT]: 0.92, [S_PLATE]: 1, [S_WET]: 0.96, [S_MUD]: 0.8 };
export const SURF_WHEELS: Record<number, number> = { [S_DIRT]: 1, [S_GRASS]: 1, [S_ICE]: 0.85, [S_GRIT]: 0.72, [S_PLATE]: 1.05, [S_WET]: 0.9, [S_MUD]: 0.6 };
export const SURF_TRACKS: Record<number, number> = { [S_DIRT]: 1, [S_GRASS]: 1, [S_ICE]: 0.9, [S_GRIT]: 0.9, [S_PLATE]: 1, [S_WET]: 0.95, [S_MUD]: 0.85 };

/** surface under a world position */
export function surfaceAt(surface: Uint8Array, x: number, z: number): number {
  const tx = Math.floor((x + WORLD / 2) / TILE);
  const tz = Math.floor((z + WORLD / 2) / TILE);
  if (tx < 0 || tz < 0 || tx >= GRID || tz >= GRID) return S_DIRT;
  return surface[tz * GRID + tx];
}

/** which house (index into map.houses) contains this point, -1 = open sky */
/** The outdoor vocabulary — scenery that must never stand in a room.
 *  (A crate indoors is FURNITURE: stampBuilding's own 'C' stencil char puts
 *  it there. These are the trespassers.) */
const OUTDOOR_PROPS: ReadonlySet<string> = new Set(['tree', 'rock', 'wreck', 'silo', 'flare_stack', 'crane', 'memorial',
  // §farm — a corn stalk in someone's living room is the exact bug this set exists for
  'crop', 'barn', 'farmhouse', 'silo_farm', 'windmill', 'watertower']);

/** Buildings stamp AFTER the obstacle scatter, so a rock blob can end up in
 *  someone's living room: the stamp clears the rock's grid claim (so it
 *  stops blocking) but the MESH stays — a boulder rendered in the hallway.
 *  Robert: "there was some trees inside of a house… I couldn't get down the
 *  hallways." Prune the outdoors out of every footprint, once, at the end. */
export function pruneIndoorProps(props: PropSpec[], houses: House[]): PropSpec[] {
  if (houses.length === 0) return props;
  return props.filter((p) => !OUTDOOR_PROPS.has(p.type) || houseAt(houses, p.pos.x, p.pos.z) < 0);
}

/** §farm: a corn stalk only makes sense standing in a FIELD. The farm chunk
 *  paints its rows as T_GRASS and drops crops on them, but later passes (its
 *  own landmarks, the lane carve, base compounds, vehicle pads) can overwrite
 *  a tile out from under one — leaving corn growing on bare road or buried in
 *  a wall. Re-check at the end: every crop stands on grass, or it doesn't stand. */
export function pruneStrandedCrops(props: PropSpec[], grid: Uint8Array): PropSpec[] {
  return props.filter((p) => {
    if (p.type !== 'crop') return true;
    const tx = Math.floor((p.pos.x + WORLD / 2) / TILE);
    const tz = Math.floor((p.pos.z + WORLD / 2) / TILE);
    if (tx < 0 || tz < 0 || tx >= GRID || tz >= GRID) return false;
    return grid[tz * GRID + tx] === T_GRASS;
  });
}

export function houseAt(houses: House[], x: number, z: number): number {
  const tx = Math.floor((x + WORLD / 2) / TILE);
  const tz = Math.floor((z + WORLD / 2) / TILE);
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i];
    if (tx >= h.tx && tx < h.tx + h.tw && tz >= h.tz && tz < h.tz + h.th) return i;
  }
  return -1;
}

export interface PropSpec {
  // ('ruin' lived here for a while with no producer and no render case —
  //  the Shelled Ruin is a BUILDING kind, stamped as tiles, not a prop)
  type: 'rock' | 'bunker' | 'crate' | 'tree' | 'clone_bay'
    // the §8.2 fronts' furniture: farm skylines, refinery fire, harbor
    // iron, and the burned-out hulls every front collects
    | 'silo' | 'flare_stack' | 'crane' | 'wreck'
    // the City's plaza monument — Robert's own soldier, cast in bronze
    // (the one GLTF hero prop; see props.ts for the loading law)
    | 'memorial'
    // §farm: the countryside. `crop` is DECORATION on walkable T_GRASS (corn
    // stands 2u — taller than a man — so a field conceals exactly the way tall
    // grass already does); the rest are SOLID landmarks that claim their tiles.
    | 'crop' | 'barn' | 'farmhouse' | 'silo_farm' | 'windmill' | 'watertower'
    // A1 the airfield: a building dedicated to an aircraft (Robert). Purely
    // visual — no grid stamps, so it can never trap a hull or break a path;
    // the jet parks under the canopy and flies out over everything anyway.
    | 'hangar';
  pos: Vec3;
  scale: number;
  rot: number;
}

export interface VehiclePad {
  kind: VehicleKind;
  team: Team;
  pos: Vec3;
}

export interface PickupSpawn {
  type: 'medkit' | 'ammo' | 'flamer' | 'energy';
  pos: Vec3;
}

export interface House {
  id: number;
  center: Vec3;
  door: Vec3;
  /** footprint in tiles — roofs, concealment, and interior checks key off this */
  tx: number; tz: number; tw: number; th: number;
  /** occupied storeys, 1–3 (roof sits at floors * 4) */
  floors?: number;
  /** roof style, decided by the building's kind — gable for whole-rect
   *  houses, parapet lips for commercial, vents for industry, none on ruins */
  roof?: 'gable' | 'flat' | 'parapet' | 'vents' | 'none';
  /** footprint bitmask per stencil row (bit x = tile tx+x is covered) — the
   *  roof is shaped by the FOOTPRINT, not the bounding rect */
  maskRows?: number[];
}

/** Provenance for maps authored by the whole-building grammar. Optional so
 * every legacy battle map keeps its original allocation and serialized shape. */
export interface BuildingMapMeta {
  cityId: string;
  archetype: string;
  grammarVersion: number;
  floors: 1 | 2 | 3;
  activeSection?: string;
}

export interface GameMap {
  seed: number;
  theme: ThemeId;
  grid: Uint8Array; // GRID*GRID
  /** the SECOND STOREY (§8.4 Phase-2): F2_* per tile — void unless a
   *  two-storey building stamped an upper floor here. Static after gen. */
  grid2: Uint8Array;
  /** Indexed upper storeys for new building maps. Index 0 is the same logical
   * Level 2 content as grid2; index 1 is Level 3. Absent on legacy maps. */
  upperLayers?: Uint8Array[];
  /** Authoring/generator provenance; absent on legacy battle maps. */
  buildingMeta?: BuildingMapMeta;
  /** the SURFACE layer (§8.6): S_* per tile — movement, sound, and tracks */
  surface: Uint8Array;
  basePos: [Vec3, Vec3];
  spawns: [Vec3[], Vec3[]];
  flagPos: [Vec3, Vec3];
  hillPos: Vec3;
  controlPoints: { name: string; pos: Vec3 }[];
  vehiclePads: VehiclePad[];
  pickups: PickupSpawn[];
  props: PropSpec[];
  zombieSpawns: Vec3[];
  /** safehouse mode: the neighborhood's searchable houses */
  houses: House[];
  /** paired jump-gate teleporters (battlefield maps) */
  gates: { a: Vec3; b: Vec3 }[];
  /** grav-lift launch pads: step on, get flung along dir */
  pads: { pos: Vec3; dir: { x: number; z: number } }[];
  /** SINGLE SOURCE OF TRUTH for prop-rendered collision: tile indices whose
   *  blocking geometry is visually owned by a prop (rock disc, tree trunk,
   *  crate). The generator records these AT THE STAMP SITE and prunes any
   *  claim a later stamp overwrote. The renderer skips EXACTLY this set and
   *  never re-derives footprints — the drift that caused every invisible-wall
   *  bug is structurally impossible. Guarded by tests/walls.test.ts. */
  propCovered: number[];
}

export function tileAt(grid: Uint8Array, x: number, z: number): number {
  const tx = Math.floor((x + WORLD / 2) / TILE);
  const tz = Math.floor((z + WORLD / 2) / TILE);
  if (tx < 0 || tz < 0 || tx >= GRID || tz >= GRID) return T_WALL;
  return grid[tz * GRID + tx];
}

const thinGrids = new WeakSet<Uint8Array>();

/** Mark a grid as containing narrow geometry so LOS uses a sub-wall step. */
export function registerThinGrid(grid: Uint8Array): void {
  thinGrids.add(grid);
}

export function isDoorTile(tile: number): boolean {
  return tile === T_DOOR || tile === T_DOOR_OPEN || tile === T_METAL_DOOR
    || tile === T_THIN_DOOR_H || tile === T_THIN_DOOR_V
    || tile === T_THIN_DOOR_H_OPEN || tile === T_THIN_DOOR_V_OPEN;
}

export function doorIsOpen(tile: number): boolean {
  return tile === T_DOOR_OPEN || tile === T_THIN_DOOR_H_OPEN || tile === T_THIN_DOOR_V_OPEN;
}

export function isWindowTile(tile: number): boolean {
  return tile === T_WINDOW_H || tile === T_WINDOW_V
    || tile === T_WINDOW_H_BROKEN || tile === T_WINDOW_V_BROKEN
    || tile === F2_WINDOW_H || tile === F2_WINDOW_V
    || tile === F2_WINDOW_H_BROKEN || tile === F2_WINDOW_V_BROKEN;
}

export function windowIsBroken(tile: number): boolean {
  return tile === T_WINDOW_H_BROKEN || tile === T_WINDOW_V_BROKEN
    || tile === F2_WINDOW_H_BROKEN || tile === F2_WINDOW_V_BROKEN;
}

export function breakWindowTile(tile: number): number {
  if (tile === T_WINDOW_H) return T_WINDOW_H_BROKEN;
  if (tile === T_WINDOW_V) return T_WINDOW_V_BROKEN;
  if (tile === F2_WINDOW_H) return F2_WINDOW_H_BROKEN;
  if (tile === F2_WINDOW_V) return F2_WINDOW_V_BROKEN;
  return tile;
}

export function windowSpansX(tile: number): boolean {
  return tile === T_WINDOW_H || tile === T_WINDOW_H_BROKEN
    || tile === F2_WINDOW_H || tile === F2_WINDOW_H_BROKEN;
}

/** Toggle a door while retaining the explicit orientation of thin doors. */
export function toggleDoorTile(tile: number): number {
  if (tile === T_DOOR) return T_DOOR_OPEN;
  if (tile === T_DOOR_OPEN) return T_DOOR;
  if (tile === T_THIN_DOOR_H) return T_THIN_DOOR_H_OPEN;
  if (tile === T_THIN_DOOR_H_OPEN) return T_THIN_DOOR_H;
  if (tile === T_THIN_DOOR_V) return T_THIN_DOOR_V_OPEN;
  if (tile === T_THIN_DOOR_V_OPEN) return T_THIN_DOOR_V;
  return tile;
}

/** Compatibility name for systems that speak in door types rather than tiles. */
export const toggleDoorType = toggleDoorTile;

function centeredTileOffset(value: number): number {
  const within = ((value + WORLD / 2) % TILE + TILE) % TILE;
  return within - TILE / 2;
}

export function thinTileBlocks(tile: number, x: number, z: number): boolean {
  if (tile === T_THIN_DOOR_H_OPEN || tile === T_THIN_DOOR_V_OPEN
    || tile === T_SECTION_SHUTTER_OPEN || tile === F2_DOOR_H_OPEN
    || tile === F2_DOOR_V_OPEN || tile === F2_SHUTTER_OPEN) return false;
  const ox = Math.abs(centeredTileOffset(x));
  const oz = Math.abs(centeredTileOffset(z));
  const horizontal = tile === T_THIN_WALL_H || tile === T_THIN_DOOR_H || tile === T_THIN_WALL_HV
    || tile === T_WINDOW_H || tile === T_WINDOW_H_BROKEN || tile === T_SECTION_SHUTTER
    || tile === F2_THIN_WALL_H || tile === F2_THIN_WALL_HV || tile === F2_WINDOW_H
    || tile === F2_WINDOW_H_BROKEN || tile === F2_DOOR_H || tile === F2_RAIL_H || tile === F2_SHUTTER;
  const vertical = tile === T_THIN_WALL_V || tile === T_THIN_DOOR_V || tile === T_THIN_WALL_HV
    || tile === T_WINDOW_V || tile === T_WINDOW_V_BROKEN
    || tile === F2_THIN_WALL_V || tile === F2_THIN_WALL_HV || tile === F2_WINDOW_V
    || tile === F2_WINDOW_V_BROKEN || tile === F2_DOOR_V || tile === F2_RAIL_V;
  return (horizontal && oz <= THIN_WALL / 2) || (vertical && ox <= THIN_WALL / 2);
}

export function isBlocked(grid: Uint8Array, x: number, z: number, hover = false): boolean {
  const t = tileAt(grid, x, z);
  if (t === T_WATER) return false;   // shallow: wadeable by everyone (slowly)
  if (t === T_DEEP) return !hover;   // deep: hover only — soldiers SWIM via their own physics
  // slits and CLOSED doors block movement always; open doors are a doorway.
  // CLIMB barricades block GROUND movement like walls — clearing one is the
  // airborne y-band's job (world.ts knows your apex; this function doesn't).
  if ((t >= T_THIN_WALL_H && t <= T_THIN_WALL_HV) || isWindowTile(t)
    || t === T_SECTION_SHUTTER || t === T_SECTION_SHUTTER_OPEN) return thinTileBlocks(t, x, z);
  return t === T_WALL || t === T_COVER || t === T_SLIT || t === T_DOOR || t === T_METAL || t === T_METAL_DOOR || t === T_CLIMB;
}

/**
 * Nearest open-tile CENTER within `maxR` rings of (x, z) — the statue law's
 * escape hatch. The movement integrator only vetoes DESTINATIONS, so a body
 * that somehow stands inside masonry (a leap landing, a door closed on the
 * doorway, a bad spawn) could otherwise never move again. Ring-by-ring scan
 * keeps it nearest-first; null means everything nearby is masonry too.
 */
export function nearestOpenTile(grid: Uint8Array, x: number, z: number, maxR = 4): { x: number; z: number } | null {
  const tx = Math.floor((x + WORLD / 2) / TILE);
  const tz = Math.floor((z + WORLD / 2) / TILE);
  for (let r = 1; r <= maxR; r++) {
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // this ring's shell only
        const nx = tx + dx, nz = tz + dz;
        if (nx < 0 || nx >= GRID || nz < 0 || nz >= GRID) continue;
        const cx = (nx + 0.5) * TILE - WORLD / 2;
        const cz = (nz + 0.5) * TILE - WORLD / 2;
        if (isBlocked(grid, cx, cz)) continue; // deep water is no refuge either
        const d = Math.hypot(cx - x, cz - z);
        if (d < bestD) { bestD = d; best = { x: cx, z: cz }; }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Blocks projectiles/sight: walls always; cover and water never (shots fly over). */
export function blocksShot(grid: Uint8Array, x: number, z: number, y: number): boolean {
  const t = tileAt(grid, x, z);
  if (t === T_WALL) return y < WALL_H;   // walls are 4 units tall
  if (t === T_COVER) return y < COVER_H; // low cover
  if (t === T_SLIT) return !(y >= 1.2 && y <= 1.8); // the firing band — muzzle height passes
  if (t === T_DOOR) return y < 2.2;      // a closed door stops rounds and eyes
  if (t === T_METAL || t === T_METAL_DOOR) return y < WALL_H;  // metal walls (and safe-room doors) are walls
  if (t === T_CLIMB) return y < CLIMB_H; // §8.7: rounds clear the lip at 2.5
  if (t === T_RUBBLE) return y < RUBBLE_H; // a breach pile: shin cover, eyes clear
  if (t >= T_THIN_WALL_H && t <= T_THIN_WALL_HV) {
    const door = t === T_THIN_DOOR_H || t === T_THIN_DOOR_V;
    return thinTileBlocks(t, x, z) && y < (door ? 2.2 : WALL_H);
  }
  if (t === T_WINDOW_H || t === T_WINDOW_V) return thinTileBlocks(t, x, z) && y < WALL_H;
  if (t === T_WINDOW_H_BROKEN || t === T_WINDOW_V_BROKEN) return thinTileBlocks(t, x, z) && y < 1.0;
  if (t === T_SECTION_SHUTTER) return thinTileBlocks(t, x, z) && y < WALL_H;
  return false;
}

// ---------------------------------------------------------------------------
// THE SECOND STOREY (§8.4 Phase-2 experiment). A separate tile layer rides
// above the ground grid: upstairs is where you WALK at y=4 and SHOOT at
// y≈5.4 — which clears every ground wall for free, because the whole sim
// already thinks in y-bands. Upstairs soldiers carry `floor: 1`.
// ---------------------------------------------------------------------------
export const F2_VOID = 0;   // no floor — step here and you FALL
export const F2_FLOOR = 1;  // walkable upper floor
export const F2_WALL = 2;   // upper wall (blocks 4..8)
export const F2_SLIT = 3;   // upper window — fire band 5.2..5.8 (the sniper nest)
export const F2_WELL = 4;   // the ladder well: walkable, E descends
export const F2_THIN_WALL_H = 5;
export const F2_THIN_WALL_V = 6;
export const F2_THIN_WALL_HV = 7;
export const F2_WINDOW_H = 8;
export const F2_WINDOW_V = 9;
export const F2_WINDOW_H_BROKEN = 10;
export const F2_WINDOW_V_BROKEN = 11;
export const F2_DOOR_H = 12;
export const F2_DOOR_V = 13;
export const F2_DOOR_H_OPEN = 14;
export const F2_DOOR_V_OPEN = 15;
export const F2_BALCONY = 16;
export const F2_RAIL_H = 17;
export const F2_RAIL_V = 18;
export const F2_STAIR_N = 19;
export const F2_STAIR_E = 20;
export const F2_STAIR_S = 21;
export const F2_STAIR_W = 22;
export const F2_SHUTTER = 23;
export const F2_SHUTTER_OPEN = 24;

/** Upper-layer shot blocking — walls live in the 4..8 band. */
export function blocksShotUpper(grid2: Uint8Array, x: number, z: number, y: number): boolean {
  if (y < 4 || y >= 8) return false;
  const t = tileAt(grid2, x, z);
  if (t === F2_WALL) return true;
  if (t === F2_SLIT) return !(y >= 5.2 && y <= 5.8);
  if ((t === F2_THIN_WALL_H || t === F2_THIN_WALL_V || t === F2_THIN_WALL_HV)
    && thinTileBlocks(t, x, z)) return true;
  if ((t === F2_WINDOW_H || t === F2_WINDOW_V) && thinTileBlocks(t, x, z)) return true;
  if ((t === F2_WINDOW_H_BROKEN || t === F2_WINDOW_V_BROKEN) && thinTileBlocks(t, x, z)) return y < 5;
  if ((t === F2_DOOR_H || t === F2_DOOR_V) && thinTileBlocks(t, x, z)) return y < 6.2;
  if ((t === F2_RAIL_H || t === F2_RAIL_V) && thinTileBlocks(t, x, z)) return y < 5.2;
  if (t === F2_SHUTTER && thinTileBlocks(t, x, z)) return true;
  return false;
}

/** Is this upper tile standable? (Anything but void — walls stop you first.) */
export const upperBlocked = (grid2: Uint8Array, x: number, z: number): boolean => {
  const t = tileAt(grid2, x, z);
  if (t === F2_WALL || t === F2_SLIT) return true;
  if (t === F2_THIN_WALL_H || t === F2_THIN_WALL_V || t === F2_THIN_WALL_HV
    || t === F2_WINDOW_H || t === F2_WINDOW_V || t === F2_WINDOW_H_BROKEN || t === F2_WINDOW_V_BROKEN
    || t === F2_DOOR_H || t === F2_DOOR_V || t === F2_RAIL_H || t === F2_RAIL_V || t === F2_SHUTTER) {
    return thinTileBlocks(t, x, z);
  }
  return false;
};

/** March a ray across the grid; true if line of sight is clear at the given height. */
export function losClear(grid: Uint8Array, a: Vec3, b: Vec3, y = 1.4): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const stride = thinGrids.has(grid) ? THIN_WALL * 0.5 : TILE * 0.5;
  const steps = Math.max(1, Math.ceil(dist / stride));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksShot(grid, a.x + dx * t, a.z + dz * t, y)) return false;
  }
  return true;
}

/** The UPSTAIRS counterpart to losClear: march the UPPER grid at the nest band
 *  (y 5.4), where F2_WALL blocks the 4..8 storey and F2_SLIT passes only its
 *  5.2–5.8 firing band. This is what makes two soldiers who are BOTH on a
 *  second storey obey the upper walls between them, instead of reading the
 *  ground floor's layout by accident (sight-plan A3 step 2). */
export function losClearUpper(grid2: Uint8Array, a: Vec3, b: Vec3, y = 5.4): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / (TILE * 0.5)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksShotUpper(grid2, a.x + dx * t, a.z + dz * t, y)) return false;
  }
  return true;
}

function setTile(grid: Uint8Array, tx: number, tz: number, v: number) {
  if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) return;
  grid[tz * GRID + tx] = v;
}

/** A prop-owned tile claim: the prop's mesh visually stands in for this
 *  tile's collision box. Recorded at the stamp site; pruned if a later stamp
 *  overwrites the value (the prop no longer owns what's there). */
export interface TileClaim { idx: number; t: number }

/** Stamp a blocking tile a prop will render, and record the claim. Mirrors
 *  setTile's bounds guard exactly — a skipped write is a skipped claim. */
function claimTile(grid: Uint8Array, claims: TileClaim[], tx: number, tz: number, v: number) {
  if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) return;
  grid[tz * GRID + tx] = v;
  claims.push({ idx: tz * GRID + tx, t: v });
}

/** Claims that survived every later stamp — deduped, ready for the map.
 *
 *  A claim is a promise: "the renderer will skip this tile because a PROP
 *  draws it." Break the promise and you get an invisible wall. So a claim
 *  whose prop is GONE (pruned indoors, or overwritten) isn't merely dropped
 *  from the list — its tile is OPENED, because the thing that was blocking
 *  you no longer exists. Claim and prop live and die together. */
function settleClaims(grid: Uint8Array, claims: TileClaim[], props?: PropSpec[]): number[] {
  const live = claims.filter((c) => grid[c.idx] === c.t);
  if (!props) return [...new Set(live.map((c) => c.idx))];
  const kept: number[] = [];
  for (const c of live) {
    const x = ((c.idx % GRID) + 0.5) * TILE - WORLD / 2;
    const z = (Math.floor(c.idx / GRID) + 0.5) * TILE - WORLD / 2;
    if (props.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 1.6 + p.scale * 1.2)) kept.push(c.idx);
    else grid[c.idx] = T_OPEN; // its prop is gone — so is the wall
  }
  return [...new Set(kept)];
}

function tileToWorld(tx: number, tz: number): Vec3 {
  return { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 };
}

function clearArea(grid: Uint8Array, cx: number, cz: number, r: number) {
  for (let z = cz - r; z <= cz + r; z++)
    for (let x = cx - r; x <= cx + r; x++) setTile(grid, x, z, T_OPEN);
}

/** Generates a symmetric battlefield — or a suburban neighborhood for safehouse mode. */
/** §3.3/§14 — the named paintball fields. Each is a small sealed arena dealt
 *  from its own seed, wearing a real theme's palette so the fields feel like
 *  places, not test boxes. The onboarding picker renders these straight from
 *  the grid — the map IS its own thumbnail. */
export const PAINTBALL_FIELDS = [
  { id: 'kopje', name: 'Kopje Court', theme: 'savanna' as ThemeId, seed: 1101, blurb: 'Rocks and long grass. The classic yard.' },
  { id: 'deck', name: 'Deck Nine', theme: 'starship' as ThemeId, seed: 2202, blurb: 'Tight corridors on ship plate. Angles everywhere.' },
  { id: 'grit', name: 'Grit Alley', theme: 'titan' as ThemeId, seed: 3303, blurb: 'Barricade jungle in colony dust. Climbers welcome.' },
] as const;

/** A paintball field: one small walled arena carved out of a sealed map —
 *  Brawl-Stars scale, mirrored cover for fairness, three tag points for the
 *  prey, corner spawns for the pack. Everything outside the fence is wall. */
/** sight-plan A3 step 4 — the CROSS-FLOOR SLANT. An upstairs eye and a
 *  ground body see each other only if the UPSTAIRS HALF of the line clears
 *  the UPPER walls and the GROUND HALF clears the GROUND walls (split at the
 *  midpoint). The split buys the ROOF-PEEK — ground clutter near the perch
 *  is seen OVER — and kills the FLOOR-PLAN GIVEAWAY: an interior ground room
 *  still hides behind its own walls, so nobody reads the plan through the
 *  floor. `up` is the upstairs end, `dn` the ground end. */
export function losCrossFloor(grid: Uint8Array, grid2: Uint8Array, up: Vec3, dn: Vec3): boolean {
  const mid = { x: (up.x + dn.x) / 2, y: 0, z: (up.z + dn.z) / 2 };
  return losClearUpper(grid2, up, mid) && losClear(grid, mid, dn);
}

export function generatePaintballField(seed: number, theme: ThemeId = 'savanna'): GameMap {
  const rng = new Rng(seed);
  const grid = new Uint8Array(GRID * GRID).fill(T_WALL); // sealed world…
  const grid2 = new Uint8Array(GRID * GRID);
  const surface = new Uint8Array(GRID * GRID);
  const A0 = 36, A1 = 64; // …with a 28-tile (84u) arena carved from the center
  const baseSurf = theme === 'savanna' ? S_GRASS : theme === 'starship' ? S_PLATE
    : theme === 'titan' ? S_GRIT : theme === 'europa' ? S_WET : theme === 'triton' ? S_ICE : S_DIRT;
  surface.fill(baseSurf);
  for (let tz = A0; tz <= A1; tz++)
    for (let tx = A0; tx <= A1; tx++) grid[tz * GRID + tx] = T_OPEN;

  // mirrored cover: pairs of crates, short wall stubs, and a few CLIMB
  // barricades — enough angles to teach peeking, never a maze
  const mid = (A0 + A1) / 2;
  const stamps = theme === 'starship' ? 16 : 13;
  for (let i = 0; i < stamps; i++) {
    const tx = A0 + 2 + rng.int(0, (A1 - A0) / 2 - 3); // west half; east is the mirror
    const tz = A0 + 2 + rng.int(0, A1 - A0 - 4);
    const kind = rng.next() < 0.55 ? T_COVER : rng.next() < 0.5 ? T_WALL : T_CLIMB;
    const len = kind === T_WALL ? rng.int(2, 3) : rng.int(1, 2);
    const horiz = rng.next() < 0.5;
    for (let k = 0; k < len; k++) {
      const x = tx + (horiz ? k : 0), z = tz + (horiz ? 0 : k);
      if (x <= A0 || x >= A1 || z <= A0 || z >= A1) continue;
      grid[z * GRID + x] = kind;
      const mx = A0 + A1 - x; // vertical-line mirror
      grid[z * GRID + mx] = kind;
    }
  }
  // the center stays honest: a clear lane through the middle for the duel
  for (let tz = mid - 1; tz <= mid + 1; tz++) grid[tz * GRID + mid] = T_OPEN;

  // WATER (Robert: 'have water — should feel like a paintball field'): every
  // yard gets a shallow feature you splash through — wading is a choice
  // (slow but a flank), never a wall. Mirrored like the cover.
  const wz = mid + (seed % 2 === 0 ? 5 : -5);
  for (let tx = A0 + 6; tx <= A0 + 11; tx++) {
    for (let dz = 0; dz < 2; dz++) {
      grid[(wz + dz) * GRID + tx] = T_WATER;
      grid[(wz + dz) * GRID + (A0 + A1 - tx)] = T_WATER; // the mirror pool
      surface[(wz + dz) * GRID + tx] = S_MUD;
      surface[(wz + dz) * GRID + (A0 + A1 - tx)] = S_MUD;
    }
  }


  const P = (tx: number, tz: number): Vec3 => ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });
  // three tag points for the prey: center + two mirrored corners
  const controlPoints = [
    { name: 'A', pos: P(mid, mid) },
    { name: 'B', pos: P(A0 + 3, A1 - 3) },
    { name: 'C', pos: P(A1 - 3, A0 + 3) },
  ];
  for (const cp of controlPoints) { // tag pads stand on open paint
    const tx = Math.floor((cp.pos.x + WORLD / 2) / TILE), tz = Math.floor((cp.pos.z + WORLD / 2) / TILE);
    grid[tz * GRID + tx] = T_OPEN;
  }
  // hunters rally on the west fence, the prey slips in from the east
  const spawns: [Vec3[], Vec3[]] = [
    [P(A0 + 1, mid - 2), P(A0 + 1, mid), P(A0 + 1, mid + 2), P(A0 + 2, mid)],
    [P(A1 - 1, mid - 1), P(A1 - 1, mid + 1)],
  ];
  // JUMPING (Robert): a mirrored pair of grav pads that fling you over the
  // middle — the inflatable-bunker leap every paintball field secretly wants
  const pads = [
    { pos: P(A0 + 4, mid), dir: { x: 1, z: 0 } },
    { pos: P(A1 - 4, mid), dir: { x: -1, z: 0 } },
  ];
  for (const pd of pads) { // pads stand on open paint
    const tx = Math.floor((pd.pos.x + WORLD / 2) / TILE), tz = Math.floor((pd.pos.z + WORLD / 2) / TILE);
    grid[tz * GRID + tx] = T_OPEN;
  }

  return {
    seed, theme, grid, grid2, surface,
    basePos: [P(A0 + 1, mid), P(A1 - 1, mid)],
    spawns,
    flagPos: [P(A0 + 2, mid), P(A1 - 2, mid)],
    hillPos: P(mid, mid),
    controlPoints,
    vehiclePads: [], pickups: [], props: [], zombieSpawns: [],
    houses: [], gates: [], pads, propCovered: [],
  };
}

export function generateMap(seed: number, mode: ModeId, theme: ThemeId = 'savanna'): GameMap {
  if (mode === 'safehouse') return generateNeighborhood(seed);
  if (mode === 'paintball') return generatePaintballField(seed, theme);
  const rng = new Rng(seed);
  const grid = new Uint8Array(GRID * GRID);
  const grid2 = new Uint8Array(GRID * GRID); // the second storey — void by default
  const props: PropSpec[] = [];
  const claims: TileClaim[] = []; // prop-covered tiles, recorded where stamped
  const gen = THEMES[theme].gen;

  // Border walls
  for (let i = 0; i < GRID; i++) {
    grid[i] = T_WALL;
    grid[(GRID - 1) * GRID + i] = T_WALL;
    grid[i * GRID] = T_WALL;
    grid[i * GRID + GRID - 1] = T_WALL;
  }

  // Scatter obstacles mirrored across the vertical center line for fairness.
  // The mix is the environment: starship corridors, asteroid galleries,
  // Europa pools, Triton crevasses, or the classic savanna field.
  const half = GRID / 2;
  // thresholds: below wall→wall seg, below cover→crates, below rock→rock blob, else water
  const MIX: Record<typeof gen, { wall: number; cover: number; rock: number; blobs: number; wallLen: [number, number] }> = {
    field:     { wall: 0.38, cover: 0.72, rock: 0.86, blobs: 46, wallLen: [3, 8] },
    corridors: { wall: 0.60, cover: 0.95, rock: 0.95, blobs: 60, wallLen: [6, 16] },
    rocks:     { wall: 0.15, cover: 0.40, rock: 0.97, blobs: 52, wallLen: [3, 6] },
    ocean:     { wall: 0.28, cover: 0.52, rock: 0.68, blobs: 48, wallLen: [3, 7] },
    ice:       { wall: 0.22, cover: 0.50, rock: 0.78, blobs: 48, wallLen: [3, 7] },
    // ARMOR COUNTRY: the fewest walls in the game and the shortest ones —
    // what obstacles exist are COVER (something to fight around at speed),
    // not structures (something to get wedged in).
    armor:     { wall: 0.12, cover: 0.58, rock: 0.80, blobs: 34, wallLen: [2, 4] },
  };
  const mix = MIX[gen];
  // §indoor: the corridors theme is a whole-map BUILDING INTERIOR (carveInterior,
  // below). §chunks: the FIELD themes are a region grammar now (fillRegions,
  // below) — forests, neighborhoods, interiors, not random scatter. Both need
  // arrays declared later, so both are carved below; the scatter is left to the
  // rock/ocean/ice worlds.
  if (gen !== 'corridors' && gen !== 'field')
  for (let b = 0; b < mix.blobs; b++) {
    const tx = rng.int(6, half - 3);
    const tz = rng.int(6, GRID - 7);
    const kind = rng.next();
    const mirror = (x: number) => GRID - 1 - x;
    if (kind < mix.wall) {
      // wall segment (starship corridors run long and orthogonal).
      // §8.7: about a quarter of the scatter runs go up as CLIMB barricades —
      // container walls at 2.5u that jump troopers jet over for real flank
      // routes. The decision reuses the `kind` roll already in hand (uniform
      // on [0, mix.wall) here, so /mix.wall is uniform on [0,1)) — ZERO extra
      // rng draws, so every shipped layout survives tile-for-tile; only the
      // heights change. Mirrored like everything else, and never structural:
      // bases and buildings stamp AFTER this loop and overwrite whatever we
      // lay here, so no perimeter ever goes soft.
      const len = rng.int(mix.wallLen[0], mix.wallLen[1]);
      const horiz = rng.next() < 0.5;
      const seg = kind / mix.wall < 0.25 ? T_CLIMB : T_WALL;
      for (let i = 0; i < len; i++) {
        setTile(grid, tx + (horiz ? i : 0), tz + (horiz ? 0 : i), seg);
        setTile(grid, mirror(tx + (horiz ? i : 0)), tz + (horiz ? 0 : i), seg);
      }
      // (the old corridor L-elbow lived here — the corridors theme carves a
      // real interior now, so the scatter never runs for it and the elbow is
      // gone. Other themes never drew it: the guard short-circuited before
      // the rng roll, so removing it keeps every field layout bit-for-bit.)
    } else if (kind < mix.cover) {
      // cover cluster
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const ox = rng.int(-2, 2), oz = rng.int(-2, 2);
        claimTile(grid, claims, tx + ox, tz + oz, T_COVER);
        claimTile(grid, claims, mirror(tx + ox), tz + oz, T_COVER);
        const w = tileToWorld(tx + ox, tz + oz);
        props.push({ type: 'crate', pos: w, scale: 1, rot: rng.range(0, Math.PI) });
        props.push({ type: 'crate', pos: tileToWorld(mirror(tx + ox), tz + oz), scale: 1, rot: rng.range(0, Math.PI) });
      }
    } else if (kind < mix.rock) {
      // rock blob (wall tiles, rendered as rocks — ice boulders on Triton).
      // Claim only tiles the MESH actually covers: the icosphere spans
      // scale*1.45 world units, so a tile center may sit at most that far
      // (plus half a tile of grace) from the rock. The old r² disc claimed
      // diagonal rims the mesh never touched — the long-lived "invisible
      // wall" you bumped a full stride before the stone. Audit-law enforced.
      const r = rng.int(1, 2);
      const meshReach = r * 1.6 * 1.45 + 1.2;
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++)
          if (Math.hypot(x * TILE, z * TILE) <= meshReach) {
            claimTile(grid, claims, tx + x, tz + z, T_WALL);
            claimTile(grid, claims, mirror(tx + x), tz + z, T_WALL);
          }
      const w = tileToWorld(tx, tz);
      props.push({ type: 'rock', pos: w, scale: r * 1.6, rot: rng.range(0, Math.PI * 2) });
      props.push({ type: 'rock', pos: tileToWorld(mirror(tx), tz), scale: r * 1.6, rot: rng.range(0, Math.PI * 2) });
    } else {
      // water: savanna ponds, Europa pools, Triton crevasses
      const r = gen === 'ocean' ? rng.int(3, 4) : rng.int(2, 3);
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++)
          if (x * x + z * z <= r * r) {
            // deep core, shallow rim: you can wade the edge of any pond, but
            // the middle is a SWIM — slow, defenseless, and worth avoiding
            const deep = x * x + z * z <= (r - 1.4) * (r - 1.4);
            setTile(grid, tx + x, tz + z, deep ? T_DEEP : T_WATER);
            setTile(grid, mirror(tx + x), tz + z, deep ? T_DEEP : T_WATER);
          }
    }
  }

  // THE MOAT (ocean worlds): a ring lake around the center island — deep
  // water in the channel (swim: slow, defenseless), shallow banks, and two
  // shallow FORD causeways north and south. KOTH becomes king of the
  // island; gunboats own the channel; fords are the infantry chokepoints.
  if (gen === 'ocean') {
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const d = Math.hypot(x - half + 0.5, z - half + 0.5);
        if (d < 7 || d > 15) continue;
        const ford = Math.abs(x - half + 0.5) <= 1.2; // the north/south causeways
        const deep = !ford && d > 8.2 && d < 13.8;
        setTile(grid, x, z, deep ? T_DEEP : T_WATER);
      }
    }
  }

  const pickups: PickupSpawn[] = []; // declared early — huts stock their shelves

  // §indoor: the whole-map interior for the corridors theme — hallway spine,
  // room bays, cross-corridors (interior.ts). Owns the middle; compounds cap
  // the ends. The scatter loop above was skipped for this gen.
  if (gen === 'corridors') carveInterior({ grid, claims, props, pickups, rng }, half);

  // ---- the building stock (§8.4 + the ZombsRoyale rule: indoors has STUFF).
  // Hand-authored templates from the library, procedurally dealt and mirrored
  // for fairness: houses, warehouses, bunkers — doors closed, shelves stocked.
  // (Skipped indoors — the interior IS the building; battle huts would clutter.)
  const houses: House[] = [];
  const buildCtx = { grid, grid2, props, pickups, houses, claims, rng };
  // §chunks: the field map's contested band becomes a mix of regions —
  // forest / neighborhood / interior / open — each a tactical texture with a
  // guaranteed through-lane. Runs before placeBuildings so hand-stamped
  // structures land on top of the ground texture.
  if (gen === 'field') fillRegions(buildCtx, half, { forest: 3, neighborhood: 3, farm: 2, interior: 1, industrial: 1, open: 2 });
  // V5 ARMOR COUNTRY: the SAME chunk system, weighted for manoeuvre. Mostly
  // open ground with a little cover to fight around, and NO interior blocks —
  // a tank map's job is long lanes and flanks, not corridors where a hull
  // gets stuck and a jet has nothing to strafe.
  else if (gen === 'armor') fillRegions(buildCtx, half, { open: 7, forest: 2, farm: 2, industrial: 1 });
  // the old scatter-building placer is for the rock/ocean/ice worlds now — the
  // field's buildings come from its region chunks (no double placement, and no
  // building stamped over a forest, which orphaned tree claims into thin air)
  if (gen !== 'corridors' && gen !== 'field') placeBuildings(buildCtx, 3, [
    { tx: half, tz: half, r: gen === 'ocean' ? 18 : 12 }, // the hill (+ the moat)
    { tx: half - 22, tz: half - 22, r: 8 },   // CP A clearing
    { tx: half + 22, tz: half + 22, r: 8 },   // CP C clearing
    { tx: 10, tz: half, r: 20 },        // §base: keep battle buildings off the
    { tx: GRID - 11, tz: half, r: 20 }, // two compounds — the base owns its ground
  ]);

  // Bases: west (team 0) and east (team 1)
  const baseT: [number, number][] = [[10, half], [GRID - 11, half]];
  const basePos: [Vec3, Vec3] = [tileToWorld(baseT[0][0], baseT[0][1]), tileToWorld(baseT[1][0], baseT[1][1])];
  for (const [btx, btz] of baseT) clearArea(grid, btx, btz, 7);
  // §base: the walled COMPOUND is stamped LAST (below, after every other
  // terrain pass) so nothing overwrites its walls — the base owns its ground.

  // Center clearings for objectives
  clearArea(grid, half, half, 6);
  const hillPos = tileToWorld(half, half);

  const cpB = tileToWorld(half, half);
  const cpA = tileToWorld(half - 22, Math.floor(half - 22));
  const cpC = tileToWorld(half + 22, Math.floor(half + 22));
  clearArea(grid, half - 22, half - 22, 4);
  clearArea(grid, half + 22, half + 22, 4);
  const controlPoints = [
    { name: 'A', pos: cpA },
    { name: 'B', pos: cpB },
    { name: 'C', pos: cpC },
  ];

  // Spawns: rings inside each base
  const spawns: [Vec3[], Vec3[]] = [[], []];
  for (let side = 0 as Team; side < 2; side++) {
    const [btx, btz] = baseT[side];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spawns[side].push(tileToWorld(btx + Math.round(Math.cos(a) * 3), btz + Math.round(Math.sin(a) * 3)));
    }
  }

  const flagPos: [Vec3, Vec3] = [basePos[0], basePos[1]];

  // Vehicle pads flanking each base — the full motor pool
  const vehiclePads: VehiclePad[] = [];
  // V2/V3: the air program joins the motor pool. The AIRFIELD (strike jet,
  // interceptor, bomber) and the LANCE that answers the enemy's.
  const padKinds: VehicleKind[] = ['buggy', 'tank', 'apc', 'skiff', 'bike', 'flyer', 'transport', 'ambulance', 'tunneler', 'hoverboard', 'mech',
    'strikejet', 'interceptor', 'bomber', 'aatrack'];
  for (let side = 0 as Team; side < 2; side++) {
    const [btx, btz] = baseT[side];
    const fwd = side === 0 ? 1 : -1;
    // THE MOTOR POOL stages just OUTSIDE the compound gate (the wire is full
    // of buildings now) — a vehicle yard between the base and the front, x≥20
    // clears the east wall at +18. Rows spread off the gate lane so armor
    // isn't parked nose-to-tail in the firing line.
    const padOffsets = [
      [fwd * 21, -8], [fwd * 21, 8], [fwd * 24, -3], [fwd * 24, 3],
      [fwd * 21, -13], [fwd * 21, 13], [fwd * 27, -9], [fwd * 27, 9],
      [fwd * 24, -12], [fwd * 24, 12],
      [fwd * 28, 5], // mech — off the center row so it doesn't park in the main firing lane
      // A1 THE AIRFIELD (Robert: "put them all together… buildings dedicated
      // to certain aircraft"). One flight line on the base's south flank —
      // three hangars in a row, mouths toward the front, a poured apron in
      // front of them. The flank, NOT the centreline: a first cut parked the
      // strip at 10-13 tiles deep and the compound's own barracks stamped
      // over the pads on some seeds (the last-stamp trap), and re-clearing
      // after the stamp carved lopsided holes in the compound walls. The old
      // jet pads lived at lateral 18 and never collided with anything —
      // the whole field now lives out there.
      [fwd * 14, -15], [fwd * 14, -20],  // strike jet · interceptor, on the flight line
      [fwd * 14, -25],                    // bomber — the end slot, biggest hangar
      [fwd * 19, -6],                     // the Lance guards the field; off the gate lane
    ];
    padKinds.forEach((kind, i) => {
      const [ox, oz] = padOffsets[i];
      // aircraft get a wider clear — a hangar's canopy needs the whole yard
      const aircraft = kind === 'strikejet' || kind === 'interceptor' || kind === 'bomber';
      clearArea(grid, btx + ox, btz + oz, aircraft ? 4 : 3); // a yard the hull can pull out of
      const at = tileToWorld(btx + ox, btz + oz);
      vehiclePads.push({ kind, team: side as Team, pos: at });
      // A1: every airframe sleeps in its own building — the bomber's is
      // taller and wider because the bomber is. Open face toward the front,
      // which is also the direction the runway leaves.
      if (aircraft) {
        // the hangar wraps the TAIL, not the whole airframe — a plane fully
        // under its roof is a plane the top-down camera cannot find. Nose
        // pokes out of the mouth, so "my jet is home" reads at any zoom.
        props.push({
          type: 'hangar',
          pos: { x: at.x - fwd * 2.6, y: at.y, z: at.z },
          scale: kind === 'bomber' ? 1.35 : 1,
          rot: side === 0 ? 0 : Math.PI,
        });
      }
    });
    // one Bulwark emplacement gun guarding each team's midfield approach — a
    // WIDE clear so the region's trees never wall the gun into its own bunker
    const ex = btx + fwd * 22, ez = btz + (side === 0 ? -14 : 14);
    clearArea(grid, ex, ez, 4);
    vehiclePads.push({ kind: 'emplacement', team: side as Team, pos: tileToWorld(ex, ez) });
    // V5: ARMOR COUNTRY runs a heavier pool — a second tank and a second
    // Lance per side, so the map plays like the tank battle it is shaped for
    // (and so the extra armour has an extra answer above it).
    if (gen === 'armor') {
      for (const [kind, ox, oz] of [['tank', fwd * 30, -6], ['tank', fwd * 30, 6], ['aatrack', fwd * 26, 0]] as const) {
        clearArea(grid, btx + ox, btz + oz, 3);
        vehiclePads.push({ kind, team: side as Team, pos: tileToWorld(btx + ox, btz + oz) });
      }
    }
    // V3 EVERY BASE STARTS WITH A SAM (Robert's exact ask). A second Lance
    // sits ON the compound, unmanned and always awake — so the sky over a
    // base is never free, even when the whole team is out on the map. It
    // fires slower without a gunner (see stepAntiAir), which is the incentive
    // to actually crew it.
    // …but NOT inside the compound: a pad at fwd*6 sat where the base
    // buildings stamp LATER, so my clearArea was overwritten and the launcher
    // spawned inside a wall (this codebase's signature ordering trap — the
    // last stamp wins). It parks in the yard beside the emplacement instead,
    // which costs nothing: the missile reaches 120u, so "covering the base"
    // never depended on standing in the middle of it.
    const sx = btx + fwd * 18, sz = btz + (side === 0 ? 16 : -16);
    clearArea(grid, sx, sz, 3);
    vehiclePads.push({ kind: 'aatrack', team: side as Team, pos: tileToWorld(sx, sz) });
  }

  // gunboats moor on the SHALLOW inner bank beside the causeways — where
  // wading bots actually pass within boarding reach (a pad out in the deep
  // channel is a boat nobody can walk to)
  if (gen === 'ocean') {
    // ring radius 7.9 — inside the SHALLOW band (7.0–8.2), beside a causeway
    vehiclePads.push({ kind: 'boat', team: 0, pos: tileToWorld(half - 3, half - 8) });
    vehiclePads.push({ kind: 'boat', team: 1, pos: tileToWorld(half + 2, half + 7) });
  }

  // Pickups sprinkled around midfield, mirrored
  const pickTypes: PickupSpawn['type'][] = ['medkit', 'ammo', 'energy', 'medkit', 'ammo', 'flamer'];
  pickTypes.forEach((type, i) => {
    const tz = 12 + Math.floor((i / pickTypes.length) * (GRID - 24)) + rng.int(-4, 4);
    let tx = half + rng.int(-16, 16);
    // ocean worlds: never drop a supply crate INTO the moat
    if (gen === 'ocean' && Math.hypot(tx - half, tz - half) < 17) tx = tx < half ? half - 20 : half + 20;
    clearArea(grid, tx, tz, 1);
    pickups.push({ type, pos: tileToWorld(tx, tz) });
    pickups.push({ type, pos: tileToWorld(GRID - 1 - tx, tz) });
  });

  // Zombie spawns: map edges — but NEVER inside a base compound (the horde
  // pours in from the flanks, it doesn't spawn in the player's barracks). A
  // point that lands within a compound is pulled toward center until it clears.
  const zombieSpawns: Vec3[] = [];
  const inCompound = (tx: number) => tx < 30 || tx > GRID - 31; // the two base bands
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    let tx = Math.round(half + Math.cos(a) * (half - 6));
    const tz = Math.round(half + Math.sin(a) * (half - 6));
    if (inCompound(tx)) tx = tx < half ? 32 : GRID - 33; // just outside the gate
    clearArea(grid, tx, tz, 1);
    zombieSpawns.push(tileToWorld(tx, tz));
  }

  // §base: THE COMPOUND, drawn LAST so its walls are final — a walled base
  // with a gate to the enemy, a parade ground at the spawn ring (flag stand
  // open to the sky), and real buildings inside: a barracks, a watchtower's
  // manned slit ring, a supply depot. Mirrored fair, seed-stable (base.ts).
  for (let side = 0 as Team; side < 2; side++) {
    stampBaseCompound(buildCtx, baseT[side][0], baseT[side][1], side);
  }

  // ---- the SURFACE layer (§8.6): each theme deals its own ground ----
  const surface = new Uint8Array(GRID * GRID);
  const baseSurf = gen === 'field' || gen === 'armor' ? (theme === 'titan' ? S_GRIT : S_GRASS)
    : gen === 'corridors' ? S_PLATE
    : gen === 'rocks' ? S_DIRT
    : gen === 'ocean' ? S_WET
    : S_ICE; // triton
  surface.fill(baseSurf);
  // A1 THE APRON: a poured-plate flight line in front of the three hangars.
  // Pure surface paint — no tiles change, so nothing can be trapped or
  // walled by it; it reads AS an airfield from the sky and gives wheels
  // their 1.05 on the deck. Stamped before the mud pass on purpose.
  for (let side = 0 as Team; side < 2; side++) {
    const [btx, btz] = baseT[side];
    const fwd = side === 0 ? 1 : -1;
    for (let dx = 16; dx <= 19; dx++) {
      for (let dz = -27; dz <= -13; dz++) {
        const tx = btx + fwd * dx, tz = btz + dz;
        if (tx < 1 || tx >= GRID - 1 || tz < 1 || tz >= GRID - 1) continue;
        surface[tz * GRID + tx] = S_PLATE;
        // and no meadow grows through poured plate — clear tall grass on the
        // line (grass is walkable, so reachability cannot change; it only
        // stops the flight line hiding a whole fireteam)
        if (grid[tz * GRID + tx] === T_GRASS) grid[tz * GRID + tx] = T_OPEN;
      }
    }
  }
  // water margins turn to mud (wheels hate it; hover gets its moment)
  if (gen !== 'ice') {
    for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) {
      if (grid[z * GRID + x] === T_WATER) continue;
      if (grid[z * GRID + x + 1] === T_WATER || grid[z * GRID + x - 1] === T_WATER ||
          grid[(z + 1) * GRID + x] === T_WATER || grid[(z - 1) * GRID + x] === T_WATER) {
        surface[z * GRID + x] = S_MUD;
      }
    }
  }

  // Decorative trees on open tiles — Terra only; nothing grows off-world
  if (theme === 'savanna' || theme === 'titan') {
    for (let i = 0; i < (theme === 'titan' ? 14 : 40); i++) {
      const tx = rng.int(4, GRID - 5), tz = rng.int(4, GRID - 5);
      if (grid[tz * GRID + tx] === T_OPEN) {
        const w = tileToWorld(tx, tz);
        // exclusion radii are TILE-SCALED: the base COMPOUND now spans ~18
        // tiles from its center out to the gate, so the keep-out grew to
        // match — a fixed radius once grew a tree IN the base gate and walled
        // a whole team in, and a too-small one plants oaks in the parade
        const far = Math.hypot(w.x - basePos[0].x, w.z - basePos[0].z) > TILE * 20 &&
                    Math.hypot(w.x - basePos[1].x, w.z - basePos[1].z) > TILE * 20 &&
                    Math.hypot(w.x - hillPos.x, w.z - hillPos.z) > TILE * 7 &&
                    // AND never in the MOTOR POOL: the pads stage well past the
                    // base tree-line, and a tree claims T_WALL — one oak in the
                    // pool boxes a hull in and the AI can never drive it out
                    !vehiclePads.some((p) => Math.hypot(w.x - p.pos.x, w.z - p.pos.z) < TILE * 3);
        // NOTHING GROWS INDOORS (Robert: "some trees inside of a house… I
        // couldn't get down the hallways"). A house's FLOOR is T_OPEN, so the
        // open-tile test above happily planted oaks in living rooms — and a
        // tree claims T_WALL, so it bricked the corridor it landed in. The
        // houses array was right here the whole time; now we ask it.
        if (far && houseAt(houses, w.x, w.z) < 0) {
          claimTile(grid, claims, tx, tz, T_WALL);
          props.push({ type: 'tree', pos: w, scale: rng.range(0.8, 1.4), rot: rng.range(0, Math.PI * 2) });
        }
      }
    }
  }

  // jump gates: each base's flank warps to its own midfield approach (mirrored)
  const gates: GameMap['gates'] = [];
  for (const side of [0, 1]) {
    const [btx, btz] = baseT[side];
    const fwd = side === 0 ? 1 : -1;
    // the base-end warp pad sits OUTSIDE the compound gate now (x≥20 from
    // base clears the +18 east wall) — a tunnel a bot reaches through the
    // gate, not one that punches the perimeter (base.ts owns the wall)
    const aT: [number, number] = [btx + fwd * 21, btz - 5];
    const bT: [number, number] = [half - fwd * 14, btz - 18];
    clearArea(grid, aT[0], aT[1], 2);
    clearArea(grid, bT[0], bT[1], 2);
    gates.push({ a: tileToWorld(aT[0], aT[1]), b: tileToWorld(bT[0], bT[1]) });
  }

  // grav-lift pads: mirrored midfield launchers aimed at the hill
  const pads: GameMap['pads'] = [];
  for (const [ptx, ptz] of [[half - 16, half - 14], [half - 16, half + 14]] as const) {
    for (const mirror of [0, 1]) {
      const tx = mirror ? GRID - 1 - ptx : ptx;
      clearArea(grid, tx, ptz, 1);
      const w = tileToWorld(tx, ptz);
      const dx = hillPos.x - w.x, dz = hillPos.z - w.z;
      const dl = Math.hypot(dx, dz) || 1;
      pads.push({ pos: w, dir: { x: dx / dl, z: dz / dl } });
    }
  }

  // THE MEADOWS (finish-list 18): long grass in blobs on open ground --
  // concealment terrain, free to cross, stops nothing. Kopje's promise kept.
  // (No meadows inside a hull — the interior deck grows nothing.)
  for (let m = 0; gen !== 'corridors' && m < 7; m++) {
    const gcx = rng.int(8, GRID - 9), gcz = rng.int(8, GRID - 9);
    const gr = rng.int(2, 4);
    for (let dz = -gr; dz <= gr; dz++) {
      for (let dx = -gr; dx <= gr; dx++) {
        if (dx * dx + dz * dz > gr * gr + rng.int(0, 2)) continue;
        const gidx = (gcz + dz) * GRID + (gcx + dx);
        if (grid[gidx] === T_OPEN) grid[gidx] = T_GRASS;
      }
    }
  }

  const outdoorProps = pruneStrandedCrops(pruneIndoorProps(props, houses), grid);
  return { seed, theme, grid, grid2, surface, basePos, spawns, flagPos, hillPos, controlPoints, vehiclePads, pickups, props: outdoorProps, zombieSpawns, houses, gates, pads, propCovered: settleClaims(grid, claims, outdoorProps) };
}

/**
 * Safehouse neighborhood: a 4×3 grid of walled houses along streets, a
 * command post at the south edge, yards with fences and trees. Houses have a
 * street-facing front door (and sometimes a back door) so the horde can get in.
 */
function generateNeighborhood(seed: number): GameMap {
  const rng = new Rng(seed);
  const grid = new Uint8Array(GRID * GRID);
  const grid2 = new Uint8Array(GRID * GRID); // the second storey — void by default
  const props: PropSpec[] = [];
  const claims: TileClaim[] = []; // prop-covered tiles, recorded where stamped
  const houses: House[] = [];
  const pickups: PickupSpawn[] = [];

  for (let i = 0; i < GRID; i++) {
    grid[i] = T_WALL;
    grid[(GRID - 1) * GRID + i] = T_WALL;
    grid[i * GRID] = T_WALL;
    grid[i * GRID + GRID - 1] = T_WALL;
  }

  // 4 columns × 3 rows of lots; streets between them stay open. Every house
  // is GROWN by the dynamic-interior system (buildings.ts): real rooms, real
  // T_DOOR doors the horde has to break down, windows, furniture, loot —
  // no two neighborhoods share a floor plan.
  const cols = 4, rows = 3;
  const lotW = 22, lotH = 26;
  const originX = 6, originZ = 8;
  const ctx: StampCtx = { grid, grid2, props, pickups, houses, claims, rng };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = originX + c * lotW;
      const lz = originZ + r * lotH;
      const roll = rng.next();
      const type = roll < 0.55 ? 'bungalow' : roll < 0.85 ? 'hall_house' : 'manor';
      const def = generateHouse(rng, type);
      const hh = def.rows.length;
      const hw = Math.max(...def.rows.map((row) => row.length));
      const hx = lx + rng.int(1, Math.max(2, lotW - hw - 3));
      const hz = lz + rng.int(1, Math.max(2, lotH - hh - 8));
      if (!stampBuilding(ctx, def, hx, hz, houses.length * 2)) continue;

      // yard dressing: fence stubs + crates + a tree
      if (rng.next() < 0.6) {
        const fz = hz + hh + 1;
        for (let x = hx - 1; x < hx + Math.floor(hw / 2); x++) setTile(grid, x, fz, T_COVER);
      }
      if (rng.next() < 0.7) {
        const cxT = hx + hw + 1, czT = hz + rng.int(0, hh - 1);
        claimTile(grid, claims, cxT, czT, T_COVER);
        props.push({ type: 'crate', pos: tileToWorld(cxT, czT), scale: 1, rot: rng.range(0, Math.PI) });
      }
      const tx = lx + rng.int(0, 2), tz = lz + rng.int(0, 3);
      const yard = tileToWorld(tx, tz);
      // the yard tree grows in the YARD — the lot origin can land inside the
      // house that was just stamped on it (same disease as the battle-map
      // trees: a floor is T_OPEN)
      if (grid[tz * GRID + tx] === T_OPEN && houseAt(houses, yard.x, yard.z) < 0) {
        claimTile(grid, claims, tx, tz, T_WALL);
        props.push({ type: 'tree', pos: yard, scale: rng.range(0.8, 1.3), rot: rng.range(0, Math.PI * 2) });
      }
    }
  }

  // command post: south edge center clearing
  const cpTx = GRID / 2, cpTz = GRID - 8;
  clearArea(grid, cpTx, cpTz, 6);
  const basePos: [Vec3, Vec3] = [tileToWorld(cpTx, cpTz), tileToWorld(GRID / 2, 6)];
  props.push({ type: 'bunker', pos: tileToWorld(cpTx - 4, cpTz), scale: 1, rot: -Math.PI / 2 });
  const spawns: [Vec3[], Vec3[]] = [[], []];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spawns[0].push(tileToWorld(cpTx + Math.round(Math.cos(a) * 3), cpTz + Math.round(Math.sin(a) * 3)));
    spawns[1].push(tileToWorld(GRID / 2 + Math.round(Math.cos(a) * 3), 6));
  }

  // street-corner supply drops
  const cornerTypes: PickupSpawn['type'][] = ['medkit', 'ammo', 'energy', 'flamer'];
  for (let i = 0; i < 6; i++) {
    const tx = originX + rng.int(0, cols - 1) * lotW + lotW - 2;
    const tz = originZ + rng.int(0, rows - 1) * lotH + lotH + 1;
    if (grid[Math.min(tz, GRID - 2) * GRID + tx] === T_OPEN) {
      pickups.push({ type: cornerTypes[i % cornerTypes.length], pos: tileToWorld(tx, Math.min(tz, GRID - 2)) });
    }
  }

  const zombieSpawns: Vec3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tx = Math.round(GRID / 2 + Math.cos(a) * (GRID / 2 - 6));
    const tz = Math.round(GRID / 2 + Math.sin(a) * (GRID / 2 - 6));
    clearArea(grid, tx, tz, 1);
    zombieSpawns.push(tileToWorld(tx, tz));
  }

  const hillPos = tileToWorld(GRID / 2, GRID / 2);

  // squad support at the command post: a field ambulance + two emplacement guns
  const vehiclePads: VehiclePad[] = [];
  clearArea(grid, cpTx - 8, cpTz, 2);
  vehiclePads.push({ kind: 'ambulance', team: 0, pos: tileToWorld(cpTx - 8, cpTz) });
  for (const side of [-1, 1]) {
    clearArea(grid, cpTx + side * 10, cpTz - 6, 2);
    vehiclePads.push({ kind: 'emplacement', team: 0, pos: tileToWorld(cpTx + side * 10, cpTz - 6) });
  }

  const surface = new Uint8Array(GRID * GRID);
  surface.fill(S_GRASS);
  const hoodProps = pruneIndoorProps(props, houses);
  return {
    seed, theme: 'savanna', grid, grid2, surface, basePos, spawns,
    flagPos: [basePos[0], basePos[1]],
    hillPos,
    controlPoints: [
      { name: 'A', pos: tileToWorld(GRID / 2 - 20, GRID / 2) },
      { name: 'B', pos: hillPos },
      { name: 'C', pos: tileToWorld(GRID / 2 + 20, GRID / 2) },
    ],
    vehiclePads,
    pickups, props: hoodProps, zombieSpawns, houses,
    gates: [], pads: [],
    propCovered: settleClaims(grid, claims, hoodProps),
  };
}
