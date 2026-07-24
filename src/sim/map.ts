import { Rng } from './rng';
import { generateHouse, placeBuildings, stampBuilding, type StampCtx } from './buildings';
import { stampBaseCompound } from './base';
import { carveInterior } from './interior';
import { fillRegions } from './chunks';
import { THEMES } from './data';
import type { ModeId, RaceTrack, Team, ThemeId, Vec3, VehicleKind } from './types';
import { PIECE_SHAPE, camerasFor, checkpointsFor, walkTrack, type BuiltTrack, type Pavement } from './tracks';
import type { OperationPhaseKind, OperationScale, OperationSiteId } from './operations';
import type { TheaterMetadata } from './theater-types';
import type { SemanticDistrict } from './geospatial/types';
import {
  LEGACY_GEOMETRY,
  inBounds as geometryInBounds,
  tileIndex as geometryTileIndex,
  tileToWorld as geometryTileToWorld,
  worldToTile as geometryWorldToTile,
  type MapGeometry,
} from './map-geometry';

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
export function surfaceAt(
  surface: Uint8Array,
  x: number,
  z: number,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): number {
  const [tx, tz] = geometryWorldToTile(geometry, x, z);
  if (!geometryInBounds(geometry, tx, tz)) return S_DIRT;
  return surface[geometryTileIndex(geometry, tx, tz)];
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
export function pruneStrandedCrops(
  props: PropSpec[],
  grid: Uint8Array,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): PropSpec[] {
  return props.filter((p) => {
    if (p.type !== 'crop') return true;
    const [tx, tz] = geometryWorldToTile(geometry, p.pos.x, p.pos.z);
    if (!geometryInBounds(geometry, tx, tz)) return false;
    return grid[geometryTileIndex(geometry, tx, tz)] === T_GRASS;
  });
}

export function houseAt(
  houses: House[],
  x: number,
  z: number,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): number {
  const [tx, tz] = geometryWorldToTile(geometry, x, z);
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
    | 'hangar'
    // THE FURNISHED INTERIOR (high-code #7): the things that stand in an
    // interior cover cell. Same footprint and collision as the crate they
    // replace — a bedroom, an office and a workshop stop being the same box.
    | 'bed' | 'table' | 'desk' | 'shelf' | 'counter' | 'cabinet';
  pos: Vec3;
  scale: number;
  rot: number;
}

export interface VehiclePad {
  kind: VehicleKind;
  team: Team;
  pos: Vec3;
  /** Named national-pool hull committed to this Operation pad. */
  operationHullId?: string;
  /** Destructible mission target carried by this pad's spawned vehicle. */
  operationObjectiveId?: string;
  /** Scorched-earth prize the attacking force must keep alive. */
  operationPrize?: boolean;
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
  seed?: number;
  footprint?: string;
  origin?: { tx: number; tz: number };
  width?: number;
  height?: number;
  sockets?: {
    id: string;
    kind: 'entry' | 'exit' | 'objective' | 'guard' | 'civilian' | 'dog-handler' | 'reinforcement';
    x: number; z: number; floor: number; sectionId: 'west' | 'east'; required: boolean;
  }[];
  sections?: {
    id: 'west' | 'east'; active: boolean;
    tiles: { x: number; z: number; floor: number }[];
  }[];
}

/** Visual-only treatment for an attributable real-world slice. None of these
 * objects participate in collision; authoritative play still reads the grid. */
export interface GeospatialDecor {
  kind: 'palm' | 'streetlight' | 'barrier';
  pos: Vec3;
  scale: number;
  rot: number;
}

export interface GeospatialMapMeta {
  sourceId: string;
  cityId: string;
  style: 'default' | 'miami-gardens' | 'lower-manhattan' | 'tarboro';
  classification: Uint8Array;
  buildingHeight: Uint8Array;
  decor: GeospatialDecor[];
  /** Versioned real-city street, block, lot, building, and access graph. */
  district?: SemanticDistrict;
}

/** One cabinet on somebody's floor. `cart` is the cartridge bolted inside it. */
export interface ArcadeCabinet {
  pos: Vec3;
  /** which cartridge this machine runs — a cabinet plays ONE game, forever */
  cart: string;
  /** the machine's own name on the marquee */
  name: string;
  /** which way the screen faces, so you stand in front of it */
  yaw: number;
}

export interface GameMap {
  seed: number;
  theme: ThemeId;
  /** Authoritative tile dimensions. Legacy battlefields are 100×100×3. */
  geometry: MapGeometry;
  /** Vehicle-scale theater routes, landing zones, and domain metadata. */
  theater?: TheaterMetadata;
  grid: Uint8Array; // GRID*GRID
  /** the SECOND STOREY (§8.4 Phase-2): F2_* per tile — void unless a
   *  two-storey building stamped an upper floor here. Static after gen. */
  grid2: Uint8Array;
  /** Indexed upper storeys for new building maps. Index 0 is the same logical
   * Level 2 content as grid2; index 1 is Level 3. Absent on legacy maps. */
  upperLayers?: Uint8Array[];
  /** Authoring/generator provenance; absent on legacy battle maps. */
  buildingMeta?: BuildingMapMeta;
  /** Source classification plus non-colliding district presentation. */
  geospatial?: GeospatialMapMeta;
  /** the SURFACE layer (§8.6): S_* per tile — movement, sound, and tracks */
  surface: Uint8Array;
  /** TERRAIN ELEVATION (v1, docs/superpowers/specs/2026-07-22-terrain-elevation):
   *  per-tile ground height 0..2 (Ground / Building / Sky-mountain). ABSENT = flat
   *  (every legacy map), so nothing pays until a map places terrain. See
   *  TERRAIN_U / terrainTopAt / losClearTerrain. Static after gen; replicated once. */
  height?: Uint8Array;
  /** per-tile ramp flag (1 = a graded slope a vehicle can drive between levels);
   *  absent/0 = a step/cliff. Only meaningful where `height` varies. */
  ramp?: Uint8Array;
  basePos: [Vec3, Vec3];
  spawns: [Vec3[], Vec3[]];
  flagPos: [Vec3, Vec3];
  hillPos: Vec3;
  controlPoints: { name: string; pos: Vec3 }[];
  vehiclePads: VehiclePad[];
  pickups: PickupSpawn[];
  props: PropSpec[];
  /**
   * THE ARCADE — walk-up cabinets you can actually play.
   *
   * Robert: *"ARCADE GAMES = walk-up consoles in the world: you approach one, a
   * UI pops up, and you're actually playing a video game."*
   *
   * The distinction from the Deck is WHERE, not what: the Deck is the handheld
   * in your pack, a cabinet is a machine bolted to somebody's floor. Same five
   * games, same runtime — but you have to go to it, and going to it is the
   * point. Furniture, exactly like `pickups`: the map lays them, the E chain
   * answers them, the client draws the screen.
   */
  arcades?: ArcadeCabinet[];
  zombieSpawns: Vec3[];
  /** safehouse mode: the neighborhood's searchable houses */
  houses: House[];
  /** paired jump-gate teleporters (battlefield maps) */
  gates: { a: Vec3; b: Vec3 }[];
  /** grav-lift launch pads: step on, get flung along dir */
  pads: { pos: Vec3; dir: { x: number; z: number } }[];
  /** race / timetrial: the circuit carved into this map (checkpoints + grid). */
  raceTrack?: RaceTrack;
  /** SINGLE SOURCE OF TRUTH for prop-rendered collision: tile indices whose
   *  blocking geometry is visually owned by a prop (rock disc, tree trunk,
   *  crate). The generator records these AT THE STAMP SITE and prunes any
   *  claim a later stamp overwrote. The renderer skips EXACTLY this set and
   *  never re-derives footprints — the drift that caused every invisible-wall
   *  bug is structurally impossible. Guarded by tests/walls.test.ts. */
  propCovered: number[];
  /** Military Operations metadata. Stock modes ignore it; the objective
   * runtime consumes this serializable layer without reverse-engineering
   * control-point labels or map geometry. */
  operation?: {
    operationId: string;
    site: OperationSiteId;
    scale: OperationScale;
    objectives: Array<{
      id: string;
      phaseId: string;
      kind: OperationPhaseKind;
      pos: Vec3;
      radius: number;
      targetCount?: number;
      targetPropIndex?: number;
    }>;
    protectedZones: Array<{ pos: Vec3; radius: number }>;
  };
}

export function tileAt(
  grid: Uint8Array,
  x: number,
  z: number,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): number {
  const [tx, tz] = geometryWorldToTile(geometry, x, z);
  if (!geometryInBounds(geometry, tx, tz)) return T_WALL;
  return grid[geometryTileIndex(geometry, tx, tz)];
}

const thinGrids = new WeakSet<Uint8Array>();

/** Mark a grid as containing narrow geometry so LOS uses a sub-wall step. */
export function registerThinGrid(grid: Uint8Array): void {
  thinGrids.add(grid);
}

export function isDoorTile(tile: number, upper = false): boolean {
  if (upper) {
    return tile === F2_DOOR_H || tile === F2_DOOR_V
      || tile === F2_DOOR_H_OPEN || tile === F2_DOOR_V_OPEN;
  }
  return tile === T_DOOR || tile === T_DOOR_OPEN || tile === T_METAL_DOOR
    || tile === T_THIN_DOOR_H || tile === T_THIN_DOOR_V
    || tile === T_THIN_DOOR_H_OPEN || tile === T_THIN_DOOR_V_OPEN;
}

export function doorIsOpen(tile: number, upper = false): boolean {
  if (upper) return tile === F2_DOOR_H_OPEN || tile === F2_DOOR_V_OPEN;
  return tile === T_DOOR_OPEN || tile === T_THIN_DOOR_H_OPEN || tile === T_THIN_DOOR_V_OPEN;
}

export function isWindowTile(tile: number, upper = false): boolean {
  return upper
    ? tile === F2_WINDOW_H || tile === F2_WINDOW_V || tile === F2_WINDOW_H_BROKEN || tile === F2_WINDOW_V_BROKEN
    : tile === T_WINDOW_H || tile === T_WINDOW_V || tile === T_WINDOW_H_BROKEN || tile === T_WINDOW_V_BROKEN;
}

export function windowIsBroken(tile: number, upper = false): boolean {
  return upper
    ? tile === F2_WINDOW_H_BROKEN || tile === F2_WINDOW_V_BROKEN
    : tile === T_WINDOW_H_BROKEN || tile === T_WINDOW_V_BROKEN;
}

export function breakWindowTile(tile: number, upper = false): number {
  if (upper) {
    if (tile === F2_WINDOW_H) return F2_WINDOW_H_BROKEN;
    if (tile === F2_WINDOW_V) return F2_WINDOW_V_BROKEN;
    return tile;
  }
  if (tile === T_WINDOW_H) return T_WINDOW_H_BROKEN;
  if (tile === T_WINDOW_V) return T_WINDOW_V_BROKEN;
  return tile;
}

export function windowSpansX(tile: number, upper = false): boolean {
  return upper
    ? tile === F2_WINDOW_H || tile === F2_WINDOW_H_BROKEN
    : tile === T_WINDOW_H || tile === T_WINDOW_H_BROKEN;
}

/** Toggle a door while retaining the explicit orientation of thin doors. */
export function toggleDoorTile(tile: number, upper = false): number {
  if (upper) {
    if (tile === F2_DOOR_H) return F2_DOOR_H_OPEN;
    if (tile === F2_DOOR_H_OPEN) return F2_DOOR_H;
    if (tile === F2_DOOR_V) return F2_DOOR_V_OPEN;
    if (tile === F2_DOOR_V_OPEN) return F2_DOOR_V;
    return tile;
  }
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

function centeredTileOffset(value: number, tileCount: number, tileSize: number): number {
  const within = ((value + tileCount * tileSize / 2) % tileSize + tileSize) % tileSize;
  return within - tileSize / 2;
}

export function thinTileBlocks(
  tile: number,
  x: number,
  z: number,
  upper = false,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean {
  if (upper
    ? tile === F2_DOOR_H_OPEN || tile === F2_DOOR_V_OPEN || tile === F2_SHUTTER_OPEN
    : tile === T_THIN_DOOR_H_OPEN || tile === T_THIN_DOOR_V_OPEN || tile === T_SECTION_SHUTTER_OPEN) return false;
  const ox = Math.abs(centeredTileOffset(x, geometry.cols, geometry.tile));
  const oz = Math.abs(centeredTileOffset(z, geometry.rows, geometry.tile));
  const horizontal = upper
    ? tile === F2_THIN_WALL_H || tile === F2_THIN_WALL_HV || tile === F2_WINDOW_H
      || tile === F2_WINDOW_H_BROKEN || tile === F2_DOOR_H || tile === F2_RAIL_H || tile === F2_SHUTTER
    : tile === T_THIN_WALL_H || tile === T_THIN_DOOR_H || tile === T_THIN_WALL_HV
      || tile === T_WINDOW_H || tile === T_WINDOW_H_BROKEN || tile === T_SECTION_SHUTTER;
  const vertical = upper
    ? tile === F2_THIN_WALL_V || tile === F2_THIN_WALL_HV || tile === F2_WINDOW_V
      || tile === F2_WINDOW_V_BROKEN || tile === F2_DOOR_V || tile === F2_RAIL_V
    : tile === T_THIN_WALL_V || tile === T_THIN_DOOR_V || tile === T_THIN_WALL_HV
      || tile === T_WINDOW_V || tile === T_WINDOW_V_BROKEN;
  return (horizontal && oz <= THIN_WALL / 2) || (vertical && ox <= THIN_WALL / 2);
}

export function isBlocked(
  grid: Uint8Array,
  x: number,
  z: number,
  hover = false,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean {
  const t = tileAt(grid, x, z, geometry);
  if (t === T_WATER) return false;   // shallow: wadeable by everyone (slowly)
  if (t === T_DEEP) return !hover;   // deep: hover only — soldiers SWIM via their own physics
  // slits and CLOSED doors block movement always; open doors are a doorway.
  // CLIMB barricades block GROUND movement like walls — clearing one is the
  // airborne y-band's job (world.ts knows your apex; this function doesn't).
  if ((t >= T_THIN_WALL_H && t <= T_THIN_WALL_HV) || isWindowTile(t)
    || t === T_SECTION_SHUTTER || t === T_SECTION_SHUTTER_OPEN) return thinTileBlocks(t, x, z, false, geometry);
  return t === T_WALL || t === T_COVER || t === T_SLIT || t === T_DOOR || t === T_METAL || t === T_METAL_DOOR || t === T_CLIMB;
}

/**
 * Nearest open-tile CENTER within `maxR` rings of (x, z) — the statue law's
 * escape hatch. The movement integrator only vetoes DESTINATIONS, so a body
 * that somehow stands inside masonry (a leap landing, a door closed on the
 * doorway, a bad spawn) could otherwise never move again. Ring-by-ring scan
 * keeps it nearest-first; null means everything nearby is masonry too.
 */
export function nearestOpenTile(
  grid: Uint8Array,
  x: number,
  z: number,
  maxR = 4,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): { x: number; z: number } | null {
  const [tx, tz] = geometryWorldToTile(geometry, x, z);
  for (let r = 1; r <= maxR; r++) {
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // this ring's shell only
        const nx = tx + dx, nz = tz + dz;
        if (!geometryInBounds(geometry, nx, nz)) continue;
        const center = geometryTileToWorld(geometry, nx, nz);
        const cx = center.x;
        const cz = center.z;
        if (isBlocked(grid, cx, cz, false, geometry)) continue; // deep water is no refuge either
        const d = Math.hypot(cx - x, cz - z);
        if (d < bestD) { bestD = d; best = { x: cx, z: cz }; }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Blocks projectiles/sight: walls always; cover and water never (shots fly over). */
export function blocksShot(
  grid: Uint8Array,
  x: number,
  z: number,
  y: number,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean {
  const t = tileAt(grid, x, z, geometry);
  if (t === T_WALL) return y < WALL_H;   // walls are 4 units tall
  if (t === T_COVER) return y < COVER_H; // low cover
  if (t === T_SLIT) return !(y >= 1.2 && y <= 1.8); // the firing band — muzzle height passes
  if (t === T_DOOR) return y < 2.2;      // a closed door stops rounds and eyes
  if (t === T_METAL || t === T_METAL_DOOR) return y < WALL_H;  // metal walls (and safe-room doors) are walls
  if (t === T_CLIMB) return y < CLIMB_H; // §8.7: rounds clear the lip at 2.5
  if (t === T_RUBBLE) return y < RUBBLE_H; // a breach pile: shin cover, eyes clear
  if (t >= T_THIN_WALL_H && t <= T_THIN_WALL_HV) {
    const door = t === T_THIN_DOOR_H || t === T_THIN_DOOR_V;
    return thinTileBlocks(t, x, z, false, geometry) && y < (door ? 2.2 : WALL_H);
  }
  if (t === T_WINDOW_H || t === T_WINDOW_V) return thinTileBlocks(t, x, z, false, geometry) && y < WALL_H;
  if (t === T_WINDOW_H_BROKEN || t === T_WINDOW_V_BROKEN) return thinTileBlocks(t, x, z, false, geometry) && y < 1.0;
  if (t === T_SECTION_SHUTTER) return thinTileBlocks(t, x, z, false, geometry) && y < WALL_H;
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
export function blocksShotUpper(
  grid2: Uint8Array,
  x: number,
  z: number,
  y: number,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean {
  if (y < 4 || y >= 8) return false;
  const t = tileAt(grid2, x, z, geometry);
  if (t === F2_WALL) return true;
  if (t === F2_SLIT) return !(y >= 5.2 && y <= 5.8);
  if ((t === F2_THIN_WALL_H || t === F2_THIN_WALL_V || t === F2_THIN_WALL_HV)
    && thinTileBlocks(t, x, z, true, geometry)) return true;
  if ((t === F2_WINDOW_H || t === F2_WINDOW_V) && thinTileBlocks(t, x, z, true, geometry)) return true;
  if ((t === F2_WINDOW_H_BROKEN || t === F2_WINDOW_V_BROKEN) && thinTileBlocks(t, x, z, true, geometry)) return y < 5;
  if ((t === F2_DOOR_H || t === F2_DOOR_V) && thinTileBlocks(t, x, z, true, geometry)) return y < 6.2;
  if ((t === F2_RAIL_H || t === F2_RAIL_V) && thinTileBlocks(t, x, z, true, geometry)) return y < 5.2;
  if (t === F2_SHUTTER && thinTileBlocks(t, x, z, true, geometry)) return true;
  return false;
}

/** Is this upper tile standable? (Anything but void — walls stop you first.) */
export const upperBlocked = (
  grid2: Uint8Array,
  x: number,
  z: number,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean => {
  const t = tileAt(grid2, x, z, geometry);
  if (t === F2_WALL || t === F2_SLIT) return true;
  if (t === F2_THIN_WALL_H || t === F2_THIN_WALL_V || t === F2_THIN_WALL_HV
    || t === F2_WINDOW_H || t === F2_WINDOW_V || t === F2_WINDOW_H_BROKEN || t === F2_WINDOW_V_BROKEN
    || t === F2_DOOR_H || t === F2_DOOR_V || t === F2_RAIL_H || t === F2_RAIL_V || t === F2_SHUTTER) {
    return thinTileBlocks(t, x, z, true, geometry);
  }
  return false;
};

/** March a ray across the grid; true if line of sight is clear at the given height. */
export function losClear(
  grid: Uint8Array,
  a: Vec3,
  b: Vec3,
  y = 1.4,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const stride = thinGrids.has(grid) ? Math.min(THIN_WALL * 0.5, geometry.tile * 0.5) : geometry.tile * 0.5;
  const steps = Math.max(1, Math.ceil(dist / stride));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksShot(grid, a.x + dx * t, a.z + dz * t, y, geometry)) return false;
  }
  return true;
}

/** opt #9 (S5): the coordinate-taking twin of losClear — IDENTICAL march, but
 *  no per-call {x,y,z} literals. `losClear` never reads the endpoints' y (it
 *  marches at its own `y`), so this is byte-for-byte equal to
 *  losClear(grid, {x:ax,_,z:az}, {x:bx,_,z:bz}, y). Perception evaluates it up
 *  to ~5,760× per tick at horde scale — this kills ~11.5k object allocs/tick. */
export function losClearXZ(grid: Uint8Array, ax: number, az: number, bx: number, bz: number, y = 1.4, geometry: MapGeometry = LEGACY_GEOMETRY): boolean {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const stride = thinGrids.has(grid) ? Math.min(THIN_WALL * 0.5, geometry.tile * 0.5) : geometry.tile * 0.5;
  const steps = Math.max(1, Math.ceil(dist / stride));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksShot(grid, ax + dx * t, az + dz * t, y, geometry)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// TERRAIN ELEVATION (v1) — the ground itself has height. Four vertical bands,
// one scale shared with elevation.ts: Ground / Building / Sky / Clouds. Terrain
// climbs the lower three; Clouds is jet-only air (no terrain). Heights are
// NON-LINEAR — a Sky mountain (16u) is ~4× a Building rise (4u) — so mountains
// mean something. Per-tile `height` is 0..2; absent = flat (byte-identical).
// ---------------------------------------------------------------------------
/** level → world units. Ground 0 · Building 4 (≈WALL_H) · Sky/mountain 16. */
export const TERRAIN_U = [0, 4, 16] as const;
export const SKY_LEVEL = 2; // the mountain band; rotorcraft cap here (elevation.ts)

/** Ground height (world units) at a world position; 0 flat / out of bounds. */
export function terrainTopAt(height: Uint8Array | undefined, x: number, z: number, geometry: MapGeometry = LEGACY_GEOMETRY): number {
  if (!height) return 0;
  const [tx, tz] = geometryWorldToTile(geometry, x, z);
  if (!geometryInBounds(geometry, tx, tz)) return 0;
  return TERRAIN_U[height[geometryTileIndex(geometry, tx, tz)]] ?? 0;
}

/** terrain LEVEL (0..2) at a world position; 0 flat / out of bounds. */
export function terrainLevelAt(height: Uint8Array | undefined, x: number, z: number, geometry: MapGeometry = LEGACY_GEOMETRY): number {
  if (!height) return 0;
  const [tx, tz] = geometryWorldToTile(geometry, x, z);
  if (!geometryInBounds(geometry, tx, tz)) return 0;
  return height[geometryTileIndex(geometry, tx, tz)] ?? 0;
}

/** true if this tile is a graded ramp (a vehicle can change level across it). */
export function isRampAt(ramp: Uint8Array | undefined, x: number, z: number, geometry: MapGeometry = LEGACY_GEOMETRY): boolean {
  if (!ramp) return false;
  const [tx, tz] = geometryWorldToTile(geometry, x, z);
  if (!geometryInBounds(geometry, tx, tz)) return false;
  return ramp[geometryTileIndex(geometry, tx, tz)] === 1;
}

/** TERRAIN occlusion: true if the line A→B is not blocked by higher GROUND
 *  between them. `ay`/`by` are ABSOLUTE heights (each end's terrain top + its
 *  eye/muzzle stance). A tile whose ground rises above the interpolated line
 *  blocks. Returns true immediately when there's no height layer, so flat maps
 *  cost nothing and stay byte-identical — this composes ON TOP of the wall LOS. */
export function losClearTerrain(height: Uint8Array | undefined, ax: number, ay: number, az: number, bx: number, by: number, bz: number, geometry: MapGeometry = LEGACY_GEOMETRY): boolean {
  if (!height) return true;
  const dx = bx - ax, dz = bz - az, dy = by - ay;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / (geometry.tile * 0.5)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (terrainTopAt(height, ax + dx * t, az + dz * t, geometry) > ay + dy * t + 0.001) return false;
  }
  return true;
}

/** The UPSTAIRS counterpart to losClear: march the UPPER grid at the nest band
 *  (y 5.4), where F2_WALL blocks the 4..8 storey and F2_SLIT passes only its
 *  5.2–5.8 firing band. This is what makes two soldiers who are BOTH on a
 *  second storey obey the upper walls between them, instead of reading the
 *  ground floor's layout by accident (sight-plan A3 step 2). */
export function losClearUpper(
  grid2: Uint8Array,
  a: Vec3,
  b: Vec3,
  y = 5.4,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const stride = thinGrids.has(grid2) ? Math.min(THIN_WALL * 0.5, geometry.tile * 0.5) : geometry.tile * 0.5;
  const steps = Math.max(1, Math.ceil(dist / stride));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksShotUpper(grid2, a.x + dx * t, a.z + dz * t, y, geometry)) return false;
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
export function losCrossFloor(
  grid: Uint8Array, grid2: Uint8Array, up: Vec3, dn: Vec3,
  geometry: MapGeometry = LEGACY_GEOMETRY,
): boolean {
  const mid = { x: (up.x + dn.x) / 2, y: 0, z: (up.z + dn.z) / 2 };
  return losClearUpper(grid2, up, mid, 5.4, geometry) && losClear(grid, mid, dn, 1.4, geometry);
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

  const mid = (A0 + A1) / 2;
  // THE MAZE YARDS (Robert: "more like a maze… we need hallways, the long
  // corridors — think Pac-Man, but a little bit simpler. Maybe a maze on
  // each side, then it opens up"): every yard is now two mirrored maze
  // WINGS of long two-tile hallways feeding an open center plaza.
  //
  // Each wing runs three north-south lanes separated by wall columns; the
  // doorways through each column are STAGGERED (per-seed phase), so crossing
  // a wing is a zigzag — corridor fighting with an angle at every door.
  // Reachability is guaranteed by construction: every lane is continuous
  // N-S, every wall column carries multiple doors, and the plaza joins the
  // wings. Water (stamped later) melts extra holes through the columns.
  // THE YARDS ARE WILDLY DIFFERENT (Robert, COMPETITIVE-ARC §2b) — same maze
  // grammar, three dialects, so records mean something PER FIELD:
  //   savanna  → THE OPEN YARD (Kopje): two thin columns, generous doors —
  //              long grass sightlines. Belt country: the only yard where a
  //              40u splat is on the table.
  //   starship → THE KNIFE FIGHT (Deck Nine): three columns, stingy doors —
  //              the densest lattice. The Fan's home.
  //   titan    → THE JUNKYARD (Grit Alley): three columns, standard doors,
  //              and half again the plaza cover — grenade and angle play.
  const WING_WALLS = theme === 'savanna'
    ? [A0 + 5, A0 + 10]
    : [A0 + 4, A0 + 7, A0 + 10]; // west wing; east is the mirror
  const doorMod = theme === 'starship' ? 7 : theme === 'savanna' ? 5 : 6;
  const doorPhase = WING_WALLS.map(() => rng.int(0, 5));
  WING_WALLS.forEach((wx, k) => {
    for (let tz = A0 + 1; tz <= A1 - 1; tz++) {
      if ((tz - A0 + doorPhase[k] + k * 3) % doorMod < 2) continue; // the doorways
      grid[tz * GRID + wx] = T_WALL;
      grid[tz * GRID + (A0 + A1 - wx)] = T_WALL; // the east wing, mirrored
    }
  });
  // the plaza gets its bunkers — inflatable cover lives in the OPEN, the
  // hallways stay clean for the long shots
  const plazaStamps = theme === 'titan' ? 9 : 6;
  for (let i = 0; i < plazaStamps; i++) {
    const tx = mid - 3 + rng.int(0, 3); // west half of the plaza; east mirrors
    const tz = A0 + 2 + rng.int(0, A1 - A0 - 4);
    const kind = rng.next() < 0.6 ? T_COVER : T_CLIMB;
    grid[tz * GRID + tx] = kind;
    grid[tz * GRID + (A0 + A1 - tx)] = kind;
  }
  // the center stays honest: a clear lane through the middle for the duel
  for (let tz = mid - 1; tz <= mid + 1; tz++) grid[tz * GRID + mid] = T_OPEN;

  const P = (tx: number, tz: number): Vec3 => ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });

  // GROUND VARIETY (Robert: "we got all grass right now"): the yard reads
  // PLAYED-ON — a worn dirt spine down the center lane and a few mirrored
  // scuffed patches where boots have argued with the turf.
  for (let tz = A0; tz <= A1; tz++) {
    surface[tz * GRID + mid] = S_DIRT;
    surface[tz * GRID + mid - 1] = S_DIRT;
  }
  for (let i = 0; i < 5; i++) {
    const px = A0 + 3 + rng.int(0, (A1 - A0) / 2 - 4);
    const pz = A0 + 3 + rng.int(0, A1 - A0 - 6);
    const wear = rng.next() < 0.5 ? S_DIRT : S_GRIT;
    for (let dz = 0; dz <= 1; dz++) {
      for (let dx = 0; dx <= 1; dx++) {
        surface[(pz + dz) * GRID + px + dx] = wear;
        surface[(pz + dz) * GRID + (A0 + A1 - px - dx)] = wear;
      }
    }
  }

  // TREES ON THE KOPJE (Robert: "I don't know how paintballs look when they
  // hit trees" — they burst on the trunk like anything else, and now you can
  // see it): mirrored acacias for the savanna yard. The trunk claims its
  // tile (T_WALL = honest collision), propCovered hands the box's visual to
  // the tree mesh, so no invisible-wall drift is possible.
  const props: PropSpec[] = [];
  const propCovered: number[] = [];
  if (theme === 'savanna') {
    const spots: [number, number][] = [[A0 + 5, A0 + 5], [A0 + 9, A1 - 7], [mid - 3, A0 + 8]];
    for (const [tx, tz] of spots) {
      for (const x of [tx, A0 + A1 - tx]) {
        const idx = tz * GRID + x;
        if (grid[idx] !== T_OPEN) continue; // never overwrite a pool or a pad
        grid[idx] = T_WALL;
        propCovered.push(idx);
        props.push({ type: 'tree', pos: P(x, tz), scale: 1.15 + ((x * 7 + tz * 13) % 5) * 0.08, rot: ((x * 31 + tz * 17) % 63) / 10 });
      }
    }
  }

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
    seed, theme, geometry: { ...LEGACY_GEOMETRY }, grid, grid2, surface,
    basePos: [P(A0 + 1, mid), P(A1 - 1, mid)],
    spawns,
    flagPos: [P(A0 + 2, mid), P(A1 - 2, mid)],
    hillPos: P(mid, mid),
    controlPoints,
    vehiclePads: [], pickups: [], props, zombieSpawns: [],
    houses: [], gates: [], pads, propCovered,
  };
}

/** THE MOTOR TRIALS circuit — an elliptical ring carved from a sealed field.
 *  The track is the open annulus between two concentric ellipses; the infield
 *  and the outer field are walled, so the loop IS the only way round. A ring of
 *  ordered checkpoints (gate 0 = start/finish) banks laps; a grid of start
 *  slots sits behind the line. Fully deterministic from the seed. */
export function generateRaceTrack(seed: number, theme: ThemeId = 'savanna'): GameMap {
  const rng = new Rng(seed);
  const grid = new Uint8Array(GRID * GRID).fill(T_WALL); // sealed; carve the ring
  const grid2 = new Uint8Array(GRID * GRID);
  const surface = new Uint8Array(GRID * GRID);
  const baseSurf = theme === 'savanna' ? S_GRASS : theme === 'starship' ? S_PLATE
    : theme === 'titan' ? S_GRIT : theme === 'europa' ? S_WET : theme === 'triton' ? S_ICE : S_DIRT;
  surface.fill(baseSurf);

  const cx = GRID / 2, cz = GRID / 2;
  // ═══ THE CIRCUIT HAS A SHAPE ═══════════════════════════════════════════
  //
  // This used to be a pure ellipse with the seed nudging its two radii by up to
  // five tiles — and the old comment claimed that meant "no two circuits drive
  // identically". Measured across five seeds, every one produced a
  // 12-checkpoint oval between 630u and 684u, a ±4% spread, with the same start
  // heading. Lap times came back 18.9 / 18.8 / 18.7s. The venue was decoration:
  // the league had five named circuits and one racetrack.
  //
  // The centreline is now a DEFORMED ring — the base ellipse bent by two seeded
  // harmonics, so a seed produces a genuinely different ribbon: a long fast
  // sweeper, a tight kidney, a lopsided loop with one big straight. Amplitudes
  // are deliberately bounded (≤0.34 total): past that the ring pinches into
  // itself and the corridor stops being drivable, and an undrivable circuit is
  // a worse bug than a boring one.
  const Rx = 30 + rng.next() * 14;          // 30..44
  const Rz = 21 + rng.next() * 12;          // 21..33
  const p2 = rng.next() * Math.PI * 2;
  const p3 = rng.next() * Math.PI * 2;
  const half = 5; // track half-width in tiles → ~30u wide racing surface

  // A CIRCUIT NOBODY CAN GET ROUND IS A WORSE BUG THAN A BORING ONE.
  //
  // Measured on the first cut: the bends produced 64–75° corners where the old
  // uniform oval was a flat 30° — roughly double anything the racing AI had
  // ever been tuned against — and two seeds in five never completed a single
  // lap in 400 seconds. Boards failed circuits that cars got round, because a
  // board carries far more speed into the same corner.
  //
  // So the shape is EARNED, not assumed: propose amplitudes, measure the
  // circuit, and damp until it is drivable. Same seed, same damping, same
  // track — deterministic, and it can never ship a ribbon the field cannot
  // drive. The amplitude that survives is still wildly more varied than a
  // fixed ellipse; it is simply bounded by what a car can do.
  const MAX_CORNER = 0.88;                  // ~50° between gates
  let a2 = 0.06 + rng.next() * 0.16;        // the big bend — one long side
  let a3 = 0.04 + rng.next() * 0.12;        // the kink — a corner complex

  const bendWith = (A2: number, A3: number) => (th: number): number =>
    1 + A2 * Math.sin(2 * th + p2) + A3 * Math.sin(3 * th + p3);
  const ptWith = (b: (t: number) => number) => (th: number): { tx: number; tz: number } => {
    const r = b(th);
    return { tx: cx + Rx * r * Math.cos(th), tz: cz + Rz * r * Math.sin(th) };
  };
  /** the sharpest heading change between adjacent gates, in radians */
  const sharpest = (pt: (t: number) => { tx: number; tz: number }, gates: number): number => {
    let worst = 0;
    for (let k = 0; k < gates; k++) {
      const a = pt((2 * Math.PI * (k - 1)) / gates);
      const b = pt((2 * Math.PI * k) / gates);
      const c = pt((2 * Math.PI * (k + 1)) / gates);
      const h1 = Math.atan2(b.tz - a.tz, b.tx - a.tx);
      const h2 = Math.atan2(c.tz - b.tz, c.tx - b.tx);
      let d = Math.abs(h2 - h1);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > worst) worst = d;
    }
    return worst;
  };
  // damp until the sharpest corner is inside the band (8 tries is plenty —
  // ×0.72 each pass takes any legal starting amplitude to nearly nothing)
  for (let guard = 0; guard < 8; guard++) {
    if (sharpest(ptWith(bendWith(a2, a3)), 12) <= MAX_CORNER) break;
    a2 *= 0.72; a3 *= 0.72;
  }

  /** the centreline radius multiplier at angle θ */
  const bend = bendWith(a2, a3);
  const ptAt = ptWith(bend);

  // CARVE THE RIBBON along the centreline instead of testing an ellipse: a bent
  // ring has no closed-form inside/outside, and a round brush walked along the
  // curve gives a constant-width track through every bend for free.
  const SAMPLES = 220;
  const halfTiles = half;
  const reach = (halfTiles + 0.5) * (halfTiles + 0.5);
  for (let i = 0; i < SAMPLES; i++) {
    const { tx, tz } = ptAt((2 * Math.PI * i) / SAMPLES);
    const bx = Math.round(tx), bz = Math.round(tz);
    for (let oz = -halfTiles; oz <= halfTiles; oz++) {
      for (let ox = -halfTiles; ox <= halfTiles; ox++) {
        if (ox * ox + oz * oz > reach) continue; // round brush
        const gx = bx + ox, gz = bz + oz;
        if (gx < 1 || gx >= GRID - 1 || gz < 1 || gz >= GRID - 1) continue;
        grid[gz * GRID + gx] = T_OPEN;
        surface[gz * GRID + gx] = S_PLATE; // a paved ribbon reads as a track
      }
    }
  }

  const P = (tx: number, tz: number): Vec3 => ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });
  // ordered ring of gates on the centreline; gate 0 = start/finish. theta runs
  // 0→2π so the loop keeps one consistent direction (counter-clockwise).
  //
  // GATE COUNT FOLLOWS LENGTH. A fixed 12 on a long circuit leaves gaps the AI
  // cuts across; on a short one it crowds them. Measure the ribbon, then lay a
  // gate roughly every 55 units of it.
  let lapLen = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const a = ptAt((2 * Math.PI * i) / SAMPLES);
    const b = ptAt((2 * Math.PI * (i + 1)) / SAMPLES);
    lapLen += Math.hypot(b.tx - a.tx, b.tz - a.tz) * TILE;
  }
  const N = Math.max(10, Math.min(20, Math.round(lapLen / 55)));
  const checkpoints: RaceTrack['checkpoints'] = [];
  for (let k = 0; k < N; k++) {
    const th = (2 * Math.PI * k) / N;
    const { tx, tz } = ptAt(th);
    checkpoints.push({ pos: P(tx, tz), radius: half * TILE * 0.95 });
  }
  // start grid: behind gate 0 (θ=0, +x side), staggered back along −θ (−z), two
  // columns straddling the racing line. startYaw = tangent at θ=0 = +z.
  // THE GRID SITS ON THE RIBBON, wherever the ribbon happens to be. It used to
  // be laid against the raw ellipse radii; on a bent centreline that puts half
  // the field in the grass, so it is sampled off the same curve as everything
  // else and offset along the LOCAL normal.
  const gridSlots: Vec3[] = [];
  const normalAt = (th: number): { nx: number; nz: number } => {
    const e = 0.02;
    const a = ptAt(th - e), b = ptAt(th + e);
    const tx = b.tx - a.tx, tz = b.tz - a.tz;
    const L = Math.hypot(tx, tz) || 1;
    return { nx: -tz / L, nz: tx / L };      // left of travel
  };
  for (let row = 0; row < 5; row++) {
    for (const lane of [-1, 1]) {
      // 0.05 put same-lane rows under FOUR units apart on a ~30-tile radius —
      // closer than a car is long, so the field spawned inside itself and the
      // flag dropped on a shoving match instead of a race.
      const th = -0.12 * (row + 1);           // staggered back behind the line
      const c = ptAt(th);
      const n = normalAt(th);
      gridSlots.push(P(c.tx + n.nx * lane * 2.0, c.tz + n.nz * lane * 2.0));
    }
  }
  // START HEADING = the tangent where the ribbon actually crosses the line. On
  // the old fixed ellipse this was always +z; bend the ring and a hardcoded
  // heading points the whole field at a wall.
  const s0 = ptAt(-0.01), s1 = ptAt(0.01);
  const startYaw = Math.atan2((s1.tz - s0.tz) * TILE, (s1.tx - s0.tx) * TILE);

  // the procedural oval gets the same two cameras every circuit deserves: the
  // start line, and one across the far side where the pack arrives together.
  // Clamped inside the fence — a camera posted off the edge of the world sees
  // the circuit from outside the map.
  const inWorld = (p: Vec3): Vec3 => ({
    x: Math.max(-WORLD / 2 + 8, Math.min(WORLD / 2 - 8, p.x)), y: 0,
    z: Math.max(-WORLD / 2 + 8, Math.min(WORLD / 2 - 8, p.z)),
  });
  const raceTrack: RaceTrack = {
    checkpoints, width: half * TILE, grid: gridSlots, startYaw,
    // the two cameras every circuit deserves — the start line, and one out on
    // the lap — both pushed off the ribbon along its own normal so they stand
    // BESIDE the track rather than in the middle of it
    cameras: [
      inWorld(P(ptAt(0).tx + normalAt(0).nx * (half + 4), ptAt(0).tz + normalAt(0).nz * (half + 4))),
      inWorld(P(
        ptAt(Math.PI * 0.6).tx + normalAt(Math.PI * 0.6).nx * (half + 4),
        ptAt(Math.PI * 0.6).tz + normalAt(Math.PI * 0.6).nz * (half + 4),
      )),
    ],
  };

  // a couple of decorative barrier stubs in the infield so it doesn't read as a
  // flat disc (purely cosmetic; the ring is already sealed)
  void rng;

  return {
    seed, theme, geometry: { ...LEGACY_GEOMETRY }, grid, grid2, surface,
    basePos: [checkpoints[0].pos, checkpoints[6].pos],
    spawns: [gridSlots, gridSlots],
    flagPos: [checkpoints[0].pos, checkpoints[6].pos],
    hillPos: P(cx, cz),
    controlPoints: checkpoints.map((c, i) => ({ name: `CP${i}`, pos: c.pos })),
    vehiclePads: [], pickups: [], props: [], zombieSpawns: [],
    houses: [], gates: [], pads: [], propCovered: [], raceTrack,
  };
}

/** THE BUILT CIRCUIT — carve a creator's track (the Track Builder's parts box)
 *  into a real, raceable GameMap. This is the missing bridge from `BuiltTrack`
 *  (pure data) to a drivable ring: the route is carved as an open corridor
 *  through a sealed field, each piece paved with its own surface, and the
 *  checkpoints + start grid come off the same centre-line the editor drew. The
 *  payoff: ramp pieces author real TERRAIN HEIGHT (with the graded-ramp flag),
 *  so a built track is the FIRST generated map that isn't dead flat. Fully
 *  deterministic from the track — same track, same map, on every machine, which
 *  is what lets a lap RECORD set on a built track mean something. */
export function buildTrackMap(track: BuiltTrack, theme: ThemeId = 'savanna'): GameMap {
  const grid = new Uint8Array(GRID * GRID).fill(T_WALL); // sealed; carve the route
  const grid2 = new Uint8Array(GRID * GRID);
  const surface = new Uint8Array(GRID * GRID);
  const height = new Uint8Array(GRID * GRID);
  const ramp = new Uint8Array(GRID * GRID);
  const baseSurf = theme === 'savanna' ? S_GRASS : theme === 'starship' ? S_PLATE
    : theme === 'titan' ? S_GRIT : theme === 'europa' ? S_WET : theme === 'triton' ? S_ICE : S_DIRT;
  surface.fill(baseSurf);

  const SURF_FOR: Record<Pavement, number> = { paved: S_PLATE, dirt: S_DIRT, ice: S_ICE };
  // world→tile (inverse of P below); the track is authored in world units.
  const tileX = (x: number) => Math.round((x + WORLD / 2) / TILE - 0.5);
  const tileZ = (z: number) => Math.round((z + WORLD / 2) / TILE - 0.5);
  // TERRAIN_U = [0, 4, 16]: map an accumulated rise to a level the engine draws.
  const levelFor = (y: number): number => (y <= 2 ? 0 : y <= 10 ? 1 : 2);
  let elevated = false;

  /** Stamp an open corridor A→B, `halfW` wide, paved `surf`, rising y0→y1.
   *  `graded` marks the tiles drivable-between-levels (a ramp, not a cliff). */
  const carve = (ax: number, az: number, bx: number, bz: number, halfW: number,
    surf: number, y0: number, y1: number, graded: boolean) => {
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const steps = Math.max(1, Math.ceil(len / (TILE * 0.5)));
    const halfTiles = Math.max(1, Math.round(halfW / TILE));
    const reach = (halfTiles + 0.5) * (halfTiles + 0.5);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const lvl = levelFor(y0 + (y1 - y0) * t);
      const cx = tileX(px), cz = tileZ(pz);
      for (let oz = -halfTiles; oz <= halfTiles; oz++) {
        for (let ox = -halfTiles; ox <= halfTiles; ox++) {
          if (ox * ox + oz * oz > reach) continue; // round brush
          const gx = cx + ox, gz = cz + oz;
          if (gx < 1 || gx >= GRID - 1 || gz < 1 || gz >= GRID - 1) continue;
          const gi = gz * GRID + gx;
          grid[gi] = T_OPEN;
          surface[gi] = surf;
          height[gi] = lvl;
          if (lvl > 0) elevated = true;
          if (graded) ramp[gi] = 1;
        }
      }
    }
  };

  /** Open a round patch — used to knock the square off a corner. */
  const stampDisc = (cx0: number, cz0: number, r: number, surf: number, lvl: number): void => {
    const cx = tileX(cx0), cz = tileZ(cz0);
    const rt = Math.max(1, Math.round(r / TILE));
    for (let oz = -rt; oz <= rt; oz++) {
      for (let ox = -rt; ox <= rt; ox++) {
        if (ox * ox + oz * oz > (rt + 0.5) * (rt + 0.5)) continue;
        const gx = cx + ox, gz = cz + oz;
        if (gx < 1 || gx >= GRID - 1 || gz < 1 || gz >= GRID - 1) continue;
        const gi = gz * GRID + gx;
        grid[gi] = T_OPEN;
        surface[gi] = surf;
        height[gi] = lvl;
      }
    }
  };

  const nodes = walkTrack(track);
  for (const n of nodes) {
    const shape = PIECE_SHAPE[n.piece.kind] ?? PIECE_SHAPE.straight;
    const ex = n.pos.x + Math.cos(n.yaw) * shape.run;
    const ez = n.pos.z + Math.sin(n.yaw) * shape.run;
    const graded = n.piece.kind === 'ramp_up' || n.piece.kind === 'ramp_down';
    const halfW = n.piece.width / 2;
    const surf = SURF_FOR[n.piece.surface];
    if (n.piece.kind === 'jump') {
      // THE JUMP IS A LIP, NOT A FLAT RUN. It used to carve like a straight, so
      // the one piece in the box whose whole job is airtime did nothing at all.
      // Build it in two halves: a GRADED climb to the lip, then the far side
      // dropped back to the ground with NO ramp flag — so the lip is a step you
      // fly off, not a slope you roll down. Landing is then the shock model's
      // problem, which is exactly Robert's "land in a realistic way".
      const lipX = n.pos.x + (ex - n.pos.x) * 0.55;
      const lipZ = n.pos.z + (ez - n.pos.z) * 0.55;
      carve(n.pos.x, n.pos.z, lipX, lipZ, halfW, surf, n.pos.y, n.pos.y + 4, true);
      carve(lipX, lipZ, ex, ez, halfW, surf, n.pos.y, n.pos.y, false);
    } else {
      carve(n.pos.x, n.pos.z, ex, ez, halfW, surf, n.pos.y, n.pos.y + shape.rise * 4, graded);
    }
    // ROUND THE CORNER. The centre line is a polyline, so a curve piece is a
    // straight run that then kinks — and a kink carves a SQUARE wall on the
    // outside of the turn. A car arriving at speed drives into it and the race
    // strands. Open a disc at the vertex so the corner is something you can
    // actually swing through.
    if (Math.abs(shape.turn) > 0.01) {
      stampDisc(ex, ez, halfW * (1 + Math.min(1, Math.abs(shape.turn))),
        surf, levelFor(n.pos.y + shape.rise * 4));
    }
  }

  const checkpoints = checkpointsFor(track);

  // ── the start grid: behind the line, snapped onto carved corridor ──────────
  const tileOpen = (x: number, z: number): boolean => {
    const tx = tileX(x), tz = tileZ(z);
    return tx >= 0 && tx < GRID && tz >= 0 && tz < GRID && grid[tz * GRID + tx] === T_OPEN;
  };
  const snapToOpen = (p: Vec3): Vec3 => {
    if (tileOpen(p.x, p.z)) return p;
    const dx = track.start.x - p.x, dz = track.start.z - p.z, d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;
    for (let s = 1; s <= Math.ceil(d / TILE) + 2; s++) {
      const q = { x: p.x + ux * s * TILE, y: p.y, z: p.z + uz * s * TILE };
      if (tileOpen(q.x, q.z)) return q;
    }
    return { x: track.start.x, y: p.y, z: track.start.z };
  };
  // THE GRID GOES BACK DOWN THE ROAD, not backwards off `startYaw`.
  //
  // Laying it along −startYaw assumes the circuit ARRIVES at the line running
  // the same way the first piece leaves it. On any track that closes through a
  // corner it does not: the starter oval comes into the line heading −z while
  // its first piece runs +x, so all ten slots landed in sealed ground, snapped
  // onto the start point, and spawned the whole field in a 2×6 pile that shoved
  // itself off the racing line. Four or five cars never completed a lap.
  //
  // So: walk the centre line BACKWARDS from the line and drop the rows on it.
  // Whatever shape the circuit is, the grid lands on real road, correctly
  // staggered, facing the way the cars are actually travelling.
  const loop: Vec3[] = [...nodes.map((n) => ({ ...n.pos })), { ...track.start }];
  const backFrom = (dist: number): { pos: Vec3; yaw: number } => {
    let left = dist;
    for (let i = loop.length - 1; i > 0; i--) {
      const a = loop[i - 1], b = loop[i];
      const seg = Math.hypot(b.x - a.x, b.z - a.z);
      if (seg <= 1e-6) continue;
      const yaw = Math.atan2(b.z - a.z, b.x - a.x);
      if (left <= seg) {
        const f = 1 - left / seg;
        return { pos: { x: a.x + (b.x - a.x) * f, y: 0, z: a.z + (b.z - a.z) * f }, yaw };
      }
      left -= seg;
    }
    const a = loop[0], b = loop[1] ?? loop[0];
    return { pos: { ...a }, yaw: Math.atan2(b.z - a.z, b.x - a.x) };
  };
  const gridSlots: Vec3[] = [];
  for (let row = 0; row < 5; row++) {
    // a clear car-length between rows (the procedural grid's 3.76u overlapped
    // hulls) — but not so far back that the last row is laid into the previous
    // corner, which strands the long hulls before the flag drops
    const at = backFrom(7 + row * 6);
    const side = { x: -Math.sin(at.yaw), z: Math.cos(at.yaw) };
    for (const lane of [-1, 1]) {
      gridSlots.push(snapToOpen({
        x: at.pos.x + side.x * lane * 3, y: 0,
        z: at.pos.z + side.z * lane * 3,
      }));
    }
  }

  const avgW = track.pieces.reduce((a, p) => a + p.width, 0) / Math.max(1, track.pieces.length);
  // the field faces the way it is TRAVELLING at the line (the approach), which
  // is only the same as the first piece's heading when the start sits on a
  // straight — face `startYaw` on the oval and the whole grid stares at a wall
  const raceTrack: RaceTrack = {
    checkpoints, width: avgW / 2, grid: gridSlots, startYaw: backFrom(2).yaw,
    cameras: camerasFor(track),
  };

  // stable numeric seed from the track id (records/replays stay deterministic)
  let seed = 0;
  for (let i = 0; i < track.id.length; i++) seed = (seed * 31 + track.id.charCodeAt(i)) | 0;
  const mid = checkpoints[Math.floor(checkpoints.length / 2)]?.pos ?? checkpoints[0].pos;

  return {
    seed: seed >>> 0, theme, geometry: { ...LEGACY_GEOMETRY }, grid, grid2, surface,
    // only a track that USES ramps carries height — a flat circuit stays a flat
    // map, byte-identical to every other generated ground (no behaviour change).
    ...(elevated ? { height, ramp } : {}),
    basePos: [checkpoints[0].pos, mid],
    spawns: [gridSlots, gridSlots],
    flagPos: [checkpoints[0].pos, mid],
    hillPos: checkpoints[0].pos,
    controlPoints: checkpoints.map((c, i) => ({ name: `CP${i}`, pos: c.pos })),
    vehiclePads: [], pickups: [], props: [], zombieSpawns: [],
    houses: [], gates: [], pads: [], propCovered: [], raceTrack,
  };
}

