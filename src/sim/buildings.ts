import type { House, PickupSpawn, PropSpec } from './map';
import { F2_FLOOR, F2_SLIT, F2_WALL, F2_WELL, GRID, T_COVER, T_DOOR, T_LADDER, T_METAL, T_OPEN, T_SLIT, T_WALL, TILE, WORLD } from './map';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// The building library — hand-AUTHORED templates, procedurally PLACED.
// Neither "hand-make every map" nor "pure noise": stencils are testable data
// with doors, slit windows, metal cores, furniture, and loot; the placer
// deals them onto generated fronts, mirrored for fairness.
//
// Stencil legend (one char per tile):
//   '#' wall        'M' metal wall (undrillable — the breacher sparks off it)
//   'S' firing slit 'D' door (closed; E opens it)
//   '.' interior    ' ' outside the footprint (nothing stamped)
//   'C' crate cover (claimed — the crate mesh renders the collision)
//   'P' pickup on the floor (medkit/ammo alternating)
//   'L' ladder foot (walkable; E climbs to the rows2 storey above)
//
// Second storeys: the format reserves `floors` for the Phase-2 height layer
// (DD §8.4 decided walkable roofs need their own engine decision) — every
// template today is floors:1 and the sim treats all buildings as one level.
// ---------------------------------------------------------------------------

export interface BuildingDef {
  id: string;
  name: string;
  kind: 'house' | 'commercial' | 'industrial' | 'military' | 'ruin';
  /** 1 = single storey; 2 = the §8.4 Phase-2 experiment — rows2 rides above */
  floors: 1 | 2;
  rows: string[];
  /** the SECOND STOREY stencil (same width): '#' wall, 'S' window, '.' floor,
   *  'L' the ladder well (must sit over a ground-floor 'L'), ' ' void */
  rows2?: string[];
}

const B = (id: string, name: string, kind: BuildingDef['kind'], rows: string[]): BuildingDef =>
  ({ id, name, kind, floors: 1, rows });

/** Ten houses + ten other structures — the §8.2 fronts' building stock. */
export const BUILDINGS: BuildingDef[] = [
  // ---- houses (10) ----
  B('hut', 'Field Hut', 'house', [
    '##S##S#',
    '#C....#',
    '#..P..#',
    '#....C#',
    '###DD##',
  ]),
  B('cottage', 'Cottage', 'house', [
    '#S###S#',
    '#.....#',
    '#.C.P.#',
    '#.....#',
    '##DD#S#',
  ]),
  B('longhouse', 'Longhouse', 'house', [
    '#S###S###S#',
    '#C........#',
    '#...P...C.#',
    '####DD#####',
  ]),
  B('l_house', 'L-House', 'house', [
    '#S####    ',
    '#....#    ',
    '#.C..####S',
    '#..P.....#',
    '###DD#####',
  ]),
  B('courtyard', 'Courtyard House', 'house', [
    '#S#####S#',
    '#.......#',
    '#.##D##.#',
    '#.#...#.#',
    '#.#.P.#.#',
    '#.#####.#',
    '####DD###',
  ]),
  B('duplex', 'Duplex', 'house', [
    '#S###S###',
    '#...#...#',
    '#.C.#.P.#',
    '##D###D##',
  ]),
  B('shack', 'Shack', 'house', [
    '#S###',
    '#..P#',
    '##D##',
  ]),
  B('villa', 'Villa', 'house', [
    '#S##S##S#',
    '#.......#',
    '#.C...C.#',
    '#...P...#',
    '#.......#',
    '###DD##S#',
  ]),
  B('rowhouse', 'Rowhouse', 'house', [
    '#S#S#S#S#',
    '#.......#',
    '#C.P..C.#',
    '#D##D##D#',
  ]),
  B('farmhouse', 'Farmhouse', 'house', [
    '#S#####',
    '#.....S',
    '#.P.C.#',
    '#.....#',
    '#DD####',
  ]),
  // ---- other structures (10) ----
  B('warehouse', 'Warehouse', 'industrial', [
    'MMMSMMMSMM',
    'M........M',
    'M.CC..CC.M',
    'M...P....M',
    'M.CC..CC.M',
    'MMMDDMMMMM',
  ]),
  B('machine_shop', 'Machine Shop', 'industrial', [
    'MMMMSMMM',
    'M..CC..M',
    'M..P...M',
    'MMDDMMMM',
  ]),
  B('depot', 'Container Depot', 'industrial', [
    'MMMM MMMM',
    'M.CM M.CM',
    'MDMM MMDM',
  ]),
  B('garage', 'Garage', 'industrial', [
    '#######',
    '#..C..#',
    '#.....#',
    '#DDDD##',
  ]),
  B('pumphouse', 'Pump House', 'industrial', [
    'M#S#M',
    '#.C.#',
    '#.P.#',
    'M#D#M',
  ]),
  B('bunker', 'Bunker', 'military', [
    'MSMMSM',
    'M....M',
    'M.PC.M',
    'MMDDMM',
  ]),
  B('guard_post', 'Guard Post', 'military', [
    '#S#S#',
    'S...#',
    '#.P.S',
    '##D##',
  ]),
  B('barracks_hall', 'Barracks Hall', 'military', [
    '#S##S##S#',
    '#C.C.C.C#',
    '#.......#',
    '#...P...#',
    '###DD####',
  ]),
  B('mess_hall', 'Mess Hall', 'house', [
    '#S#####S#',
    '#.C...C.#',
    '#..P....#',
    '#D#####D#',
  ]),
  B('ruin', 'Shelled Ruin', 'ruin', [
    '## S# #',
    '#.....#',
    ' .C.P. ',
    '#..   #',
    '## ## #',
  ]),
];

