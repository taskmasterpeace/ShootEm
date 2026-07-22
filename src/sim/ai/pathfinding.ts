// ---------------------------------------------------------------------------
// THE PLANNER — grid pathfinding (BFS + A*) for the bot brain.
//
// Extracted from bots.ts (see docs/AI-ARCHITECTURE.md). A pure LEAF: it reads
// the World, the map, and geometry ONLY — no soldier, combat, or objective
// logic. The BFS/A* scratch is module-shared and reused across repaths
// (pathStep is synchronous and never nests). Behaviour is byte-identical to
// the in-bots version; determinism rides on the unchanged tile-walk order.
// ---------------------------------------------------------------------------
import {
  T_CLIMB, T_GRASS, T_LADDER, T_METAL_DOOR, T_OPEN, T_RUBBLE,
  T_STAIRS_N, T_STAIRS_W, T_WATER, isBlocked, isDoorTile,
} from '../map';
import {
  MAX_BUILDING_FLOORS, floorBlocked, floorExists, floorHeight,
  floorLayer, hasFloorAt, ladderWellAt, stairDirectionAt,
} from '../map-layers';
import { tileToWorld, worldToTile } from '../map-geometry';
import type { Vec3 } from '../types';
import { type World } from '../world';

// BFS scratch, reused across repaths. Allocating two map-sized arrays per
// call was pure GC churn — 24 bots repathing is megabytes/sec of garbage on
// a low-end machine. Safe to share: pathStep is synchronous and never nests.
// two layers: index = floor·AREA + tile (the ground-only fast path uses
// layer 0 exclusively, byte-identical to the classic single-layer walk)
let bfsPrev = new Int32Array(0);
let bfsQ = new Int32Array(0);
// A* scratch: g/f scores in INTEGER octile cost (straight 10, diagonal 14) so
// the ordering is exact and replay-stable. Neither needs clearing between runs —
// a slot is only ever read when bfsPrev marks that node visited this search.
let aG = new Int32Array(0);
let aF = new Int32Array(0);

function ensurePathScratch(area: number): void {
  const size = area * MAX_BUILDING_FLOORS;
  if (bfsPrev.length >= size) return;
  bfsPrev = new Int32Array(size);
  bfsQ = new Int32Array(size);
  aG = new Int32Array(size);
  aF = new Int32Array(size);
}

/** BFS from start tile to goal tile; returns the next reachable waypoint (LOS-smoothed) or null.
 *  `wheels` plans for a VEHICLE: doorways, ladders, and barricades come off
 *  the menu — a hull fits none of them (this is why bikes used to bury
 *  themselves in walls: the driver had a compass, never a map). */
