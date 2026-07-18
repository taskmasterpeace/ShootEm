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
  GRID, TILE, WORLD, houseAt,
  T_OPEN, T_WALL, T_COVER, T_WATER, T_DEEP, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL, T_LADDER, T_CLIMB,
  type GameMap, type PropSpec, type PickupSpawn, type VehiclePad, type House, type TileClaim,
} from './map';
import { BUILDINGS, stampBuilding, type BuildingDef, type StampCtx } from './buildings';
import { FRONT_STENCILS, frontWalkable, generateFront, boxFor, type MapSize } from './fronts';
import { generateSkirmishMap } from './skirmish';
import { Rng } from './rng';
import type { Team, ThemeId, VehicleKind, Vec3 } from './types';

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

const tileToWorld = (tx: number, tz: number): Vec3 =>
  ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });
const worldToTile = (x: number, z: number): [number, number] =>
  [Math.floor((x + WORLD / 2) / TILE), Math.floor((z + WORLD / 2) / TILE)];

function cloneMap(m: GameMap): GameMap {
  return {
    seed: m.seed, theme: m.theme,
    grid: m.grid.slice(), grid2: m.grid2.slice(), surface: m.surface.slice(),
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
  const grid = new Uint8Array(GRID * GRID);
  const grid2 = new Uint8Array(GRID * GRID);
  const surface = new Uint8Array(GRID * GRID).fill(1); // S_GRASS
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) grid[z * GRID + x] = T_WALL;
  }
  const mid = Math.floor((box.z0 + box.z1) / 2);
  const bx0 = box.x0 + 10, bx1 = box.x1 - 9;
  const ring = (cx: number, cz: number): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push(tileToWorld(cx + Math.round(Math.cos(a) * 3), cz + Math.round(Math.sin(a) * 3)));
    }
    return out;
  };
  const map: GameMap = {
    seed, theme, grid, grid2, surface,
    basePos: [tileToWorld(bx0, mid), tileToWorld(bx1, mid)],
    spawns: [ring(bx0, mid), ring(bx1, mid)],
    flagPos: [tileToWorld(bx0, mid), tileToWorld(bx1, mid)],
    hillPos: tileToWorld(50, 50),
    controlPoints: [
      { name: 'A', pos: tileToWorld(box.x0 + 20, mid) },
      { name: 'B', pos: tileToWorld(50, 50) },
      { name: 'C', pos: tileToWorld(box.x1 - 19, mid) },
    ],
    vehiclePads: [], pickups: [], props: [], zombieSpawns: [], houses: [],
    gates: [], pads: [], propCovered: [],
  };
  return { frontId: null, size, seed, mode: 'tdm', map, claims: [], rng: new Rng(seed ^ 0x5eed), undoStack: [], redoStack: [] };
}

// ---------------------------------------------------------------------------
// undo / redo — full-doc snapshots (a dev tool can afford them)
// ---------------------------------------------------------------------------
export interface MapJSON {
  v: 1; frontId: string | null; size: MapSize; seed: number;
  grid: number[]; grid2: number[]; surface: number[];
  basePos: [Vec3, Vec3]; spawns: [Vec3[], Vec3[]]; flagPos: [Vec3, Vec3];
  hillPos: Vec3; controlPoints: { name: string; pos: Vec3 }[];
  vehiclePads: VehiclePad[]; pickups: PickupSpawn[]; props: PropSpec[];
  zombieSpawns: Vec3[]; houses: House[]; theme: GameMap['theme'];
  claims: TileClaim[];
}

export function serializeDoc(doc: MakerDoc): MapJSON {
  const m = doc.map;
  return {
    v: 1, frontId: doc.frontId, size: doc.size, seed: doc.seed,
    grid: [...m.grid], grid2: [...m.grid2], surface: [...m.surface],
    basePos: m.basePos, spawns: m.spawns, flagPos: m.flagPos, hillPos: m.hillPos,
    controlPoints: m.controlPoints, vehiclePads: m.vehiclePads, pickups: m.pickups,
    props: m.props, zombieSpawns: m.zombieSpawns, houses: m.houses, theme: m.theme,
    claims: doc.claims,
  };
}

