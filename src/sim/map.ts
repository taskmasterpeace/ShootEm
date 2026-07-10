import { Rng } from './rng';
import type { ModeId, Team, Vec3, VehicleKind } from './types';

export const TILE = 2;          // world units per tile
export const GRID = 100;        // tiles per side
export const WORLD = TILE * GRID; // 200 units square, centered on origin

export const T_OPEN = 0;
export const T_WALL = 1;   // tall — blocks movement, bullets, sight
export const T_COVER = 2;  // low crate/sandbag — blocks movement, not railgun sight... (blocks projectiles too, simple)
export const T_WATER = 3;  // impassable to soldiers, hover skiff can cross

export interface PropSpec {
  type: 'rock' | 'bunker' | 'crate' | 'tree' | 'ruin';
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
}

export interface GameMap {
  seed: number;
  grid: Uint8Array; // GRID*GRID
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
}

export function tileAt(grid: Uint8Array, x: number, z: number): number {
  const tx = Math.floor((x + WORLD / 2) / TILE);
  const tz = Math.floor((z + WORLD / 2) / TILE);
  if (tx < 0 || tz < 0 || tx >= GRID || tz >= GRID) return T_WALL;
  return grid[tz * GRID + tx];
}

export function isBlocked(grid: Uint8Array, x: number, z: number, hover = false): boolean {
  const t = tileAt(grid, x, z);
  if (t === T_WATER) return !hover;
  return t === T_WALL || t === T_COVER;
}

/** Blocks projectiles/sight: walls always; cover and water never (shots fly over). */
export function blocksShot(grid: Uint8Array, x: number, z: number, y: number): boolean {
  const t = tileAt(grid, x, z);
  if (t === T_WALL) return y < 4;      // walls are 4 units tall
  if (t === T_COVER) return y < 1.2;   // low cover
  return false;
}

/** March a ray across the grid; true if line of sight is clear at the given height. */
export function losClear(grid: Uint8Array, a: Vec3, b: Vec3, y = 1.4): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / (TILE * 0.5)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksShot(grid, a.x + dx * t, a.z + dz * t, y)) return false;
  }
  return true;
}

function setTile(grid: Uint8Array, tx: number, tz: number, v: number) {
  if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) return;
  grid[tz * GRID + tx] = v;
}

function tileToWorld(tx: number, tz: number): Vec3 {
  return { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 };
}

function clearArea(grid: Uint8Array, cx: number, cz: number, r: number) {
  for (let z = cz - r; z <= cz + r; z++)
    for (let x = cx - r; x <= cx + r; x++) setTile(grid, x, z, T_OPEN);
}

