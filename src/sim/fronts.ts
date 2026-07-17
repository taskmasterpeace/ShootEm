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
// POPULATION-SCALED SIZES (33C, shipped): every front builds in three tiers
// keyed to the lobby's bots-per-team count — small (~186u) for skirmishes,
// standard (~246u) for mid wars, large (~300u, the full grid) for 12v12+.
// The engine's WORLD stays 300u: a front authors inside a centered playable
// BOX and seals everything outside it to solid ground (the Highland Pass
// trick, generalized). Buildings keep their authored tile sizes at every
// tier — what scales is the ground BETWEEN the features and the COUNT of
// features: a small city has fewer blocks, not smaller houses.
//
// The tier reaches generateFront two ways: the explicit `size` argument
// (tests, tools), or a `front@size` suffix on the id itself — the channel
// main.ts uses to push the lobby's headcount through world.ts untouched.
// ---------------------------------------------------------------------------
import type { Team, Vec3 } from './types';
import { Rng } from './rng';
import {
  GRID, TILE, WORLD, houseAt,
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

/** Open GROUND — outdoors, and not some building's floor.
 *  NOTHING SCATTERS INDOORS (Robert: "trees inside of a house… I couldn't
 *  get down the hallways"). A house's floor is T_OPEN, so the naive
 *  open-tile test plants boulders in living rooms — and a claimed prop tile
 *  becomes T_WALL, bricking the corridor. Every scatter asks this. */
function openOutdoors(d: FrontDraft, tx: number, tz: number): boolean {
  if (!inb(tx) || !inb(tz) || d.grid[idx(tx, tz)] !== T_OPEN) return false;
  const w = tw(tx, tz);
  return houseAt(d.houses, w.x, w.z) < 0;
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

// ---------------------------------------------------------------------------
// THE SIZE KIT — population-scaled fronts (33C)
// ---------------------------------------------------------------------------

/** The three population tiers. Lobby headcount picks the tier; a front is
 *  authored once per tier, never stretched. */
export type MapSize = 'small' | 'standard' | 'large';

/** playable tile counts per tier (centered box; the grid is always 100²) */
const SIZE_TILES: Record<MapSize, number> = { small: 62, standard: 82, large: 100 };

/** The centered playable box for a tier, inclusive tile bounds. Everything
 *  outside it is solid, sealed ground — the map's honest edge. */
export interface Box { x0: number; z0: number; x1: number; z1: number }
export function boxFor(size: MapSize): Box {
  const t = SIZE_TILES[size];
  const x0 = Math.floor((GRID - t) / 2);
  return { x0, z0: x0, x1: x0 + t - 1, z1: x0 + t - 1 };
}

/** bots-per-team → the tier that population deserves. 12v12 keeps the full
 *  300u grid it was balanced on; smaller wars get tighter ground so the
 *  fight finds you. */
export function mapSizeForPlayers(botsPerTeam: number): MapSize {
  return botsPerTeam <= 6 ? 'small' : botsPerTeam <= 9 ? 'standard' : 'large';
}

/** fraction helpers: author in box-relative units, not absolute tiles */
const bx = (b: Box, fx: number) => Math.round(b.x0 + fx * (b.x1 - b.x0));
const bz = (b: Box, fz: number) => Math.round(b.z0 + fz * (b.z1 - b.z0));

/** seal everything OUTSIDE the playable box to solid ground — the world
 *  rim AND the margin read as impassable terrain, so small maps stay
 *  honest (no walkable tile the war can never touch). */
function sealOutside(grid: Uint8Array, b: Box) {
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) grid[z * GRID + x] = T_WALL;
  }
}

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

