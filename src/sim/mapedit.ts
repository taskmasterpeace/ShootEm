// ---------------------------------------------------------------------------
// THE MAP MAKER ENGINE — the editing core behind the harness's Map Maker tab.
// Pure sim code (no DOM): the same laws the suite enforces on shipped fronts
// run here LIVE on the document being edited, so a map that passes the maker
// passes the tests.
//
// The document model: a deep-cloned GameMap plus the authoring metadata the
// grid alone doesn't carry (claims, front/size/seed provenance, undo stack).
// Every op mutates the doc and settles claims the way fronts.ts does — a
// claim lives and dies with its prop.
// ---------------------------------------------------------------------------
import {
  houseAt,
  T_OPEN, T_WALL, T_COVER, T_WATER, T_DEEP, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL, T_LADDER, T_CLIMB,
  T_THIN_WALL_H, T_THIN_WALL_V, T_THIN_DOOR_H, T_THIN_DOOR_V, T_WINDOW_H, T_WINDOW_V,
  T_STAIRS_N, T_STAIRS_E, T_STAIRS_S, T_STAIRS_W, T_SECTION_SHUTTER,
  type BuildingMapMeta, type GameMap, type GeospatialMapMeta, type PropSpec, type PickupSpawn, type VehiclePad, type House, type TileClaim,
} from './map';
import { ensureUpperFloor } from './map-layers';
import { buildingAuthoringLayoutFromMap, validateWholeBuilding } from './building-navigation';
import { BUILDINGS, stampBuilding, type BuildingDef, type StampCtx } from './buildings';
import { FRONT_STENCILS, frontWalkable, generateFront, boxFor, type MapSize } from './fronts';
import { generateSkirmishMap } from './skirmish';
import { Rng } from './rng';
import type { Team, ThemeId, VehicleKind, Vec3 } from './types';
import { generateTheater } from './theaters';
import type { TheaterId } from './theater-types';
import {
  LEGACY_GEOMETRY, geometryLength, tileIndex,
  tileToWorld as geometryTileToWorld, validateGeometry,
  worldToTile as geometryWorldToTile,
  type MapGeometry,
} from './map-geometry';

// ---------------------------------------------------------------------------
// the document
// ---------------------------------------------------------------------------
export interface MakerDoc {
  frontId: string | null;   // provenance — null when built from a blank slab
  size: MapSize;
  seed: number;
  mode: string;             // the mode it will deploy as (display only)
  map: GameMap;
  claims: TileClaim[];
  rng: Rng;                 // deterministic stamping stream (crate rotations)
  undoStack: string[];      // serialized snapshots, oldest → newest
  redoStack: string[];
}

const tileToWorld = (map: GameMap, tx: number, tz: number): Vec3 =>
  geometryTileToWorld(map.geometry, tx, tz);
const worldToTile = (map: GameMap, x: number, z: number): [number, number] =>
  geometryWorldToTile(map.geometry, x, z);

function cloneMap(m: GameMap): GameMap {
  const upperLayers = m.upperLayers?.map((layer) => layer.slice());
  const grid2 = upperLayers?.[0] ?? m.grid2.slice();
  if (upperLayers) upperLayers[0] = grid2;
  return {
    seed: m.seed, theme: m.theme, geometry: { ...m.geometry },
    grid: m.grid.slice(), grid2, surface: m.surface.slice(),
    ...(upperLayers ? { upperLayers } : {}),
    ...(m.height ? { height: m.height.slice() } : {}),
    ...(m.ramp ? { ramp: m.ramp.slice() } : {}),
    ...(m.buildingMeta ? { buildingMeta: structuredClone(m.buildingMeta) } : {}),
    ...(m.geospatial ? {
      geospatial: {
        ...structuredClone(m.geospatial),
        classification: m.geospatial.classification.slice(),
        buildingHeight: m.geospatial.buildingHeight.slice(),
      },
    } : {}),
    basePos: [{ ...m.basePos[0] }, { ...m.basePos[1] }],
    spawns: [m.spawns[0].map((s) => ({ ...s })), m.spawns[1].map((s) => ({ ...s }))],
    flagPos: [{ ...m.flagPos[0] }, { ...m.flagPos[1] }],
    hillPos: { ...m.hillPos },
    controlPoints: m.controlPoints.map((c) => ({ name: c.name, pos: { ...c.pos } })),
    vehiclePads: m.vehiclePads.map((v) => ({ ...v, pos: { ...v.pos } })),
    pickups: m.pickups.map((p) => ({ ...p, pos: { ...p.pos } })),
    props: m.props.map((p) => ({ ...p, pos: { ...p.pos } })),
    zombieSpawns: m.zombieSpawns.map((z) => ({ ...z })),
    houses: m.houses.map((h) => ({ ...h, center: { ...h.center }, door: { ...h.door }, maskRows: h.maskRows?.slice() })),
    gates: m.gates.map((g) => ({ a: { ...g.a }, b: { ...g.b } })),
    pads: m.pads.map((p) => ({ pos: { ...p.pos }, dir: { ...p.dir } })),
    propCovered: m.propCovered.slice(),
    operation: m.operation ? {
      ...m.operation,
      objectives: m.operation.objectives.map((objective) => ({ ...objective, pos: { ...objective.pos } })),
      protectedZones: m.operation.protectedZones.map((zone) => ({ ...zone, pos: { ...zone.pos } })),
    } : undefined,
    theater: m.theater ? {
      ...m.theater,
      domains: [...m.theater.domains],
      routes: m.theater.routes.map((route) => ({ ...route, points: route.points.map((point) => ({ ...point })) })),
      landingZones: m.theater.landingZones.map((zone) => ({ ...zone, pos: { ...zone.pos } })),
      deepWater: [...m.theater.deepWater],
    } : undefined,
  };
}