/** Generates a symmetric battlefield — or a suburban neighborhood for safehouse mode. */
export function generateMap(seed: number, mode: ModeId): GameMap {
  if (mode === 'safehouse') return generateNeighborhood(seed);
  const rng = new Rng(seed);
  const grid = new Uint8Array(GRID * GRID);
  const props: PropSpec[] = [];

  // Border walls
  for (let i = 0; i < GRID; i++) {
    grid[i] = T_WALL;
    grid[(GRID - 1) * GRID + i] = T_WALL;
    grid[i * GRID] = T_WALL;
    grid[i * GRID + GRID - 1] = T_WALL;
  }

  // Scatter obstacles mirrored across the vertical center line for fairness.
  const half = GRID / 2;
  const blobCount = 46;
  for (let b = 0; b < blobCount; b++) {
    const tx = rng.int(6, half - 3);
    const tz = rng.int(6, GRID - 7);
    const kind = rng.next();
    const mirror = (x: number) => GRID - 1 - x;
    if (kind < 0.38) {
      // wall segment
      const len = rng.int(3, 8);
      const horiz = rng.next() < 0.5;
      for (let i = 0; i < len; i++) {
        setTile(grid, tx + (horiz ? i : 0), tz + (horiz ? 0 : i), T_WALL);
        setTile(grid, mirror(tx + (horiz ? i : 0)), tz + (horiz ? 0 : i), T_WALL);
      }
    } else if (kind < 0.72) {
      // cover cluster
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const ox = rng.int(-2, 2), oz = rng.int(-2, 2);
        setTile(grid, tx + ox, tz + oz, T_COVER);
        setTile(grid, mirror(tx + ox), tz + oz, T_COVER);
        const w = tileToWorld(tx + ox, tz + oz);
        props.push({ type: 'crate', pos: w, scale: 1, rot: rng.range(0, Math.PI) });
        props.push({ type: 'crate', pos: tileToWorld(mirror(tx + ox), tz + oz), scale: 1, rot: rng.range(0, Math.PI) });
      }
    } else if (kind < 0.86) {
      // rock blob (wall tiles, rendered as rocks)
      const r = rng.int(1, 2);
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++)
          if (x * x + z * z <= r * r) {
            setTile(grid, tx + x, tz + z, T_WALL);
            setTile(grid, mirror(tx + x), tz + z, T_WALL);
          }
      const w = tileToWorld(tx, tz);
      props.push({ type: 'rock', pos: w, scale: r * 1.6, rot: rng.range(0, Math.PI * 2) });
      props.push({ type: 'rock', pos: tileToWorld(mirror(tx), tz), scale: r * 1.6, rot: rng.range(0, Math.PI * 2) });
    } else {
      // pond
      const r = rng.int(2, 3);
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++)
          if (x * x + z * z <= r * r) {
            setTile(grid, tx + x, tz + z, T_WATER);
            setTile(grid, mirror(tx + x), tz + z, T_WATER);
          }
    }
  }

  // Bases: west (team 0) and east (team 1)
  const baseT: [number, number][] = [[10, half], [GRID - 11, half]];
  const basePos: [Vec3, Vec3] = [tileToWorld(baseT[0][0], baseT[0][1]), tileToWorld(baseT[1][0], baseT[1][1])];
  for (const [btx, btz] of baseT) clearArea(grid, btx, btz, 7);
  // base bunker walls (three-sided, open toward center)
  for (let side = 0; side < 2; side++) {
    const [btx, btz] = baseT[side];
    const open = side === 0 ? 1 : -1; // opening faces map center
    for (let i = -5; i <= 5; i++) {
      setTile(grid, btx - open * 6, btz + i, T_WALL);              // back wall
      if (Math.abs(i) > 2) setTile(grid, btx + open * 6, btz + i, T_WALL); // front wall w/ gate
      setTile(grid, btx + i, btz - 6, i % 3 === 0 ? T_OPEN : T_WALL);
      setTile(grid, btx + i, btz + 6, i % 3 === 0 ? T_OPEN : T_WALL);
    }
    props.push({ type: 'bunker', pos: tileToWorld(btx - open * 4, btz), scale: 1, rot: side === 0 ? 0 : Math.PI });
  }

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

  // Vehicle pads flanking each base
  const vehiclePads: VehiclePad[] = [];
  const padKinds: VehicleKind[] = ['buggy', 'tank', 'apc', 'skiff'];
  for (let side = 0 as Team; side < 2; side++) {
    const [btx, btz] = baseT[side];
    const fwd = side === 0 ? 1 : -1;
    const padOffsets = [[fwd * 9, -9], [fwd * 9, 9], [fwd * 12, -3], [fwd * 12, 3]];
    padKinds.forEach((kind, i) => {
      const [ox, oz] = padOffsets[i];
      clearArea(grid, btx + ox, btz + oz, 2);
      vehiclePads.push({ kind, team: side as Team, pos: tileToWorld(btx + ox, btz + oz) });
    });
  }

  // Pickups sprinkled around midfield, mirrored
  const pickups: PickupSpawn[] = [];
  const pickTypes: PickupSpawn['type'][] = ['medkit', 'ammo', 'energy', 'medkit', 'ammo', 'flamer'];
  pickTypes.forEach((type, i) => {
    const tz = 12 + Math.floor((i / pickTypes.length) * (GRID - 24)) + rng.int(-4, 4);
    const tx = half + rng.int(-16, 16);
    clearArea(grid, tx, tz, 1);
    pickups.push({ type, pos: tileToWorld(tx, tz) });
    pickups.push({ type, pos: tileToWorld(GRID - 1 - tx, tz) });
  });

  // Zombie spawns: map edges
  const zombieSpawns: Vec3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tx = Math.round(half + Math.cos(a) * (half - 6));
    const tz = Math.round(half + Math.sin(a) * (half - 6));
    clearArea(grid, tx, tz, 1);
    zombieSpawns.push(tileToWorld(tx, tz));
  }

  // Decorative trees on open tiles
  for (let i = 0; i < 40; i++) {
    const tx = rng.int(4, GRID - 5), tz = rng.int(4, GRID - 5);
    if (grid[tz * GRID + tx] === T_OPEN) {
      const w = tileToWorld(tx, tz);
      const far = Math.hypot(w.x - basePos[0].x, w.z - basePos[0].z) > 20 &&
                  Math.hypot(w.x - basePos[1].x, w.z - basePos[1].z) > 20 &&
                  Math.hypot(w.x - hillPos.x, w.z - hillPos.z) > 14;
      if (far) {
        setTile(grid, tx, tz, T_WALL);
        props.push({ type: 'tree', pos: w, scale: rng.range(0.8, 1.4), rot: rng.range(0, Math.PI * 2) });
      }
    }
  }

  // jump gates: each base's flank warps to its own midfield approach (mirrored)
  const gates: GameMap['gates'] = [];
  for (const side of [0, 1]) {
    const [btx, btz] = baseT[side];
    const fwd = side === 0 ? 1 : -1;
    const aT: [number, number] = [btx + fwd * 3, btz - 10];
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

  return { seed, grid, basePos, spawns, flagPos, hillPos, controlPoints, vehiclePads, pickups, props, zombieSpawns, houses: [], gates, pads };
}

