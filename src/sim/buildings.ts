import type { House, PickupSpawn, PropSpec } from './map';
import { GRID, T_COVER, T_DOOR, T_METAL, T_OPEN, T_SLIT, T_WALL, TILE, WORLD } from './map';
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
//
// Second storeys: the format reserves `floors` for the Phase-2 height layer
// (DD §8.4 decided walkable roofs need their own engine decision) — every
// template today is floors:1 and the sim treats all buildings as one level.
// ---------------------------------------------------------------------------

export interface BuildingDef {
  id: string;
  name: string;
  kind: 'house' | 'industrial' | 'military' | 'ruin';
  /** reserved for the Phase-2 height layer — always 1 today */
  floors: 1;
  rows: string[];
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

const LEGEND = new Set(['#', 'M', 'S', 'D', '.', ' ', 'C', 'P']);
export const isLegalStencilChar = (ch: string) => LEGEND.has(ch);

export interface StampCtx {
  grid: Uint8Array;
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
        case 'D': ctx.grid[idx] = T_DOOR; break;
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
        default: break; // ' ' — outside the footprint
      }
    }
  }
  const center = interior ?? { x: tx + Math.floor(w / 2), z: tz + Math.floor(h / 2) };
  ctx.houses.push({
    id: ctx.houses.length,
    center: tileToWorld(center.x, center.z),
    door: tileToWorld(tx + Math.floor(w / 2), tz + h - 1),
    tx, tz, tw: w, th: h,
  });
  return true;
}

/** Horizontal mirror of a template — placed on the far side for fairness. */
export function mirrorDef(def: BuildingDef): BuildingDef {
  const w = Math.max(...def.rows.map((r) => r.length));
  return { ...def, rows: def.rows.map((r) => r.padEnd(w, ' ').split('').reverse().join('')) };
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
    const def = BUILDINGS[ctx.rng.int(0, BUILDINGS.length - 1)];
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