export function pathStep(w: World, from: Vec3, to: Vec3, canClimb = false, wheels = false, fromFloor = 0, toFloor = 0, allowLadders = true): (Vec3 & { climb?: boolean }) | null {
  const grid = w.map.grid;
  const geometry = w.map.geometry;
  const { cols, rows, tile } = geometry;
  const area = cols * rows;
  ensurePathScratch(area);
  const toTile = (x: number, z: number) => worldToTile(geometry, x, z);
  const toWorld = (tx: number, tz: number) => tileToWorld(geometry, tx, tz);
  const [sx, sz] = toTile(from.x, from.z);
  let [gx, gz] = toTile(to.x, to.z);
  // LADDER IQ: any storey in play routes through the layered walk below
  // (still a plain BFS — it runs far less often than this ground fast path).
  if (fromFloor !== 0 || toFloor !== 0) return pathStepLayered(w, from, to, fromFloor, toFloor, allowLadders);
  if (sx === gx && sz === gz) return null;
  // doors are PASSABLE to the planner: humans open them, monsters break them.
  // SHALLOW water is passable too — fords are routes now, not walls. DEEP
  // water stays off the menu: a swimming bot can't shoot back.
  // §8.7: CLIMB barricades join the menu for jump troopers ONLY (canClimb) —
  // their jet is the door key; to everyone else a 2.5u wall is a wall.
  // The walkability ray below still treats a closed door as solid, so the
  // smoothed path delivers the bot TO the door, where its hands take over
  // (and delivers a jump trooper TO the barricade, where climb IQ burns).
  const open = wheels
    ? (x: number, z: number) => {
      if (x < 0 || z < 0 || x >= cols || z >= rows) return false;
      const t = grid[z * cols + x];
      return t === T_OPEN || t === T_WATER;
    }
    : (x: number, z: number) => {
      if (x < 0 || z < 0 || x >= cols || z >= rows) return false;
      const t = grid[z * cols + x];
      // GRASS is walkable concealment (forests are grass, not wall — "choke,
      // not seal") and RUBBLE is a breached wall (destruction only ever OPENS a
      // path); the planner treated both as sealed, so bots detoured around
      // forests and never exploited a hole a teammate drilled.
      return t === T_OPEN || (isDoorTile(t) && t !== T_METAL_DOOR) || t === T_WATER || t === T_LADDER || t === T_GRASS || t === T_RUBBLE || (canClimb && t === T_CLIMB);
    };
  if (!open(gx, gz)) {
    // the objective landed inside a structure (buildings stamp everywhere
    // now) — spiral out to the nearest walkable tile instead of giving up.
    // Giving up here is how a whole match once ended 0–0.
    let found = false;
    outer: for (let r = 1; r <= 4; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (open(gx + dx, gz + dz)) { gx += dx; gz += dz; found = true; break outer; }
        }
      }
    }
    if (!found) return null;
  }

  // A* (was uniform-cost BFS, which expanded EVERY tile closer than the goal —
  // a base->mid route flooded ~half the map on every repath, and 24 bots + a
  // horde doing that once a second was the biggest cost in the brain). The
  // octile heuristic pulls the search straight at the goal; ties break on tile
  // index so the result is deterministic and replay-stable.
  const prev = bfsPrev.fill(-1);
  const heap = bfsQ;
  let heapN = 0;
  const startIdx = sz * cols + sx;
  const goalIdx = gz * cols + gx;
  // octile distance in the same integer units as the step costs
  const h = (n: number) => {
    const dx = Math.abs((n % cols) - gx), dz = Math.abs(((n / cols) | 0) - gz);
    return 10 * (dx + dz) - 6 * Math.min(dx, dz);
  };
  const before = (a: number, b: number) => (aF[a] !== aF[b] ? aF[a] < aF[b] : a < b);
  const push = (n: number) => {
    let i = heapN++;
    heap[i] = n;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!before(heap[i], heap[p])) break;
      const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap[--heapN];
    if (heapN > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heapN && before(heap[l], heap[m])) m = l;
        if (r < heapN && before(heap[r], heap[m])) m = r;
        if (m === i) break;
        const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
      }
    }
    return top;
  };

  prev[startIdx] = startIdx;
  aG[startIdx] = 0;
  aF[startIdx] = h(startIdx);
  push(startIdx);
  let found = false;
  const dirs = [1, -1, cols, -cols, cols + 1, cols - 1, -cols + 1, -cols - 1];
  let expanded = 0;
  while (heapN > 0 && expanded < area) {
    const cur = pop();
    expanded++;
    if (cur === goalIdx) { found = true; break; }
    const cx = cur % cols, cz = (cur / cols) | 0;
    for (const d of dirs) {
      const nxt = cur + d;
      const nx = nxt % cols, nz = (nxt / cols) | 0;
      if (nx < 0 || nz < 0 || nxt < 0 || nxt >= area) continue;
      if (Math.abs(nx - cx) > 1 || Math.abs(nz - cz) > 1) continue; // wrap guard
      if (!open(nx, nz)) continue;
      // no diagonal corner cutting
      const diag = nx !== cx && nz !== cz;
      if (diag && (!open(cx, nz) || !open(nx, cz))) continue;
      const ng = aG[cur] + (diag ? 14 : 10);
      if (prev[nxt] !== -1 && ng >= aG[nxt]) continue; // already reached as cheap or cheaper
      prev[nxt] = cur;
      aG[nxt] = ng;
      aF[nxt] = ng + h(nxt);
      push(nxt);
    }
  }
  if (!found) return null;

  // walk back from goal to the tile after start
  const path: number[] = [];
  let cur = goalIdx;
  while (cur !== startIdx && path.length < 500) {
    path.push(cur);
    cur = prev[cur];
  }
  path.reverse();
  // WALK smoothing: take the farthest path node we can walk straight to.
  // This must be a walkability ray, not losClear — a shot ray flies over
  // water and open doors of thought that boots cannot cross (the pond in
  // front of a base gate once pinned four bots forever).
  // wheels judge the ray by THEIR menu (an open doorway walks, but no hull
  // fits through it); boots keep the classic isBlocked truth
  const solid = wheels
    ? (x: number, z: number) => { const [tx, tz] = toTile(x, z); return !open(tx, tz); }
    : (x: number, z: number) => isBlocked(grid, x, z, false, geometry);
  const walkClear = (a: Vec3, bx: number, bz: number): boolean => {
    const dx = bx - a.x, dz = bz - a.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (tile * 0.4)));
    let px = a.x, pz = a.z;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + dx * t, z = a.z + dz * t;
      // the point itself PLUS the two elbows: a sampled diagonal can thread
      // the exact corner where two walls touch — the physics can't, so bots
      // aimed through it and sat pinned on the corner forever
      if (solid(x, z) || solid(px, z) || solid(x, pz)) return false;
      px = x; pz = z;
    }
    return true;
  };
  let target = path[0];
  for (let i = Math.min(path.length - 1, 24); i > 0; i--) {
    const p = toWorld(path[i] % cols, (path[i] / cols) | 0);
    if (walkClear(from, p.x, p.z)) { target = path[i]; break; }
  }
  return toWorld(target % cols, (target / cols) | 0);
}