/**
 * Safehouse neighborhood: a 4×3 grid of walled houses along streets, a
 * command post at the south edge, yards with fences and trees. Houses have a
 * street-facing front door (and sometimes a back door) so the horde can get in.
 */
function generateNeighborhood(seed: number): GameMap {
  const rng = new Rng(seed);
  const grid = new Uint8Array(GRID * GRID);
  const props: PropSpec[] = [];
  const houses: House[] = [];
  const pickups: PickupSpawn[] = [];

  for (let i = 0; i < GRID; i++) {
    grid[i] = T_WALL;
    grid[(GRID - 1) * GRID + i] = T_WALL;
    grid[i * GRID] = T_WALL;
    grid[i * GRID + GRID - 1] = T_WALL;
  }

  // 4 columns × 3 rows of lots; streets between them stay open
  const cols = 4, rows = 3;
  const lotW = 22, lotH = 26;
  const originX = 6, originZ = 8;
  let houseId = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = originX + c * lotW;
      const lz = originZ + r * lotH;
      // house footprint inside the lot
      const hw = rng.int(9, 11);
      const hh = rng.int(7, 8);
      const hx = lx + rng.int(3, lotW - hw - 3);
      const hz = lz + rng.int(4, lotH - hh - 8);
      // walls
      for (let x = hx; x < hx + hw; x++) {
        setTile(grid, x, hz, T_WALL);
        setTile(grid, x, hz + hh - 1, T_WALL);
      }
      for (let z = hz; z < hz + hh; z++) {
        setTile(grid, hx, z, T_WALL);
        setTile(grid, hx + hw - 1, z, T_WALL);
      }
      // front door: 2-tile gap on the south wall (faces the street below)
      const doorX = hx + rng.int(2, hw - 4);
      setTile(grid, doorX, hz + hh - 1, T_OPEN);
      setTile(grid, doorX + 1, hz + hh - 1, T_OPEN);
      const door = tileToWorld(doorX, hz + hh - 1);
      // sometimes a back door
      if (rng.next() < 0.55) {
        const backX = hx + rng.int(2, hw - 4);
        setTile(grid, backX, hz, T_OPEN);
        setTile(grid, backX + 1, hz, T_OPEN);
      }
      // interior room divider with a doorway
      if (hw >= 10) {
        const divX = hx + Math.floor(hw / 2);
        for (let z = hz + 1; z < hz + hh - 1; z++) {
          if (z !== hz + Math.floor(hh / 2)) setTile(grid, divX, z, T_WALL);
        }
      }
      const center = tileToWorld(hx + Math.floor(hw / 2) - 1, hz + Math.floor(hh / 2));
      houses.push({ id: houseId++, center, door });

      // yard dressing: fence stubs + crates + a tree
      if (rng.next() < 0.6) {
        const fz = hz + hh + 1;
        for (let x = hx - 1; x < hx + Math.floor(hw / 2); x++) setTile(grid, x, fz, T_COVER);
      }
      if (rng.next() < 0.7) {
        const cxT = hx + hw + 1, czT = hz + rng.int(0, hh - 1);
        setTile(grid, cxT, czT, T_COVER);
        props.push({ type: 'crate', pos: tileToWorld(cxT, czT), scale: 1, rot: rng.range(0, Math.PI) });
      }
      const tx = lx + rng.int(0, 2), tz = lz + rng.int(0, 3);
      if (grid[tz * GRID + tx] === T_OPEN) {
        setTile(grid, tx, tz, T_WALL);
        props.push({ type: 'tree', pos: tileToWorld(tx, tz), scale: rng.range(0.8, 1.3), rot: rng.range(0, Math.PI * 2) });
      }
      // some houses stock a pickup
      if (rng.next() < 0.5) {
        pickups.push({ type: rng.next() < 0.5 ? 'medkit' : 'ammo', pos: { ...center, x: center.x + 2 } });
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
  return {
    seed, grid, basePos, spawns,
    flagPos: [basePos[0], basePos[1]],
    hillPos,
    controlPoints: [
      { name: 'A', pos: tileToWorld(GRID / 2 - 20, GRID / 2) },
      { name: 'B', pos: hillPos },
      { name: 'C', pos: tileToWorld(GRID / 2 + 20, GRID / 2) },
    ],
    vehiclePads: [],
    pickups, props, zombieSpawns, houses,
    gates: [], pads: [],
  };
}