/** settle claims the fronts.ts way: a claim survives iff the grid still
 *  holds its tile value (a later edit overwrote it → the promise is dead). */
function settleClaims(grid: Uint8Array, claims: TileClaim[]): number[] {
  return [...new Set(claims.filter((c) => grid[c.idx] === c.t).map((c) => c.idx))];
}

/** Load a front at a tier into an editable document. */
export function loadFront(frontId: string, seed: number, size: MapSize): MakerDoc {
  const map = generateFront(frontId, seed, size);
  if (!map) throw new Error(`mapedit: unknown front '${frontId}'`);
  return {
    frontId, size, seed, mode: 'tdm',
    map: cloneMap(map),
    claims: map.propCovered.map((idx) => ({ idx, t: map.grid[idx] })),
    rng: new Rng(seed ^ 0x5eed),
    undoStack: [], redoStack: [],
  };
}

/** Load a procedural SKIRMISH roll — a biome hunt ground as an editable doc. */
export function loadSkirmish(theme: ThemeId, seed: number): MakerDoc {
  const map = generateSkirmishMap(theme, seed);
  return {
    frontId: null, size: 'small', seed, mode: 'tdm',
    map: cloneMap(map),
    claims: map.propCovered.map((idx) => ({ idx, t: map.grid[idx] })),
    rng: new Rng(seed ^ 0x5eed),
    undoStack: [], redoStack: [],
  };
}

/** A blank battlefield: sealed rim, open box interior, two bare bases. */
export function blankDoc(size: MapSize, seed: number, theme: GameMap['theme'] = 'savanna'): MakerDoc {
  const box = boxFor(size);
  const geometry = { ...LEGACY_GEOMETRY };
  const grid = new Uint8Array(geometryLength(geometry));
  const grid2 = new Uint8Array(geometryLength(geometry));
  const surface = new Uint8Array(geometryLength(geometry)).fill(1); // S_GRASS
  for (let z = 0; z < geometry.rows; z++) for (let x = 0; x < geometry.cols; x++) {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) grid[tileIndex(geometry, x, z)] = T_WALL;
  }
  const mid = Math.floor((box.z0 + box.z1) / 2);
  const bx0 = box.x0 + 10, bx1 = box.x1 - 9;
  const ring = (cx: number, cz: number): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push(geometryTileToWorld(geometry, cx + Math.round(Math.cos(a) * 3), cz + Math.round(Math.sin(a) * 3)));
    }
    return out;
  };
  const map: GameMap = {
    seed, theme, geometry, grid, grid2, surface,
    basePos: [geometryTileToWorld(geometry, bx0, mid), geometryTileToWorld(geometry, bx1, mid)],
    spawns: [ring(bx0, mid), ring(bx1, mid)],
    flagPos: [geometryTileToWorld(geometry, bx0, mid), geometryTileToWorld(geometry, bx1, mid)],
    hillPos: geometryTileToWorld(geometry, 50, 50),
    controlPoints: [
      { name: 'A', pos: geometryTileToWorld(geometry, box.x0 + 20, mid) },
      { name: 'B', pos: geometryTileToWorld(geometry, 50, 50) },
      { name: 'C', pos: geometryTileToWorld(geometry, box.x1 - 19, mid) },
    ],
    vehiclePads: [], pickups: [], props: [], zombieSpawns: [], houses: [],
    gates: [], pads: [], propCovered: [],
  };
  return { frontId: null, size, seed, mode: 'tdm', map, claims: [], rng: new Rng(seed ^ 0x5eed), undoStack: [], redoStack: [] };
}

/** Load one of the six vehicle-scale theaters as a fully editable document. */
export function loadTheater(theaterId: TheaterId, seed: number): MakerDoc {
  const map = generateTheater(theaterId, seed);
  return {
    frontId: `theater:${theaterId}`, size: 'large', seed, mode: 'operation',
    map: cloneMap(map),
    claims: map.propCovered.map((idx) => ({ idx, t: map.grid[idx] })),
    rng: new Rng(seed ^ 0x5eed),
    undoStack: [], redoStack: [],
  };
}