export function deserializeDoc(json: MapJSON): MakerDoc {
  if (json.v !== 1) throw new Error(`mapedit: can't read doc version ${(json as { v?: number }).v}`);
  const grid = Uint8Array.from(json.grid);
  const map: GameMap = {
    seed: json.seed, theme: json.theme,
    grid, grid2: Uint8Array.from(json.grid2), surface: Uint8Array.from(json.surface),
    basePos: json.basePos, spawns: json.spawns, flagPos: json.flagPos, hillPos: json.hillPos,
    controlPoints: json.controlPoints, vehiclePads: json.vehiclePads, pickups: json.pickups,
    props: json.props, zombieSpawns: json.zombieSpawns, houses: json.houses,
    gates: [], pads: [], propCovered: settleClaims(grid, json.claims),
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
  const r = Math.floor(brush / 2);
  const idxs: number[] = [];
  for (let z = tz - r; z <= tz + r; z++) for (let x = tx - r; x <= tx + r; x++) {
    if (x < 1 || z < 1 || x >= GRID - 1 || z >= GRID - 1) continue;
    doc.map.grid[z * GRID + x] = tile;
    idxs.push(z * GRID + x);
  }
  afterGridWrite(doc, idxs);
}

/** paint the SURFACE layer (movement/sound/paint), same brush model. */
export function paintSurface(doc: MakerDoc, tx: number, tz: number, surf: number, brush = 1) {
  pushUndo(doc);
  const r = Math.floor(brush / 2);
  for (let z = tz - r; z <= tz + r; z++) for (let x = tx - r; x <= tx + r; x++) {
    if (x < 1 || z < 1 || x >= GRID - 1 || z >= GRID - 1) continue;
    doc.map.surface[z * GRID + x] = surf;
  }
}

/** place a prop; if it blocks (rock/tree/silo/stack/crate/wreck), claim the
 *  tile so collision and mesh stay married (the invisible-wall law). */
export function placeProp(doc: MakerDoc, type: PropSpec['type'], tx: number, tz: number, scale = 1, rot = 0) {
  pushUndo(doc);
  const idx = tz * GRID + tx;
  doc.map.props.push({ type, pos: tileToWorld(tx, tz), scale, rot });
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
  const w = tileToWorld(tx, tz);
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
    const cx = (c.idx % GRID + 0.5) * TILE - WORLD / 2;
    const cz = (Math.floor(c.idx / GRID) + 0.5) * TILE - WORLD / 2;
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
  tx = Math.max(1, Math.min(GRID - 2, tx));
  tz = Math.max(1, Math.min(GRID - 2, tz));
  pushUndo(doc);
  const w = tileToWorld(tx, tz);
  const m = doc.map;
  switch (ref.kind) {
    case 'cp': m.controlPoints[ref.index].pos = w; break;
    case 'hill': m.hillPos = w; break;
    case 'pickup': m.pickups[ref.index].pos = w; break;
    case 'pad': m.vehiclePads[ref.index].pos = w; break;
    case 'mouth': m.zombieSpawns[ref.index] = w; break;
    case 'base': {
      const [ox, oz] = worldToTile(m.basePos[ref.team].x, m.basePos[ref.team].z);
      const dx = tx - ox, dz = tz - oz;
      m.basePos[ref.team] = w;
      m.flagPos[ref.team] = w;
      m.spawns[ref.team] = m.spawns[ref.team].map((s) => {
        const [sx, sz] = worldToTile(s.x, s.z);
        return tileToWorld(sx + dx, sz + dz);
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
  doc.map.controlPoints.push({ name: name ?? String.fromCharCode(65 + doc.map.controlPoints.length), pos: tileToWorld(tx, tz) });
}
export function addPickup(doc: MakerDoc, type: PickupSpawn['type'], tx: number, tz: number) {
  pushUndo(doc);
  doc.map.pickups.push({ type, pos: tileToWorld(tx, tz) });
}
export function addPad(doc: MakerDoc, kind: VehicleKind, tx: number, tz: number) {
  pushUndo(doc);
  const team: Team = tx < GRID / 2 ? 0 : 1;
  doc.map.vehiclePads.push({ kind, team, pos: tileToWorld(tx, tz) });
}
export function addMouth(doc: MakerDoc, tx: number, tz: number) {
  pushUndo(doc);
  doc.map.zombieSpawns.push(tileToWorld(tx, tz));
}

// ---- buildings ------------------------------------------------------------

/** stamp a library/front stencil into the doc (the stamp registers the house,
 *  the roof, the crates and the loot — atomically deletable via deleteHouse). */
export function stamp(doc: MakerDoc, def: BuildingDef, tx: number, tz: number): boolean {
  pushUndo(doc);
  const ctx: StampCtx = {
    grid: doc.map.grid, grid2: doc.map.grid2, props: doc.map.props,
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
  for (let z = h.tz - 1; z <= h.tz + h.th; z++) {
    for (let x = h.tx - 1; x <= h.tx + h.tw; x++) {
      if (x < 1 || z < 1 || x >= GRID - 1 || z >= GRID - 1) continue;
      m.grid[z * GRID + x] = T_OPEN;
      m.grid2[z * GRID + x] = 0;
    }
  }
  const inside = (p: Vec3) => {
    const [px, pz] = worldToTile(p.x, p.z);
    return px >= h.tx - 1 && px <= h.tx + h.tw && pz >= h.tz - 1 && pz <= h.tz + h.th;
  };
  m.props = m.props.filter((p) => !inside(p.pos));
  m.pickups = m.pickups.filter((p) => !inside(p.pos));
  doc.claims = doc.claims.filter((c) => {
    const cx = c.idx % GRID, cz = Math.floor(c.idx / GRID);
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
export interface LawIssue { law: string; detail: string; tiles: [number, number][] }
export interface LawReport {
  ok: boolean;
  issues: LawIssue[];
  /** flood-from-base-0 mask (1 = reachable) — the maker paints orphans red */
  seen: Uint8Array;
}

const OUTDOOR_ONLY = new Set(['tree', 'rock', 'wreck', 'silo', 'flare_stack', 'crane', 'memorial']);

export function validateDoc(doc: MakerDoc): LawReport {
  const m = doc.map;
  const issues: LawIssue[] = [];
  const seen = flood(m, m.basePos[0]);

  // 1 · SEALED RIM — nobody walks off the world
  const rim: [number, number][] = [];
  for (let i = 0; i < GRID; i++) {
    if (frontWalkable(m.grid[i])) rim.push([i, 0]);
    if (frontWalkable(m.grid[(GRID - 1) * GRID + i])) rim.push([i, GRID - 1]);
    if (frontWalkable(m.grid[i * GRID])) rim.push([0, i]);
    if (frontWalkable(m.grid[i * GRID + GRID - 1])) rim.push([GRID - 1, i]);
  }
  if (rim.length) issues.push({ law: 'SEALED RIM', detail: `${rim.length} walkable rim tiles`, tiles: rim.slice(0, 12) });

  // 2 · ZERO ORPHANS — every walkable tile reachable from base 0
  const orphans: [number, number][] = [];
  let orphanCount = 0;
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    const i = z * GRID + x;
    if (frontWalkable(m.grid[i]) && !seen[i]) { if (orphans.length < 12) orphans.push([x, z]); orphanCount++; }
  }
  if (orphanCount) issues.push({ law: 'ZERO ORPHANS', detail: `${orphanCount} sealed walkable tiles`, tiles: orphans });

  // 3 · READABLE — every objective reachable from BOTH bases
  const unreached: string[] = [];
  const unreachedTiles: [number, number][] = [];
  for (const side of [0, 1] as const) {
    const floodSide = side === 0 ? seen : flood(m, m.basePos[side]);
    const check = (p: Vec3, what: string) => {
      const [tx, tz] = worldToTile(p.x, p.z);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx, z = tz + dz;
        if (x >= 0 && z >= 0 && x < GRID && z < GRID && floodSide[z * GRID + x]) return;
      }
      unreached.push(`${what} (base ${side})`);
      unreachedTiles.push([tx, tz]);
    };
    check(m.basePos[1 - side], 'enemy base');
    check(m.hillPos, 'the hill');
    m.flagPos.forEach((f, i) => check(f, `flag ${i}`));
    m.controlPoints.forEach((c) => check(c.pos, `CP ${c.name}`));
    m.vehiclePads.forEach((v) => check(v.pos, `${v.kind} pad`));
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
        if (!edge && seen[z * GRID + x] && frontWalkable(m.grid[z * GRID + x])) inside = true;
      }
    }
    if (!inside) facades.push([h.tx, h.tz]);
  }
  if (facades.length) issues.push({ law: 'ENTERABLE', detail: `${facades.length} buildings are facades`, tiles: facades });

  // 5 · NOTHING GROWS INDOORS
  const trespassers: [number, number][] = [];
  for (const p of m.props) {
    if (OUTDOOR_ONLY.has(p.type) && houseAt(m.houses, p.pos.x, p.pos.z) >= 0) trespassers.push(worldToTile(p.pos.x, p.pos.z));
  }
  if (trespassers.length) issues.push({ law: 'INDOORS', detail: `${trespassers.length} outdoor props inside buildings`, tiles: trespassers });

  // 6 · NO INVISIBLE WALLS — every claimed tile blocks AND has its prop
  const ghost: [number, number][] = [];
  for (const i of m.propCovered) {
    if (m.grid[i] !== T_WALL && m.grid[i] !== T_COVER) { ghost.push([i % GRID, Math.floor(i / GRID)]); continue; }
    const x = (i % GRID + 0.5) * TILE - WORLD / 2;
    const z = (Math.floor(i / GRID) + 0.5) * TILE - WORLD / 2;
    if (!m.props.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 1.6 + p.scale * 1.2)) ghost.push([i % GRID, Math.floor(i / GRID)]);
  }
  if (ghost.length) issues.push({ law: 'WALLS', detail: `${ghost.length} claimed tiles with no prop standing on them`, tiles: ghost.slice(0, 12) });

  return { ok: issues.length === 0, issues, seen };
}

function flood(m: GameMap, from: Vec3): Uint8Array {
  const seen = new Uint8Array(GRID * GRID);
  const [sx, sz] = worldToTile(from.x, from.z);
  const q: number[] = [sz * GRID + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % GRID, z = (i / GRID) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      const ni = nz * GRID + nx;
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

export { T_OPEN, T_WALL, T_COVER, T_WATER, T_DEEP, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL, T_LADDER, T_CLIMB };
export type { GameMap, MapSize };