const LEGEND = new Set(['#', 'M', 'S', 'D', '.', ' ', 'C', 'P', 'L']);
export const isLegalStencilChar = (ch: string) => LEGEND.has(ch);

// ---------------------------------------------------------------------------
// Dynamic interiors — houses GENERATED, not authored, but emitted as the same
// stencil format the whole pipeline already trusts: stampBuilding stamps them,
// mirrorDef mirrors them, the legality/connectivity tests police them. Three
// types, each with its own floor-plan grammar:
//   manor      — big BSP plan: rooms split from rooms, a door in every wall
//   bungalow   — modest BSP: two or three rooms
//   hall_house — a corridor spine with rooms hanging off it, barracks-style
// ---------------------------------------------------------------------------

export type DynHouseType = 'manor' | 'bungalow' | 'hall_house';

const DYN_SPEC: Record<DynHouseType, {
  name: string; w: [number, number]; h: [number, number]; splits: number; corridor: boolean; winEvery: number;
}> = {
  manor:      { name: 'Manor',      w: [14, 17], h: [10, 12], splits: 3, corridor: false, winEvery: 3 },
  bungalow:   { name: 'Bungalow',   w: [10, 12], h: [8, 9],   splits: 2, corridor: false, winEvery: 3 },
  hall_house: { name: 'Hall House', w: [14, 17], h: [7, 8],   splits: 0, corridor: true,  winEvery: 4 },
};

interface Room { x: number; z: number; w: number; h: number }

/** Generate one dynamic house as a stencil-format BuildingDef. Deterministic
 *  from the rng, so every client grows the same floor plan from the seed.
 *  Regrows on the (rare) disconnected layout — the contract is that every
 *  room is reachable from the front door, and it's re-checked in tests. */
export function generateHouse(rng: Rng, type: DynHouseType): BuildingDef {
  for (let tries = 0; ; tries++) {
    const def = growHouse(rng, type);
    if (tries >= 4 || stencilConnected(def)) return def;
  }
}