export function generateMap(seed: number, mode: ModeId, theme: ThemeId = 'savanna'): GameMap {
  if (mode === 'safehouse') return generateNeighborhood(seed);
  if (mode === 'paintball') return generatePaintballField(seed, theme);
  // DERBY carves the same ring. It used to fall through to a battlefield map,
  // which has no `raceTrack` and therefore NO START GRID — so a demolition
  // deploy seated nobody, `stepDerby` counted zero live hulls and ended the
  // match at ~4.6 s with no winner. An advertised discipline, dead on arrival.
  if (mode === 'race' || mode === 'timetrial' || mode === 'derby') return generateRaceTrack(seed, theme);
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
    'strikejet', 'interceptor', 'bomber', 'aatrack', 'attackheli', 'transportheli'];
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
      [fwd * 14, -30], [fwd * 14, -35],  // open-air Shrike and Condor helipads
    ];
    padKinds.forEach((kind, i) => {
      const [ox, oz] = padOffsets[i];
      // aircraft get a wider clear — a hangar's canopy needs the whole yard
      const fixedWing = kind === 'strikejet' || kind === 'interceptor' || kind === 'bomber';
      const aircraft = fixedWing || kind === 'attackheli' || kind === 'transportheli';
      clearArea(grid, btx + ox, btz + oz, aircraft ? 4 : 3); // a yard the hull can pull out of
      const at = tileToWorld(btx + ox, btz + oz);
      vehiclePads.push({ kind, team: side as Team, pos: at });
      // A1: every airframe sleeps in its own building — the bomber's is
      // taller and wider because the bomber is. Open face toward the front,
      // which is also the direction the runway leaves.
      if (fixedWing) {
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
  return { seed, theme, geometry: { ...LEGACY_GEOMETRY }, grid, grid2, surface, basePos, spawns, flagPos, hillPos, controlPoints, vehiclePads, pickups, props: outdoorProps, zombieSpawns, houses, gates, pads, propCovered: settleClaims(grid, claims, outdoorProps) };
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
    seed, theme: 'savanna', geometry: { ...LEGACY_GEOMETRY }, grid, grid2, surface, basePos, spawns,
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