/** A geometry-sized blank theater: sealed one-tile rim and open interior. */
export function blankGeometryDoc(
  geometry: MapGeometry,
  seed: number,
  theme: GameMap['theme'] = 'savanna',
): MakerDoc {
  const g = { ...geometry };
  validateGeometry(g);
  const grid = new Uint8Array(geometryLength(g));
  const grid2 = new Uint8Array(geometryLength(g));
  const surface = new Uint8Array(geometryLength(g)).fill(1);
  for (let z = 0; z < g.rows; z++) for (let x = 0; x < g.cols; x++) {
    if (x === 0 || z === 0 || x === g.cols - 1 || z === g.rows - 1) grid[tileIndex(g, x, z)] = T_WALL;
  }
  const midX = Math.floor(g.cols / 2);
  const midZ = Math.floor(g.rows / 2);
  const bx0 = 10;
  const bx1 = g.cols - 11;
  const ring = (cx: number, cz: number): Vec3[] => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return geometryTileToWorld(g, cx + Math.round(Math.cos(a) * 3), cz + Math.round(Math.sin(a) * 3));
  });
  const base0 = geometryTileToWorld(g, bx0, midZ);
  const base1 = geometryTileToWorld(g, bx1, midZ);
  const center = geometryTileToWorld(g, midX, midZ);
  const map: GameMap = {
    seed, theme, geometry: g, grid, grid2, surface,
    basePos: [base0, base1], spawns: [ring(bx0, midZ), ring(bx1, midZ)],
    flagPos: [{ ...base0 }, { ...base1 }], hillPos: center,
    controlPoints: [
      { name: 'A', pos: geometryTileToWorld(g, Math.floor(g.cols * 0.3), midZ) },
      { name: 'B', pos: center },
      { name: 'C', pos: geometryTileToWorld(g, Math.floor(g.cols * 0.7), midZ) },
    ],
    vehiclePads: [], pickups: [], props: [], zombieSpawns: [], houses: [],
    gates: [], pads: [], propCovered: [],
  };
  return { frontId: null, size: 'large', seed, mode: 'tdm', map, claims: [], rng: new Rng(seed ^ 0x5eed), undoStack: [], redoStack: [] };
}

// ---------------------------------------------------------------------------
// undo / redo — full-doc snapshots (a dev tool can afford them)
// ---------------------------------------------------------------------------
interface MapJSONBase {
  frontId: string | null; size: MapSize; seed: number;
  /** v1 documents omit geometry and always migrate to the legacy grid. */
  geometry?: MapGeometry;
  grid: number[]; grid2: number[]; surface: number[];
  basePos: [Vec3, Vec3]; spawns: [Vec3[], Vec3[]]; flagPos: [Vec3, Vec3];
  hillPos: Vec3; controlPoints: { name: string; pos: Vec3 }[];
  vehiclePads: VehiclePad[]; pickups: PickupSpawn[]; props: PropSpec[];
  zombieSpawns: Vec3[]; houses: House[]; theme: GameMap['theme'];
  operation?: GameMap['operation'];
  theater?: GameMap['theater'];
  claims: TileClaim[];
}

export interface MapJSONV1 extends MapJSONBase { v: 1 }
export interface MapJSONV2 extends MapJSONBase {
  v: 2;
  upperLayers: number[][];
  buildingMeta?: BuildingMapMeta;
  geospatial?: Omit<GeospatialMapMeta, 'classification' | 'buildingHeight'> & {
    classification: number[];
    buildingHeight: number[];
  };
  height?: number[];
  ramp?: number[];
}
export type MapJSON = MapJSONV1 | MapJSONV2;

export function serializeDoc(doc: MakerDoc): MapJSONV2 {
  const m = doc.map;
  return {
    v: 2, frontId: doc.frontId, size: doc.size, seed: doc.seed,
    geometry: { ...m.geometry },
    grid: [...m.grid], grid2: [...m.grid2], surface: [...m.surface],
    upperLayers: (m.upperLayers ?? [m.grid2]).map((layer) => [...layer]),
    ...(m.buildingMeta ? { buildingMeta: structuredClone(m.buildingMeta) } : {}),
    ...(m.geospatial ? {
      geospatial: {
        ...structuredClone(m.geospatial),
        classification: [...m.geospatial.classification],
        buildingHeight: [...m.geospatial.buildingHeight],
      },
    } : {}),
    ...(m.height ? { height: [...m.height] } : {}),
    ...(m.ramp ? { ramp: [...m.ramp] } : {}),
    basePos: m.basePos, spawns: m.spawns, flagPos: m.flagPos, hillPos: m.hillPos,
    controlPoints: m.controlPoints, vehiclePads: m.vehiclePads, pickups: m.pickups,
    props: m.props, zombieSpawns: m.zombieSpawns, houses: m.houses, theme: m.theme,
    operation: m.operation,
    theater: m.theater,
    claims: doc.claims,
  };
}