function growHouse(rng: Rng, type: DynHouseType): BuildingDef {
  const spec = DYN_SPEC[type];
  const w = rng.int(spec.w[0], spec.w[1]);
  const h = rng.int(spec.h[0], spec.h[1]);
  const g: string[][] = [];
  for (let z = 0; z < h; z++) {
    g.push([]);
    for (let x = 0; x < w; x++) {
      g[z].push(z === 0 || z === h - 1 || x === 0 || x === w - 1 ? '#' : '.');
    }
  }
  const rooms: Room[] = [];

  if (spec.corridor) {
    // corridor spine two rows above the front wall; rooms hang off it
    const zc = h - 3;
    for (let x = 1; x < w - 1; x++) g[zc - 1][x] = '#';
    let x0 = 1;
    while (x0 < w - 1) {
      const rw = Math.min(rng.int(4, 5), w - 1 - x0);
      if (rw < 3) { // absorb the remainder into the previous room
        for (let z = 1; z < zc - 1; z++) g[z][x0 - 1] = '.';
        if (rooms.length) rooms[rooms.length - 1].w += rw + 1;
        break;
      }
      if (x0 + rw < w - 1) for (let z = 1; z < zc - 1; z++) g[z][x0 + rw] = '#';
      g[zc - 1][x0 + rng.int(1, rw - 2)] = 'D'; // every room opens onto the hall
      rooms.push({ x: x0, z: 1, w: rw, h: zc - 2 });
      x0 += rw + 1;
    }
  } else {
    // BSP: split the biggest room, wall it, and put a DOOR in every new wall
    rooms.push({ x: 1, z: 1, w: w - 2, h: h - 2 });
    for (let i = 0; i < spec.splits; i++) {
      rooms.sort((a, b) => b.w * b.h - a.w * a.h);
      const r = rooms[0];
      const canV = r.w >= 7, canH = r.h >= 7;
      if (!canV && !canH) break;
      const vertical = canV && (!canH || r.w >= r.h);
      rooms.shift();
      // never wall a cell that touches an existing door — a new partition
      // grazing an old doorway would seal the room behind it
      const adjD = (x: number, z: number) =>
        g[z - 1]?.[x] === 'D' || g[z + 1]?.[x] === 'D' || g[z][x - 1] === 'D' || g[z][x + 1] === 'D';
      if (vertical) {
        const wx = r.x + rng.int(3, r.w - 4);
        for (let z = r.z; z < r.z + r.h; z++) if (g[z][wx] === '.' && !adjD(wx, z)) g[z][wx] = '#';
        const spots: number[] = [];
        for (let z = r.z; z < r.z + r.h; z++) if (g[z][wx] === '#' && g[z][wx - 1] === '.' && g[z][wx + 1] === '.') spots.push(z);
        if (spots.length) g[spots[rng.int(0, spots.length - 1)]][wx] = 'D';
        rooms.push({ x: r.x, z: r.z, w: wx - r.x, h: r.h });
        rooms.push({ x: wx + 1, z: r.z, w: r.x + r.w - wx - 1, h: r.h });
      } else {
        const wz = r.z + rng.int(3, r.h - 4);
        for (let x = r.x; x < r.x + r.w; x++) if (g[wz][x] === '.' && !adjD(x, wz)) g[wz][x] = '#';
        const spots: number[] = [];
        for (let x = r.x; x < r.x + r.w; x++) if (g[wz][x] === '#' && g[wz - 1][x] === '.' && g[wz + 1][x] === '.') spots.push(x);
        if (spots.length) g[wz][spots[rng.int(0, spots.length - 1)]] = 'D';
        rooms.push({ x: r.x, z: r.z, w: r.w, h: wz - r.z });
        rooms.push({ x: r.x, z: wz + 1, w: r.w, h: r.z + r.h - wz - 1 });
      }
    }
  }

  // the FRONT DOOR: double, on the south wall, opening into open floor
  const doorSpots: number[] = [];
  for (let x = 1; x < w - 2; x++) if (g[h - 2][x] === '.' && g[h - 2][x + 1] === '.') doorSpots.push(x);
  const fd = doorSpots[rng.int(0, doorSpots.length - 1)] ?? Math.floor(w / 2);
  g[h - 1][fd] = 'D';
  g[h - 1][fd + 1] = 'D';
  // sometimes a single back door
  if (rng.next() < 0.5) {
    const backSpots: number[] = [];
    for (let x = 1; x < w - 1; x++) if (g[1][x] === '.') backSpots.push(x);
    if (backSpots.length) g[0][backSpots[rng.int(0, backSpots.length - 1)]] = 'D';
  }

  // WINDOWS: slits along every exterior wall, skipping corners and doors
  for (let x = 1 + (rng.int(0, 1)); x < w - 1; x += spec.winEvery) {
    if (g[0][x] === '#' && g[1][x] === '.') g[0][x] = 'S';
    if (g[h - 1][x] === '#' && g[h - 2][x] === '.') g[h - 1][x] = 'S';
  }
  for (let z = 1 + (rng.int(0, 1)); z < h - 1; z += spec.winEvery) {
    if (g[z][0] === '#' && g[z][1] === '.') g[z][0] = 'S';
    if (g[z][w - 1] === '#' && g[z][w - 2] === '.') g[z][w - 1] = 'S';
  }

  // FURNITURE: a crate in most rooms (corner-biased), loot in one
  const finalRooms = rooms.length ? rooms : [{ x: 1, z: 1, w: w - 2, h: h - 2 }];
  let crates = 0;
  for (const r of finalRooms) {
    if (crates >= 5 || rng.next() > 0.8) continue;
    const cx = rng.next() < 0.5 ? r.x : r.x + r.w - 1;
    const cz = rng.next() < 0.5 ? r.z : r.z + r.h - 1;
    if (g[cz]?.[cx] === '.') { g[cz][cx] = 'C'; crates++; }
  }
  const loot = finalRooms[rng.int(0, finalRooms.length - 1)];
  const lx = loot.x + (loot.w >> 1), lz = loot.z + (loot.h >> 1);
  if (g[lz]?.[lx] === '.') g[lz][lx] = 'P';
  if (crates === 0 && g[1][1] === '.') g[1][1] = 'C'; // the indoors ALWAYS has stuff

  // the SECOND STOREY (§8.4 Phase-2): some manors grow a walled loft above,
  // reached by a ladder, ringed with upper windows — the sniper nest
  let rows2: string[] | undefined;
  let floors: 1 | 2 = 1;
  if (type === 'manor' && rng.next() < 0.45) {
    const spots: [number, number][] = [];
    for (let z = 1; z < h - 1; z++) {
      for (let x = 1; x < w - 1; x++) {
        if (g[z][x] !== '.') continue;
        const wallTouch = g[z - 1][x] === '#' || g[z + 1][x] === '#' || g[z][x - 1] === '#' || g[z][x + 1] === '#';
        const doorTouch = g[z - 1][x] === 'D' || g[z + 1][x] === 'D' || g[z][x - 1] === 'D' || g[z][x + 1] === 'D';
        if (wallTouch && !doorTouch) spots.push([x, z]);
      }
    }
    if (spots.length) {
      const [lx2, lz2] = spots[rng.int(0, spots.length - 1)];
      g[lz2][lx2] = 'L';
      const u: string[][] = [];
      for (let z = 0; z < h; z++) {
        u.push([]);
        for (let x = 0; x < w; x++) u[z].push(z === 0 || z === h - 1 || x === 0 || x === w - 1 ? '#' : '.');
      }
      for (let x = 2; x < w - 2; x += 3) { u[0][x] = 'S'; u[h - 1][x] = 'S'; }
      for (let z = 2; z < h - 2; z += 3) { u[z][0] = 'S'; u[z][w - 1] = 'S'; }
      u[lz2][lx2] = 'L'; // the well, directly over the ladder foot
      rows2 = u.map((r) => r.join(''));
      floors = 2;
    }
  }
  return {
    id: `dyn_${type}`, name: floors === 2 ? 'Two-Storey Manor' : spec.name,
    kind: 'house', floors,
    rows: g.map((row) => row.join('')),
    ...(rows2 ? { rows2 } : {}),
  };
}

