// ---------------------------------------------------------------------------
// §8.2 THE TEN FRONTS — authored ground, not recipes.
//
// Until now every Scar front deployed onto a random scatter map wearing the
// front's name. This file is the arena/authored-front pass the DD promised
// (§8.5: "waits for the arena/authored-front pass"): each front's BONES are
// hand-placed — the river is where the river is, every run of the same front
// is the same ground — and the seed only deals DRESSING (trees, crates,
// boulders). Four laws per front, straight from §8.2:
//
//   1. Readable from the top-down camera — lanes, not maze soup
//      (tests/fronts.test.ts enforces this as literal BFS reachability).
//   2. A signature moment — the thing players tell stories about.
//   3. A persistent scar — the campaign hook (applied by main.ts scar mods).
//   4. A doctrine lean — each front's motor pool tilts toward its stars.
//
// Scale note (33C): all ten ship on the standard 300u grid — inside the
// "~300–360u standard front" band. Per-front SIZE variation is engine work
// (WORLD is load-bearing across renderer/minimap/wire) and stays a named
// follow-up; per-front CHARACTER variation is this file.
// ---------------------------------------------------------------------------
import type { Team, Vec3 } from './types';
import { Rng } from './rng';
import {
  GRID, TILE, WORLD,
  T_OPEN, T_WALL, T_COVER, T_WATER, T_DEEP, T_SLIT, T_DOOR, T_METAL, T_LADDER, T_CLIMB,
  S_DIRT, S_GRASS, S_ICE, S_GRIT, S_PLATE, S_WET, S_MUD,
  type GameMap, type PropSpec, type PickupSpawn, type VehiclePad, type House, type TileClaim,
} from './map';
import {
  BUILDINGS, stampBuilding, mirrorDef, generateHouse, generateDistrict,
  type BuildingDef, type StampCtx,
} from './buildings';
import type { VehicleKind } from './types';

// ---------------------------------------------------------------------------
// the shared kit — every front builds with these
// ---------------------------------------------------------------------------

const tw = (tx: number, tz: number): Vec3 =>
  ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });

const idx = (tx: number, tz: number) => tz * GRID + tx;
const inb = (t: number) => t >= 0 && t < GRID;

function set(grid: Uint8Array, tx: number, tz: number, t: number) {
  if (inb(tx) && inb(tz)) grid[idx(tx, tz)] = t;
}

/** rect writer, inclusive bounds — the workhorse */
function rect(grid: Uint8Array, x0: number, z0: number, x1: number, z1: number, t: number) {
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(grid, x, z, t);
}

function rectSurf(surface: Uint8Array, x0: number, z0: number, x1: number, z1: number, s: number) {
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      if (inb(x) && inb(z)) surface[idx(x, z)] = s;
}

/** the map's edge is the end of the world — no front leaks */
function sealRim(grid: Uint8Array) {
  for (let i = 0; i < GRID; i++) {
    grid[i] = T_WALL;
    grid[(GRID - 1) * GRID + i] = T_WALL;
    grid[i * GRID] = T_WALL;
    grid[i * GRID + GRID - 1] = T_WALL;
  }
}

function clearDisc(grid: Uint8Array, cx: number, cz: number, r: number, t = T_OPEN) {
  for (let z = cz - r; z <= cz + r; z++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) set(grid, x, z, t);
}

/** a claimed prop tile — the walls.test.ts law: collision owned by a prop */
function claim(grid: Uint8Array, claims: TileClaim[], tx: number, tz: number, t: number) {
  if (!inb(tx) || !inb(tz)) return;
  set(grid, tx, tz, t);
  claims.push({ idx: idx(tx, tz), t });
}

/** claims that a later stamp overwrote are dropped — same as map.ts */
function settle(grid: Uint8Array, claims: TileClaim[]): number[] {
  return claims.filter((c) => grid[c.idx] === c.t).map((c) => c.idx);
}

/** a ring of tiles (trenches, pit terraces) with gap arcs left open.
 *  gaps are [startDeg, endDeg] ranges on compass degrees (0 = +x, ccw). */
function ring(grid: Uint8Array, cx: number, cz: number, r: number, t: number, gaps: [number, number][]) {
  const steps = Math.ceil(2 * Math.PI * r * 2);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 360;
    if (gaps.some(([g0, g1]) => a >= g0 && a <= g1)) continue;
    const rad = (a * Math.PI) / 180;
    set(grid, Math.round(cx + Math.cos(rad) * r), Math.round(cz + Math.sin(rad) * r), t);
  }
}

const byId = (id: string): BuildingDef => {
  const def = BUILDINGS.find((b) => b.id === id);
  if (!def) throw new Error(`front wants unknown building '${id}'`);
  return def;
};

/** every front's team kit: pocket walls, clone bay, spawn ring, doctrine
 *  motor pool. The pad list IS the doctrine lean — tank country gets tanks,
 *  the pass gets transports, the port gets boats. */
function stampBase(
  grid: Uint8Array, claims: TileClaim[], props: PropSpec[], vehiclePads: VehiclePad[],
  side: Team, btx: number, btz: number, pool: VehicleKind[],
) {
  clearDisc(grid, btx, btz, 7);
  const open = side === 0 ? 1 : -1; // the gate faces the war
  for (let i = -5; i <= 5; i++) {
    set(grid, btx - open * 6, btz + i, T_WALL);
    if (Math.abs(i) > 2) set(grid, btx + open * 6, btz + i, T_WALL);
    set(grid, btx + i, btz - 6, i % 3 === 0 ? T_OPEN : T_WALL);
    set(grid, btx + i, btz + 6, i % 3 === 0 ? T_OPEN : T_WALL);
  }
  props.push({ type: 'bunker', pos: tw(btx - open * 4, btz), scale: 1, rot: side === 0 ? 0 : Math.PI });
  claim(grid, claims, btx, btz + 4, T_COVER);
  props.push({ type: 'clone_bay', pos: tw(btx, btz + 4), scale: 1, rot: side === 0 ? 0 : Math.PI });
  // the motor pool fans out forward of the gate, two columns
  pool.forEach((kind, i) => {
    const row = Math.floor(i / 2), col = i % 2 ? 1 : -1;
    const px = btx + open * (8 + row * 3), pz = btz + col * (4 + row);
    clearDisc(grid, px, pz, 2);
    vehiclePads.push({ kind, team: side, pos: tw(px, pz) });
  });
}

function spawnRing(btx: number, btz: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    out.push(tw(btx + Math.round(Math.cos(a) * 3), btz + Math.round(Math.sin(a) * 3)));
  }
  return out;
}

function zombieRing(grid: Uint8Array): Vec3[] {
  const out: Vec3[] = [];
  const half = GRID / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tx = Math.round(half + Math.cos(a) * (half - 6));
    const tz = Math.round(half + Math.sin(a) * (half - 6));
    clearDisc(grid, tx, tz, 1);
    out.push(tw(tx, tz));
  }
  return out;
}

/** water-margin mud — wheels hate the banks everywhere in the world */
function mudMargins(grid: Uint8Array, surface: Uint8Array) {
  for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) {
    const t = grid[idx(x, z)];
    if (t === T_WATER || t === T_DEEP) continue;
    if ([grid[idx(x + 1, z)], grid[idx(x - 1, z)], grid[idx(x, z + 1)], grid[idx(x, z - 1)]]
      .some((n) => n === T_WATER || n === T_DEEP)) surface[idx(x, z)] = S_MUD;
  }
}

/** the front skeleton every generator fills in */
interface FrontDraft {
  grid: Uint8Array; grid2: Uint8Array; surface: Uint8Array;
  props: PropSpec[]; claims: TileClaim[]; pickups: PickupSpawn[];
  houses: House[]; vehiclePads: VehiclePad[]; rng: Rng;
}