export function deserializeDoc(json: MapJSON): MakerDoc {
  if (json.v !== 1 && json.v !== 2) throw new Error(`mapedit: can't read doc version ${(json as { v?: number }).v}`);
  const geometry = json.geometry ? { ...json.geometry } : { ...LEGACY_GEOMETRY };
  const grid = Uint8Array.from(json.grid);
  const upperLayers = json.v === 2 ? json.upperLayers.map((layer) => Uint8Array.from(layer)) : undefined;
  const grid2 = upperLayers?.[0] ?? Uint8Array.from(json.grid2);
  if (upperLayers) upperLayers[0] = grid2;
  const surface = Uint8Array.from(json.surface);
  const height = json.v === 2 && json.height ? Uint8Array.from(json.height) : undefined;
  const ramp = json.v === 2 && json.ramp ? Uint8Array.from(json.ramp) : undefined;
  validateGeometry(geometry, grid, grid2, surface, ...(upperLayers ?? []), ...(height ? [height] : []), ...(ramp ? [ramp] : []));
  const map: GameMap = {
    seed: json.seed, theme: json.theme, geometry,
    grid, grid2, surface,
    ...(upperLayers ? { upperLayers } : {}),
    ...(json.v === 2 && json.buildingMeta ? { buildingMeta: structuredClone(json.buildingMeta) } : {}),
    ...(json.v === 2 && json.geospatial ? {
      geospatial: {
        ...structuredClone(json.geospatial),
        classification: Uint8Array.from(json.geospatial.classification),
        buildingHeight: Uint8Array.from(json.geospatial.buildingHeight),
      },
    } : {}),
    ...(height ? { height } : {}),
    ...(ramp ? { ramp } : {}),
    basePos: json.basePos, spawns: json.spawns, flagPos: json.flagPos, hillPos: json.hillPos,
    controlPoints: json.controlPoints, vehiclePads: json.vehiclePads, pickups: json.pickups,
    props: json.props, zombieSpawns: json.zombieSpawns, houses: json.houses,
    gates: [], pads: [], propCovered: settleClaims(grid, json.claims),
    operation: json.operation,
    theater: json.theater,
  };
  return {
    frontId: json.frontId, size: json.size, seed: json.seed, mode: 'tdm',
    map, claims: json.claims.map((c) => ({ ...c })), rng: new Rng(json.seed ^ 0x5eed),
    undoStack: [], redoStack: [],
  };
}

const UNDO_CAP = 40;
function pushUndo(doc: MakerDoc) {
  doc.undoStack.push(JSON.stringify(serializeDoc(doc)));
  if (doc.undoStack.length > UNDO_CAP) doc.undoStack.shift();
  doc.redoStack = [];
}
export function undo(doc: MakerDoc): boolean {
  const prev = doc.undoStack.pop();
  if (!prev) return false;
  doc.redoStack.push(JSON.stringify(serializeDoc(doc)));
  const fresh = deserializeDoc(JSON.parse(prev) as MapJSON);
  applyDoc(doc, fresh);
  return true;
}
export function redo(doc: MakerDoc): boolean {
  const next = doc.redoStack.pop();
  if (!next) return false;
  doc.undoStack.push(JSON.stringify(serializeDoc(doc)));
  const fresh = deserializeDoc(JSON.parse(next) as MapJSON);
  applyDoc(doc, fresh);
  return true;
}
function applyDoc(doc: MakerDoc, fresh: MakerDoc) {
  doc.map = fresh.map;
  doc.claims = fresh.claims;
  doc.frontId = fresh.frontId;
  doc.size = fresh.size;
  doc.seed = fresh.seed;
}

// ---------------------------------------------------------------------------
// the ops
// ---------------------------------------------------------------------------

/** drop any claims whose tile the op is about to rewrite, then settle. */
function afterGridWrite(doc: MakerDoc, idxs: number[]) {
  const dead = new Set(idxs);
  doc.claims = doc.claims.filter((c) => !dead.has(c.idx) || doc.map.grid[c.idx] === c.t);
  doc.map.propCovered = settleClaims(doc.map.grid, doc.claims);
}

/** paint terrain with a square brush, centered. Painting over a prop-claimed
 *  tile kills the claim (the prop mesh itself is NOT removed — erase props
 *  with the eraser first, or accept a ghost mesh). */
export function paintTile(doc: MakerDoc, tx: number, tz: number, tile: number, brush = 1) {
  pushUndo(doc);
  const { cols, rows } = doc.map.geometry;
  const r = Math.floor(brush / 2);
  const idxs: number[] = [];
  for (let z = tz - r; z <= tz + r; z++) for (let x = tx - r; x <= tx + r; x++) {
    if (x < 1 || z < 1 || x >= cols - 1 || z >= rows - 1) continue;
    const idx = tileIndex(doc.map.geometry, x, z);
    doc.map.grid[idx] = tile;
    idxs.push(idx);
  }
  afterGridWrite(doc, idxs);
}

/** Paint an indexed upper storey. This is deliberately separate from ground
 * terrain painting: upper values are F2_* architecture codes, not T_* land. */
export function paintFloorTile(doc: MakerDoc, floor: 1 | 2, tx: number, tz: number, tile: number, brush = 1) {
  pushUndo(doc);
  const layer = ensureUpperFloor(doc.map, floor);
  const { cols, rows } = doc.map.geometry;
  const r = Math.floor(brush / 2);
  for (let z = tz - r; z <= tz + r; z++) for (let x = tx - r; x <= tx + r; x++) {
    if (x < 1 || z < 1 || x >= cols - 1 || z >= rows - 1) continue;
    layer[tileIndex(doc.map.geometry, x, z)] = tile;
  }
}