// ---------------------------------------------------------------------------
// The districts — COMMERCIAL and INDUSTRIAL buildings, grown with their own
// grammars (a shop is not a house with a sign; a factory is not a big shop):
//   storefront — glass front (window row), counter, back room, rear door
//   market     — one open hall, stall rows with shopping aisles
//   office     — corridor spine, small rooms both sides; sometimes two floors
//   factory    — metal shell, machine blocks in bays, wide doors both ends
//   depot_hall — metal, long rack rows with forklift aisles, loading doors
// ---------------------------------------------------------------------------

export type DistrictType = 'storefront' | 'market' | 'office' | 'factory' | 'depot_hall';

export function generateDistrict(rng: Rng, type: DistrictType): BuildingDef {
  for (let tries = 0; ; tries++) {
    const def = growDistrict(rng, type);
    if (tries >= 4 || stencilConnected(def)) return def;
  }
}

function growDistrict(rng: Rng, type: DistrictType): BuildingDef {
  const commercial = type === 'storefront' || type === 'market' || type === 'office';
  const wall = commercial ? '#' : 'M';
  const spec: Record<DistrictType, { w: [number, number]; h: [number, number]; name: string }> = {
    storefront: { w: [8, 11], h: [7, 9], name: 'Storefront' },
    market:     { w: [13, 17], h: [9, 11], name: 'Market Hall' },
    office:     { w: [12, 16], h: [9, 11], name: 'Office Block' },
    factory:    { w: [14, 18], h: [10, 12], name: 'Factory' },
    depot_hall: { w: [13, 17], h: [9, 11], name: 'Freight Depot' },
  };
  const w = rng.int(spec[type].w[0], spec[type].w[1]);
  const h = rng.int(spec[type].h[0], spec[type].h[1]);
  const g: string[][] = [];
  for (let z = 0; z < h; z++) {
    g.push([]);
    for (let x = 0; x < w; x++) g[z].push(z === 0 || z === h - 1 || x === 0 || x === w - 1 ? wall : '.');
  }
  let rows2: string[] | undefined;
  let floors: 1 | 2 = 1;

  if (type === 'storefront') {
    // the GLASS FRONT: the whole south wall is window slits around the door
    for (let x = 1; x < w - 1; x++) g[h - 1][x] = 'S';
    // the counter: a crate line two tiles in from the front, with a gap
    const gap = rng.int(1, w - 3);
    for (let x = 1; x < w - 1; x++) if (Math.abs(x - gap) > 0) g[h - 3][x] = 'C';
    // back room with a connecting door + rear exit
    for (let x = 1; x < w - 1; x++) g[2][x] = '#';
    g[2][rng.int(1, w - 2)] = 'D';
    g[0][rng.int(1, w - 2)] = 'D';
    g[1][rng.int(1, w - 2)] = 'P'; // the stockroom holds the goods
  } else if (type === 'market') {
    // stall rows with aisles — an open fighting hall full of hard cover
    for (let z = 2; z < h - 2; z += 2) {
      for (let x = 2; x < w - 2; x++) {
        if ((x - 2) % 4 === 3) continue; // shopping aisles cut the rows
        g[z][x] = 'C';
      }
    }
    g[Math.floor(h / 2)][Math.floor(w / 2)] = 'P';
    // windows on the long sides, wide doors at both gables — market day
    for (let z = 2; z < h - 2; z += 3) { g[z][0] = 'S'; g[z][w - 1] = 'S'; }
    const mmid = Math.floor(w / 2);
    g[h - 1][mmid - 1] = 'D'; g[h - 1][mmid] = 'D';
    g[0][rng.int(2, w - 3)] = 'D';
  } else if (type === 'office') {
    // corridor spine with small rooms both sides
    const zc = Math.floor(h / 2);
    for (let x = 1; x < w - 1; x++) { g[zc - 1][x] = '#'; g[zc + 1][x] = '#'; }
    let x0 = 1;
    while (x0 < w - 1) {
      const rw = Math.min(rng.int(3, 4), w - 1 - x0);
      if (rw < 2) break;
      if (x0 + rw < w - 1) {
        for (let z = 1; z < zc - 1; z++) g[z][x0 + rw] = '#';
        for (let z = zc + 2; z < h - 1; z++) g[z][x0 + rw] = '#';
      }
      g[zc - 1][x0 + rng.int(0, rw - 1)] = 'D';
      g[zc + 1][x0 + rng.int(0, rw - 1)] = 'D';
      x0 += rw + 1;
    }
    // corridor exits both ends
    g[zc][0] = 'D';
    g[zc][w - 1] = 'D';
    for (let x = 2; x < w - 2; x += 3) { g[0][x] = 'S'; g[h - 1][x] = 'S'; }
    g[1][1] = 'C';
    g[h - 2][w - 2] = 'P';
    // some office blocks rise a storey — the corridor stairwell gets a ladder
    if (rng.next() < 0.4) {
      g[zc][Math.floor(w / 2)] = 'L';
      const u: string[][] = [];
      for (let z = 0; z < h; z++) {
        u.push([]);
        for (let x = 0; x < w; x++) u[z].push(z === 0 || z === h - 1 || x === 0 || x === w - 1 ? '#' : '.');
      }
      for (let x = 2; x < w - 2; x += 3) { u[0][x] = 'S'; u[h - 1][x] = 'S'; }
      for (let z = 2; z < h - 2; z += 3) { u[z][0] = 'S'; u[z][w - 1] = 'S'; }
      u[zc][Math.floor(w / 2)] = 'L';
      rows2 = u.map((r) => r.join(''));
      floors = 2;
    }
  } else if (type === 'factory') {
    // machine bays: 2x2 blocks of machinery down the floor, wide lanes
    for (let z = 2; z < h - 3; z += 3) {
      for (let x = 2; x < w - 3; x += 4) {
        g[z][x] = 'C'; g[z][x + 1] = 'C';
        g[z + 1][x] = 'C'; g[z + 1][x + 1] = 'C';
      }
    }
    // wide doors both ends (trucks drive through)
    const mid = Math.floor(w / 2);
    g[h - 1][mid - 1] = 'D'; g[h - 1][mid] = 'D'; g[h - 1][mid + 1] = 'D';
    g[0][mid] = 'D'; g[0][mid + 1] = 'D';
    for (let z = 2; z < h - 2; z += 3) { g[z][0] = 'S'; g[z][w - 1] = 'S'; }
    g[1][1] = 'P';
  } else {
    // depot_hall: long rack rows with forklift aisles
    for (let z = 2; z < h - 2; z++) {
      if ((z - 2) % 3 === 2) continue; // cross aisles
      for (let x = 2; x < w - 2; x += 3) { g[z][x] = 'C'; }
    }
    const mid = Math.floor(w / 2);
    g[h - 1][mid] = 'D'; g[h - 1][mid + 1] = 'D';
    g[0][rng.int(2, w - 3)] = 'D';
    for (let z = 3; z < h - 3; z += 4) { g[z][0] = 'S'; g[z][w - 1] = 'S'; }
    g[Math.floor(h / 2)][Math.floor(w / 2) + 1] = 'P';
  }

  // clear cover that seals a doorway (a stall in front of the door is a wall)
  for (let z = 1; z < h - 1; z++) {
    for (let x = 1; x < w - 1; x++) {
      if (g[z][x] !== 'C') continue;
      const nearD = g[z - 1][x] === 'D' || g[z + 1][x] === 'D' || g[z][x - 1] === 'D' || g[z][x + 1] === 'D';
      if (nearD) g[z][x] = '.';
    }
  }

  return {
    id: `dyn_${type}`, name: spec[type].name,
    kind: commercial ? 'commercial' : 'industrial', floors,
    rows: g.map((r) => r.join('')),
    ...(rows2 ? { rows2 } : {}),
  };
}