/**
 * The LAYERED walk (ladder IQ): floor-0 tiles, floor-1 plates, and the
 * ladder WELLS that join them — one BFS over both storeys. Returns the next
 * waypoint on the CALLER'S floor; `climb: true` means that waypoint is the
 * well itself and the next move is the E press. Only invoked when a storey
 * is actually in play, so the classic ground walk stays untouched.
 */
function pathStepLayered(w: World, from: Vec3, to: Vec3, fromFloor: number, toFloor: number, allowLadders: boolean): (Vec3 & { climb?: boolean }) | null {
  const grid = w.map.grid;
  const geometry = w.map.geometry;
  const { cols, rows, tile } = geometry;
  const area = cols * rows;
  ensurePathScratch(area);
  const [sx, sz] = worldToTile(geometry, from.x, from.z);
  let [gx, gz] = worldToTile(geometry, to.x, to.z);
  const toWorld = (tx: number, tz: number) => tileToWorld(geometry, tx, tz);
  if (!floorExists(w.map, fromFloor) || !floorExists(w.map, toFloor)) return null;
  if (sx === gx && sz === gz && fromFloor === toFloor) return null;
  const openGround = (x: number, z: number) => {
    if (x < 0 || z < 0 || x >= cols || z >= rows) return false;
    const t = grid[z * cols + x];
    return t === T_OPEN || (isDoorTile(t) && t !== T_METAL_DOOR)
      || (t >= T_STAIRS_N && t <= T_STAIRS_W)
      || t === T_WATER || t === T_LADDER || t === T_GRASS || t === T_RUBBLE;
  };
  const openUpper = (floor: number, x: number, z: number) => {
    if (x < 0 || z < 0 || x >= cols || z >= rows) return false;
    if (!floorExists(w.map, floor)) return false;
    const pos = toWorld(x, z);
    const floorTile = floorLayer(w.map, floor)[z * cols + x];
    return hasFloorAt(w.map, floor, pos.x, pos.z)
      && (isDoorTile(floorTile, true) || !floorBlocked(w.map, floor, pos.x, pos.z));
  };
  const openAt = (f: number, x: number, z: number) => (f === 0 ? openGround(x, z) : openUpper(f, x, z));
  const transitionAt = (floor: number, nextFloor: number, tileIdx: number): 'ladder' | 'stairs' | null => {
    if (nextFloor < 0 || nextFloor >= MAX_BUILDING_FLOORS || !floorExists(w.map, nextFloor)) return null;
    const pos = toWorld(tileIdx % cols, (tileIdx / cols) | 0);
    if (allowLadders && ladderWellAt(w.map, floor, pos.x, pos.z) && ladderWellAt(w.map, nextFloor, pos.x, pos.z)) return 'ladder';
    const a = stairDirectionAt(w.map, floor, pos.x, pos.z);
    const b = stairDirectionAt(w.map, nextFloor, pos.x, pos.z);
    return a && b && a.x === b.x && a.z === b.z ? 'stairs' : null;
  };

  if (!openAt(toFloor, gx, gz)) {
    // the destination sits inside masonry on its own storey — spiral out
    let found = false;
    outer: for (let r = 1; r <= 4; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (openAt(toFloor, gx + dx, gz + dz)) { gx += dx; gz += dz; found = true; break outer; }
        }
      }
    }
    if (!found) return null;
  }

  const prev = bfsPrev.fill(-1);
  const q = bfsQ;
  let head = 0, tail = 0;
  const startIdx = fromFloor * area + sz * cols + sx;
  const goalIdx = toFloor * area + gz * cols + gx;
  q[tail++] = startIdx;
  prev[startIdx] = startIdx;
  let found = false;
  const dirs = [1, -1, cols, -cols, cols + 1, cols - 1, -cols + 1, -cols - 1];
  let expanded = 0;
  while (head < tail && expanded < area * MAX_BUILDING_FLOORS) {
    const cur = q[head++];
    expanded++;
    if (cur === goalIdx) { found = true; break; }
    const f = Math.floor(cur / area);
    const t = cur % area;
    const cx = t % cols, cz = (t / cols) | 0;
    for (const d of dirs) {
      const nt = t + d;
      const nx = nt % cols, nz = (nt / cols) | 0;
      if (Math.abs(nx - cx) > 1 || Math.abs(nz - cz) > 1) continue; // wrap guard
      const nIdx = f * area + nt;
      if (prev[nIdx] !== -1 || !openAt(f, nx, nz)) continue;
      if (nx !== cx && nz !== cz && (!openAt(f, cx, nz) || !openAt(f, nx, cz))) continue;
      prev[nIdx] = cur;
      q[tail++] = nIdx;
    }
    // Same-tile vertical links: ladders require E; aligned stairs are walked.
    for (const nf of [f - 1, f + 1]) {
      if (!transitionAt(f, nf, t)) continue;
      const oIdx = nf * area + t;
      if (prev[oIdx] === -1) { prev[oIdx] = cur; q[tail++] = oIdx; }
    }
  }
  if (!found) return null;

  const path: number[] = [];
  let cur = goalIdx;
  while (cur !== startIdx && path.length < 900) {
    path.push(cur);
    cur = prev[cur];
  }
  path.reverse();

  // the same-floor PREFIX is all this repath can steer across; the node
  // after it (same tile, other storey) is the climb itself
  let cross = path.length;
  for (let i = 0; i < path.length; i++) {
    if (Math.floor(path[i] / area) !== fromFloor) { cross = i; break; }
  }
  const y = floorHeight(fromFloor);
  if (cross === 0) {
    const nextFloor = Math.floor(path[0] / area);
    const transition = transitionAt(fromFloor, nextFloor, sz * cols + sx);
    const current = toWorld(sx, sz);
    let { x, z } = current;
    if (transition === 'stairs') {
      const stair = stairDirectionAt(w.map, fromFloor, x, z)!;
      const direction = nextFloor > fromFloor ? 1 : -1;
      x += stair.x * direction * tile * 0.35;
      z += stair.z * direction * tile * 0.35;
    }
    return { x, y, z, climb: transition === 'ladder' };
  }
  const solid = fromFloor === 0
    ? (x: number, z: number) => isBlocked(grid, x, z, false, geometry)
    : (x: number, z: number) => floorBlocked(w.map, fromFloor, x, z)
      || !hasFloorAt(w.map, fromFloor, x, z);
  const walkClearL = (bx: number, bz: number): boolean => {
    const dx = bx - from.x, dz = bz - from.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (tile * 0.4)));
    let px = from.x, pz = from.z;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t, z = from.z + dz * t;
      if (solid(x, z) || solid(px, z) || solid(x, pz)) return false;
      px = x; pz = z;
    }
    return true;
  };
  let target = path[0] % area;
  let targetI = 0;
  for (let i = Math.min(cross - 1, 24); i > 0; i--) {
    const t = path[i] % area;
    const pos = toWorld(t % cols, (t / cols) | 0);
    if (walkClearL(pos.x, pos.z)) { target = t; targetI = i; break; }
  }
  const atTransition = cross < path.length && targetI === cross - 1;
  const nextFloor = atTransition ? Math.floor(path[cross] / area) : fromFloor;
  const transition = atTransition ? transitionAt(fromFloor, nextFloor, target) : null;
  const targetPos = toWorld(target % cols, (target / cols) | 0);
  let { x, z } = targetPos;
  if (transition === 'stairs') {
    const stair = stairDirectionAt(w.map, fromFloor, x, z)!;
    const direction = nextFloor > fromFloor ? 1 : -1;
    x += stair.x * direction * tile * 0.35;
    z += stair.z * direction * tile * 0.35;
  }
  return { x, y, z, climb: transition === 'ladder' };
}