/** paint the SURFACE layer (movement/sound/paint), same brush model. */
export function paintSurface(doc: MakerDoc, tx: number, tz: number, surf: number, brush = 1) {
  pushUndo(doc);
  const { cols, rows } = doc.map.geometry;
  const r = Math.floor(brush / 2);
  for (let z = tz - r; z <= tz + r; z++) for (let x = tx - r; x <= tx + r; x++) {
    if (x < 1 || z < 1 || x >= cols - 1 || z >= rows - 1) continue;
    doc.map.surface[tileIndex(doc.map.geometry, x, z)] = surf;
  }
}

/** place a prop; if it blocks (rock/tree/silo/stack/crate/wreck), claim the
 *  tile so collision and mesh stay married (the invisible-wall law). */
export function placeProp(doc: MakerDoc, type: PropSpec['type'], tx: number, tz: number, scale = 1, rot = 0) {
  pushUndo(doc);
  const idx = tileIndex(doc.map.geometry, tx, tz);
  doc.map.props.push({ type, pos: tileToWorld(doc.map, tx, tz), scale, rot });
  const blocks: Partial<Record<PropSpec['type'], number>> = {
    rock: T_WALL, tree: T_WALL, silo: T_WALL, flare_stack: T_WALL, crate: T_COVER, wreck: T_COVER, memorial: T_WALL,
  };
  const t = blocks[type];
  if (t !== undefined) {
    doc.map.grid[idx] = t;
    doc.claims.push({ idx, t });
    afterGridWrite(doc, []);
  }
}

/** remove the nearest prop within the hit radius of a tile, opening its tile. */
export function erasePropAt(doc: MakerDoc, tx: number, tz: number): boolean {
  const w = tileToWorld(doc.map, tx, tz);
  let best = -1, bestD = Infinity;
  for (let i = 0; i < doc.map.props.length; i++) {
    const p = doc.map.props[i];
    const d = Math.hypot(p.pos.x - w.x, p.pos.z - w.z) - p.scale * 1.2;
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0 || bestD > 2.2) return false;
  pushUndo(doc);
  doc.map.props.splice(best, 1);
  // its claim dies with it, and the tile opens (map.ts settleClaims semantics)
  for (const c of doc.claims) {
    const center = tileToWorld(doc.map, c.idx % doc.map.geometry.cols, Math.floor(c.idx / doc.map.geometry.cols));
    const cx = center.x;
    const cz = center.z;
    if (Math.hypot(cx - w.x, cz - w.z) < 2.2 + 1) {
      doc.map.grid[c.idx] = T_OPEN;
      doc.claims.splice(doc.claims.indexOf(c), 1);
    }
  }
  doc.map.propCovered = settleClaims(doc.map.grid, doc.claims);
  return true;
}

// ---- objects: control points, hill, pickups, pads, mouths, spawns, bases --

export type ObjectRef =
  | { kind: 'cp'; index: number }
  | { kind: 'hill' }
  | { kind: 'pickup'; index: number }
  | { kind: 'pad'; index: number }
  | { kind: 'mouth'; index: number }
  | { kind: 'base'; team: Team };

/** what object (if any) owns a hit at this world position — nearest wins */
export function pickObject(doc: MakerDoc, x: number, z: number, radius = 2.5): ObjectRef | null {
  const m = doc.map;
  const near = (p: Vec3, r: number) => Math.hypot(p.x - x, p.z - z) <= r;
  for (let i = 0; i < m.controlPoints.length; i++) if (near(m.controlPoints[i].pos, radius)) return { kind: 'cp', index: i };
  if (near(m.hillPos, radius)) return { kind: 'hill' };
  for (let i = 0; i < m.pickups.length; i++) if (near(m.pickups[i].pos, radius)) return { kind: 'pickup', index: i };
  for (let i = 0; i < m.vehiclePads.length; i++) if (near(m.vehiclePads[i].pos, radius + 0.6)) return { kind: 'pad', index: i };
  for (let i = 0; i < m.zombieSpawns.length; i++) if (near(m.zombieSpawns[i], radius)) return { kind: 'mouth', index: i };
  for (const team of [0, 1] as const) if (near(m.basePos[team], radius + 2)) return { kind: 'base', team };
  return null;
}

export function objectPos(doc: MakerDoc, ref: ObjectRef): Vec3 {
  const m = doc.map;
  switch (ref.kind) {
    case 'cp': return m.controlPoints[ref.index].pos;
    case 'hill': return m.hillPos;
    case 'pickup': return m.pickups[ref.index].pos;
    case 'pad': return m.vehiclePads[ref.index].pos;
    case 'mouth': return m.zombieSpawns[ref.index];
    case 'base': return m.basePos[ref.team];
  }
}

/** move an object to a new tile (snap-to-tile-center, clamped inside the rim). */
export function moveObject(doc: MakerDoc, ref: ObjectRef, tx: number, tz: number) {
  tx = Math.max(1, Math.min(doc.map.geometry.cols - 2, tx));
  tz = Math.max(1, Math.min(doc.map.geometry.rows - 2, tz));
  pushUndo(doc);
  const w = tileToWorld(doc.map, tx, tz);
  const m = doc.map;
  switch (ref.kind) {
    case 'cp': m.controlPoints[ref.index].pos = w; break;
    case 'hill': m.hillPos = w; break;
    case 'pickup': m.pickups[ref.index].pos = w; break;
    case 'pad': m.vehiclePads[ref.index].pos = w; break;
    case 'mouth': m.zombieSpawns[ref.index] = w; break;
    case 'base': {
      const [ox, oz] = worldToTile(m, m.basePos[ref.team].x, m.basePos[ref.team].z);
      const dx = tx - ox, dz = tz - oz;
      m.basePos[ref.team] = w;
      m.flagPos[ref.team] = w;
      m.spawns[ref.team] = m.spawns[ref.team].map((s) => {
        const [sx, sz] = worldToTile(m, s.x, s.z);
        return tileToWorld(m, sx + dx, sz + dz);
      });
      break;
    }
  }
}