/** Every open-floor cell reachable from the front door? (No sealed rooms —
 *  the generator's contract, enforced again by the test suite.) */
export function stencilConnected(def: BuildingDef): boolean {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const at = (x: number, z: number) => (def.rows[z] ?? '')[x] ?? ' ';
  const pass = (ch: string) => ch === '.' || ch === 'D' || ch === 'P' || ch === 'L';
  // seed from a bottom-row door
  let sx = -1, sz = -1;
  for (let z = h - 1; z >= 0 && sx < 0; z--)
    for (let x = 0; x < w; x++) if (at(x, z) === 'D') { sx = x; sz = z; break; }
  if (sx < 0) return false;
  const seen = new Set<number>([sz * w + sx]);
  const q = [[sx, sz]];
  while (q.length) {
    const [x, z] = q.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h || seen.has(nz * w + nx)) continue;
      if (!pass(at(nx, nz))) continue;
      seen.add(nz * w + nx);
      q.push([nx, nz]);
    }
  }
  for (let z = 0; z < h; z++)
    for (let x = 0; x < w; x++)
      if ((at(x, z) === '.' || at(x, z) === 'P' || at(x, z) === 'L') && !seen.has(z * w + x)) return false;
  return true;
}

export interface StampCtx {
  grid: Uint8Array;
  /** the second-storey layer (F2_*) — stamped from rows2 */
  grid2: Uint8Array;
  props: PropSpec[];
  pickups: PickupSpawn[];
  houses: House[];
  claims: { idx: number; t: number }[];
  rng: Rng;
}