function zombieRing(grid: Uint8Array, b?: Box): Vec3[] {
  const out: Vec3[] = [];
  const half = GRID / 2;
  // on sized fronts the mouths ring the playable box, not the world rim —
  // a mouth sealed inside the margin is a spawner the horde can't leave
  const r = b ? Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2 - 5 : half - 6;
  const cx = b ? (b.x0 + b.x1) / 2 : half;
  const cz = b ? (b.z0 + b.z1) / 2 : half;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tx = Math.round(cx + Math.cos(a) * r);
    const tz = Math.round(cz + Math.sin(a) * r);
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
// 1 · BRIDGE DELTA — the river owns the map; the crossings are the prices.
// Large fields all three spans (main deck, rail, ford); standard keeps the
// three closer; small is the knife fight: the deck and the ford, nothing
// else. Signature: holding the main span while artillery walks it.
// Doctrine: armor + the boat. Scar: flooded (the ford becomes everything).
// ---------------------------------------------------------------------------
interface DeltaLayout {
  span: [number, number];  // z band of the main span (4 lanes)
  rail?: [number, number]; // the rail bridge — cut on small
  ford: [number, number];  // shallow the whole way
  hamlets: [string, number, number][]; // west-side buildings (mirrored)
  boats: number;           // z of the moorings
  guns: [number, number];  // emplacement tile (west; mirrored)
  pickups: [number, number, PickupSpawn['type']][];
  reeds: number;
}

const DELTA_LAYOUTS: Record<MapSize, DeltaLayout> = {
  large: {
    span: [36, 39], rail: [61, 62], ford: [78, 81],
    hamlets: [['guard_post', 38, 30], ['cottage', 28, 14], ['farmhouse', 18, 24], ['pumphouse', 37, 74], ['hut', 24, 84]],
    boats: 70, guns: [36, 46],
    pickups: [[40, 37, 'medkit'], [40, 62, 'ammo'], [40, 80, 'energy'], [30, 50, 'ammo']],
    reeds: 22,
  },
  standard: {
    span: [32, 35], rail: [52, 53], ford: [68, 71],
    hamlets: [['guard_post', 36, 26], ['farmhouse', 16, 20], ['pumphouse', 37, 62], ['hut', 24, 76]],
    boats: 64, guns: [34, 42],
    pickups: [[40, 33, 'medkit'], [40, 53, 'ammo'], [40, 69, 'energy'], [30, 47, 'ammo']],
    reeds: 16,
  },
  small: {
    span: [36, 39], ford: [60, 63],
    hamlets: [['guard_post', 38, 28], ['farmhouse', 26, 22], ['pumphouse', 38, 56]],
    boats: 56, guns: [36, 42],
    pickups: [[40, 37, 'medkit'], [40, 61, 'ammo'], [30, 47, 'energy']],
    reeds: 10,
  },
};

function bridgeDelta(seed: number, size: MapSize = 'large'): GameMap {
  const L = DELTA_LAYOUTS[size];
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_GRASS);
  const { grid, surface, props, claims } = d;
  const midZ = Math.floor((box.z0 + box.z1) / 2);

  // THE RIVER: north-south, deep core, wadeable rims — the map's one truth
  rect(grid, 45, box.z0 + 1, 54, box.z1 - 1, T_WATER);
  rect(grid, 47, box.z0 + 1, 52, box.z1 - 1, T_DEEP);

  // THE MAIN SPAN: four lanes of plate, rail cover on the edges with three
  // vault gaps a side — the artillery-hell duel deck
  rect(grid, 44, L.span[0], 55, L.span[1], T_OPEN);
  rectSurf(surface, 44, L.span[0], 55, L.span[1], S_PLATE);
  for (let x = 44; x <= 55; x++) {
    if (x === 47 || x === 50 || x === 53) continue; // the vaults
    set(grid, x, L.span[0] - 1, T_COVER);
    set(grid, x, L.span[1] + 1, T_COVER);
  }
  // the burned convoy — mid-span hard cover, the story the yard tells
  const spanMid = Math.floor((L.span[0] + L.span[1]) / 2);
  claim(grid, claims, 49, spanMid, T_COVER);
  claim(grid, claims, 50, spanMid + 1, T_COVER);
  props.push({ type: 'wreck', pos: tw(49, spanMid), scale: 1.15, rot: 0.5 });
  props.push({ type: 'wreck', pos: tw(50, spanMid + 1), scale: 1, rot: 3.6 });

  // THE RAIL BRIDGE: two naked lanes — fast and honest (cut on small)
  if (L.rail) {
    rect(grid, 44, L.rail[0], 55, L.rail[1], T_OPEN);
    rectSurf(surface, 44, L.rail[0], 55, L.rail[1], S_PLATE);
  }

  // THE FORD: shallow the whole width — the only crossing wheels get
  rect(grid, 45, L.ford[0], 54, L.ford[1], T_WATER);

  // bridgehead sandbags, mirrored: attacking a span head costs you the open
  for (const z of [L.span[0] - 3, L.span[1] + 3]) {
    for (let x = 39; x <= 42; x++) { set(grid, x, z, T_COVER); set(grid, GRID - 1 - x, z, T_COVER); }
  }
  if (L.rail) {
    for (const z of [L.rail[0] - 2, L.rail[1] + 2]) {
      for (let x = 40; x <= 42; x++) { set(grid, x, z, T_COVER); set(grid, GRID - 1 - x, z, T_COVER); }
    }
  }

  // the banks are farmland: a hamlet a side, a pumphouse watching the ford
  const ctx = ctxOf(d);
  for (const [id, hx, hz] of L.hamlets) {
    const def = byId(id);
    stampBuilding(ctx, def, hx, hz, hx + hz);
    stampBuilding(ctx, mirrorDef(def), GRID - hx - Math.max(...def.rows.map((r) => r.length)), hz, hx + hz + 1);
  }

  // reed stands on the banks — dressing, the seed's only vote
  for (let i = 0; i < L.reeds; i++) {
    const tz = d.rng.int(box.z0 + 6, box.z1 - 6);
    const west = d.rng.next() < 0.5;
    const tx = west ? d.rng.int(41, 43) : d.rng.int(56, 58);
    if (openOutdoors(d, tx, tz)) {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'tree', pos: tw(tx, tz), scale: d.rng.range(0.7, 1.1), rot: d.rng.range(0, Math.PI * 2) });
    }
  }
  // supply dumps behind each bridgehead — the fight leaves its kit lying out
  const dumps: [number, number][] = [[38, spanMid], [37, spanMid - 2], [41, L.ford[0] + 1]];
  for (const [cx2, cz2] of dumps) {
    for (const tx of [cx2, GRID - 1 - cx2]) {
      if (grid[idx(tx, cz2)] === T_OPEN) {
        claim(grid, claims, tx, cz2, T_COVER);
        props.push({ type: 'crate', pos: tw(tx, cz2), scale: 1, rot: d.rng.range(0, Math.PI) });
      }
    }
  }

  // bases + the armor-and-boats motor pool
  stampBase(grid, claims, props, d.vehiclePads, 0, box.x0 + 10, midZ, ['tank', 'apc', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, box.x1 - 9, midZ, ['tank', 'apc', 'buggy', 'ambulance']);
  d.vehiclePads.push({ kind: 'boat', team: 0, pos: tw(45, L.boats) });
  d.vehiclePads.push({ kind: 'boat', team: 1, pos: tw(54, L.boats) });
  d.vehiclePads.push({ kind: 'emplacement', team: 0, pos: tw(...L.guns) });
  d.vehiclePads.push({ kind: 'emplacement', team: 1, pos: tw(GRID - 1 - L.guns[0], L.guns[1]) });
  clearDisc(grid, L.guns[0], L.guns[1], 2); clearDisc(grid, GRID - 1 - L.guns[0], L.guns[1], 2);

  dealPickups(d, L.pickups);
  mudMargins(grid, surface);
  sealOutside(grid, box);
  sealRim(grid);

  // conquest here is the fight for the crossings themselves
  const cps = [
    { name: 'SPAN', pos: tw(49, spanMid + 1) },
    ...(L.rail ? [{ name: 'RAIL', pos: tw(49, L.rail[0]) }] : []),
    { name: 'FORD', pos: tw(49, L.ford[0] + 1) },
  ];
  return {
    seed, theme: 'savanna', grid, grid2: d.grid2, surface,
    basePos: [tw(box.x0 + 10, midZ), tw(box.x1 - 9, midZ)],
    spawns: [spawnRing(box.x0 + 10, midZ), spawnRing(box.x1 - 9, midZ)],
    flagPos: [tw(box.x0 + 10, midZ), tw(box.x1 - 9, midZ)],
    hillPos: tw(49, spanMid),
    controlPoints: cps,
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
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

function fortRaven(seed: number, size: MapSize = 'large'): GameMap {
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_GRIT);
  const { grid, surface, props, claims } = d;
  const C = 50; // the fort's heart never moves; the ground closes around it
  const L = {
    large: {
      rings: [[12, [[350, 360], [0, 10], [80, 100], [170, 190], [260, 280]]], [20, [[35, 55], [125, 145], [215, 235], [305, 325]]], [33, [[0, 30], [60, 120], [150, 210], [240, 300], [330, 360]]]] as [number, [number, number][]][],
      bunkers: [[36, 36], [57, 36], [36, 57], [57, 57]] as [number, number][],
      posts: [[47, 24], [47, 71]] as [number, number][],
      ruins: [[22, 44], [GRID - 29, 52]] as [number, number][],
      teeth: { count: 16, r: 27 }, craters: 9, boulders: 12, boulderR: 36,
      baseX: [10, GRID - 11], baseZ: 50,
      pickups: [[30, 40, 'medkit'], [30, 60, 'ammo'], [40, 28, 'energy'], [40, 72, 'ammo']] as [number, number, PickupSpawn['type']][],
    },
    standard: {
      rings: [[11, [[350, 360], [0, 10], [80, 100], [170, 190], [260, 280]]], [18, [[35, 55], [125, 145], [215, 235], [305, 325]]], [28, [[0, 30], [60, 120], [150, 210], [240, 300], [330, 360]]]] as [number, [number, number][]][],
      bunkers: [[38, 38], [57, 38], [38, 57], [57, 57]] as [number, number][],
      posts: [[47, 17], [47, 79]] as [number, number][],
      ruins: [[18, 44], [GRID - 25, 52]] as [number, number][],
      teeth: { count: 14, r: 23 }, craters: 6, boulders: 8, boulderR: 30,
      baseX: [19, GRID - 20], baseZ: 49,
      pickups: [[26, 38, 'medkit'], [26, 61, 'ammo'], [38, 22, 'energy'], [38, 77, 'ammo']] as [number, number, PickupSpawn['type']][],
    },
    small: {
      rings: [[9, [[350, 360], [0, 10], [80, 100], [170, 190], [260, 280]]], [14, [[35, 55], [125, 145], [215, 235], [305, 325]]], [22, [[0, 30], [60, 120], [150, 210], [240, 300], [330, 360]]]] as [number, [number, number][]][],
      bunkers: [[40, 40], [55, 40], [40, 55], [55, 55]] as [number, number][],
      posts: [[47, 26], [47, 68]] as [number, number][],
      ruins: [] as [number, number][],
      teeth: { count: 12, r: 18 }, craters: 4, boulders: 6, boulderR: 24,
      baseX: [29, GRID - 30], baseZ: 49,
      pickups: [[32, 42, 'medkit'], [32, 57, 'ammo'], [40, 30, 'energy'], [40, 69, 'ammo']] as [number, number, PickupSpawn['type']][],
    },
  }[size];

  // the glacis is bare grit — attackers cross it in the open.
  // The rings: parapet arcs with sally gaps; no straight walk to the keep.
  for (const [r, gaps] of L.rings) ring(grid, C, C, r, T_COVER, gaps);

  // bunkers between the rings, slits watching the diagonals
  const ctx = ctxOf(d);
  for (const [bx2, bz2] of L.bunkers) {
    stampBuilding(ctx, byId('bunker'), bx2, bz2, bx2 + bz2);
  }

  // the keep itself — doors south, nests upstairs
  stampBuilding(ctx, THE_KEEP, C - 4, C - 3, 8);

  // observation posts off the fort
  for (const [px2, pz2] of L.posts) stampBuilding(ctx, byId('guard_post'), px2, pz2, px2 + pz2);

  // dragon's teeth on the far glacis — armor picks a lane and commits
  for (let i = 0; i < L.teeth.count; i++) {
    const a = (i / L.teeth.count) * Math.PI * 2;
    const tx = Math.round(C + Math.cos(a) * L.teeth.r), tz = Math.round(C + Math.sin(a) * L.teeth.r);
    if ((i % 4) === 0) continue; // four armored lanes
    if (grid[idx(tx, tz)] === T_OPEN) {
      claim(grid, claims, tx, tz, T_COVER);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: 0.8, rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  // shell craters: the guns have been ranging this ground for a season
  for (let i = 0; i < L.craters; i++) {
    const a = d.rng.range(0, Math.PI * 2), r = d.rng.range(L.rings[1][0] + 3, L.teeth.r + 13);
    const cx2 = Math.round(C + Math.cos(a) * r), cz2 = Math.round(C + Math.sin(a) * r);
    for (let z = cz2 - 1; z <= cz2 + 1; z++) for (let x = cx2 - 1; x <= cx2 + 1; x++) {
      if (inb(x) && inb(z) && (x - cx2) ** 2 + (z - cz2) ** 2 <= 2) surface[idx(x, z)] = S_DIRT;
    }
  }

  // outbuildings the sieges gutted — approach cover with a history
  for (const [rx2, rz2] of L.ruins) stampBuilding(ctx, byId('ruin'), rx2, rz2, rx2 + rz2);

  // boulder dressing outside the fight
  for (let i = 0; i < L.boulders; i++) {
    const tx = d.rng.int(box.x0 + 6, box.x1 - 6), tz = d.rng.int(box.z0 + 6, box.z1 - 6);
    if (Math.hypot(tx - C, tz - C) > L.boulderR && Math.abs(tz - L.baseZ) > 10 && openOutdoors(d, tx, tz)) {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(1.1, 1.8), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, L.baseX[0], L.baseZ, ['tank', 'apc', 'tunneler', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, L.baseX[1], L.baseZ, ['tank', 'apc', 'tunneler', 'ambulance']);

  dealPickups(d, L.pickups);
  sealOutside(grid, box);
  sealRim(grid);

  const innerR = L.rings[0][0];
  return {
    seed, theme: 'titan', grid, grid2: d.grid2, surface,
    basePos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    spawns: [spawnRing(L.baseX[0], L.baseZ), spawnRing(L.baseX[1], L.baseZ)],
    flagPos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    hillPos: tw(C, C), // KOTH is the keep — hold the heart of the fort
    controlPoints: [
      { name: 'NORTH SALLY', pos: tw(C, C - innerR) },
      { name: 'THE KEEP', pos: tw(C, C) },
      { name: 'SOUTH SALLY', pos: tw(C, C + innerR) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 3 · EASTERN PLAINS — hedgerow tank country. Long lanes, plowed fields,
// three farms, and a no-man's lane of burned hulls down the middle.
// Signature: the 60-unit tank duel broken by a treeline ambush.
// Doctrine: armor doubled. Scar: fire (burned fields lose concealment).
// ---------------------------------------------------------------------------
interface PlainsLayout {
  rows: { z: number; gaps: number[] }[];          // the hedgerow lines
  fields: [number, number, number, number][];     // plowed dirt rects
  track: [number, number, number, number][];      // the mud farm lanes
  farms: [string, number, number][];              // west-side stock (mirrored)
  silos: [number, number][];                      // the skyline (mirrored)
  wrecks: [number, number, number][];             // no-man's lane
  guns: [number, number];                         // emplacement (west; mirrored)
  baseX: [number, number]; baseZ: number;
  pickups: [number, number, PickupSpawn['type']][];
}

const PLAINS_LAYOUTS: Record<MapSize, PlainsLayout> = {
  large: {
    rows: [
      { z: 20, gaps: [22, 50, 78] }, { z: 35, gaps: [34, 64, 90] },
      { z: 50, gaps: [14, 48, 82] }, { z: 65, gaps: [30, 60, 88] },
      { z: 80, gaps: [20, 52, 76] },
    ],
    fields: [[12, 22, 44, 33], [55, 37, 88, 48], [12, 52, 44, 63], [55, 67, 88, 78]],
    track: [[10, 46, 89, 48], [47, 36, 49, 64]],
    farms: [['farmhouse', 22, 24], ['warehouse', 18, 54], ['hut', 30, 70]],
    silos: [[32, 25], [31, 56], [39, 71]],
    wrecks: [[48, 27, 0.8], [51, 42, 2.4], [47, 57, 5.5], [52, 72, 1.2], [49, 87, 4.0]],
    guns: [30, 42], baseX: [10, GRID - 11], baseZ: 50,
    pickups: [[38, 27, 'ammo'], [42, 43, 'medkit'], [38, 58, 'energy'], [42, 73, 'ammo']],
  },
  standard: {
    rows: [
      { z: 16, gaps: [24, 50, 74] }, { z: 30, gaps: [36, 62, 84] },
      { z: 47, gaps: [20, 48, 78] }, { z: 60, gaps: [32, 58, 82] },
      { z: 74, gaps: [24, 52, 72] },
    ],
    fields: [[12, 18, 44, 28], [55, 32, 86, 45], [12, 49, 44, 58], [55, 62, 86, 72]],
    track: [[10, 45, 87, 47], [47, 31, 49, 59]],
    farms: [['farmhouse', 20, 18], ['warehouse', 16, 48], ['hut', 28, 64]],
    silos: [[30, 19], [29, 50], [37, 65]],
    wrecks: [[48, 24, 0.8], [51, 40, 2.4], [47, 55, 5.5], [52, 70, 1.2]],
    guns: [28, 40], baseX: [19, GRID - 20], baseZ: 47,
    pickups: [[36, 24, 'ammo'], [40, 42, 'medkit'], [36, 56, 'energy'], [40, 68, 'ammo']],
  },
  small: {
    rows: [
      { z: 26, gaps: [30, 56, 74] }, { z: 40, gaps: [22, 48, 70] },
      { z: 54, gaps: [34, 60, 76] }, { z: 68, gaps: [26, 52, 72] },
    ],
    fields: [[20, 28, 44, 38], [55, 42, 78, 52], [22, 56, 46, 66]],
    track: [[20, 45, 78, 47]],
    farms: [['farmhouse', 26, 28], ['hut', 30, 56]],
    silos: [[36, 29], [38, 57]],
    wrecks: [[48, 32, 0.8], [51, 47, 2.4], [47, 62, 5.5]],
    guns: [32, 42], baseX: [29, GRID - 30], baseZ: 49,
    pickups: [[38, 33, 'ammo'], [40, 45, 'medkit'], [38, 59, 'energy']],
  },
};

function easternPlains(seed: number, size: MapSize = 'large'): GameMap {
  const L = PLAINS_LAYOUTS[size];
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_GRASS);
  const { grid, surface, props, claims } = d;

  // HEDGEROWS: treelines with staggered gaps so no lane runs clean through —
  // armor must jink between rows, and every gap is a known ambush angle
  for (const { z, gaps } of L.rows) {
    for (let x = box.x0 + 8; x <= box.x1 - 8; x++) {
      if (gaps.some((g) => Math.abs(x - g) <= 2)) continue;
      set(grid, x, z, T_WALL);
      if (x % 3 === 0) props.push({ type: 'tree', pos: tw(x, z), scale: d.rng.range(0.9, 1.3), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  // plowed fields between hedges — the ground itself tells you where you are
  for (const [x0, z0, x1, z1] of L.fields) rectSurf(surface, x0, z0, x1, z1, S_DIRT);
  // the farm tracks: mud lanes the wheels hate and the crossroads that names
  // the middle CP
  for (const [x0, z0, x1, z1] of L.track) rectSurf(surface, x0, z0, x1, z1, S_MUD);

  // the farms — a working landscape, mirrored for fairness
  const ctx = ctxOf(d);
  for (const [id, hx, hz] of L.farms) {
    const def = byId(id);
    stampBuilding(ctx, def, hx, hz, hx + hz);
    stampBuilding(ctx, mirrorDef(def), GRID - hx - Math.max(...def.rows.map((r) => r.length)), hz, hx + hz + 1);
  }
  // silos BESIDE the farms — the plains' skyline
  for (const [sx, sz] of L.silos) {
    for (const tx of [sx, GRID - 1 - sx]) {
      claim(grid, claims, tx, sz, T_WALL);
      props.push({ type: 'silo', pos: tw(tx, sz), scale: 1, rot: 0 });
    }
  }

  // NO-MAN'S LANE: burned hulls down the center — the only cover out there
  for (const [wx, wz, r] of L.wrecks) {
    claim(grid, claims, wx, wz, T_COVER);
    props.push({ type: 'wreck', pos: tw(wx, wz), scale: 1.1, rot: r });
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, L.baseX[0], L.baseZ, ['tank', 'tank', 'apc', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, L.baseX[1], L.baseZ, ['tank', 'tank', 'apc', 'buggy', 'ambulance']);
  d.vehiclePads.push({ kind: 'emplacement', team: 0, pos: tw(...L.guns) });
  d.vehiclePads.push({ kind: 'emplacement', team: 1, pos: tw(GRID - 1 - L.guns[0], GRID - 1 - L.guns[1]) });
  clearDisc(grid, L.guns[0], L.guns[1], 2); clearDisc(grid, GRID - 1 - L.guns[0], GRID - 1 - L.guns[1], 2);

  dealPickups(d, L.pickups);
  sealOutside(grid, box);
  sealRim(grid);

  const midRow = L.rows[Math.floor(L.rows.length / 2)];
  const crossZ = L.track.length ? L.track[0][2] : midRow.z;
  return {
    seed, theme: 'savanna', grid, grid2: d.grid2, surface,
    basePos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    spawns: [spawnRing(L.baseX[0], L.baseZ), spawnRing(L.baseX[1], L.baseZ)],
    flagPos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    hillPos: tw(50, crossZ),
    controlPoints: [
      { name: 'NORTH FARM', pos: tw(L.farms[0][1] + 4, L.farms[0][2] + 4) },
      { name: 'CROSSROADS', pos: tw(48, crossZ) },
      { name: 'SOUTH FARM', pos: tw(GRID - L.farms[0][1] - 5, GRID - L.farms[0][2] - 5) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 4 · THE CITY — a street grid of grown districts, a plaza, a canal — and
// THE SEWER: roofed tunnel trunks under the sidewalk columns, entered by
// manhole ladders from the street, draining to the canal through grate
// doors. The roof conceals (§4): inside the trunk you are OFF the map.
// Signature: the K9 clearing an apartment stack room by room.
// Doctrine: infantry country — K9, UGV, engineers. Scar: rubble.
// LAW: every building in the city is ENTERABLE — doors, never facades.
// ---------------------------------------------------------------------------

/** the tenement — the guaranteed two-storey fallback when a grown office
 *  won't fit its lot: a walk-up with a ladder well and a nest upstairs. */
const TENEMENT: BuildingDef = {
  id: 'tenement', name: 'Tenement', kind: 'house', floors: 2,
  rows: [
    '#S#S#S#',
    '#.....#',
    '#..L.P#',
    '#.....#',
    '##DD###',
  ],
  rows2: [
    '#S#S#S#',
    'S.....S',
    '#..L..#',
    'S.....S',
    '#S#S#S#',
  ],
};

/** A SEWER TRUNK, grown to length: metal masonry the drill sparks off, a
 *  two-tile walkway, manhole ladders on BOTH sidewalks, crate cover and a
 *  cache in the dark, grate doors at the canal outflow. Stamped as a
 *  building so the roof rect gives the §8.4 concealment the fiction needs —
 *  from the street above, the tunnel and everyone in it does not exist. */
function sewerTrunk(h: number, manholes: number[], outflow: boolean, rng: Rng): BuildingDef {
  const rows: string[] = [];
  for (let z = 0; z < h; z++) {
    let r = 'M..M';
    if (manholes.includes(z)) r = 'L..L';
    else if (z > 1 && z < h - 2 && z % 9 === 4) r = rng.next() < 0.5 ? 'MC.M' : 'M.CM';
    else if (z > 1 && z < h - 2 && z % 13 === 7) r = 'M.PM';
    rows.push(r);
  }
  rows[0] = 'MMMM'; // blind end — the main runs on past the playable ground
  rows[h - 1] = outflow ? 'MDDM' : 'MMMM'; // the outflow grates onto the bank
  return { id: 'sewer_trunk', name: 'Sewer Trunk', kind: 'industrial', floors: 1, rows };
}

type CityLotKind = 'house' | 'shop' | 'office' | 'office2' | 'factory' | 'ruin' | 'stock';
interface CityLot { x: number; z: number; kind: CityLotKind; stock?: string; w: number; h: number }
interface CityLayout {
  avenues: number[]; streets: number[];
  canal: [number, number]; bank: number; bridges: number[];
  trunks: number[]; segs: [number, number][]; manholes: number[];
  lots: CityLot[]; plaza?: { x0: number; z0: number; x1: number; z1: number };
  cps: [string, number, number][]; cars: [number, number][];
  outskirts: number; pickups: [number, number, PickupSpawn['type']][];
  baseTz: number; pool: VehicleKind[];
}

/** grow a district/house that FITS its lot — regrow on overflow, then fall
 *  back to authored stock small enough to always fit. Deterministic: every
 *  client rolls the same sequence from the same rng. */
function growLot(rng: Rng, lot: CityLot): BuildingDef {
  const fits = (def: BuildingDef) =>
    def.rows.length <= lot.h && Math.max(...def.rows.map((r) => r.length)) <= lot.w;
  const growOnce = (): BuildingDef => {
    switch (lot.kind) {
      case 'house': return generateHouse(rng, rng.next() < 0.5 ? 'bungalow' : 'hall_house');
      case 'shop': return generateDistrict(rng, rng.next() < 0.5 ? 'storefront' : 'market');
      case 'office': case 'office2': return generateDistrict(rng, 'office');
      case 'factory': return generateDistrict(rng, rng.next() < 0.5 ? 'factory' : 'depot_hall');
      case 'ruin': return byId('ruin');
      default: return byId(lot.stock ?? 'shack');
    }
  };
  if (lot.kind === 'stock' || lot.kind === 'ruin') return growOnce();
  let def = growOnce();
  if (lot.kind === 'office2') {
    // the city's walk-up law: at least one real second storey, guaranteed —
    // reroll until the office grows its loft (and still fits the lot)
    for (let i = 0; i < 20 && !(def.rows2 && fits(def)); i++) def = growOnce();
    if (!(def.rows2 && fits(def))) return TENEMENT;
    return def;
  }
  for (let i = 0; i < 6 && !fits(def); i++) def = growOnce();
  if (!fits(def)) {
    const fallback: Record<string, string> = {
      house: 'rowhouse', shop: 'mess_hall', office: 'barracks_hall', factory: 'machine_shop',
    };
    def = byId(fallback[lot.kind] ?? 'shack');
  }
  return def;
}

const CITY_LAYOUTS: Record<MapSize, CityLayout> = {
  large: {
    avenues: [18, 38, 58, 78], streets: [20, 44, 68],
    canal: [88, 92], bank: 87, bridges: [28, 70],
    trunks: [22, 74], segs: [[10, 18], [26, 40], [60, 66], [74, 86]],
    manholes: [14, 30, 36, 63, 78],
    lots: [
      { x: 6, z: 8, kind: 'shop', w: 11, h: 11 }, { x: 28, z: 8, kind: 'house', w: 9, h: 11 },
      { x: 44, z: 8, kind: 'office2', w: 13, h: 11 }, { x: 62, z: 8, kind: 'house', w: 11, h: 11 },
      { x: 84, z: 8, kind: 'house', w: 11, h: 11 },
      { x: 6, z: 26, kind: 'house', w: 11, h: 15 }, { x: 28, z: 26, kind: 'office', w: 9, h: 15 },
      { x: 44, z: 26, kind: 'house', w: 13, h: 15 }, { x: 62, z: 26, kind: 'shop', w: 11, h: 15 },
      { x: 84, z: 26, kind: 'ruin', w: 11, h: 15 },
      { x: 6, z: 50, kind: 'house', w: 9, h: 15 }, { x: 28, z: 50, kind: 'shop', w: 9, h: 15 },
      { x: 62, z: 50, kind: 'office', w: 11, h: 15 }, { x: 84, z: 50, kind: 'house', w: 11, h: 15 },
      { x: 28, z: 74, kind: 'house', w: 9, h: 13 }, { x: 44, z: 74, kind: 'factory', w: 13, h: 13 },
      { x: 62, z: 74, kind: 'house', w: 11, h: 13 },
    ],
    plaza: { x0: 44, z0: 50, x1: 56, z1: 66 },
    cps: [['MARKET', 30, 46], ['PLAZA', 50, 58], ['DEPOT', 68, 46]],
    cars: [[38, 44], [58, 20], [78, 68], [18, 68], [58, 44]],
    outskirts: 10,
    pickups: [[38, 22, 'medkit'], [40, 46, 'ammo'], [38, 70, 'energy'], [30, 87, 'ammo']],
    baseTz: 50, pool: ['apc', 'buggy', 'bike', 'ambulance'],
  },
  standard: {
    avenues: [18, 38, 58, 78], streets: [20, 44, 68],
    canal: [84, 88], bank: 83, bridges: [28, 70],
    trunks: [22, 74], segs: [[10, 18], [26, 36], [58, 66], [74, 82]],
    manholes: [14, 30, 34, 62, 78],
    lots: [
      { x: 28, z: 10, kind: 'house', w: 9, h: 9 }, { x: 44, z: 10, kind: 'shop', w: 13, h: 9 },
      { x: 62, z: 10, kind: 'house', w: 11, h: 9 },
      { x: 28, z: 24, kind: 'office2', w: 9, h: 13 }, { x: 44, z: 24, kind: 'house', w: 13, h: 13 },
      { x: 62, z: 24, kind: 'shop', w: 11, h: 13 },
      { x: 28, z: 58, kind: 'shop', w: 9, h: 9 }, { x: 44, z: 58, kind: 'office', w: 13, h: 9 },
      { x: 62, z: 58, kind: 'house', w: 11, h: 9 },
      { x: 28, z: 72, kind: 'house', w: 9, h: 11 }, { x: 44, z: 72, kind: 'factory', w: 13, h: 11 },
      { x: 62, z: 72, kind: 'house', w: 11, h: 11 },
    ],
    plaza: { x0: 44, z0: 48, x1: 56, z1: 56 },
    cps: [['MARKET', 30, 46], ['PLAZA', 50, 52], ['DEPOT', 68, 46]],
    cars: [[38, 44], [58, 68], [18, 68], [58, 44]],
    outskirts: 8,
    pickups: [[38, 22, 'medkit'], [40, 46, 'ammo'], [38, 66, 'energy'], [30, 83, 'ammo']],
    baseTz: 47, pool: ['apc', 'buggy', 'bike', 'ambulance'],
  },
  small: {
    avenues: [26, 50], streets: [28, 54],
    canal: [72, 76], bank: 71, bridges: [38, 60],
    trunks: [30, 66], segs: [[58, 70]],
    manholes: [61, 67],
    lots: [
      { x: 34, z: 20, kind: 'stock', stock: 'hut', w: 8, h: 7 },
      { x: 56, z: 20, kind: 'stock', stock: 'rowhouse', w: 9, h: 7 },
      { x: 70, z: 20, kind: 'stock', stock: 'shack', w: 6, h: 7 },
      // the M row keeps clear of BOTH base compounds (their walls/pads own
      // x 18-37 and x 61-81 at z 37-52) — the center columns only
      { x: 40, z: 36, kind: 'house', w: 9, h: 13 },
      { x: 55, z: 36, kind: 'office2', w: 7, h: 13 },
    ],
    plaza: { x0: 40, z0: 58, x1: 62, z1: 68 },
    cps: [['MARKET', 38, 50], ['PLAZA', 50, 63], ['DEPOT', 62, 50]],
    cars: [[26, 54], [50, 28]],
    outskirts: 6,
    pickups: [[34, 26, 'medkit'], [40, 56, 'ammo'], [38, 64, 'energy']],
    baseTz: 44, pool: ['apc', 'buggy', 'ambulance'],
  },
};

function theCity(seed: number, size: MapSize = 'large'): GameMap {
  const L = CITY_LAYOUTS[size];
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_GRIT); // asphalt world; parks paint over it
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);

  // PAVE THE GRID: avenues and cross-streets in plate — the city reads as a
  // city from command height
  for (const ax of L.avenues) rectSurf(surface, ax, box.z0 + 4, ax + 3, box.z1 - 4, S_PLATE);
  for (const sz of L.streets) rectSurf(surface, box.x0 + 4, sz, box.x1 - 4, sz + 3, S_PLATE);

  // the CANAL along the south edge — the sewer's drain, two footbridges
  rect(grid, box.x0 + 4, L.canal[0], box.x1 - 4, L.canal[1], T_WATER);
  rect(grid, box.x0 + 4, L.canal[0] + 1, box.x1 - 4, L.canal[1] - 1, T_DEEP);
  for (const bx2 of L.bridges) {
    rect(grid, bx2, L.canal[0], bx2 + 1, L.canal[1], T_OPEN);
    rectSurf(surface, bx2, L.canal[0], bx2 + 1, L.canal[1], S_PLATE);
  }

  // THE SEWER: trunk segments under the sidewalk columns. Each segment is a
  // stamped building — roofed, concealed, entered by manhole ladders from
  // the street. The south segment grates open onto the canal bank.
  for (const tx of L.trunks) {
    for (let s = 0; s < L.segs.length; s++) {
      const [z0, z1] = L.segs[s];
      const h = z1 - z0 + 1;
      const local = L.manholes.filter((z) => z >= z0 && z <= z1).map((z) => z - z0);
      const outflow = s === L.segs.length - 1;
      const def = sewerTrunk(h, local, outflow, d.rng);
      stampBuilding(ctx, def, tx, z0, 40 + tx + s);
      rectSurf(surface, tx, z0, tx + 3, z0 + h - 1, S_WET); // the muck
    }
  }

  // districts: every lot GROWN, every building ENTERABLE — doors, never
  // facades (the city's law). Lots keep clear of avenues, trunks, and the
  // base lanes; the street grid always reads.
  for (const lot of L.lots) {
    const def = growLot(d.rng, lot);
    stampBuilding(ctx, def, lot.x, lot.z, lot.x + lot.z);
    if (lot.kind === 'ruin') {
      // the shelled block: rubble spills into the street
      for (let i = 0; i < 6; i++) {
        const rx = lot.x + d.rng.int(-2, 10), rz = lot.z + d.rng.int(-2, 8);
        if (openOutdoors(d, rx, rz)) {
          claim(grid, claims, rx, rz, T_COVER);
          props.push({ type: 'rock', pos: tw(rx, rz), scale: 0.7, rot: d.rng.range(0, Math.PI * 2) });
        }
      }
    }
  }

  // THE PLAZA: the city's heart — open, paved, and watched from every side.
  // The monument is THE MEMORIAL: Robert's soldier cast in bronze, facing
  // south down the plaza — the city remembers its dead.
  if (L.plaza) {
    const p = L.plaza;
    rect(grid, p.x0, p.z0, p.x1, p.z1, T_OPEN);
    rectSurf(surface, p.x0, p.z0, p.x1, p.z1, S_PLATE);
    const mx = Math.floor((p.x0 + p.x1) / 2), mz = Math.floor((p.z0 + p.z1) / 2);
    claim(grid, claims, mx, mz, T_WALL);
    props.push({ type: 'memorial', pos: tw(mx, mz), scale: 1.25, rot: -Math.PI / 2 });
    for (const [px, pz] of [[p.x0 + 2, p.z0 + 2], [p.x1 - 2, p.z0 + 2], [p.x0 + 2, p.z1 - 2], [p.x1 - 2, p.z1 - 2]] as const) {
      if (grid[idx(px, pz)] === T_OPEN) {
        claim(grid, claims, px, pz, T_COVER);
        props.push({ type: 'crate', pos: tw(px, pz), scale: 1, rot: d.rng.range(0, Math.PI) });
      }
    }
  }

  // burnt cars at the big intersections — street cover, city texture
  for (const [wx, wz] of L.cars) {
    if (openOutdoors(d, wx, wz)) {
      claim(grid, claims, wx, wz, T_COVER);
      props.push({ type: 'wreck', pos: tw(wx, wz), scale: 0.8, rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  // THE OUTSKIRTS: the flanks are edge-of-town — junked cars, dumped crates,
  // rubble where the city frays toward the bases
  for (let i = 0; i < L.outskirts; i++) {
    const west = i % 2 === 0;
    const tx = west ? d.rng.int(box.x0 + 2, box.x0 + 8) : d.rng.int(box.x1 - 8, box.x1 - 2);
    const tz = d.rng.int(box.z0 + 6, box.z1 - 6);
    if (!openOutdoors(d, tx, tz) || Math.abs(tz - L.baseTz) < 9) continue; // the base lanes stay clear
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

  stampBase(grid, claims, props, d.vehiclePads, 0, box.x0 + 10, L.baseTz, L.pool);
  stampBase(grid, claims, props, d.vehiclePads, 1, box.x1 - 9, L.baseTz, L.pool);

  dealPickups(d, L.pickups);
  mudMargins(grid, surface);
  sealOutside(grid, box);
  sealRim(grid);

  return {
    seed, theme: 'savanna', grid, grid2: d.grid2, surface,
    basePos: [tw(box.x0 + 10, L.baseTz), tw(box.x1 - 9, L.baseTz)],
    spawns: [spawnRing(box.x0 + 10, L.baseTz), spawnRing(box.x1 - 9, L.baseTz)],
    flagPos: [tw(box.x0 + 10, L.baseTz), tw(box.x1 - 9, L.baseTz)],
    hillPos: L.plaza
      ? tw(Math.floor((L.plaza.x0 + L.plaza.x1) / 2), Math.floor((L.plaza.z0 + L.plaza.z1) / 2) + 2)
      : tw(50, 50),
    controlPoints: L.cps.map(([name, x, z]) => ({ name, pos: tw(x, z) })),
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 5 · HIGHLAND PASS — one road through solid rock. Switchbacks, two chokes,
// two goat paths, and a climb-wall saddle for the airborne. The whole map
// is CARVED — the rock is the map edge, whatever the tier.
// Signature: the MANPADS ambush on a helo threading the pass.
// Doctrine: air + transport. Scar: blocked (avalanche closes a route).
// ---------------------------------------------------------------------------
interface PassLayout {
  road: [number, number, number, number][];   // carved road rects, end to end
  meadows: [number, number, number][];        // [cx, cz, r] passing bays
  meadowGates: [number, number, number, number][]; // their lanes onto the road
  goats: [number, number, number, number][];  // infantry threads the road never sees
  chokes: [number, number][];                 // the avalanche squeeze points
  saddle: [number, number, number, number];   // the CLIMB wall rect
  saddlePath: [number, number, number, number][]; // open ground through it
  overlooks: [number, number][];              // emplacement ledges
  ledges: [number, number, number, number][]; // their walk-ups to the road
  stations: [string, number, number][];       // way-station buildings
  wrecks: [number, number, number][];         // the convoy that never made it
  bases: [[number, number], [number, number]];
  pickups: [number, number, PickupSpawn['type']][];
}

const PASS_LAYOUTS: Record<MapSize, PassLayout> = {
  large: {
    road: [[4, 48, 30, 52], [27, 24, 31, 52], [27, 24, 72, 28], [69, 24, 73, 76], [69, 72, 95, 76]],
    meadows: [[38, 26, 5], [62, 74, 5]],
    meadowGates: [[66, 72, 70, 74]],
    goats: [[14, 30, 15, 49], [14, 30, 27, 31], [84, 51, 85, 73], [73, 51, 85, 52]],
    chokes: [[50, 24], [69, 50]],
    saddle: [48, 40, 50, 44],
    saddlePath: [[48, 29, 50, 39], [48, 45, 50, 60], [48, 60, 72, 62]],
    overlooks: [[44, 20], [76, 56]],
    ledges: [[44, 21, 45, 24]],
    stations: [['shack', 34, 22], ['shack', 60, 71], ['guard_post', 52, 30]],
    wrecks: [[70, 56, 1.7], [71, 60, 0.2]],
    bases: [[10, 50], [GRID - 11, 74]],
    pickups: [[38, 25, 'ammo'], [30, 44, 'medkit'], [49, 33, 'energy']],
  },
  standard: {
    road: [[13, 46, 30, 50], [27, 22, 31, 50], [27, 22, 70, 26], [67, 22, 71, 72], [67, 68, 86, 72]],
    meadows: [[36, 24, 4], [60, 68, 4]],
    meadowGates: [[63, 66, 67, 70]],
    goats: [[17, 28, 18, 47], [17, 28, 27, 29], [76, 45, 77, 69], [71, 45, 77, 46]],
    chokes: [[48, 22], [67, 46]],
    saddle: [46, 36, 48, 40],
    saddlePath: [[46, 27, 48, 35], [46, 41, 48, 54], [46, 54, 68, 56]],
    overlooks: [[42, 18], [72, 52]],
    ledges: [[42, 19, 43, 22]],
    stations: [['shack', 33, 20], ['shack', 58, 67], ['guard_post', 48, 28]],
    wrecks: [[68, 52, 1.7], [69, 56, 0.2]],
    bases: [[19, 48], [GRID - 20, 70]],
    pickups: [[36, 23, 'ammo'], [28, 42, 'medkit'], [47, 29, 'energy']],
  },
  small: {
    road: [[23, 44, 32, 48], [29, 26, 33, 48], [29, 26, 64, 30], [61, 26, 65, 64], [61, 60, 76, 64]],
    meadows: [[36, 28, 4], [56, 60, 3]],
    meadowGates: [[59, 58, 62, 62]],
    goats: [[21, 32, 22, 45], [21, 32, 29, 33], [72, 42, 73, 61], [65, 42, 73, 43]],
    chokes: [[46, 26], [61, 44]],
    saddle: [44, 36, 46, 40],
    saddlePath: [[44, 31, 46, 35], [44, 41, 46, 52], [44, 52, 62, 54]],
    overlooks: [[40, 22], [68, 48]],
    ledges: [[40, 23, 41, 26], [66, 48, 68, 49]],
    stations: [['shack', 35, 22], ['guard_post', 52, 32]],
    wrecks: [[63, 44, 1.7], [64, 48, 0.2]],
    bases: [[29, 46], [GRID - 30, 62]],
    pickups: [[36, 27, 'ammo'], [31, 40, 'medkit'], [45, 31, 'energy']],
  },
};

function highlandPass(seed: number, size: MapSize = 'large'): GameMap {
  const L = PASS_LAYOUTS[size];
  const box = boxFor(size);
  const d = draft(seed, T_WALL, S_DIRT); // solid mountain; we CARVE the map
  const { grid, surface, props, claims } = d;

  // THE ROAD: west gate → north shelf → east wall → south descent → east gate.
  const carveRoad = (x0: number, z0: number, x1: number, z1: number) => {
    rect(grid, x0, z0, x1, z1, T_OPEN);
    rectSurf(surface, x0, z0, x1, z1, S_GRIT);
  };
  for (const [x0, z0, x1, z1] of L.road) carveRoad(x0, z0, x1, z1);

  // ALPINE MEADOWS: passing bays where a convoy can turn and fight — each
  // with its lane onto the road (a bay you can't enter is a painting)
  for (const [cx2, cz2, r] of L.meadows) {
    clearDisc(grid, cx2, cz2, r);
    rectSurf(surface, cx2 - r, cz2 - r, cx2 + r, cz2 + r, S_DIRT);
  }
  for (const [x0, z0, x1, z1] of L.meadowGates) carveRoad(x0, z0, x1, z1);

  // GOAT PATHS: one-tile infantry threads the road never sees
  for (const [x0, z0, x1, z1] of L.goats) rect(grid, x0, z0, x1, z1, T_OPEN);

  // THE CHOKES: avalanche rubble narrows the road to a two-tile squeeze —
  // the MANPADS ambush points
  for (const [cx, cz] of L.chokes) {
    claim(grid, claims, cx, cz, T_WALL);
    claim(grid, claims, cx + 1, cz, T_WALL);
    props.push({ type: 'rock', pos: tw(cx, cz), scale: 1.6, rot: d.rng.range(0, Math.PI * 2) });
    props.push({ type: 'rock', pos: tw(cx + 1, cz + 1), scale: 1.2, rot: d.rng.range(0, Math.PI * 2) });
  }

  // THE CLIMB SADDLE: jump troopers and the bold cross here; everyone else
  // drives around
  rect(grid, ...L.saddle, T_CLIMB);
  for (const [x0, z0, x1, z1] of L.saddlePath) {
    rect(grid, x0, z0, x1, z1, T_OPEN);
    rectSurf(surface, x0, z0, x1, z1, S_DIRT);
  }

  // overlook ledges: one emplacement each side, watching a choke — each
  // ledge gets its walk-up (an orphaned gun is a decoration, not a position)
  for (const [ox, oz] of L.overlooks) clearDisc(grid, ox, oz, 2);
  for (const [x0, z0, x1, z1] of L.ledges) rect(grid, x0, z0, x1, z1, T_OPEN);
  d.vehiclePads.push({ kind: 'emplacement', team: 0, pos: tw(...L.overlooks[0]) });
  d.vehiclePads.push({ kind: 'emplacement', team: 1, pos: tw(...L.overlooks[1]) });

  // the way stations — shelter on the shelves
  const ctx = ctxOf(d);
  for (const [id, sx, sz] of L.stations) stampBuilding(ctx, byId(id), sx, sz, sx + sz);

  // the convoy that never made it out of the pass — burned out on the long
  // descent, right under the east overlook. The ambush story, told in steel.
  for (const [wx, wz, r] of L.wrecks) {
    if (openOutdoors(d, wx, wz)) {
      claim(grid, claims, wx, wz, T_COVER);
      props.push({ type: 'wreck', pos: tw(wx, wz), scale: 1, rot: r });
    }
  }

  // base pockets carved into the rock at the gates
  clearDisc(grid, L.bases[0][0], L.bases[0][1], 8);
  clearDisc(grid, L.bases[1][0], L.bases[1][1], 8);
  stampBase(grid, claims, props, d.vehiclePads, 0, L.bases[0][0], L.bases[0][1], ['transport', 'flyer', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, L.bases[1][0], L.bases[1][1], ['transport', 'flyer', 'buggy', 'ambulance']);
  // the pocket carve leaks a sliver BEHIND each base's back wall — rock
  // swallows it again (the zero-orphan law named these tiles exactly)
  rect(grid, L.bases[0][0] - 9, L.bases[0][1] - 8, L.bases[0][0] - 7, L.bases[0][1] + 8, T_WALL);
  rect(grid, L.bases[1][0] + 7, L.bases[1][1] - 8, L.bases[1][0] + 9, L.bases[1][1] + 8, T_WALL);

  dealPickups(d, L.pickups);
  sealOutside(grid, box);
  sealRim(grid);

  // the quarantine crawls out of the NETWORK — mouths on the road itself,
  // never in rock pockets no path serves
  const roadMid = (r: [number, number, number, number], f: number): [number, number] =>
    [Math.round(r[0] + (r[2] - r[0]) * f), Math.round((r[1] + r[3]) / 2)];
  const mouths: Vec3[] = [];
  const spots: [number, number][] = [
    roadMid(L.road[0], 0.25), roadMid(L.road[0], 0.75),
    [Math.round(L.road[2][0] + (L.road[2][2] - L.road[2][0]) / 3), L.road[2][1] + 2],
    [Math.round(L.road[2][0] + ((L.road[2][2] - L.road[2][0]) * 2) / 3), L.road[2][1] + 2],
    [L.road[3][0] + 2, Math.round((L.road[3][1] + L.road[3][3]) / 2)],
    roadMid(L.road[4], 0.5), roadMid(L.road[4], 0.8),
    [L.meadows[0][0], L.meadows[0][1]],
    [L.goats[0][0], Math.round((L.goats[0][1] + L.goats[0][3]) / 2)],
    [L.goats[2][0], Math.round((L.goats[2][1] + L.goats[2][3]) / 2)],
    [L.saddlePath[0][0], L.saddlePath[0][1]],
    [L.meadows[1][0], L.meadows[1][1]],
  ];
  for (const [mx2, mz2] of spots) { clearDisc(grid, mx2, mz2, 1); mouths.push(tw(mx2, mz2)); }

  return {
    seed, theme: 'asteroid', grid, grid2: d.grid2, surface,
    basePos: [tw(...L.bases[0]), tw(...L.bases[1])],
    spawns: [spawnRing(...L.bases[0]), spawnRing(...L.bases[1])],
    flagPos: [tw(...L.bases[0]), tw(...L.bases[1])],
    hillPos: tw(L.chokes[0][0], L.chokes[0][1] + 2),
    controlPoints: [
      { name: 'WEST ELBOW', pos: tw(L.road[1][0] + 2, Math.round((L.road[1][1] + L.road[1][3]) / 2)) },
      { name: 'THE NARROWS', pos: tw(L.chokes[0][0] + 2, L.chokes[0][1] + 2) },
      { name: 'EAST ELBOW', pos: tw(L.road[3][0] + 2, Math.round((L.road[3][1] + L.road[3][3]) / 2)) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: mouths,
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

function blacksite(seed: number, size: MapSize = 'large'): GameMap {
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_ICE);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);
  const L = {
    large: {
      leads: [[[12, 20], [30, 28], [44, 22], [58, 30]], [[40, 86], [56, 74], [72, 80], [86, 68]], [[70, 12], [80, 26], [92, 32]]] as [number, number][][],
      tower: [44, 42] as [number, number], shop: [52, 40] as [number, number] | null, barracks: [44, 54] as [number, number] | null,
      yard: [42, 48, 60, 52] as [number, number, number, number],
      masts: [[28, 26], [32, 30], [26, 33], [35, 25], [30, 22], [24, 28]] as [number, number][],
      pad: [68, 66] as [number, number], posts: [[47, 18], [47, 78]] as [number, number][],
      fenceR: 30, boulders: 22, baseX: [10, GRID - 11] as [number, number], baseZ: 50,
      pickups: [[34, 40, 'medkit'], [34, 60, 'ammo'], [42, 30, 'energy']] as [number, number, PickupSpawn['type']][],
    },
    standard: {
      leads: [[[16, 18], [32, 24], [44, 18], [56, 26]], [[38, 78], [54, 68], [70, 72], [82, 62]], [[66, 12], [76, 22], [84, 28]]] as [number, number][][],
      tower: [46, 42] as [number, number], shop: [53, 40] as [number, number] | null, barracks: [46, 54] as [number, number] | null,
      yard: [44, 48, 58, 52] as [number, number, number, number],
      masts: [[28, 24], [32, 28], [26, 31], [35, 23], [30, 20]] as [number, number][],
      pad: [64, 62] as [number, number], posts: [[47, 16], [47, 76]] as [number, number][],
      fenceR: 26, boulders: 16, baseX: [19, GRID - 20] as [number, number], baseZ: 47,
      pickups: [[34, 38, 'medkit'], [34, 58, 'ammo'], [42, 28, 'energy']] as [number, number, PickupSpawn['type']][],
    },
    small: {
      leads: [[[24, 22], [36, 28], [46, 22]], [[36, 74], [52, 66], [68, 70]]] as [number, number][][],
      tower: [46, 44] as [number, number], shop: [52, 42] as [number, number] | null, barracks: null,
      yard: [44, 48, 56, 52] as [number, number, number, number],
      masts: [[28, 26], [32, 30], [26, 32], [34, 24]] as [number, number][],
      pad: [62, 60] as [number, number], posts: [[47, 24], [47, 68]] as [number, number][],
      fenceR: 20, boulders: 10, baseX: [29, GRID - 30] as [number, number], baseZ: 49,
      pickups: [[34, 40, 'medkit'], [34, 58, 'ammo'], [42, 30, 'energy']] as [number, number, PickupSpawn['type']][],
    },
  }[size];

  // OPEN LEADS: cracks of black water across the floe — swim or walk around;
  // the frozen scar seals them and rewrites every route
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
  for (const pts of L.leads) lead(pts);

  // THE COMPOUND: metal labs around a plate courtyard — the whiteout's one
  // warm heart. Walkway rails guide you home when visibility dies.
  stampBuilding(ctx, LAB_TOWER, L.tower[0], L.tower[1], 0);
  if (L.shop) stampBuilding(ctx, byId('machine_shop'), L.shop[0], L.shop[1], 2);
  if (L.barracks) stampBuilding(ctx, byId('barracks_hall'), L.barracks[0], L.barracks[1], 4);
  const [yx0, yz0, yx1, yz1] = L.yard;
  rect(grid, yx0, yz0, yx1, yz1, T_OPEN);
  rectSurf(surface, yx0, yz0, yx1, yz1, S_PLATE);
  // mouths are COMPUTED from the labs' real doorways — a rail that walls a
  // doorstep shut is the bug this comment once described (the atlas caught
  // the tower door walled shut by its own walkway rail)
  const mouths = new Set([L.tower[0] + 2, Math.floor((yx0 + yx1) / 2), Math.floor((yx0 + yx1) / 2) + 2]);
  if (L.shop) { mouths.add(L.shop[0] + 2); mouths.add(L.shop[0] + 3); }
  for (let x = yx0; x <= yx1; x += 2) {
    if (mouths.has(x)) continue;
    set(grid, x, yz0 - 1, T_COVER);
    set(grid, x, yz1 + 1, T_COVER);
  }

  // ANTENNA FARM: the listening post — masts in a boulder field
  for (const [ax, az] of L.masts) {
    claim(grid, claims, ax, az, T_COVER);
    props.push({ type: 'flare_stack', pos: tw(ax, az), scale: 0.7, rot: 0 });
  }

  // LANDING PAD: plate disc — the extraction point
  clearDisc(grid, L.pad[0], L.pad[1], 4);
  for (let z = L.pad[1] - 4; z <= L.pad[1] + 4; z++) for (let x = L.pad[0] - 4; x <= L.pad[0] + 4; x++) {
    if ((x - L.pad[0]) ** 2 + (z - L.pad[1]) ** 2 <= 16 && inb(x) && inb(z)) surface[idx(x, z)] = S_PLATE;
  }

  // perimeter: guard posts on the cardinals, a broken fence line between
  for (const [px2, pz2] of L.posts) stampBuilding(ctx, byId('guard_post'), px2, pz2, px2 + pz2);
  ring(grid, 50, 50, L.fenceR, T_COVER, [[0, 20], [70, 110], [160, 200], [250, 290], [340, 360]]);

  // pressure ridges: ice boulders drift the floe (dressing)
  for (let i = 0; i < L.boulders; i++) {
    const tx = d.rng.int(box.x0 + 8, box.x1 - 8), tz = d.rng.int(box.z0 + 8, box.z1 - 8);
    if (Math.hypot(tx - 50, tz - 50) > 16 && openOutdoors(d, tx, tz) && Math.abs(tz - L.baseZ) > 8) {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(0.9, 1.6), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, L.baseX[0], L.baseZ, ['bike', 'buggy', 'flyer', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, L.baseX[1], L.baseZ, ['bike', 'buggy', 'flyer', 'ambulance']);

  dealPickups(d, L.pickups);
  d.pickups.push({ type: 'flamer', pos: tw(L.pad[0], L.pad[1]) }); // the pad cache
  mudMargins(grid, surface);
  sealOutside(grid, box);
  sealRim(grid);

  return {
    seed, theme: 'triton', grid, grid2: d.grid2, surface,
    basePos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    spawns: [spawnRing(L.baseX[0], L.baseZ), spawnRing(L.baseX[1], L.baseZ)],
    flagPos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    hillPos: tw(51, 50),
    controlPoints: [
      { name: 'ANTENNA FARM', pos: tw(L.masts[0][0] + 2, L.masts[0][1] + 1) },
      { name: 'THE LABS', pos: tw(51, 50) },
      { name: 'LANDING PAD', pos: tw(...L.pad) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
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

function refinery(seed: number, size: MapSize = 'large'): GameMap {
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_PLATE);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);
  const L = {
    large: {
      apron: [[22, 26, 43, 72]] as [number, number, number, number][],
      tanks: [[28, 32], [28, 50], [28, 68], [38, 41], [38, 59]] as [number, number][],
      flares: [[22, 20], [22, 80]] as [number, number][],
      racks: [24, 76], blocks: [['pumphouse', 42, 30], ['machine_shop', 40, 64]] as [string, number, number][],
      drums: 16, baseX: [10, GRID - 11] as [number, number], baseZ: 50,
      pickups: [[34, 24, 'ammo'], [34, 76, 'medkit'], [44, 40, 'flamer']] as [number, number, PickupSpawn['type']][],
    },
    standard: {
      apron: [[22, 22, 41, 70]] as [number, number, number, number][],
      tanks: [[26, 28], [26, 46], [26, 64], [36, 37]] as [number, number][],
      flares: [[22, 16], [22, 74]] as [number, number][],
      racks: [20, 72], blocks: [['pumphouse', 40, 26], ['machine_shop', 38, 58]] as [string, number, number][],
      drums: 12, baseX: [19, GRID - 20] as [number, number], baseZ: 47,
      pickups: [[32, 20, 'ammo'], [32, 70, 'medkit'], [44, 38, 'flamer']] as [number, number, PickupSpawn['type']][],
    },
    small: {
      apron: [[26, 26, 40, 68]] as [number, number, number, number][],
      tanks: [[30, 30], [30, 48], [30, 64]] as [number, number][],
      flares: [[24, 24], [24, 70]] as [number, number][],
      racks: [28, 66], blocks: [['pumphouse', 42, 32], ['machine_shop', 40, 56]] as [string, number, number][],
      drums: 8, baseX: [29, GRID - 30] as [number, number], baseZ: 49,
      pickups: [[34, 28, 'ammo'], [34, 64, 'medkit'], [44, 36, 'flamer']] as [number, number, PickupSpawn['type']][],
    },
  }[size];

  // containment aprons under each tank farm: grit stains against the plate,
  // so the farms read as districts instead of dots on a slab
  for (const [ax0, az0, ax1, az1] of L.apron) {
    rectSurf(surface, ax0, az0, ax1, az1, S_GRIT);
    rectSurf(surface, GRID - 1 - ax1, az0, GRID - 1 - ax0, az1, S_GRIT);
  }

  // TANK FARMS: storage tanks, mirrored — every tank a fat silhouette you
  // can't see past and shouldn't stand beside. The claim is the PLUS shape
  // the drum's silhouette actually covers (the invisible-rim audit law).
  for (const [cx, cz] of L.tanks) {
    for (const tx of [cx, GRID - 1 - cx]) {
      clearDisc(grid, tx, cz, 3);
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        claim(grid, claims, tx + dx, cz + dz, T_WALL);
      }
      props.push({ type: 'silo', pos: tw(tx, cz), scale: 2.1, rot: 0 });
    }
  }

  // FLARE STACKS: pilot lights on the skyline — the chain-reaction bait
  for (const [fx, fz] of L.flares) {
    for (const tx of [fx, GRID - 1 - fx]) {
      claim(grid, claims, tx, fz, T_WALL);
      props.push({ type: 'flare_stack', pos: tw(tx, fz), scale: 1.2, rot: 0 });
    }
  }

  // PIPE RACKS: two east-west runs with crawl gaps — infantry cover the
  // whole way across, vehicles pick a gap and pray
  for (const z of L.racks) {
    for (let x = box.x0 + 8; x <= box.x1 - 8; x++) {
      if (x === 30 || x === 50 || x === 70) continue;
      set(grid, x, z, T_COVER);
    }
  }

  // process blocks: pump houses and the machine shop, mirrored
  for (const [id, bx2, bz2] of L.blocks) {
    const def = byId(id);
    stampBuilding(ctx, def, bx2, bz2, bx2 + bz2);
    stampBuilding(ctx, mirrorDef(def), GRID - bx2 - Math.max(...def.rows.map((r) => r.length)), bz2, bx2 + bz2 + 1);
  }

  // THE CONTROL ROOM: dead center — hold the switches, hold the front
  stampBuilding(ctx, CONTROL_ROOM, 46, 46, 8);

  // drum stacks in the alleys and along the empty top/bottom bands
  for (let i = 0; i < L.drums; i++) {
    const tx = d.rng.int(box.x0 + 10, box.x1 - 10), tz = d.rng.int(box.z0 + 8, box.z1 - 8);
    if (openOutdoors(d, tx, tz) && Math.hypot(tx - 50, tz - 50) > 9 && Math.abs(tz - L.baseZ) > 4) {
      claim(grid, claims, tx, tz, T_COVER);
      props.push({ type: 'crate', pos: tw(tx, tz), scale: 1, rot: d.rng.range(0, Math.PI) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, L.baseX[0], L.baseZ, ['apc', 'tunneler', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, L.baseX[1], L.baseZ, ['apc', 'tunneler', 'buggy', 'ambulance']);

  dealPickups(d, L.pickups);
  sealOutside(grid, box);
  sealRim(grid);

  return {
    seed, theme: 'starship', grid, grid2: d.grid2, surface,
    basePos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    spawns: [spawnRing(L.baseX[0], L.baseZ), spawnRing(L.baseX[1], L.baseZ)],
    flagPos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    hillPos: tw(49, 52),
    controlPoints: [
      { name: 'WEST FARM', pos: tw(L.tanks[0][0] + 5, L.tanks[0][1] + 9) },
      { name: 'CONTROL', pos: tw(49, 52) },
      { name: 'EAST FARM', pos: tw(GRID - L.tanks[0][0] - 6, GRID - L.tanks[0][1] - 10) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// 8 · THE PORT — a harbor channel splits the terminal; the moored ship is
// the main crossing, the north mole the naked one.
// Signature: the assault-boat run onto the pier under fire.
// Doctrine: boats and the air. Scar: flooded (lanes drown).
// ---------------------------------------------------------------------------
interface PortLayout {
  ship: [number, number];          // z band of the moored hull
  mole: [number, number] | null;   // the bare causeway (cut on small)
  yards: { x0: number; rows: number[] }[]; // container lanes (climb walls)
  clutter: [number, number][];     // dockside boxes toward the corners
  cranes: [number, number][];      // crane kings (mirrored)
  warehouses: [string, number, number][];    // west-side stock (mirrored)
  platform: [number, number, number, number]; // the offshore cache island
  boats: [[number, number], [number, number]];
  baseX: [number, number]; baseZ: number;
  pickups: [number, number, PickupSpawn['type']][];
}

const PORT_LAYOUTS: Record<MapSize, PortLayout> = {
  large: {
    ship: [40, 52], mole: [18, 19],
    yards: [{ x0: 24, rows: [28, 34, 58, 64] }, { x0: GRID - 1 - 36, rows: [28, 34, 58, 64] }],
    clutter: [[16, 14], [20, 82], [83, 14], [79, 84], [36, 12], [63, 88]],
    cranes: [[30, 31], [30, 61]],
    warehouses: [['warehouse', 20, 42], ['depot', 26, 74]],
    platform: [47, 74, 52, 79],
    boats: [[45, 30], [54, 66]],
    baseX: [10, GRID - 11], baseZ: 50,
    pickups: [[36, 20, 'ammo'], [38, 46, 'medkit'], [36, 70, 'ammo']],
  },
  standard: {
    ship: [38, 50], mole: [16, 17],
    yards: [{ x0: 22, rows: [24, 30, 54, 60] }, { x0: GRID - 1 - 34, rows: [24, 30, 54, 60] }],
    clutter: [[14, 12], [18, 76], [81, 12], [77, 78], [34, 12], [61, 80]],
    cranes: [[28, 27], [28, 55]],
    warehouses: [['warehouse', 18, 38], ['depot', 24, 66]],
    platform: [47, 66, 52, 71],
    boats: [[45, 26], [54, 58]],
    baseX: [19, GRID - 20], baseZ: 47,
    pickups: [[34, 18, 'ammo'], [36, 42, 'medkit'], [34, 62, 'ammo']],
  },
  small: {
    ship: [38, 50], mole: null,
    yards: [{ x0: 24, rows: [26, 32, 56, 62] }, { x0: GRID - 1 - 36, rows: [26, 32, 56, 62] }],
    clutter: [[22, 22], [24, 72], [74, 22], [72, 74]],
    cranes: [[28, 29], [28, 53]],
    warehouses: [['warehouse', 22, 40]],
    platform: [47, 62, 52, 67],
    boats: [[45, 28], [54, 56]],
    baseX: [29, GRID - 30], baseZ: 49,
    pickups: [[34, 24, 'ammo'], [36, 42, 'medkit'], [34, 58, 'ammo']],
  },
};

function thePort(seed: number, size: MapSize = 'large'): GameMap {
  const L = PORT_LAYOUTS[size];
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_WET);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);

  // THE CHANNEL: deep water down the middle, working rims you can wade
  rect(grid, 44, box.z0 + 1, 55, box.z1 - 1, T_WATER);
  rect(grid, 46, box.z0 + 1, 53, box.z1 - 1, T_DEEP);

  // THE SHIP: a moored hull spanning the channel. Metal sides, plate deck,
  // container stacks for deck cover, gangways both banks — boarding her IS
  // crossing the harbor.
  rect(grid, 42, L.ship[0], 57, L.ship[1], T_OPEN);
  rectSurf(surface, 42, L.ship[0], 57, L.ship[1], S_PLATE);
  for (let x = 42; x <= 57; x++) {
    if (x >= 48 && x <= 51) continue; // bow/stern working gaps stay walls
    set(grid, x, L.ship[0], T_METAL);
    set(grid, x, L.ship[1], T_METAL);
  }
  set(grid, 48, L.ship[0], T_METAL); set(grid, 51, L.ship[0], T_METAL);
  set(grid, 48, L.ship[1], T_METAL); set(grid, 51, L.ship[1], T_METAL);
  rect(grid, 42, L.ship[0] + 1, 42, L.ship[1] - 1, T_METAL);
  rect(grid, 57, L.ship[0] + 1, 57, L.ship[1] - 1, T_METAL);
  // gangways: the only doors onto the deck
  const gz = Math.floor((L.ship[0] + L.ship[1]) / 2);
  set(grid, 42, gz, T_DOOR); set(grid, 42, gz + 1, T_DOOR);
  set(grid, 57, gz, T_DOOR); set(grid, 57, gz + 1, T_DOOR);
  // deck cargo: climb stacks — jump troopers own the high line
  rect(grid, 45, L.ship[0] + 3, 46, L.ship[0] + 4, T_CLIMB);
  rect(grid, 52, L.ship[1] - 4, 53, L.ship[1] - 3, T_CLIMB);
  rect(grid, 49, gz, 50, gz + 1, T_COVER);

  // THE NORTH MOLE: a bare plate causeway — fast and lethal
  if (L.mole) {
    rect(grid, 44, L.mole[0], 55, L.mole[1], T_OPEN);
    rectSurf(surface, 44, L.mole[0], 55, L.mole[1], S_PLATE);
  }

  // CONTAINER YARDS: climb-wall lanes on both banks — the crane's kingdom.
  // The yards stand on paved aprons so the terminal reads paved against the
  // wet europa ground.
  const yard = (x0: number, rows: number[]) => {
    for (const z of rows) rectSurf(surface, x0 - 2, z - 2, x0 + 14, z + 2, S_PLATE);
    for (const z of rows) {
      for (let x = x0; x <= x0 + 12; x++) {
        if (x === x0 + 6) continue; // every run has one broken slot
        set(grid, x, z, T_CLIMB);
      }
    }
  };
  for (const y of L.yards) yard(y.x0, y.rows);
  // stray boxes and dockside clutter toward the corners — a working port
  // is never swept clean
  for (const [bx2, bz2] of L.clutter) {
    if (grid[idx(bx2, bz2)] === T_OPEN) {
      set(grid, bx2, bz2, T_CLIMB);
      set(grid, bx2 + 1, bz2, T_CLIMB);
    }
  }
  for (const [cx, cz] of L.cranes) {
    for (const tx of [cx, GRID - 1 - cx]) {
      props.push({ type: 'crane', pos: tw(tx, cz), scale: 1, rot: tx > 50 ? Math.PI : 0 });
    }
  }

  // warehouses back the yards
  for (const [id, hx, hz] of L.warehouses) {
    const def = byId(id);
    stampBuilding(ctx, def, hx, hz, hx + hz);
    stampBuilding(ctx, mirrorDef(def), GRID - hx - Math.max(...def.rows.map((r) => r.length)), hz, hx + hz + 1);
  }

  // THE PLATFORM: an offshore plate island south — ladder up from the water,
  // a cache worth swimming for
  const [px0, pz0, px1, pz1] = L.platform;
  rect(grid, px0, pz0, px1, pz1, T_OPEN);
  rectSurf(surface, px0, pz0, px1, pz1, S_PLATE);
  set(grid, px0, pz0 + 2, T_LADDER); set(grid, px1, pz0 + 3, T_LADDER);
  d.pickups.push({ type: 'flamer', pos: tw(px0 + 2, pz0 + 2) });
  d.pickups.push({ type: 'energy', pos: tw(px0 + 3, pz0 + 3) });

  stampBase(grid, claims, props, d.vehiclePads, 0, L.baseX[0], L.baseZ, ['apc', 'buggy', 'flyer', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, L.baseX[1], L.baseZ, ['apc', 'buggy', 'flyer', 'ambulance']);
  d.vehiclePads.push({ kind: 'boat', team: 0, pos: tw(...L.boats[0]) });
  d.vehiclePads.push({ kind: 'boat', team: 1, pos: tw(...L.boats[1]) });

  dealPickups(d, L.pickups);
  mudMargins(grid, surface);
  sealOutside(grid, box);
  sealRim(grid);

  return {
    seed, theme: 'europa', grid, grid2: d.grid2, surface,
    basePos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    spawns: [spawnRing(L.baseX[0], L.baseZ), spawnRing(L.baseX[1], L.baseZ)],
    flagPos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    hillPos: tw(49, gz),
    controlPoints: [
      { name: 'WEST YARD', pos: tw(L.yards[0].x0 + 6, Math.floor((L.yards[0].rows[1] + L.yards[0].rows[2]) / 2)) },
      { name: 'THE SHIP', pos: tw(49, gz) },
      { name: 'EAST YARD', pos: tw(L.yards[1].x0 + 6, Math.floor((L.yards[1].rows[1] + L.yards[1].rows[2]) / 2)) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
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

function airbase(seed: number, size: MapSize = 'large'): GameMap {
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_GRASS);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);
  const L = {
    large: {
      runway: [46, 53] as [number, number], taxi: [40, 41] as [number, number],
      taxiLinks: [[30, 42], [68, 42]] as [number, number][],
      hangars: [[20, 24], [44, 24], [68, 24]] as [number, number][],
      tower: [58, 33] as [number, number], revetXs: [24, 40, 56, 72], revetZ: [61, 66] as [number, number],
      fuel: [[70, 72], [74, 74], [70, 77]] as [number, number][],
      fuelPad: [66, 69, 78, 81] as [number, number, number, number],
      radar: [18, 72] as [number, number] | null, guard: [22, 74] as [number, number] | null,
      boneyard: [[78, 14, 0.8], [84, 18, 2.2], [80, 22, 4.1]] as [number, number, number][],
      bases: [[10, 72], [GRID - 11, 28]] as [[number, number], [number, number]],
      sams: [[24, 63], [72, 63]] as [[number, number], [number, number]],
      pickups: [[36, 44, 'ammo'], [36, 58, 'medkit'], [44, 70, 'energy']] as [number, number, PickupSpawn['type']][],
    },
    standard: {
      runway: [42, 49] as [number, number], taxi: [36, 37] as [number, number],
      taxiLinks: [[30, 38], [66, 38]] as [number, number][],
      hangars: [[20, 18], [44, 18], [66, 18]] as [number, number][],
      tower: [54, 26] as [number, number], revetXs: [24, 40, 56, 70], revetZ: [54, 59] as [number, number],
      fuel: [[66, 64], [70, 66], [66, 69]] as [number, number][],
      fuelPad: [62, 61, 74, 73] as [number, number, number, number],
      radar: [16, 64] as [number, number] | null, guard: [20, 66] as [number, number] | null,
      boneyard: [[70, 12, 0.8], [76, 14, 2.2], [72, 24, 4.1]] as [number, number, number][],
      bases: [[19, 62], [GRID - 20, 32]] as [[number, number], [number, number]],
      sams: [[24, 53], [68, 53]] as [[number, number], [number, number]],
      pickups: [[34, 40, 'ammo'], [34, 54, 'medkit'], [44, 62, 'energy']] as [number, number, PickupSpawn['type']][],
    },
    small: {
      runway: [40, 47] as [number, number], taxi: [34, 35] as [number, number],
      taxiLinks: [[34, 36], [62, 36]] as [number, number][],
      hangars: [[26, 22], [50, 22]] as [number, number][],
      tower: [58, 28] as [number, number], revetXs: [28, 44, 60], revetZ: [52, 57] as [number, number],
      fuel: [[62, 56], [66, 58]] as [number, number][],
      fuelPad: [60, 53, 68, 62] as [number, number, number, number],
      radar: [24, 58] as [number, number] | null, guard: [26, 60] as [number, number] | null,
      boneyard: [[68, 24, 0.8], [72, 28, 2.2]] as [number, number, number][],
      bases: [[29, 58], [GRID - 30, 36]] as [[number, number], [number, number]],
      sams: [[26, 51], [64, 51]] as [[number, number], [number, number]],
      pickups: [[36, 38, 'ammo'], [36, 50, 'medkit'], [44, 56, 'energy']] as [number, number, PickupSpawn['type']][],
    },
  }[size];

  // THE RUNWAY: eight tiles of plate, end to end. No cover. That's the point.
  rectSurf(surface, box.x0 + 8, L.runway[0], box.x1 - 8, L.runway[1], S_PLATE);
  // taxiway north, with two connectors
  rectSurf(surface, box.x0 + 12, L.taxi[0], box.x1 - 12, L.taxi[1], S_PLATE);
  for (const [lx, lz] of L.taxiLinks) rectSurf(surface, lx, lz, lx + 1, L.runway[0] - 1, S_PLATE);

  // HANGAR ROW: sheds north of the taxiway — the prototype lives here
  for (const [hx, hz] of L.hangars) stampBuilding(ctx, HANGAR, hx, hz, hx + hz);

  // THE TOWER: mid-field north, watching every inch of plate
  stampBuilding(ctx, TOWER, L.tower[0], L.tower[1], 6);

  // REVETMENTS: C-berms south of the runway sheltering the ready line
  for (const rx of L.revetXs) {
    for (let x = rx - 3; x <= rx + 3; x++) set(grid, x, L.revetZ[1], T_COVER);
    for (let z = L.revetZ[0]; z <= L.revetZ[1]; z++) { set(grid, rx - 3, z, T_COVER); set(grid, rx + 3, z, T_COVER); }
  }

  // FUEL FARM: south of the revetment line, inside CP reach
  for (const [sx, sz] of L.fuel) {
    claim(grid, claims, sx, sz, T_WALL);
    props.push({ type: 'silo', pos: tw(sx, sz), scale: 1.6, rot: 0 });
  }
  rectSurf(surface, ...L.fuelPad, S_DIRT);

  // radar mast + its guard shack, south-west
  if (L.radar) {
    claim(grid, claims, L.radar[0], L.radar[1], T_WALL);
    props.push({ type: 'flare_stack', pos: tw(...L.radar), scale: 1, rot: 0 });
  }
  if (L.guard) stampBuilding(ctx, byId('guard_post'), L.guard[0], L.guard[1], 8);

  // THE BONEYARD: gutted airframes in the north-east grass — the war's been
  // here before, and the wrecks are the only cover on that approach
  for (const [wx, wz, r] of L.boneyard) {
    claim(grid, claims, wx, wz, T_COVER);
    props.push({ type: 'wreck', pos: tw(wx, wz), scale: 1.2, rot: r });
  }

  // bases sit OFF the strip, diagonal — every route to the far objectives
  // crosses the open plate, which is the whole front
  stampBase(grid, claims, props, d.vehiclePads, 0, L.bases[0][0], L.bases[0][1], ['flyer', 'flyer', 'tank', 'transport', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, L.bases[1][0], L.bases[1][1], ['flyer', 'flyer', 'tank', 'transport', 'ambulance']);
  // the SAM ring: one emplacement in a forward revetment each
  d.vehiclePads.push({ kind: 'emplacement', team: 0, pos: tw(...L.sams[0]) });
  d.vehiclePads.push({ kind: 'emplacement', team: 1, pos: tw(...L.sams[1]) });

  dealPickups(d, L.pickups);
  sealOutside(grid, box);
  sealRim(grid);

  const midRun = Math.floor((L.runway[0] + L.runway[1]) / 2);
  return {
    seed, theme: 'savanna', grid, grid2: d.grid2, surface,
    basePos: [tw(...L.bases[0]), tw(...L.bases[1])],
    spawns: [spawnRing(...L.bases[0]), spawnRing(...L.bases[1])],
    flagPos: [tw(...L.bases[0]), tw(...L.bases[1])],
    hillPos: tw(50, midRun), // KOTH on the centerline — sprint, hold, pray
    controlPoints: [
      // rotationally paired around the strip — conquest stays fair from
      // diagonal bases: A is NW, C is its 180° twin SE, B is the plate
      { name: 'HANGAR ROW', pos: tw(L.hangars[0][0] + 6, L.hangars[0][1] + 4) },
      { name: 'THE RUNWAY', pos: tw(50, midRun) },
      { name: 'FUEL FARM', pos: tw(L.fuel[0][0], L.fuel[0][1]) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
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

function theMine(seed: number, size: MapSize = 'large'): GameMap {
  const box = boxFor(size);
  const d = draft(seed, T_OPEN, S_DIRT);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);
  const C = 50;
  const L = {
    large: {
      rings: [26, 19, 12],
      arcs: [[20, 25, 90, 180], [20, 25, 270, 360], [13, 18, 90, 230], [13, 18, 270, 410]] as [number, number, number, number][],
      gates: [[18, 48, 25, 52], [75, 48, 82, 52]] as [number, number, number, number][],
      spills: [[55, 42, 59, 45], [41, 55, 45, 58]] as [number, number, number, number][],
      oreR: 10, galleries: [[38, 14], [42, 82]] as [number, number][],
      bunker: [66, 30] as [number, number], guard: [30, 66] as [number, number] | null,
      headframe: [80, 50] as [number, number], conveyor: [84, 92, 50] as [number, number, number],
      supply: [[62, 34], [59, 30]] as [number, number][], spoil: 20,
      baseX: [10, GRID - 11] as [number, number], baseZ: 50,
      pickups: [[32, 40, 'medkit'], [32, 60, 'ammo'], [40, 34, 'energy']] as [number, number, PickupSpawn['type']][],
    },
    standard: {
      rings: [22, 16, 10],
      arcs: [[17, 21, 90, 180], [17, 21, 270, 360], [11, 15, 90, 230], [11, 15, 270, 410]] as [number, number, number, number][],
      gates: [[23, 45, 27, 49], [72, 45, 77, 49]] as [number, number, number, number][],
      spills: [[54, 42, 58, 46], [42, 54, 46, 57]] as [number, number, number, number][],
      oreR: 8, galleries: [[34, 12], [40, 78]] as [number, number][],
      bunker: [62, 26] as [number, number], guard: [28, 62] as [number, number] | null,
      headframe: [72, 47] as [number, number], conveyor: [74, 84, 47] as [number, number, number],
      supply: [[58, 30], [55, 26]] as [number, number][], spoil: 14,
      baseX: [19, GRID - 20] as [number, number], baseZ: 47,
      pickups: [[28, 36, 'medkit'], [28, 58, 'ammo'], [38, 30, 'energy']] as [number, number, PickupSpawn['type']][],
    },
    small: {
      rings: [17, 11, 6],
      arcs: [[12, 16, 90, 180], [12, 16, 270, 360], [7, 10, 90, 230], [7, 10, 270, 410]] as [number, number, number, number][],
      gates: [[28, 45, 32, 49], [67, 45, 72, 49]] as [number, number, number, number][],
      spills: [[53, 43, 56, 47], [44, 53, 47, 56]] as [number, number, number, number][],
      oreR: 6, galleries: [[32, 22], [42, 72]] as [number, number][],
      bunker: [58, 30] as [number, number], guard: null,
      headframe: [56, 47] as [number, number], conveyor: [58, 62, 47] as [number, number, number],
      supply: [[55, 33], [52, 30]] as [number, number][], spoil: 8,
      baseX: [29, GRID - 30] as [number, number], baseZ: 47,
      pickups: [[34, 38, 'medkit'], [34, 58, 'ammo'], [40, 34, 'energy']] as [number, number, PickupSpawn['type']][],
    },
  }[size];

  // THE PIT: three terrace rings of climb wall. Ramp gaps rotate a quarter
  // turn per ring, so descending is a spiral, not a straight drop.
  ring(grid, C, C, L.rings[0], T_CLIMB, [[350, 360], [0, 10], [170, 190]]);   // rim: E + W ramps
  ring(grid, C, C, L.rings[1], T_CLIMB, [[80, 100], [260, 280]]);             // mid: S + N ramps
  ring(grid, C, C, L.rings[2], T_CLIMB, [[35, 55], [215, 235]]);              // floor lip: NE + SW
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
  for (const [x0, z0, x1, z1] of L.gates) rectSurf(surface, x0, z0, x1, z1, S_GRIT);
  for (const [r0, r1, a0, a1] of L.arcs) arcSurf(r0, r1, a0, a1);
  for (const [x0, z0, x1, z1] of L.spills) rectSurf(surface, x0, z0, x1, z1, S_GRIT);

  // the ore body: the pit floor's only cover
  clearDisc(grid, C, C, L.oreR);
  for (const [ox, oz] of [[48, 48], [52, 52], [47, 52]] as const) {
    claim(grid, claims, ox, oz, T_WALL);
    props.push({ type: 'rock', pos: tw(ox, oz), scale: 1.3, rot: d.rng.range(0, Math.PI * 2) });
  }
  claim(grid, claims, 52, 48, T_COVER);
  props.push({ type: 'crate', pos: tw(52, 48), scale: 1, rot: 0.4 });

  // THE GALLERIES: two roofed corridors north and south of the pit — the
  // quarantine's favorite dark. Doors at both ends; the drill makes more.
  for (const [gx, gz] of L.galleries) stampBuilding(ctx, GALLERY, gx, gz, gx + gz);

  // the bunker complex at the north-east rim — the guard station
  stampBuilding(ctx, byId('bunker'), L.bunker[0], L.bunker[1], 8);
  if (L.guard) stampBuilding(ctx, byId('guard_post'), L.guard[0], L.guard[1], 10);

  // THE HEADFRAME: the mine's silhouette, over the east ramp, with its
  // conveyor running to the rim
  props.push({ type: 'crane', pos: tw(...L.headframe), scale: 1.1, rot: Math.PI });
  for (let x = L.conveyor[0]; x <= L.conveyor[1]; x++) { if (x % 2 === 0) set(grid, x, L.conveyor[2], T_COVER); }

  // the guard station's supply line: crates between bunker and rim
  for (const [cx2, cz2] of L.supply) {
    claim(grid, claims, cx2, cz2, T_COVER);
    props.push({ type: 'crate', pos: tw(cx2, cz2), scale: 1, rot: d.rng.range(0, Math.PI) });
  }

  // spoil heaps: the rng piles rock where the mine dumped it
  for (let i = 0; i < L.spoil; i++) {
    const tx = d.rng.int(box.x0 + 8, box.x1 - 8), tz = d.rng.int(box.z0 + 8, box.z1 - 8);
    if (Math.hypot(tx - C, tz - C) > L.rings[0] + 4 && Math.abs(tz - L.baseZ) > 9 && openOutdoors(d, tx, tz)) {
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(1.0, 1.7), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  stampBase(grid, claims, props, d.vehiclePads, 0, L.baseX[0], L.baseZ, ['tunneler', 'apc', 'buggy', 'ambulance']);
  stampBase(grid, claims, props, d.vehiclePads, 1, L.baseX[1], L.baseZ, ['tunneler', 'apc', 'buggy', 'ambulance']);

  dealPickups(d, L.pickups);
  sealOutside(grid, box);
  sealRim(grid);

  return {
    seed, theme: 'asteroid', grid, grid2: d.grid2, surface,
    basePos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    spawns: [spawnRing(L.baseX[0], L.baseZ), spawnRing(L.baseX[1], L.baseZ)],
    flagPos: [tw(L.baseX[0], L.baseZ), tw(L.baseX[1], L.baseZ)],
    hillPos: tw(C, C), // the pit floor — king of the hole
    controlPoints: [
      { name: 'NORTH GALLERY', pos: tw(L.galleries[0][0] + 10, L.galleries[0][1] + 2) },
      { name: 'THE PIT', pos: tw(C, C) },
      { name: 'SOUTH GALLERY', pos: tw(L.galleries[1][0] + 10, L.galleries[1][1] + 2) },
    ],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns: zombieRing(grid, box),
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
}

// ---------------------------------------------------------------------------
// the registry — main.ts and world.ts deploy through this door
// ---------------------------------------------------------------------------

export const FRONT_GROUNDS: Record<string, (seed: number, size?: MapSize) => GameMap> = {
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

/** authored ground for a Scar front, at the tier the lobby's headcount earns
 *  (33C). The tier arrives as the `size` argument OR baked into the id as
 *  `front@size` — the channel callers that only pass an id (world.ts) use to
 *  stay untouched. Unknown ids fall back to null so the caller can keep the
 *  old recipe path (forward compat with new fronts). */
export function generateFront(frontId: string, seed: number, size: MapSize = 'large'): GameMap | null {
  let id = frontId;
  let sz = size;
  const at = frontId.indexOf('@');
  if (at >= 0) {
    id = frontId.slice(0, at);
    const s = frontId.slice(at + 1);
    if (s === 'small' || s === 'standard' || s === 'large') sz = s;
  }
  const gen = FRONT_GROUNDS[id];
  return gen ? gen(seed, sz) : null;
}

/** exported for tests: every stencil a front hand-authors answers to the
 *  same connectivity law as the grown stock — no sealed rooms, ever. */
export const FRONT_STENCILS: BuildingDef[] = [THE_KEEP, LAB_TOWER, CONTROL_ROOM, HANGAR, TOWER, GALLERY, TENEMENT];

/** exported for tests: the walkability the reachability law is judged by.
 *  Doors count (E opens them); water counts (everyone wades/swims); climb
 *  walls do NOT (they're the airborne's shortcut, never the only road). */
export function frontWalkable(t: number): boolean {
  return t === T_OPEN || t === T_WATER || t === T_DEEP || t === T_DOOR
    || t === 6 /* T_DOOR_OPEN */ || t === T_LADDER;
}