export function deleteObject(doc: MakerDoc, ref: ObjectRef): boolean {
  const m = doc.map;
  const removable = ref.kind !== 'hill' && ref.kind !== 'base';
  if (!removable) return false;
  pushUndo(doc);
  switch (ref.kind) {
    case 'cp': m.controlPoints.splice(ref.index, 1); break;
    case 'pickup': m.pickups.splice(ref.index, 1); break;
    case 'pad': m.vehiclePads.splice(ref.index, 1); break;
    case 'mouth': m.zombieSpawns.splice(ref.index, 1); break;
  }
  return true;
}

export function addControlPoint(doc: MakerDoc, tx: number, tz: number, name?: string) {
  pushUndo(doc);
  doc.map.controlPoints.push({ name: name ?? String.fromCharCode(65 + doc.map.controlPoints.length), pos: tileToWorld(doc.map, tx, tz) });
}
export function addPickup(doc: MakerDoc, type: PickupSpawn['type'], tx: number, tz: number) {
  pushUndo(doc);
  doc.map.pickups.push({ type, pos: tileToWorld(doc.map, tx, tz) });
}
export function addPad(doc: MakerDoc, kind: VehicleKind, tx: number, tz: number) {
  pushUndo(doc);
  const team: Team = tx < doc.map.geometry.cols / 2 ? 0 : 1;
  doc.map.vehiclePads.push({ kind, team, pos: tileToWorld(doc.map, tx, tz) });
}
export function addMouth(doc: MakerDoc, tx: number, tz: number) {
  pushUndo(doc);
  doc.map.zombieSpawns.push(tileToWorld(doc.map, tx, tz));
}

// ---- buildings ------------------------------------------------------------

/** stamp a library/front stencil into the doc (the stamp registers the house,
 *  the roof, the crates and the loot — atomically deletable via deleteHouse). */
export function stamp(doc: MakerDoc, def: BuildingDef, tx: number, tz: number): boolean {
  pushUndo(doc);
  if (def.floors >= 2) ensureUpperFloor(doc.map, 1);
  if (def.floors >= 3) ensureUpperFloor(doc.map, 2);
  const ctx: StampCtx = {
    geometry: doc.map.geometry,
    grid: doc.map.grid, grid2: doc.map.grid2, upperLayers: doc.map.upperLayers, props: doc.map.props,
    pickups: doc.map.pickups, houses: doc.map.houses, claims: doc.claims, rng: doc.rng,
  };
  const before = doc.map.houses.length;
  const ok = stampBuilding(ctx, def, tx, tz, doc.map.pickups.length);
  if (ok && doc.map.houses.length > before) afterGridWrite(doc, []);
  else doc.undoStack.pop(); // no room — nothing happened, forget the snapshot
  return ok;
}

/** delete a whole building by house index: footprint + apron open, house,
 *  claims, crate props, and floor loot inside all go with it. */
export function deleteHouse(doc: MakerDoc, index: number): boolean {
  const h = doc.map.houses[index];
  if (!h) return false;
  pushUndo(doc);
  const m = doc.map;
  const { cols, rows } = m.geometry;
  for (let z = h.tz - 1; z <= h.tz + h.th; z++) {
    for (let x = h.tx - 1; x <= h.tx + h.tw; x++) {
      if (x < 1 || z < 1 || x >= cols - 1 || z >= rows - 1) continue;
      const idx = tileIndex(m.geometry, x, z);
      m.grid[idx] = T_OPEN;
      m.grid2[idx] = 0;
      for (const layer of m.upperLayers ?? []) layer[idx] = 0;
    }
  }
  const inside = (p: Vec3) => {
    const [px, pz] = worldToTile(m, p.x, p.z);
    return px >= h.tx - 1 && px <= h.tx + h.tw && pz >= h.tz - 1 && pz <= h.tz + h.th;
  };
  m.props = m.props.filter((p) => !inside(p.pos));
  m.pickups = m.pickups.filter((p) => !inside(p.pos));
  doc.claims = doc.claims.filter((c) => {
    const cx = c.idx % cols, cz = Math.floor(c.idx / cols);
    return !(cx >= h.tx - 1 && cx <= h.tx + h.tw && cz >= h.tz - 1 && cz <= h.tz + h.th);
  });
  m.houses.splice(index, 1);
  m.houses.forEach((hh, i) => { hh.id = i; });
  m.propCovered = settleClaims(m.grid, doc.claims);
  return true;
}