const tileToWorld = (tx: number, tz: number) =>
  ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });

/** Stamp a template at tile (tx,tz). Bounds-checked; registers the roof rect. */
export function stampBuilding(ctx: StampCtx, def: BuildingDef, tx: number, tz: number, pickupSeq = 0): boolean {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  if (tx < 2 || tz < 2 || tx + w >= GRID - 2 || tz + h >= GRID - 2) return false;
  // clear the footprint plus a one-tile apron so doors always open onto ground
  for (let z = tz - 1; z <= tz + h; z++)
    for (let x = tx - 1; x <= tx + w; x++) ctx.grid[z * GRID + x] = T_OPEN;
  let seq = pickupSeq;
  let interior: { x: number; z: number } | null = null;
  let frontDoor: { x: number; z: number } | null = null;
  for (let rz = 0; rz < h; rz++) {
    const row = def.rows[rz];
    for (let rx = 0; rx < w; rx++) {
      const ch = row[rx] ?? ' ';
      const gx = tx + rx, gz = tz + rz;
      const idx = gz * GRID + gx;
      switch (ch) {
        case '#': ctx.grid[idx] = T_WALL; break;
        case 'M': ctx.grid[idx] = T_METAL; break;
        case 'S': ctx.grid[idx] = T_SLIT; break;
        case 'D':
          ctx.grid[idx] = T_DOOR;
          // the LOWEST door is the front door — record where it really is
          if (!frontDoor || gz >= frontDoor.z) frontDoor = { x: gx, z: gz };
          break;
        case 'C':
          ctx.grid[idx] = T_COVER;
          ctx.claims.push({ idx, t: T_COVER });
          ctx.props.push({ type: 'crate', pos: tileToWorld(gx, gz), scale: 1, rot: ctx.rng.range(0, Math.PI) });
          break;
        case 'P':
          ctx.grid[idx] = T_OPEN;
          ctx.pickups.push({ type: seq++ % 2 === 0 ? 'medkit' : 'ammo', pos: tileToWorld(gx, gz) });
          if (!interior) interior = { x: gx, z: gz };
          break;
        case '.':
          ctx.grid[idx] = T_OPEN;
          if (!interior) interior = { x: gx, z: gz };
          break;
        case 'L':
          ctx.grid[idx] = T_LADDER;
          break;
        default: break; // ' ' — outside the footprint
      }
    }
  }
  // the second storey: stamp rows2 into the upper layer
  if (def.rows2) {
    for (let rz = 0; rz < def.rows2.length; rz++) {
      const row = def.rows2[rz];
      for (let rx = 0; rx < w; rx++) {
        const idx = (tz + rz) * GRID + tx + rx;
        switch (row[rx] ?? ' ') {
          case '#': ctx.grid2[idx] = F2_WALL; break;
          case 'S': ctx.grid2[idx] = F2_SLIT; break;
          case '.': ctx.grid2[idx] = F2_FLOOR; break;
          case 'L': ctx.grid2[idx] = F2_WELL; break;
          default: break;
        }
      }
    }
  }
  const center = interior ?? { x: tx + Math.floor(w / 2), z: tz + Math.floor(h / 2) };
  const door = frontDoor ?? { x: tx + Math.floor(w / 2), z: tz + h - 1 };
  // the roof is shaped by the FOOTPRINT and styled by the KIND — a shelled
  // ruin does not get a pristine lid, and an L-house roof follows the L
  const maskRows: number[] = [];
  let fullRect = true;
  for (let rz = 0; rz < h; rz++) {
    let bits = 0;
    for (let rx = 0; rx < w; rx++) {
      if (((def.rows[rz] ?? '')[rx] ?? ' ') !== ' ') bits |= 1 << rx;
      else fullRect = false;
    }
    maskRows.push(bits);
  }
  const roof: House['roof'] =
    def.kind === 'ruin' ? 'none'
    : def.kind === 'commercial' ? 'parapet'
    : def.kind === 'industrial' || def.kind === 'military' ? 'vents'
    : fullRect ? 'gable' : 'flat';
  ctx.houses.push({
    id: ctx.houses.length,
    center: tileToWorld(center.x, center.z),
    door: tileToWorld(door.x, door.z),
    tx, tz, tw: w, th: h,
    floors: def.floors,
    roof, maskRows,
  });
  return true;
}