function draft(seed: number, fill: number, surf: number): FrontDraft {
  const grid = new Uint8Array(GRID * GRID).fill(fill);
  const surface = new Uint8Array(GRID * GRID).fill(surf);
  return {
    grid, grid2: new Uint8Array(GRID * GRID), surface,
    props: [], claims: [], pickups: [], houses: [], vehiclePads: [], rng: new Rng(seed),
  };
}

const ctxOf = (d: FrontDraft): StampCtx =>
  ({ grid: d.grid, grid2: d.grid2, props: d.props, pickups: d.pickups, houses: d.houses, claims: d.claims, rng: d.rng });

/** midfield supply, mirrored for fairness — every front eats and reloads */
function dealPickups(d: FrontDraft, spots: [number, number, PickupSpawn['type']][]) {
  for (const [tx, tz, type] of spots) {
    clearDisc(d.grid, tx, tz, 1);
    clearDisc(d.grid, GRID - 1 - tx, tz, 1);
    d.pickups.push({ type, pos: tw(tx, tz) });
    d.pickups.push({ type, pos: tw(GRID - 1 - tx, tz) });
  }
}

// ---------------------------------------------------------------------------
// 1 · BRIDGE DELTA — the river owns the map; three crossings, three prices.
// Signature: holding the main span while artillery walks the deck.
// Doctrine: armor + the boat. Scar: flooded (the ford becomes everything).
// ---------------------------------------------------------------------------
function bridgeDelta(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_GRASS);
  const { grid, surface, props, claims } = d;

  // THE RIVER: north-south, deep core, wadeable rims — the map's one truth
  rect(grid, 45, 1, 54, GRID - 2, T_WATER);
  rect(grid, 47, 1, 52, GRID - 2, T_DEEP);

  // THE MAIN SPAN (z 36..39): four lanes of plate, rail cover on the edges
  // with three vault gaps a side — the artillery-hell duel deck
  rect(grid, 44, 36, 55, 39, T_OPEN);
  rectSurf(surface, 44, 36, 55, 39, S_PLATE);
  for (let x = 44; x <= 55; x++) {
    if (x === 47 || x === 50 || x === 53) continue; // the vaults
    set(grid, x, 35, T_COVER);
    set(grid, x, 40, T_COVER);
  }
  // the burned convoy — mid-span hard cover, the story the yard tells
  claim(grid, claims, 49, 37, T_COVER);
  claim(grid, claims, 50, 38, T_COVER);
  props.push({ type: 'wreck', pos: tw(49, 37), scale: 1.15, rot: 0.5 });
  props.push({ type: 'wreck', pos: tw(50, 38), scale: 1, rot: 3.6 });

  // THE RAIL BRIDGE (z 61..62): two naked lanes — fast and honest
  rect(grid, 44, 61, 55, 62, T_OPEN);
  rectSurf(surface, 44, 61, 55, 62, S_PLATE);

  // THE FORD (z 78..81): shallow the whole way — the only crossing wheels get
  rect(grid, 45, 78, 54, 81, T_WATER);

  // bridgehead sandbags, mirrored: attacking a span head costs you the open
  for (const z of [33, 42]) {
    for (let x = 39; x <= 42; x++) { set(grid, x, z, T_COVER); set(grid, GRID - 1 - x, z, T_COVER); }
  }
  for (const z of [59, 64]) {
    for (let x = 40; x <= 42; x++) { set(grid, x, z, T_COVER); set(grid, GRID - 1 - x, z, T_COVER); }
  }

  // the banks are farmland: a hamlet a side, a pumphouse watching the ford
  const ctx = ctxOf(d);
  stampBuilding(ctx, byId('guard_post'), 38, 30, 0);
  stampBuilding(ctx, mirrorDef(byId('guard_post')), GRID - 38 - 5, 30, 2);
  stampBuilding(ctx, byId('cottage'), 28, 14, 4);
  stampBuilding(ctx, mirrorDef(byId('cottage')), GRID - 28 - 7, 14, 6);
  stampBuilding(ctx, byId('farmhouse'), 18, 24, 8);
  stampBuilding(ctx, mirrorDef(byId('farmhouse')), GRID - 18 - 9, 24, 10);
  stampBuilding(ctx, byId('pumphouse'), 37, 74, 12);
  stampBuilding(ctx, mirrorDef(byId('pumphouse')), GRID - 37 - 5, 74, 14);
  stampBuilding(ctx, byId('hut'), 24, 84, 16);
  stampBuilding(ctx, mirrorDef(byId('hut')), GRID - 24 - 7, 84, 18);

  // reed stands on the banks — dressing, seed's only vote
  for (let i = 0; i < 22; i++) {
    const tz = d.rng.int(6, GRID - 7);
    const west = d.rng.next() < 0.5;
    const tx = west ? d.rng.int(41, 43) : d.rng.int(56, 58);
    if (grid[idx(tx, tz)] === T_OPEN) {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'tree', pos: tw(tx, tz), scale: d.rng.range(0.7, 1.1), rot: d.rng.range(0, Math.PI * 2) });
    }
  }
  // supply dumps behind each bridgehead — the fight leaves its kit lying out
  for (const [cx2, cz2] of [[38, 36], [37, 63], [41, 84]] as const) {
    for (const tx of [cx2, GRID - 1 - cx2]) {
      if (grid[idx(tx, cz2)] === T_OPEN) {
        claim(grid, claims, tx, cz2, T_COVER);
        props.push({ type: 'crate', pos: tw(tx, cz2), scale: 1, rot: d.rng.range(0, Math.PI) });
      }
    }
  }

  // bases + the armor-and-boats motor pool
  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['tank', 'apc', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 50, ['tank', 'apc', 'buggy', 'ambulance']);
  d.vehiclePads.push({ kind: 'boat', team: 0, pos: tw(45, 70) });
  d.vehiclePads.push({ kind: 'boat', team: 1, pos: tw(54, 70) });
  d.vehiclePads.push({ kind: 'emplacement', team: 0, pos: tw(36, 46) });
  d.vehiclePads.push({ kind: 'emplacement', team: 1, pos: tw(GRID - 37, 46) });
  clearDisc(grid, 36, 46, 2); clearDisc(grid, GRID - 37, 46, 2);

  dealPickups(d, [[40, 37, 'medkit'], [40, 62, 'ammo'], [40, 80, 'energy'], [30, 50, 'ammo']]);
  mudMargins(grid, surface);
  sealRim(grid);

  // conquest here is the fight for the crossings themselves
  return {
    seed, theme: 'savanna', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 50)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 50)],
    flagPos: [tw(10, 50), tw(GRID - 11, 50)],
    hillPos: tw(49, 37),
    controlPoints: [
      { name: 'SPAN', pos: tw(49, 38) },
      { name: 'RAIL', pos: tw(49, 61) },
      { name: 'FORD', pos: tw(49, 79) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 2 · FORT RAVEN — a hilltop strongpoint: two trench rings, four bunkers,
// and the keep. Signature: the last stand inside the keep. Doctrine:
// breacher/engineer siege kit. Scar: rubble (breaches accumulate).
// ---------------------------------------------------------------------------

/** the keep — authored two-storey citadel; the roof nest is the prize */
const THE_KEEP: BuildingDef = {
  id: 'the_keep', name: 'The Keep', kind: 'military', floors: 2,
  rows: [
    'MMMSSMMM',
    'M......M',
    'S..C...S',
    'M..PL..M',
    'S......S',
    'M.C....M',
    'MMMDDMMM',
  ],
  rows2: [
    '#SS##SS#',
    '#......#',
    'S......S',
    '#..L...#',
    'S......S',
    '#......#',
    '#S####S#',
  ],
};

function fortRaven(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_GRIT);
  const { grid, surface, props, claims } = d;
  const C = 50;

  // the glacis is bare grit — attackers cross it in the open
  // inner ring r=12: parapet with four sally gaps on the cardinals
  ring(grid, C, C, 12, T_COVER, [[350, 360], [0, 10], [80, 100], [170, 190], [260, 280]]);
  // outer ring r=20: gaps on the diagonals — no straight walk to the keep
  ring(grid, C, C, 20, T_COVER, [[35, 55], [125, 145], [215, 235], [305, 325]]);

  // four bunkers between the rings, slits watching the diagonals
  const ctx = ctxOf(d);
  stampBuilding(ctx, byId('bunker'), 36, 36, 0);
  stampBuilding(ctx, mirrorDef(byId('bunker')), 57, 36, 2);
  stampBuilding(ctx, byId('bunker'), 36, 57, 4);
  stampBuilding(ctx, mirrorDef(byId('bunker')), 57, 57, 6);

  // the keep itself — doors south, nests upstairs
  stampBuilding(ctx, THE_KEEP, C - 4, C - 3, 8);

  // observation posts north and south of the fort
  stampBuilding(ctx, byId('guard_post'), 47, 24, 10);
  stampBuilding(ctx, byId('guard_post'), 47, 71, 12);

  // dragon's teeth on the far glacis — armor picks a lane and commits
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tx = Math.round(C + Math.cos(a) * 27), tz = Math.round(C + Math.sin(a) * 27);
    if ((i % 4) === 0) continue; // four armored lanes
    if (grid[idx(tx, tz)] === T_OPEN) {
      claim(grid, claims, tx, tz, T_COVER);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: 0.8, rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  // the abandoned earthwork: a third, broken arc the fort outgrew — heavy
  // gaps, but the only pause on the long walk in (the atlas showed a bare
  // glacis that read unfinished rather than lethal)
  ring(grid, C, C, 33, T_COVER, [[0, 30], [60, 120], [150, 210], [240, 300], [330, 360]]);

  // shell craters: the guns have been ranging this ground for a season
  for (let i = 0; i < 9; i++) {
    const a = d.rng.range(0, Math.PI * 2), r = d.rng.range(23, 40);
    const cx2 = Math.round(C + Math.cos(a) * r), cz2 = Math.round(C + Math.sin(a) * r);
    for (let z = cz2 - 1; z <= cz2 + 1; z++) for (let x = cx2 - 1; x <= cx2 + 1; x++) {
      if (inb(x) && inb(z) && (x - cx2) ** 2 + (z - cz2) ** 2 <= 2) surface[idx(x, z)] = S_DIRT;
    }
  }

  // outbuildings the sieges gutted — approach cover with a history
  stampBuilding(ctx, byId('ruin'), 22, 44, 14);
  stampBuilding(ctx, mirrorDef(byId('ruin')), GRID - 22 - 7, 52, 16);

  // boulder dressing outside the fight
  for (let i = 0; i < 12; i++) {
    const tx = d.rng.int(6, GRID - 7), tz = d.rng.int(6, GRID - 7);
    if (Math.hypot(tx - C, tz - C) > 36 && Math.abs(tz - 50) > 10 && grid[idx(tx, tz)] === T_OPEN) {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(1.1, 1.8), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['tank', 'apc', 'tunneler', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 50, ['tank', 'apc', 'tunneler', 'ambulance']);

  dealPickups(d, [[30, 40, 'medkit'], [30, 60, 'ammo'], [40, 28, 'energy'], [40, 72, 'ammo']]);
  sealRim(grid);

  return {
    seed, theme: 'titan', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 50)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 50)],
    flagPos: [tw(10, 50), tw(GRID - 11, 50)],
    hillPos: tw(C, C), // KOTH is the keep — hold the heart of the fort
    controlPoints: [
      { name: 'NORTH SALLY', pos: tw(C, 38) },
      { name: 'THE KEEP', pos: tw(C, C) },
      { name: 'SOUTH SALLY', pos: tw(C, 62) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 3 · EASTERN PLAINS — hedgerow tank country. Long lanes, plowed fields,
// three farms, and a no-man's lane of burned hulls down the middle.
// Signature: the 60-unit tank duel broken by a treeline ambush.
// Doctrine: armor doubled. Scar: fire (burned fields lose concealment).
// ---------------------------------------------------------------------------
function easternPlains(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_GRASS);
  const { grid, surface, props, claims } = d;

  // HEDGEROWS: five treelines, gaps staggered so no lane runs clean through —
  // armor must jink between rows, and every gap is a known ambush angle
  const rows: { z: number; gaps: number[] }[] = [
    { z: 20, gaps: [22, 50, 78] },
    { z: 35, gaps: [34, 64, 90] },
    { z: 50, gaps: [14, 48, 82] },
    { z: 65, gaps: [30, 60, 88] },
    { z: 80, gaps: [20, 52, 76] },
  ];
  for (const { z, gaps } of rows) {
    for (let x = 8; x <= 91; x++) {
      if (gaps.some((g) => Math.abs(x - g) <= 2)) continue;
      set(grid, x, z, T_WALL);
      if (x % 3 === 0) props.push({ type: 'tree', pos: tw(x, z), scale: d.rng.range(0.9, 1.3), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  // plowed fields between hedges — the ground itself tells you where you are
  rectSurf(surface, 12, 22, 44, 33, S_DIRT);
  rectSurf(surface, 55, 37, 88, 48, S_DIRT);
  rectSurf(surface, 12, 52, 44, 63, S_DIRT);
  rectSurf(surface, 55, 67, 88, 78, S_DIRT);

  // the farm tracks: one east-west lane between the middle hedgerows, one
  // north-south spur threading the center hedge's gap — they MEET, so the
  // crossroads is an actual crossroads, not just a name on the HUD
  rectSurf(surface, 10, 46, 89, 48, S_MUD);
  rectSurf(surface, 47, 36, 49, 64, S_MUD);

  // the farms — a working landscape, mirrored for fairness
  const ctx = ctxOf(d);
  stampBuilding(ctx, byId('farmhouse'), 22, 24, 0);
  stampBuilding(ctx, mirrorDef(byId('farmhouse')), GRID - 22 - 9, 24, 2);
  stampBuilding(ctx, byId('warehouse'), 18, 54, 4);
  stampBuilding(ctx, mirrorDef(byId('warehouse')), GRID - 18 - 11, 54, 6);
  stampBuilding(ctx, byId('hut'), 30, 70, 8);
  stampBuilding(ctx, mirrorDef(byId('hut')), GRID - 30 - 7, 70, 10);
  // silos by the farms — the plains' skyline
  for (const [sx, sz] of [[32, 25], [26, 56], [36, 71]] as const) {
    for (const tx of [sx, GRID - 1 - sx]) {
      claim(grid, claims, tx, sz, T_WALL);
      props.push({ type: 'silo', pos: tw(tx, sz), scale: 1, rot: 0 });
    }
  }

  // NO-MAN'S LANE: burned hulls down the center — the only cover out there
  for (const [wx, wz, r] of [[48, 27, 0.8], [51, 42, 2.4], [47, 57, 5.5], [52, 72, 1.2], [49, 87, 4.0]] as const) {
    claim(grid, claims, wx, wz, T_COVER);
    props.push({ type: 'wreck', pos: tw(wx, wz), scale: 1.1, rot: r });
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['tank', 'tank', 'apc', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 50, ['tank', 'tank', 'apc', 'buggy', 'ambulance']);
  d.vehiclePads.push({ kind: 'emplacement', team: 0, pos: tw(30, 42) });
  d.vehiclePads.push({ kind: 'emplacement', team: 1, pos: tw(GRID - 31, 58) });
  clearDisc(grid, 30, 42, 2); clearDisc(grid, GRID - 31, 58, 2);

  dealPickups(d, [[38, 27, 'ammo'], [42, 43, 'medkit'], [38, 58, 'energy'], [42, 73, 'ammo']]);
  sealRim(grid);

  return {
    seed, theme: 'savanna', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 50)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 50)],
    flagPos: [tw(10, 50), tw(GRID - 11, 50)],
    hillPos: tw(50, 50),
    controlPoints: [
      { name: 'NORTH FARM', pos: tw(26, 28) },
      { name: 'CROSSROADS', pos: tw(48, 47) },
      { name: 'SOUTH FARM', pos: tw(73, 72) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 4 · THE CITY — a street grid of grown districts, a plaza, and a canal.
// Signature: the K9 clearing an apartment stack room by room.
// Doctrine: infantry country — K9, UGV, engineers. Scar: rubble.
// ---------------------------------------------------------------------------
function theCity(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_GRIT); // asphalt world; parks paint over it
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);

  // PAVE THE GRID: avenues and cross-streets in plate — the city reads as a
  // city from command height (the atlas showed one undifferentiated slab)
  for (const ax of [18, 38, 58, 78]) rectSurf(surface, ax, 6, ax + 3, 87, S_PLATE);
  for (const sz of [20, 44, 68]) rectSurf(surface, 8, sz, 91, sz + 3, S_PLATE);

  // the CANAL along the south edge — the "sewer" lane, two footbridges
  rect(grid, 8, 88, 91, 92, T_WATER);
  rect(grid, 8, 89, 91, 91, T_DEEP);
  for (const bx of [28, 70]) {
    rect(grid, bx, 88, bx + 1, 92, T_OPEN);
    rectSurf(surface, bx, 88, bx + 1, 92, S_PLATE);
  }

  // districts on a 3×3-ish grid; avenues x=18/38/58/78, streets z=20/44/68.
  // Every lot is GROWN — no two cities share a floor plan — but the LOTS are
  // authored so the street grid always reads.
  const lots: { x: number; z: number; kind: 'house' | 'shop' | 'office' | 'factory' | 'ruin' }[] = [
    { x: 22, z: 8, kind: 'house' }, { x: 42, z: 8, kind: 'house' }, { x: 62, z: 8, kind: 'shop' },
    { x: 22, z: 26, kind: 'ruin' }, { x: 42, z: 26, kind: 'office' }, { x: 62, z: 26, kind: 'shop' },
    { x: 22, z: 50, kind: 'shop' }, { x: 62, z: 50, kind: 'office' },
    { x: 22, z: 72, kind: 'house' }, { x: 42, z: 72, kind: 'factory' }, { x: 62, z: 72, kind: 'house' },
  ];
  // STREET LAW: a lot is 15 tiles wide — the avenues are the city's lanes
  // and no grown floor plan gets to wall one shut. A def that outgrows its
  // lot falls back to authored stock that fits. Deterministic per seed.
  const fits = (def: BuildingDef) =>
    def.rows.length <= 15 && Math.max(...def.rows.map((r) => r.length)) <= 15;
  const clamp = (def: BuildingDef, fallback: string) => (fits(def) ? def : byId(fallback));
  for (const lot of lots) {
    const def =
      lot.kind === 'house' ? clamp(generateHouse(d.rng, 'bungalow'), 'rowhouse')
      : lot.kind === 'shop' ? clamp(generateDistrict(d.rng, d.rng.next() < 0.5 ? 'storefront' : 'market'), 'depot')
      : lot.kind === 'office' ? clamp(generateDistrict(d.rng, 'office'), 'barracks_hall')
      : lot.kind === 'factory' ? clamp(generateDistrict(d.rng, 'factory'), 'machine_shop')
      : byId('ruin');
    stampBuilding(ctx, def, lot.x, lot.z, lot.x + lot.z);
    if (lot.kind === 'ruin') {
      // the shelled block: rubble spills into the street
      for (let i = 0; i < 6; i++) {
        const rx = lot.x + d.rng.int(-2, 10), rz = lot.z + d.rng.int(-2, 8);
        if (grid[idx(rx, rz)] === T_OPEN) {
          claim(grid, claims, rx, rz, T_COVER);
          props.push({ type: 'rock', pos: tw(rx, rz), scale: 0.7, rot: d.rng.range(0, Math.PI * 2) });
        }
      }
    }
  }

  // THE PLAZA: the city's heart — open, paved, and watched from every side.
  // The monument is THE MEMORIAL: Robert's soldier cast in bronze, facing
  // south down the plaza toward the CP — the city remembers its dead.
  rect(grid, 44, 46, 56, 62, T_OPEN);
  rectSurf(surface, 44, 46, 56, 62, S_PLATE);
  claim(grid, claims, 50, 54, T_WALL);
  props.push({ type: 'memorial', pos: tw(50, 54), scale: 1.25, rot: -Math.PI / 2 });
  for (const [px, pz] of [[46, 48], [54, 48], [46, 60], [54, 60]] as const) {
    claim(grid, claims, px, pz, T_COVER);
    props.push({ type: 'crate', pos: tw(px, pz), scale: 1, rot: d.rng.range(0, Math.PI) });
  }

  // burnt cars at the big intersections — street cover, city texture
  for (const [wx, wz] of [[38, 44], [58, 20], [78, 68], [18, 68], [58, 44]] as const) {
    if (grid[idx(wx, wz)] === T_OPEN) {
      claim(grid, claims, wx, wz, T_COVER);
      props.push({ type: 'wreck', pos: tw(wx, wz), scale: 0.8, rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  // THE OUTSKIRTS: the flanks are edge-of-town, not empty felt — junked
  // cars, dumped crates, and rubble where the city frays toward the bases
  for (let i = 0; i < 10; i++) {
    const west = i % 2 === 0;
    const tx = west ? d.rng.int(9, 16) : d.rng.int(83, 90);
    const tz = d.rng.int(10, 84);
    if (grid[idx(tx, tz)] !== T_OPEN || Math.abs(tz - 50) < 9) continue; // the base lanes stay clear
    const roll = d.rng.next();
    if (roll < 0.4) {
      claim(grid, claims, tx, tz, T_COVER);
      props.push({ type: 'wreck', pos: tw(tx, tz), scale: 0.75, rot: d.rng.range(0, Math.PI * 2) });
    } else if (roll < 0.7) {
      claim(grid, claims, tx, tz, T_COVER);
      props.push({ type: 'crate', pos: tw(tx, tz), scale: 1, rot: d.rng.range(0, Math.PI) });
    } else {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: 0.8, rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['apc', 'buggy', 'bike', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 50, ['apc', 'buggy', 'bike', 'ambulance']);

  dealPickups(d, [[38, 22, 'medkit'], [40, 46, 'ammo'], [38, 70, 'energy'], [30, 90, 'ammo']]);
  mudMargins(grid, surface);
  sealRim(grid);

  return {
    seed, theme: 'savanna', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 50)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 50)],
    flagPos: [tw(10, 50), tw(GRID - 11, 50)],
    hillPos: tw(50, 54),
    controlPoints: [
      { name: 'MARKET', pos: tw(30, 46) },
      { name: 'PLAZA', pos: tw(50, 56) },
      { name: 'DEPOT', pos: tw(70, 46) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 5 · HIGHLAND PASS — one road through solid rock. Switchbacks, two chokes,
// two goat paths, and a climb-wall shortcut for the airborne.
// Signature: the MANPADS ambush on a helo threading the pass.
// Doctrine: air + transport. Scar: blocked (avalanche closes a route).
// ---------------------------------------------------------------------------
function highlandPass(seed: number): GameMap {
  const d = draft(seed, T_WALL, S_DIRT); // solid mountain; we CARVE the map
  const { grid, surface, props, claims } = d;

  // THE ROAD: west gate → north shelf → east wall → south shelf → east gate.
  // Four switchback legs, four tiles wide — the only ground vehicles get.
  const carveRoad = (x0: number, z0: number, x1: number, z1: number) => {
    rect(grid, x0, z0, x1, z1, T_OPEN);
    rectSurf(surface, x0, z0, x1, z1, S_GRIT);
  };
  carveRoad(4, 48, 30, 52);    // west approach
  carveRoad(27, 24, 31, 52);   // climb north
  carveRoad(27, 24, 72, 28);   // the north shelf
  carveRoad(69, 24, 73, 76);   // the long east descent
  carveRoad(69, 72, 95, 76);   // east approach

  // ALPINE MEADOWS: two passing bays where a convoy can turn and fight —
  // each with its lane onto the road (a bay you can't enter is a painting)
  clearDisc(grid, 38, 26, 5); rectSurf(surface, 33, 21, 43, 31, S_DIRT);
  clearDisc(grid, 62, 74, 5); rectSurf(surface, 57, 69, 67, 79, S_DIRT);
  rect(grid, 66, 72, 70, 74, T_OPEN); // the SE meadow's gate onto the descent
  rectSurf(surface, 66, 72, 70, 74, S_DIRT);

  // GOAT PATHS: two one-tile infantry threads the road never sees
  rect(grid, 14, 30, 15, 49, T_OPEN);  // west thread: approach → north shelf
  rect(grid, 14, 30, 27, 31, T_OPEN);
  rect(grid, 84, 51, 85, 73, T_OPEN);  // east thread: descent shortcut
  rect(grid, 73, 51, 85, 52, T_OPEN);

  // THE CHOKES: avalanche rubble narrows the shelf and the descent to a
  // two-tile squeeze — the MANPADS ambush points
  for (const [cx, cz] of [[50, 24], [69, 50]] as const) {
    claim(grid, claims, cx, cz, T_WALL);
    claim(grid, claims, cx + 1, cz, T_WALL);
    props.push({ type: 'rock', pos: tw(cx, cz), scale: 1.6, rot: d.rng.range(0, Math.PI * 2) });
    props.push({ type: 'rock', pos: tw(cx + 1, cz + 1), scale: 1.2, rot: d.rng.range(0, Math.PI * 2) });
  }

  // THE CLIMB SHORTCUT: a saddle in the spine between the two shelves —
  // jump troopers and the bold cross here; everyone else drives around
  rect(grid, 48, 40, 50, 44, T_CLIMB);
  rect(grid, 48, 29, 50, 39, T_OPEN);
  rect(grid, 48, 45, 50, 60, T_OPEN);
  rect(grid, 48, 60, 72, 62, T_OPEN); // the saddle exit joins the descent
  rectSurf(surface, 48, 29, 50, 62, S_DIRT);

  // overlook ledges: one emplacement each side, watching a choke — each
  // ledge gets its walk-up (an orphaned gun is a decoration, not a position)
  clearDisc(grid, 44, 20, 2);
  rect(grid, 44, 21, 45, 24, T_OPEN); // the ledge path down to the shelf
  clearDisc(grid, 76, 56, 2);
  d.vehiclePads.push({ kind: 'emplacement', team: 0, pos: tw(44, 20) });
  d.vehiclePads.push({ kind: 'emplacement', team: 1, pos: tw(76, 56) });

  // the way stations — shelter on the shelves
  const ctx = ctxOf(d);
  stampBuilding(ctx, byId('shack'), 34, 22, 0);
  stampBuilding(ctx, byId('shack'), 60, 71, 2);
  stampBuilding(ctx, byId('guard_post'), 52, 30, 4);

  // the convoy that never made it out of the pass — burned out on the long
  // descent, right under the east overlook. The ambush story, told in steel.
  for (const [wx, wz, r] of [[70, 56, 1.7], [71, 60, 0.2]] as const) {
    if (grid[idx(wx, wz)] === T_OPEN) {
      claim(grid, claims, wx, wz, T_COVER);
      props.push({ type: 'wreck', pos: tw(wx, wz), scale: 1, rot: r });
    }
  }

  // base pockets carved into the rock at the gates
  clearDisc(grid, 10, 50, 8);
  clearDisc(grid, GRID - 11, 74, 8);
  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['transport', 'flyer', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 74, ['transport', 'flyer', 'buggy', 'ambulance']);
  // the r8 pocket carve leaks a sliver BEHIND each base's back wall — rock
  // swallows it again (the zero-orphan law named these tiles exactly)
  rect(grid, 1, 42, 3, 58, T_WALL);
  rect(grid, GRID - 4, 66, GRID - 2, 82, T_WALL);

  dealPickups(d, [[38, 25, 'ammo'], [30, 44, 'medkit'], [49, 33, 'energy']]);
  sealRim(grid);

  return {
    seed, theme: 'asteroid', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 74)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 74)],
    flagPos: [tw(10, 50), tw(GRID - 11, 74)],
    hillPos: tw(50, 26),
    controlPoints: [
      { name: 'WEST ELBOW', pos: tw(29, 40) },
      { name: 'THE NARROWS', pos: tw(52, 26) },
      { name: 'EAST ELBOW', pos: tw(71, 60) },
    ],
    // carved world: the quarantine crawls out of the NETWORK, never out of
    // rock pockets no path serves — every mouth sits on a road or a trail
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: [
      tw(6, 50), tw(38, 22), tw(54, 26), tw(62, 26), tw(72, 32),
      tw(62, 74), tw(72, 70), tw(92, 74), tw(15, 34), tw(84, 60), tw(49, 33), tw(49, 56),
    ],
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 6 · BLACKSITE — a polar research station on sea ice. Lab compound, antenna
// farm, landing pad, and open leads of black water cracking the floe.
// Signature: thermal-camo operators vs K9 sweeps in a whiteout.
// Doctrine: infiltration — bikes and eyes. Scar: frozen (the leads seal).
// ---------------------------------------------------------------------------

/** the lab tower — two storeys of metal, slit nests over the compound */
const LAB_TOWER: BuildingDef = {
  id: 'lab_tower', name: 'Lab Tower', kind: 'military', floors: 2,
  rows: [
    'MMSMM',
    'M...M',
    'S.L.S',
    'M.P.M',
    'MMDMM',
  ],
  rows2: [
    '#S#S#',
    'S...S',
    '#.L.#',
    'S...S',
    '#S#S#',
  ],
};

function blacksite(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_ICE);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);

  // OPEN LEADS: three cracks of black water across the floe — swim or walk
  // around; the frozen scar seals them and rewrites every route
  const lead = (pts: [number, number][]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(x0 + ((x1 - x0) * s) / steps);
        const z = Math.round(z0 + ((z1 - z0) * s) / steps);
        set(grid, x, z, T_DEEP);
        set(grid, x + 1, z, T_WATER);
        set(grid, x, z + 1, T_WATER);
      }
    }
  };
  lead([[12, 20], [30, 28], [44, 22], [58, 30]]);
  lead([[40, 86], [56, 74], [72, 80], [86, 68]]);
  lead([[70, 12], [80, 26], [92, 32]]);

  // THE COMPOUND: three metal labs around a plate courtyard — the whiteout's
  // one warm heart. Walkway rails guide you home when visibility dies.
  stampBuilding(ctx, LAB_TOWER, 44, 42, 0);
  stampBuilding(ctx, byId('machine_shop'), 52, 40, 2);
  stampBuilding(ctx, byId('barracks_hall'), 44, 54, 4);
  rect(grid, 42, 48, 60, 52, T_OPEN);
  rectSurf(surface, 42, 48, 60, 52, S_PLATE);
  for (let x = 42; x <= 60; x += 2) {
    // mouths at the center — and NEVER across a lab's own doorstep (the
    // atlas caught the tower door walled shut by its own walkway rail)
    if (x === 46 || x === 50 || x === 52) continue;
    set(grid, x, 47, T_COVER);
    set(grid, x, 53, T_COVER);
  }

  // ANTENNA FARM: the north-west listening post — masts in a boulder field
  for (const [ax, az] of [[28, 26], [32, 30], [26, 33], [35, 25], [30, 22], [24, 28]] as const) {
    claim(grid, claims, ax, az, T_COVER);
    props.push({ type: 'flare_stack', pos: tw(ax, az), scale: 0.7, rot: 0 });
  }

  // LANDING PAD: south-east plate disc — the extraction point
  clearDisc(grid, 68, 66, 4);
  for (let z = 62; z <= 70; z++) for (let x = 64; x <= 72; x++) {
    if ((x - 68) ** 2 + (z - 66) ** 2 <= 16) surface[idx(x, z)] = S_PLATE;
  }

  // perimeter: guard posts on the cardinals, a broken fence line between
  stampBuilding(ctx, byId('guard_post'), 47, 18, 6);
  stampBuilding(ctx, byId('guard_post'), 47, 78, 8);
  ring(grid, 50, 50, 30, T_COVER, [[0, 20], [70, 110], [160, 200], [250, 290], [340, 360]]);

  // pressure ridges: ice boulders drift the floe (dressing)
  for (let i = 0; i < 22; i++) {
    const tx = d.rng.int(8, GRID - 9), tz = d.rng.int(8, GRID - 9);
    if (Math.hypot(tx - 50, tz - 50) > 16 && grid[idx(tx, tz)] === T_OPEN && Math.abs(tz - 50) > 8) {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(0.9, 1.6), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['bike', 'buggy', 'flyer', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 50, ['bike', 'buggy', 'flyer', 'ambulance']);

  dealPickups(d, [[34, 40, 'medkit'], [34, 60, 'ammo'], [42, 30, 'energy']]);
  d.pickups.push({ type: 'flamer', pos: tw(68, 66) }); // the pad cache
  mudMargins(grid, surface);
  sealRim(grid);

  return {
    seed, theme: 'triton', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 50)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 50)],
    flagPos: [tw(10, 50), tw(GRID - 11, 50)],
    hillPos: tw(51, 50),
    controlPoints: [
      { name: 'ANTENNA FARM', pos: tw(30, 27) },
      { name: 'THE LABS', pos: tw(51, 50) },
      { name: 'LANDING PAD', pos: tw(68, 66) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 7 · REFINERY — a petrochemical maze: two tank farms, pipe racks, flare
// stacks, and a control block in the middle of it all.
// Signature: the thermobaric chain walking down the tank farm.
// Doctrine: engineers and fire. Scar: fire (tanks burn for the campaign).
// ---------------------------------------------------------------------------

/** the control room — metal, slits, and the two doors everyone fights over */
const CONTROL_ROOM: BuildingDef = {
  id: 'control_room', name: 'Control Room', kind: 'military', floors: 1,
  rows: [
    'MMMSMMM',
    'M.C...M',
    'S..P..S',
    'M...C.M',
    'MMDMMDM',
  ],
};

function refinery(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_PLATE);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);

  // containment aprons under each tank farm: grit stains against the plate,
  // so the farms read as districts instead of dots on a slab
  rectSurf(surface, 22, 26, 43, 72, S_GRIT);
  rectSurf(surface, GRID - 44, 26, GRID - 23, 72, S_GRIT);

  // TANK FARMS: three storage tanks a side, mirrored — every tank a fat
  // silhouette you can't see past and shouldn't stand beside
  for (const [cx, cz] of [[28, 32], [28, 50], [28, 68], [38, 41], [38, 59]] as const) {
    for (const tx of [cx, GRID - 1 - cx]) {
      clearDisc(grid, tx, cz, 3);
      for (let z = cz - 2; z <= cz + 2; z++) for (let x = tx - 2; x <= tx + 2; x++) {
        if ((x - tx) ** 2 + (z - cz) ** 2 <= 5) claim(grid, claims, x, z, T_WALL);
      }
      props.push({ type: 'silo', pos: tw(tx, cz), scale: 2.1, rot: 0 });
    }
  }

  // FLARE STACKS: four pilot lights on the skyline — the chain-reaction bait
  for (const [fx, fz] of [[22, 20], [22, 80]] as const) {
    for (const tx of [fx, GRID - 1 - fx]) {
      claim(grid, claims, tx, fz, T_WALL);
      props.push({ type: 'flare_stack', pos: tw(tx, fz), scale: 1.2, rot: 0 });
    }
  }

  // PIPE RACKS: two east-west runs with crawl gaps — infantry cover the
  // whole way across, vehicles pick a gap and pray
  for (const z of [24, 76]) {
    for (let x = 18; x <= 81; x++) {
      if (x === 30 || x === 50 || x === 70) continue;
      set(grid, x, z, T_COVER);
    }
  }

  // process blocks: pump houses and the machine shop, mirrored
  stampBuilding(ctx, byId('pumphouse'), 42, 30, 0);
  stampBuilding(ctx, mirrorDef(byId('pumphouse')), GRID - 42 - 5, 30, 2);
  stampBuilding(ctx, byId('machine_shop'), 40, 64, 4);
  stampBuilding(ctx, mirrorDef(byId('machine_shop')), GRID - 40 - 9, 64, 6);

  // THE CONTROL ROOM: dead center — hold the switches, hold the front
  stampBuilding(ctx, CONTROL_ROOM, 46, 46, 8);

  // drum stacks in the alleys and along the empty top/bottom bands
  for (let i = 0; i < 16; i++) {
    const tx = d.rng.int(20, 79), tz = d.rng.int(14, 86);
    if (grid[idx(tx, tz)] === T_OPEN && Math.hypot(tx - 50, tz - 50) > 9 && Math.abs(tz - 50) > 4) {
      claim(grid, claims, tx, tz, T_COVER);
      props.push({ type: 'crate', pos: tw(tx, tz), scale: 1, rot: d.rng.range(0, Math.PI) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['apc', 'tunneler', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 50, ['apc', 'tunneler', 'buggy', 'ambulance']);

  dealPickups(d, [[34, 24, 'ammo'], [34, 76, 'medkit'], [44, 40, 'flamer']]);
  sealRim(grid);

  return {
    seed, theme: 'starship', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 50)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 50)],
    flagPos: [tw(10, 50), tw(GRID - 11, 50)],
    hillPos: tw(49, 52),
    controlPoints: [
      { name: 'WEST FARM', pos: tw(33, 41) },
      { name: 'CONTROL', pos: tw(49, 52) },
      { name: 'EAST FARM', pos: tw(66, 59) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 8 · THE PORT — a harbor channel splits the terminal; the moored ship is
// the main crossing, the north mole the naked one.
// Signature: the assault-boat run onto the pier under fire.
// Doctrine: boats and the air. Scar: flooded (lanes drown).
// ---------------------------------------------------------------------------
function thePort(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_WET);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);

  // THE CHANNEL: deep water down the middle, working rims you can wade
  rect(grid, 44, 1, 55, GRID - 2, T_WATER);
  rect(grid, 46, 1, 53, GRID - 2, T_DEEP);

  // THE SHIP (z 40..52): a moored hull spanning the channel. Metal sides,
  // plate deck, container stacks for deck cover, gangways both banks —
  // boarding her IS crossing the harbor.
  rect(grid, 42, 40, 57, 52, T_OPEN);
  rectSurf(surface, 42, 40, 57, 52, S_PLATE);
  for (let x = 42; x <= 57; x++) {
    if (x >= 48 && x <= 51) continue; // bow/stern working gaps stay walls
    set(grid, x, 40, T_METAL);
    set(grid, x, 52, T_METAL);
  }
  set(grid, 48, 40, T_METAL); set(grid, 51, 40, T_METAL);
  set(grid, 48, 52, T_METAL); set(grid, 51, 52, T_METAL);
  rect(grid, 42, 41, 42, 51, T_METAL);
  rect(grid, 57, 41, 57, 51, T_METAL);
  // gangways: the only doors onto the deck
  set(grid, 42, 45, T_DOOR); set(grid, 42, 46, T_DOOR);
  set(grid, 57, 45, T_DOOR); set(grid, 57, 46, T_DOOR);
  // deck cargo: climb stacks — jump troopers own the high line
  rect(grid, 45, 43, 46, 44, T_CLIMB);
  rect(grid, 52, 48, 53, 49, T_CLIMB);
  rect(grid, 49, 45, 50, 46, T_COVER);

  // THE NORTH MOLE (z 18..19): a bare plate causeway — fast and lethal
  rect(grid, 44, 18, 55, 19, T_OPEN);
  rectSurf(surface, 44, 18, 55, 19, S_PLATE);

  // CONTAINER YARDS: climb-wall lanes on both banks — the crane's kingdom.
  // The yards stand on paved aprons so the terminal reads paved against the
  // wet europa ground.
  const yard = (x0: number) => {
    rectSurf(surface, x0 - 2, 26, x0 + 14, 36, S_PLATE);
    rectSurf(surface, x0 - 2, 56, x0 + 14, 66, S_PLATE);
    for (const z of [28, 34, 58, 64]) {
      for (let x = x0; x <= x0 + 12; x++) {
        if (x === x0 + 6) continue; // every run has one broken slot
        set(grid, x, z, T_CLIMB);
      }
    }
  };
  yard(24); yard(GRID - 1 - 36);
  // stray boxes and dockside clutter toward the corners — a working port
  // is never swept clean
  for (const [bx, bz] of [[16, 14], [20, 82], [83, 14], [79, 84], [36, 12], [63, 88]] as const) {
    if (grid[idx(bx, bz)] === T_OPEN) {
      set(grid, bx, bz, T_CLIMB);
      set(grid, bx + 1, bz, T_CLIMB);
    }
  }
  for (const [cx, cz] of [[30, 31], [30, 61]] as const) {
    for (const tx of [cx, GRID - 1 - cx]) {
      props.push({ type: 'crane', pos: tw(tx, cz), scale: 1, rot: tx > 50 ? Math.PI : 0 });
    }
  }

  // warehouses back the yards
  stampBuilding(ctx, byId('warehouse'), 20, 42, 0);
  stampBuilding(ctx, mirrorDef(byId('warehouse')), GRID - 20 - 11, 42, 2);
  stampBuilding(ctx, byId('depot'), 26, 74, 4);
  stampBuilding(ctx, mirrorDef(byId('depot')), GRID - 26 - 9, 74, 6);

  // THE PLATFORM: an offshore plate island south — ladder up from the water,
  // a cache worth swimming for
  rect(grid, 47, 74, 52, 79, T_OPEN);
  rectSurf(surface, 47, 74, 52, 79, S_PLATE);
  set(grid, 47, 76, T_LADDER); set(grid, 52, 77, T_LADDER);
  d.pickups.push({ type: 'flamer', pos: tw(49, 76) });
  d.pickups.push({ type: 'energy', pos: tw(50, 77) });

  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['apc', 'buggy', 'flyer', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 50, ['apc', 'buggy', 'flyer', 'ambulance']);
  d.vehiclePads.push({ kind: 'boat', team: 0, pos: tw(45, 30) });
  d.vehiclePads.push({ kind: 'boat', team: 1, pos: tw(54, 66) });

  dealPickups(d, [[36, 20, 'ammo'], [38, 46, 'medkit'], [36, 70, 'ammo']]);
  mudMargins(grid, surface);
  sealRim(grid);

  return {
    seed, theme: 'europa', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 50)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 50)],
    flagPos: [tw(10, 50), tw(GRID - 11, 50)],
    hillPos: tw(49, 46),
    controlPoints: [
      { name: 'WEST YARD', pos: tw(30, 46) },
      { name: 'THE SHIP', pos: tw(49, 46) },
      { name: 'EAST YARD', pos: tw(69, 46) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 9 · AIRBASE — the runway is the map: 24 units of open plate everyone has
// to cross. Hangars north, revetments south, the tower watching it all.
// Signature: stealing a prototype out of a hangar with the runway burning.
// Doctrine: everything that flies. Scar: blocked (cratered runway).
// ---------------------------------------------------------------------------

/** a hangar: metal shell, one open maw south, stocked deep */
const HANGAR: BuildingDef = {
  id: 'hangar', name: 'Hangar', kind: 'industrial', floors: 1,
  rows: [
    'MMMMMMMMMMMM',
    'M..C.....C.M',
    'M....P.....M',
    'M.C.....C..M',
    'MMMM....MMMM',
  ],
};

/** the tower — two storeys, glass all round, the airfield's one true nest */
const TOWER: BuildingDef = {
  id: 'tower', name: 'Control Tower', kind: 'military', floors: 2,
  rows: [
    'MSMSM',
    'S...S',
    'M.L.M',
    'S.P.S',
    'MMDMM',
  ],
  rows2: [
    '#S#S#',
    'S...S',
    '#.L.#',
    'S...S',
    '#S#S#',
  ],
};

function airbase(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_GRASS);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);

  // THE RUNWAY: eight tiles of plate, end to end. No cover. That's the point.
  rectSurf(surface, 8, 46, 91, 53, S_PLATE);
  // taxiway north, with two connectors
  rectSurf(surface, 16, 40, 83, 41, S_PLATE);
  rectSurf(surface, 30, 42, 31, 45, S_PLATE);
  rectSurf(surface, 68, 42, 69, 45, S_PLATE);

  // HANGAR ROW: three sheds north of the taxiway — the prototype lives here
  stampBuilding(ctx, HANGAR, 20, 24, 0);
  stampBuilding(ctx, HANGAR, 44, 24, 2);
  stampBuilding(ctx, HANGAR, 68, 24, 4);

  // THE TOWER: mid-field north, watching every inch of plate
  stampBuilding(ctx, TOWER, 58, 33, 6);

  // REVETMENTS: four C-berms south of the runway sheltering the ready line
  for (const rx of [24, 40, 56, 72]) {
    for (let x = rx - 3; x <= rx + 3; x++) set(grid, x, 66, T_COVER);
    for (let z = 61; z <= 66; z++) { set(grid, rx - 3, z, T_COVER); set(grid, rx + 3, z, T_COVER); }
  }

  // FUEL FARM: south of the revetment line, inside CP reach
  for (const [sx, sz] of [[70, 72], [74, 74], [70, 77]] as const) {
    claim(grid, claims, sx, sz, T_WALL);
    props.push({ type: 'silo', pos: tw(sx, sz), scale: 1.6, rot: 0 });
  }
  rectSurf(surface, 66, 69, 78, 81, S_DIRT);

  // radar mast + its guard shack, south-west
  claim(grid, claims, 18, 72, T_WALL);
  props.push({ type: 'flare_stack', pos: tw(18, 72), scale: 1, rot: 0 });
  stampBuilding(ctx, byId('guard_post'), 22, 74, 8);

  // THE BONEYARD: gutted airframes in the north-east grass — the war's been
  // here before, and the wrecks are the only cover on that approach
  for (const [wx, wz, r] of [[78, 14, 0.8], [84, 18, 2.2], [80, 22, 4.1]] as const) {
    claim(grid, claims, wx, wz, T_COVER);
    props.push({ type: 'wreck', pos: tw(wx, wz), scale: 1.2, rot: r });
  }

  // bases sit OFF the strip, diagonal — the atlas caught the runway running
  // straight through both spawn pockets. Now every route to the far
  // objectives crosses the open plate, which is the whole front.
  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 72, ['flyer', 'flyer', 'tank', 'transport', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 28, ['flyer', 'flyer', 'tank', 'transport', 'ambulance']);
  // the SAM ring: one emplacement in a forward revetment each
  d.vehiclePads.push({ kind: 'emplacement', team: 0, pos: tw(24, 63) });
  d.vehiclePads.push({ kind: 'emplacement', team: 1, pos: tw(72, 63) });

  dealPickups(d, [[36, 44, 'ammo'], [36, 58, 'medkit'], [44, 70, 'energy']]);
  sealRim(grid);

  return {
    seed, theme: 'savanna', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 72), tw(GRID - 11, 28)],
    spawns: [spawnRing(10, 72), spawnRing(GRID - 11, 28)],
    flagPos: [tw(10, 72), tw(GRID - 11, 28)],
    hillPos: tw(50, 49), // KOTH on the centerline — sprint, hold, pray
    controlPoints: [
      // rotationally paired around the strip — conquest stays fair from
      // diagonal bases: A is NW, C is its 180° twin SE, B is the plate
      { name: 'HANGAR ROW', pos: tw(30, 28) },
      { name: 'THE RUNWAY', pos: tw(50, 49) },
      { name: 'FUEL FARM', pos: tw(70, 72) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 10 · THE MINE — an open pit of climb-wall terraces over a bunkered floor,
// with two roofed galleries through the rock. The breacher's drill turns
// walls into doors here — the map is literally rewritable.
// Signature: the breacher surfacing INSIDE the enemy gallery.
// Doctrine: breachers, K9s, UGVs. Scar: rubble (galleries collapse).
// ---------------------------------------------------------------------------

/** a gallery: a roofed corridor through rock — dark, stocked, breachable */
const GALLERY: BuildingDef = {
  id: 'gallery', name: 'Mine Gallery', kind: 'industrial', floors: 1,
  rows: [
    'MMMMMMMMMMMMMMMMMMMM',
    'M..C....P......C...M',
    'D..................D',
    'M...C......P....C..M',
    'MMMMMMMMMMMMMMMMMMMM',
  ],
};

function theMine(seed: number): GameMap {
  const d = draft(seed, T_OPEN, S_DIRT);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);
  const C = 50;

  // THE PIT: three terrace rings of climb wall. Ramp gaps rotate a quarter
  // turn per ring, so descending is a spiral, not a straight drop.
  ring(grid, C, C, 26, T_CLIMB, [[350, 360], [0, 10], [170, 190]]);            // rim: E + W ramps
  ring(grid, C, C, 19, T_CLIMB, [[80, 100], [260, 280]]);                      // mid: S + N ramps
  ring(grid, C, C, 12, T_CLIMB, [[35, 55], [215, 235]]);                       // floor lip: NE + SW
  // the haul road reads the SPIRAL it actually drives (the atlas caught the
  // first draft painting a straight cross that dead-ended into every ring)
  const arcSurf = (r0: number, r1: number, a0: number, a1: number) => {
    for (let z = C - r1 - 1; z <= C + r1 + 1; z++) for (let x = C - r1 - 1; x <= C + r1 + 1; x++) {
      const dx = x - C, dz = z - C;
      const r = Math.hypot(dx, dz);
      if (r < r0 || r > r1) continue;
      let a = (Math.atan2(dz, dx) * 180) / Math.PI;
      if (a < 0) a += 360;
      if ((a >= a0 && a <= a1) || (a1 > 360 && a + 360 <= a1)) {
        if (inb(x) && inb(z)) surface[idx(x, z)] = S_GRIT;
      }
    }
  };
  rectSurf(surface, 18, 48, 25, 52, S_GRIT);   // west gate → rim ramp
  rectSurf(surface, 75, 48, 82, 52, S_GRIT);   // east gate → rim ramp
  arcSurf(20, 25, 90, 180);                    // W entry, upper bench, to the S mid gap
  arcSurf(20, 25, 270, 360);                   // E entry's twin bench to the N mid gap
  arcSurf(13, 18, 90, 230);                    // S mid gap, lower bench, to the SW lip
  arcSurf(13, 18, 270, 410);                   // N mid gap, lower bench, to the NE lip
  rectSurf(surface, 55, 42, 59, 45, S_GRIT);   // NE lip spill onto the floor
  rectSurf(surface, 41, 55, 45, 58, S_GRIT);   // SW lip spill onto the floor

  // the ore body: the pit floor's only cover
  clearDisc(grid, C, C, 10);
  for (const [ox, oz] of [[48, 48], [52, 52], [47, 52]] as const) {
    claim(grid, claims, ox, oz, T_WALL);
    props.push({ type: 'rock', pos: tw(ox, oz), scale: 1.3, rot: d.rng.range(0, Math.PI * 2) });
  }
  claim(grid, claims, 52, 48, T_COVER);
  props.push({ type: 'crate', pos: tw(52, 48), scale: 1, rot: 0.4 });

  // THE GALLERIES: two roofed corridors north and south of the pit — the
  // quarantine's favorite dark. Doors at both ends; the drill makes more.
  stampBuilding(ctx, GALLERY, 38, 14, 0);
  stampBuilding(ctx, GALLERY, 42, 82, 4);

  // the bunker complex at the north-east rim — the guard station
  stampBuilding(ctx, byId('bunker'), 66, 30, 8);
  stampBuilding(ctx, byId('guard_post'), 30, 66, 10);

  // THE HEADFRAME: the mine's silhouette, over the east ramp, with its
  // conveyor running to the rim
  props.push({ type: 'crane', pos: tw(80, 50), scale: 1.1, rot: Math.PI });
  for (let x = 84; x <= 92; x++) { if (x % 2 === 0) set(grid, x, 50, T_COVER); }

  // the guard station's supply line: crates between bunker and rim
  for (const [cx2, cz2] of [[62, 34], [59, 30]] as const) {
    claim(grid, claims, cx2, cz2, T_COVER);
    props.push({ type: 'crate', pos: tw(cx2, cz2), scale: 1, rot: d.rng.range(0, Math.PI) });
  }

  // spoil heaps: the rng piles rock where the mine dumped it
  for (let i = 0; i < 20; i++) {
    const tx = d.rng.int(8, GRID - 9), tz = d.rng.int(8, GRID - 9);
    if (Math.hypot(tx - C, tz - C) > 30 && Math.abs(tz - 50) > 9 && grid[idx(tx, tz)] === T_OPEN) {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(1.0, 1.7), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, 10, 50, ['tunneler', 'apc', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, GRID - 11, 50, ['tunneler', 'apc', 'buggy', 'ambulance']);

  dealPickups(d, [[32, 40, 'medkit'], [32, 60, 'ammo'], [40, 34, 'energy']]);
  sealRim(grid);

  return {
    seed, theme: 'asteroid', grid, grid2: d.grid2, surface,
    basePos: [tw(10, 50), tw(GRID - 11, 50)],
    spawns: [spawnRing(10, 50), spawnRing(GRID - 11, 50)],
    flagPos: [tw(10, 50), tw(GRID - 11, 50)],
    hillPos: tw(C, C), // the pit floor — king of the hole
    controlPoints: [
      { name: 'NORTH GALLERY', pos: tw(48, 16) },
      { name: 'THE PIT', pos: tw(C, C) },
      { name: 'SOUTH GALLERY', pos: tw(52, 84) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// the registry — main.ts and world.ts deploy through this door
// ---------------------------------------------------------------------------

export const FRONT_GROUNDS: Record<string, (seed: number) => GameMap> = {
  bridge_delta: bridgeDelta,
  fort_raven: fortRaven,
  eastern_plains: easternPlains,
  the_city: theCity,
  highland_pass: highlandPass,
  blacksite,
  refinery,
  the_port: thePort,
  airbase,
  the_mine: theMine,
};

/** authored ground for a Scar front. Unknown ids fall back to null so the
 *  caller can keep the old recipe path (forward compat with new fronts). */
export function generateFront(frontId: string, seed: number): GameMap | null {
  const gen = FRONT_GROUNDS[frontId];
  return gen ? gen(seed) : null;
}

/** exported for tests: every stencil a front hand-authors answers to the
 *  same connectivity law as the grown stock — no sealed rooms, ever. */
export const FRONT_STENCILS: BuildingDef[] = [THE_KEEP, LAB_TOWER, CONTROL_ROOM, HANGAR, TOWER, GALLERY];

/** exported for tests: the walkability the reachability law is judged by.
 *  Doors count (E opens them); water counts (everyone wades/swims); climb
 *  walls do NOT (they're the airborne's shortcut, never the only road). */
export function frontWalkable(t: number): boolean {
  return t === T_OPEN || t === T_WATER || t === T_DEEP || t === T_DOOR
    || t === 6 /* T_DOOR_OPEN */ || t === T_LADDER;
}