// ---------------------------------------------------------------------------
// THE LAWS, LIVE — the same checks tests/fronts.test.ts enforces, returned
// as a structured report the maker panel renders (and jumps to).
// ---------------------------------------------------------------------------
export interface LawIssue { law: string; detail: string; tiles: [number, number][]; floor?: number }
export interface LawReport {
  ok: boolean;
  issues: LawIssue[];
  /** flood-from-base-0 mask (1 = reachable) — the maker paints orphans red */
  seen: Uint8Array;
}

const OUTDOOR_ONLY = new Set(['tree', 'rock', 'wreck', 'silo', 'flare_stack', 'crane', 'memorial']);

export function validateDoc(doc: MakerDoc): LawReport {
  const m = doc.map;
  const { cols, rows } = m.geometry;
  const issues: LawIssue[] = [];
  const seen = flood(m, m.basePos[0]);

  // 1 · SEALED RIM — nobody walks off the world
  const rim: [number, number][] = [];
  for (let i = 0; i < cols; i++) {
    if (frontWalkable(m.grid[i])) rim.push([i, 0]);
    if (frontWalkable(m.grid[(rows - 1) * cols + i])) rim.push([i, rows - 1]);
  }
  for (let i = 0; i < rows; i++) {
    if (frontWalkable(m.grid[i * cols])) rim.push([0, i]);
    if (frontWalkable(m.grid[i * cols + cols - 1])) rim.push([cols - 1, i]);
  }
  if (rim.length) issues.push({ law: 'SEALED RIM', detail: `${rim.length} walkable rim tiles`, tiles: rim.slice(0, 12) });

  // 2 · ZERO ORPHANS — every walkable tile reachable from base 0
  const orphans: [number, number][] = [];
  let orphanCount = 0;
  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    const i = z * cols + x;
    if (frontWalkable(m.grid[i]) && !seen[i]) { if (orphans.length < 12) orphans.push([x, z]); orphanCount++; }
  }
  if (orphanCount) issues.push({ law: 'ZERO ORPHANS', detail: `${orphanCount} sealed walkable tiles`, tiles: orphans });

  // 3 · READABLE — every objective reachable from BOTH bases
  const unreached: string[] = [];
  const unreachedTiles: [number, number][] = [];
  for (const side of [0, 1] as const) {
    const floodSide = side === 0 ? seen : flood(m, m.basePos[side]);
    const check = (p: Vec3, what: string) => {
      const [tx, tz] = worldToTile(m, p.x, p.z);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx, z = tz + dz;
        if (x >= 0 && z >= 0 && x < cols && z < rows && floodSide[z * cols + x]) return;
      }
      unreached.push(`${what} (base ${side})`);
      unreachedTiles.push([tx, tz]);
    };
    check(m.basePos[1 - side], 'enemy base');
    check(m.hillPos, 'the hill');
    m.flagPos.forEach((f, i) => check(f, `flag ${i}`));
    m.controlPoints.forEach((c) => check(c.pos, `CP ${c.name}`));
    m.vehiclePads.forEach((v) => {
      if (v.kind === 'boat') {
        const [tx, tz] = worldToTile(m, v.pos.x, v.pos.z);
        const tile = m.grid[tz * cols + tx];
        if (tile === T_WATER || tile === T_DEEP) return;
      }
      check(v.pos, `${v.kind} pad`);
    });
    m.pickups.forEach((p) => check(p.pos, `${p.type} drop`));
    m.houses.forEach((h, i) => check(h.door, `house ${i} door`));
    m.zombieSpawns.forEach((z2, i) => check(z2, `mouth ${i}`));
    for (const sp of m.spawns[side]) check(sp, 'own spawn ring');
  }
  if (unreached.length) issues.push({ law: 'READABLE', detail: `${unreached.length} objectives unreachable: ${unreached.slice(0, 4).join(' · ')}`, tiles: unreachedTiles.slice(0, 12) });

  // 4 · EVERY BUILDING IS ENTERABLE
  const facades: [number, number][] = [];
  for (const h of m.houses) {
    let inside = false;
    for (let z = h.tz; z < h.tz + h.th && !inside; z++) {
      for (let x = h.tx; x < h.tx + h.tw && !inside; x++) {
        const edge = x === h.tx || z === h.tz || x === h.tx + h.tw - 1 || z === h.tz + h.th - 1;
        if (!edge && seen[z * cols + x] && frontWalkable(m.grid[z * cols + x])) inside = true;
      }
    }
    if (!inside) facades.push([h.tx, h.tz]);
  }
  if (facades.length) issues.push({ law: 'ENTERABLE', detail: `${facades.length} buildings are facades`, tiles: facades });

  // 5 · NOTHING GROWS INDOORS
  const trespassers: [number, number][] = [];
  for (const p of m.props) {
    if (OUTDOOR_ONLY.has(p.type) && houseAt(m.houses, p.pos.x, p.pos.z, m.geometry) >= 0) trespassers.push(worldToTile(m, p.pos.x, p.pos.z));
  }
  if (trespassers.length) issues.push({ law: 'INDOORS', detail: `${trespassers.length} outdoor props inside buildings`, tiles: trespassers });

  // 6 · NO INVISIBLE WALLS — every claimed tile blocks AND has its prop
  const ghost: [number, number][] = [];
  for (const i of m.propCovered) {
    if (frontWalkable(m.grid[i])) { ghost.push([i % cols, Math.floor(i / cols)]); continue; }
    const { x, z } = tileToWorld(m, i % cols, Math.floor(i / cols));
    if (!m.props.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 1.6 + p.scale * 1.2)) ghost.push([i % cols, Math.floor(i / cols)]);
  }
  if (ghost.length) issues.push({ law: 'WALLS', detail: `${ghost.length} claimed tiles with no prop standing on them`, tiles: ghost.slice(0, 12) });

  // Whole-building laws are opt-in through generator provenance. Legacy v1
  // maps keep exactly the six reports above; authored city buildings gain
  // floor-aware structural and content diagnostics.
  const authored = buildingAuthoringLayoutFromMap(m);
  if (authored) {
    const report = validateWholeBuilding(authored.layout);
    for (const buildingIssue of report.issues) {
      issues.push({
        law: buildingIssue.law,
        detail: buildingIssue.detail,
        tiles: buildingIssue.tiles.map((tile) => [tile.x + authored.origin.tx, tile.z + authored.origin.tz]),
        ...(buildingIssue.floor === undefined ? {} : { floor: buildingIssue.floor }),
      });
    }
  }

  return { ok: issues.length === 0, issues, seen };
}