/** Horizontal mirror of a template — placed on the far side for fairness. */
export function mirrorDef(def: BuildingDef): BuildingDef {
  const w = Math.max(...def.rows.map((r) => r.length));
  const flip = (r: string) => r.padEnd(w, ' ').split('').reverse().join('');
  return { ...def, rows: def.rows.map(flip), rows2: def.rows2?.map(flip) };
}

export interface AvoidZone { tx: number; tz: number; r: number }

/**
 * Deal `pairs` mirrored building pairs onto the west half of a battle map;
 * each original at (tx,tz) gets its mirrored twin at GRID-1-tx-w. Seeded,
 * collision-checked against avoid zones and previously placed rects.
 */
export function placeBuildings(ctx: StampCtx, pairs: number, avoid: AvoidZone[]): number {
  const placed: { tx: number; tz: number; w: number; h: number }[] = [];
  let done = 0;
  let attempts = 0;
  while (done < pairs && attempts < 120) {
    attempts++;
    // most of the stock is GROWN, not picked — houses, shops, and industry
    // each with their own floor-plan grammar: no two fronts share a layout
    const roll = ctx.rng.next();
    const def = roll < 0.35
      ? generateHouse(ctx.rng, (['manor', 'bungalow', 'hall_house'] as const)[ctx.rng.int(0, 2)])
      : roll < 0.55
        ? generateDistrict(ctx.rng, (['storefront', 'market', 'office'] as const)[ctx.rng.int(0, 2)])
        : roll < 0.7
          ? generateDistrict(ctx.rng, (['factory', 'depot_hall'] as const)[ctx.rng.int(0, 1)])
          : BUILDINGS[ctx.rng.int(0, BUILDINGS.length - 1)];
    const h = def.rows.length;
    const w = Math.max(...def.rows.map((r) => r.length));
    const tx = ctx.rng.int(22, 45 - w);
    const tz = ctx.rng.int(10, GRID - 12 - h);
    const cx = tx + w / 2, cz = tz + h / 2;
    if (avoid.some((a) => Math.hypot(cx - a.tx, cz - a.tz) < a.r + Math.max(w, h) / 2)) continue;
    const margin = 4;
    if (placed.some((p) =>
      tx < p.tx + p.w + margin && tx + w + margin > p.tx &&
      tz < p.tz + p.h + margin && tz + h + margin > p.tz)) continue;
    if (!stampBuilding(ctx, def, tx, tz, done * 2)) continue;
    stampBuilding(ctx, mirrorDef(def), GRID - 1 - tx - w, tz, done * 2 + 1);
    placed.push({ tx, tz, w, h });
    placed.push({ tx: GRID - 1 - tx - w, tz, w, h });
    done++;
  }
  return done;
}