function flood(m: GameMap, from: Vec3): Uint8Array {
  const { cols, rows } = m.geometry;
  const seen = new Uint8Array(geometryLength(m.geometry));
  const [sx, sz] = worldToTile(m, from.x, from.z);
  const q: number[] = [sz * cols + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % cols, z = (i / cols) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
      const ni = nz * cols + nx;
      if (!seen[ni] && frontWalkable(m.grid[ni])) { seen[ni] = 1; q.push(ni); }
    }
  }
  return seen;
}

// ---------------------------------------------------------------------------
// the maker's library — what the palette offers
// ---------------------------------------------------------------------------
export const MAKER_TILES = [
  { id: T_OPEN, name: 'Open', hint: 'clear ground' },
  { id: T_WALL, name: 'Wall', hint: '4u — blocks all' },
  { id: T_COVER, name: 'Cover', hint: '1.2u — vaultable' },
  { id: T_CLIMB, name: 'Climb', hint: '2.5u — jump troopers' },
  { id: T_SLIT, name: 'Slit', hint: 'fire band 1.2–1.8' },
  { id: T_DOOR, name: 'Door', hint: 'E opens' },
  { id: T_METAL, name: 'Metal', hint: 'undrillable' },
  { id: T_WATER, name: 'Water', hint: 'wadeable' },
  { id: T_DEEP, name: 'Deep', hint: 'swim; boats/hover' },
  { id: T_LADDER, name: 'Ladder', hint: 'manhole / storey link' },
  { id: T_THIN_WALL_H, name: 'Thin wall —', hint: 'room wall spanning east/west' },
  { id: T_THIN_WALL_V, name: 'Thin wall |', hint: 'room wall spanning north/south' },
  { id: T_THIN_DOOR_H, name: 'Thin door —', hint: 'room door spanning east/west' },
  { id: T_THIN_DOOR_V, name: 'Thin door |', hint: 'room door spanning north/south' },
  { id: T_WINDOW_H, name: 'Glass —', hint: 'breakable framed pane' },
  { id: T_WINDOW_V, name: 'Glass |', hint: 'breakable framed pane' },
  { id: T_STAIRS_N, name: 'Stairs ↑', hint: 'automatic climb north' },
  { id: T_STAIRS_E, name: 'Stairs →', hint: 'automatic climb east' },
  { id: T_STAIRS_S, name: 'Stairs ↓', hint: 'automatic climb south' },
  { id: T_STAIRS_W, name: 'Stairs ←', hint: 'automatic climb west' },
  { id: T_SECTION_SHUTTER, name: 'Shutter', hint: 'mission section boundary' },
] as const;

export const MAKER_BUILDINGS: { id: string; name: string; kind: BuildingDef['kind']; biomes?: ThemeId[] }[] = [
  ...BUILDINGS.map((b) => ({ id: b.id, name: b.name, kind: b.kind, ...(b.biomes ? { biomes: b.biomes } : {}) })),
  ...FRONT_STENCILS.filter((s) => !BUILDINGS.some((b) => b.id === s.id))
    .map((s) => ({ id: s.id, name: s.name, kind: s.kind, ...(s.biomes ? { biomes: s.biomes } : {}) })),
];

export function buildingById(id: string): BuildingDef {
  const def = [...BUILDINGS, ...FRONT_STENCILS].find((b) => b.id === id);
  if (!def) throw new Error(`mapedit: unknown building '${id}'`);
  return def;
}

export { T_OPEN, T_WALL, T_COVER, T_WATER, T_DEEP, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL, T_LADDER, T_CLIMB,
  T_THIN_WALL_H, T_THIN_WALL_V, T_THIN_DOOR_H, T_THIN_DOOR_V, T_WINDOW_H, T_WINDOW_V,
  T_STAIRS_N, T_STAIRS_E, T_STAIRS_S, T_STAIRS_W, T_SECTION_SHUTTER };
export type { GameMap, MapSize };
