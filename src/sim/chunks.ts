// ---------------------------------------------------------------------------
// THE CHUNK SYSTEM (Robert's modular maps: "easily create neighborhoods,
// forests, interiors… more bottlenecks and close combat, not COMPLETE
// bottlenecks"). A field map is carved into REGIONS; each region is filled by
// a CHUNK — a small, isolated generator that paints one kind of tactical
// texture into a rectangle. The chunk kinds are a bottleneck spectrum:
//
//   forest       — trees + tall grass: a SOFT bottleneck (breaks sightlines)
//   neighborhood — houses + streets:  a MEDIUM one (house-to-house)
//   interior     — rooms + corridors: a HARD one (true CQB)
//   industrial   — sheds + yards:     medium-hard
//   open         — sparse cover:      none (the breathing room)
//
// THE ONE HARD CONTRACT every chunk obeys: it keeps a CLEAR CROSS through its
// middle (a 3-wide horizontal + vertical lane). Regions tile the map on a
// shared grid, so those lanes line up into a connected street network — the
// map is ALWAYS traversable. That's what makes "choke, not seal" a law.
//
// Everything is authored on the WEST half through mirror-aware tools; every
// write also lands at its x→GRID-1-x twin, so the two halves are fair.
// ---------------------------------------------------------------------------
import { GRID, TILE, WORLD, T_CLIMB, T_COVER, T_DEEP, T_GRASS, T_OPEN, T_WALL, T_WATER } from './map';
import type { PickupSpawn, PropSpec } from './map';
import { generateDistrict, generateHouse, mirrorDef, stampBuilding, type BuildingDef, type DistrictType, type StampCtx } from './buildings';
import type { Rng } from './rng';

export interface RegionRect { tx: number; tz: number; tw: number; th: number }
export type ChunkKind = 'forest' | 'neighborhood' | 'interior' | 'industrial' | 'farm' | 'open';

/** Half-width of the guaranteed clear lane cross (LANE_HALF*2+1 tiles wide). */
export const LANE_HALF = 1;

/** Mirror-aware write helpers over a StampCtx — the chunk authors west, the
 *  east twin comes free. */
export interface ChunkTools {
  rng: Rng;
  /** true if (tx,tz) is open floor (and in bounds) */
  isOpen(tx: number, tz: number): boolean;
  /** the current tile at (tx,tz), T_WALL if out of bounds */
  tileAt(tx: number, tz: number): number;
  put(tx: number, tz: number, tile: number): void;
  /** a prop-owned blocking tile (claim + prop, both halves) */
  claim(tx: number, tz: number, tile: number): void;
  prop(type: PropSpec['type'], tx: number, tz: number, scale: number, rot: number): void;
  /** a prop at WORLD coords — for a landmark that straddles a multi-tile claim
   *  and must sit centred on it, not on one tile's middle (the mirror is x→−x) */
  propAt(type: PropSpec['type'], wx: number, wz: number, scale: number, rot: number): void;
  pickup(type: PickupSpawn['type'], tx: number, tz: number): void;
  /** stamp a building west + its mirrored twin east; returns the west stamp ok */
  house(def: BuildingDef, tx: number, tz: number, seq?: number): boolean;
}

const inb = (x: number, z: number) => x >= 1 && z >= 1 && x < GRID - 1 && z < GRID - 1;
const toWorld = (tx: number, tz: number) =>
  ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });

export function chunkTools(ctx: StampCtx): ChunkTools {
  const mir = (x: number) => GRID - 1 - x;
  return {
    rng: ctx.rng,
    isOpen: (tx, tz) => inb(tx, tz) && ctx.grid[tz * GRID + tx] === T_OPEN,
    tileAt: (tx, tz) => (inb(tx, tz) ? ctx.grid[tz * GRID + tx] : T_WALL),
    put(tx, tz, tile) { for (const x of [tx, mir(tx)]) if (inb(x, tz)) ctx.grid[tz * GRID + x] = tile; },
    claim(tx, tz, tile) {
      for (const x of [tx, mir(tx)]) if (inb(x, tz)) { ctx.grid[tz * GRID + x] = tile; ctx.claims.push({ idx: tz * GRID + x, t: tile }); }
    },
    prop(type, tx, tz, scale, rot) { for (const x of [tx, mir(tx)]) if (inb(x, tz)) ctx.props.push({ type, pos: toWorld(x, tz), scale, rot }); },
    propAt(type, wx, wz, scale, rot) {
      for (const x of [wx, -wx]) ctx.props.push({ type, pos: { x, y: 0, z: wz }, scale, rot });
    },
    pickup(type, tx, tz) { for (const x of [tx, mir(tx)]) if (inb(x, tz)) ctx.pickups.push({ type, pos: toWorld(x, tz) }); },
    house(def, tx, tz, seq = 0) {
      const w = Math.max(...def.rows.map((r) => r.length));
      const ok = stampBuilding(ctx, def, tx, tz, seq);
      stampBuilding(ctx, mirrorDef(def), GRID - 1 - tx - w, tz, seq); // the east twin
      return ok;
    },
  };
}

export type Chunk = (t: ChunkTools, r: RegionRect, density: number) => void;

/** Carve the region's clear CROSS — the through-route contract. Call this
 *  FIRST in every chunk (texture then fills around it); reserved tiles read
 *  back as open, so chunks avoid painting on the lanes. */
export function laneCross(t: ChunkTools, r: RegionRect): { hz: number; vx: number } {
  const hz = r.tz + (r.th >> 1); // horizontal lane row
  const vx = r.tx + (r.tw >> 1); // vertical lane column
  for (let x = r.tx; x < r.tx + r.tw; x++)
    for (let d = -LANE_HALF; d <= LANE_HALF; d++) t.put(x, hz + d, T_OPEN);
  for (let z = r.tz; z < r.tz + r.th; z++)
    for (let d = -LANE_HALF; d <= LANE_HALF; d++) t.put(vx + d, z, T_OPEN);
  return { hz, vx };
}

/** Is (tx,tz) on either lane of the region's cross? (chunks keep texture off it) */
export function onLane(r: RegionRect, tx: number, tz: number): boolean {
  const hz = r.tz + (r.th >> 1), vx = r.tx + (r.tw >> 1);
  return Math.abs(tz - hz) <= LANE_HALF || Math.abs(tx - vx) <= LANE_HALF;
}

// ---------------------------------------------------------------------------
// THE FOREST — trees + tall grass. Grass is walkable concealment (soft cover);
// tree trunks are prop-owned T_WALL that block. Density thickens the canopy.
// The clear cross keeps a path through the woods, so it funnels without
// sealing — the soft bottleneck Robert wanted.
// ---------------------------------------------------------------------------
export const forestChunk: Chunk = (t, r, density) => {
  const { hz, vx } = laneCross(t, r);
  const area = r.tw * r.th;

  // undergrowth: soft grass blobs (walkable), thicker with density
  const blobs = Math.max(2, Math.round(area * 0.03 * (0.6 + density)));
  for (let i = 0; i < blobs; i++) {
    const cx = r.tx + t.rng.int(1, r.tw - 2), cz = r.tz + t.rng.int(1, r.th - 2);
    const rad = t.rng.int(1, 3);
    for (let dz = -rad; dz <= rad; dz++)
      for (let dx = -rad; dx <= rad; dx++)
        if (dx * dx + dz * dz <= rad * rad && t.isOpen(cx + dx, cz + dz)) t.put(cx + dx, cz + dz, T_GRASS);
  }

  // the canopy: SPARSE blocking trunks. The forest's texture is the GRASS
  // (walkable, breaks sightlines — the soft bottleneck); the trunks are just
  // hard accents you fight around. Kept sparse and scattered so the pathfinder
  // (trees are T_WALL to it) threads them without a maze, and 2 clear of the
  // lane cross so the path stays airy.
  const stands = Math.max(2, Math.round(area * 0.009 * density));
  for (let s = 0; s < stands; s++) {
    const scx = r.tx + t.rng.int(2, r.tw - 3), scz = r.tz + t.rng.int(2, r.th - 3);
    const n = t.rng.int(2, 4);
    for (let k = 0; k < n; k++) {
      const tx = scx + t.rng.int(-2, 2), tz = scz + t.rng.int(-2, 2);
      if (Math.abs(tz - hz) <= LANE_HALF + 1 || Math.abs(tx - vx) <= LANE_HALF + 1) continue; // keep the lane airy
      const here = t.tileAt(tx, tz);
      if (here !== T_OPEN && here !== T_GRASS) continue;
      t.claim(tx, tz, T_WALL);
      t.prop('tree', tx, tz, t.rng.range(0.9, 1.5), t.rng.range(0, Math.PI * 2));
    }
  }


  // a scatter of low cover (fallen logs read as crates) so the clearing near
  // the path has something to fight from
  const logs = Math.round(area * 0.006 * (0.5 + density));
  for (let i = 0; i < logs; i++) {
    const tx = r.tx + t.rng.int(1, r.tw - 2), tz = r.tz + t.rng.int(1, r.th - 2);
    if (onLane(r, tx, tz) || !t.isOpen(tx, tz)) continue;
    t.claim(tx, tz, T_COVER);
    t.prop('crate', tx, tz, 1, t.rng.range(0, Math.PI));
  }
};

// ---------------------------------------------------------------------------
// OPEN — the breathing room between the choked regions: sparse cover clusters
// and the odd rock, most of it clear. No bottleneck; this is where the long
// sightlines and the objectives live.
// ---------------------------------------------------------------------------
export const openChunk: Chunk = (t, r, density) => {
  laneCross(t, r);
  const area = r.tw * r.th;
  const clusters = Math.max(2, Math.round(area * 0.01 * (0.4 + density)));
  for (let c = 0; c < clusters; c++) {
    const cx = r.tx + t.rng.int(2, r.tw - 3), cz = r.tz + t.rng.int(2, r.th - 3);
    const n = t.rng.int(2, 4);
    for (let k = 0; k < n; k++) {
      const tx = cx + t.rng.int(-1, 1), tz = cz + t.rng.int(-1, 1);
      if (onLane(r, tx, tz) || !t.isOpen(tx, tz)) continue;
      if (t.rng.next() < 0.7) { t.claim(tx, tz, T_COVER); t.prop('crate', tx, tz, 1, t.rng.range(0, Math.PI)); }
      else { const rr = t.rng.int(1, 2); t.claim(tx, tz, T_WALL); t.prop('rock', tx, tz, rr * 1.6, t.rng.range(0, Math.PI * 2)); }
    }
  }
  // §8.7 a CLIMB barricade (container wall) — a jump-trooper flank the field
  // still owes; the old scatter dealt these and the climb law expects them
  if (t.rng.next() < 0.7) {
    const bx = r.tx + t.rng.int(2, r.tw - 5), bz = r.tz + t.rng.int(2, r.th - 3), len = t.rng.int(3, 5);
    for (let i = 0; i < len; i++) if (!onLane(r, bx + i, bz) && t.isOpen(bx + i, bz)) t.put(bx + i, bz, T_CLIMB);
  }
};

/** A round shallow (or deep-cored) pond in the region, off-lane, on open/grass. */
function pond(t: ChunkTools, r: RegionRect, deepCore: boolean): void {
  const pcx = r.tx + t.rng.int(3, r.tw - 4), pcz = r.tz + t.rng.int(3, r.th - 4), pr = t.rng.int(2, 3);
  for (let dz = -pr; dz <= pr; dz++)
    for (let dx = -pr; dx <= pr; dx++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > pr * pr || onLane(r, pcx + dx, pcz + dz)) continue;
      const cur = t.tileAt(pcx + dx, pcz + dz);
      if (cur !== T_OPEN && cur !== T_GRASS) continue;
      t.put(pcx + dx, pcz + dz, deepCore && d2 <= (pr - 1.4) * (pr - 1.4) ? T_DEEP : T_WATER);
    }
}

// ---------------------------------------------------------------------------
// THE NEIGHBORHOOD — a STREET of houses. Each street band (north + south of
// the lane) is walked lot by lot, planting a ROW of varied grown houses that
// hug the kerb with yards between them — the block reads as a real
// neighbourhood you fight house to house, not one estate on an acre. The
// houses come from the dynamic grammar (manor/bungalow/hall-house, real
// multi-room interiors), a fresh floor plan every lot: the asset-library feel
// is that every house is ITS OWN house, placed like somebody meant it.
// ---------------------------------------------------------------------------
// cottages and bungalows are the workhorses (small → several line a street);
// the odd hall house or manor lands only where a wide-enough gap remains, so
// the block gets a mix without turning into a row of mansions
const HOUSE_TYPES = ['cottage', 'cottage', 'bungalow', 'bungalow', 'hall_house', 'manor'] as const;

/** Walk sa→sb (inclusive x) planting a row of houses that hug the kerb (the
 *  lane side of the band), tight alleys between, the odd empty lot. */
function streetRow(t: ChunkTools, sa: number, sb: number, bz: number, bh: number, hug: 'bottom' | 'top', density: number): void {
  let x = sa, seq = 0;
  while (x <= sb - 6) {                                   // 6 = the narrowest cottage
    if (t.rng.next() > 0.55 + density * 0.35) { x += t.rng.int(3, 5); continue; } // an empty lot
    let placed = false;
    const start = t.rng.int(0, HOUSE_TYPES.length - 1);   // rotate the first pick — variety down the street
    for (let k = 0; k < HOUSE_TYPES.length; k++) {
      const def = generateHouse(t.rng, HOUSE_TYPES[(start + k) % HOUSE_TYPES.length]);
      const hw = Math.max(...def.rows.map((row) => row.length));
      const hh = def.rows.length;
      if (hw > sb - x + 1 || hh > bh) continue;            // won't fit the remaining lot / band depth
      const hzz = hug === 'bottom' ? bz + bh - hh : bz;    // hug the kerb (the lane side)
      t.house(def, x, hzz, seq++);
      x += hw + t.rng.int(1, 2);                           // a tight alley to the next home
      placed = true;
      break;
    }
    if (!placed) x += 3;
  }
}

export const neighborhoodChunk: Chunk = (t, r, density) => {
  const { hz, vx } = laneCross(t, r);
  // the vertical cross-street splits the block into a west row and an east row;
  // each side is the full ~15-wide half (lane is vx-LANE_HALF..vx+LANE_HALF)
  const segs: [number, number][] = [
    [r.tx + 1, vx - LANE_HALF - 1],
    [vx + LANE_HALF + 1, r.tx + r.tw - 2],
  ];
  // two bands: north of the lane (homes hug its south kerb) and south of it
  // (homes hug its north kerb) — both rows face the central street
  const bands: { bz: number; bh: number; hug: 'bottom' | 'top' }[] = [
    { bz: r.tz + 1, bh: hz - LANE_HALF - r.tz - 2, hug: 'bottom' },
    { bz: hz + LANE_HALF + 1, bh: r.tz + r.th - hz - LANE_HALF - 2, hug: 'top' },
  ];
  for (const band of bands) {
    if (band.bh < 7) continue;                             // too shallow even for a cottage
    for (const [sa, sb] of segs) if (sb - sa >= 6) streetRow(t, sa, sb, band.bz, band.bh, band.hug, density);
  }
};

// ---------------------------------------------------------------------------
// THE FARM — the countryside block. CROP ROWS are runs of walkable T_GRASS
// wearing corn: a stalk stands 2u, taller than a man, so a field conceals
// exactly the way tall grass already does (bots respect the same clamp) — the
// soft bottleneck in a different coat, and you can WALK it, which is the point.
// Around the rows sit the landmarks you fight over: a barn straddling a 2×2
// claim, and a silo / windmill / water tower on single tiles — tall silhouettes
// that read from across the map and give the open ground something to mean.
// ---------------------------------------------------------------------------
export const farmChunk: Chunk = (t, r, density) => {
  const { hz, vx } = laneCross(t, r);
  const area = r.tw * r.th;

  // ---- the crop rows: long strips, aligned like a ploughed field ----------
  const rows = Math.max(3, Math.round(r.th * 0.22 * (0.6 + density)));
  for (let i = 0; i < rows; i++) {
    const rz = r.tz + 2 + t.rng.int(0, Math.max(0, r.th - 5));
    if (Math.abs(rz - hz) <= LANE_HALF + 1) continue; // the street stays bare
    const x0 = r.tx + 1 + t.rng.int(0, 4);
    const len = t.rng.int(6, Math.max(7, r.tw - 6));
    for (let k = 0; k < len; k++) {
      const tx = x0 + k;
      if (tx >= r.tx + r.tw - 1) break;
      if (Math.abs(tx - vx) <= LANE_HALF + 1) continue; // and so does the cross-street
      if (!t.isOpen(tx, rz)) continue;
      t.put(tx, rz, T_GRASS);                     // walkable concealment
      // corn on most tiles — decoration only, it claims nothing
      if (t.rng.next() < 0.72) t.prop('crop', tx, rz, t.rng.range(0.85, 1.15), t.rng.range(0, Math.PI * 2));
    }
  }

  // ---- the landmarks -----------------------------------------------------
  // a BARN on a 2×2 claim, placed centred on that claim (propAt, world coords)
  const bx = r.tx + 2 + t.rng.int(0, Math.max(0, r.tw - 6));
  const bz = r.tz + 2 + t.rng.int(0, Math.max(0, r.th - 6));
  if (Math.abs(bz - hz) > LANE_HALF + 2 && Math.abs(bx - vx) > LANE_HALF + 2) {
    let clear = true;
    for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) if (!t.isOpen(bx + dx, bz + dz)) clear = false;
    if (clear) {
      for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) t.claim(bx + dx, bz + dz, T_WALL);
      // the 2×2's true centre is the shared corner of its four tiles
      t.propAt('barn', (bx + 1) * TILE - WORLD / 2, (bz + 1) * TILE - WORLD / 2, 1, t.rng.range(0, Math.PI * 2));
    }
  }

  // one or two towers — a silo, a windmill, a water tower on single tiles
  const towers: PropSpec['type'][] = ['silo_farm', 'windmill', 'watertower'];
  const nTowers = 1 + (t.rng.next() < 0.55 ? 1 : 0);
  for (let i = 0; i < nTowers; i++) {
    const kind = towers[t.rng.int(0, towers.length - 1)];
    const tx = r.tx + 2 + t.rng.int(0, Math.max(0, r.tw - 4));
    const tz = r.tz + 2 + t.rng.int(0, Math.max(0, r.th - 4));
    if (onLane(r, tx, tz) || !t.isOpen(tx, tz)) continue;
    t.claim(tx, tz, T_WALL);
    t.prop(kind, tx, tz, 1, t.rng.range(0, Math.PI * 2));
  }

  // a little low cover so the rows aren't the only thing to fight from
  const bales = Math.round(area * 0.004 * (0.5 + density));
  for (let i = 0; i < bales; i++) {
    const tx = r.tx + t.rng.int(1, r.tw - 2), tz = r.tz + t.rng.int(1, r.th - 2);
    if (onLane(r, tx, tz) || !t.isOpen(tx, tz)) continue;
    t.claim(tx, tz, T_COVER);
    t.prop('crate', tx, tz, 1, t.rng.range(0, Math.PI));
  }
};

// ---------------------------------------------------------------------------
// A DISTRICT block — one big multi-room structure filling a band (from the
// district grammar: offices/factories/markets are corridors and rooms). The
// HARD bottleneck: you clear it wall to wall. `interior` leans on offices +
// markets (rooms), `industrial` on factories + depots (halls + yards).
// ---------------------------------------------------------------------------
function districtChunk(types: readonly DistrictType[]): Chunk {
  return (t, r, density) => {
    const { hz } = laneCross(t, r);
    const bands: RegionRect[] = [
      { tx: r.tx + 1, tz: r.tz + 1, tw: r.tw - 2, th: hz - LANE_HALF - r.tz - 2 },
      { tx: r.tx + 1, tz: hz + LANE_HALF + 1, tw: r.tw - 2, th: r.tz + r.th - hz - LANE_HALF - 2 },
    ];
    let seq = 0;
    for (const band of bands) {
      if (band.th < 6 || band.tw < 10) continue;
      if (t.rng.next() > 0.5 + density * 0.5) continue;
      const def = generateDistrict(t.rng, types[t.rng.int(0, types.length - 1)]);
      const bw = Math.max(...def.rows.map((row) => row.length));
      if (bw > band.tw - 1 || def.rows.length > band.th) continue;
      t.house(def, band.tx + t.rng.int(0, Math.max(0, band.tw - bw - 1)), band.tz + Math.max(0, band.th - def.rows.length), seq++);
      // a loading-yard crate or two out front
      for (let i = 0; i < 2; i++) {
        const cx = band.tx + t.rng.int(0, band.tw - 1), cz = band.tz;
        if (!onLane(r, cx, cz) && t.isOpen(cx, cz)) { t.claim(cx, cz, T_COVER); t.prop('crate', cx, cz, 1, t.rng.range(0, Math.PI)); }
      }
    }
  };
}

// the chunk registry — the region grammar picks by kind
export const CHUNKS: Record<ChunkKind, Chunk> = {
  forest: forestChunk,
  open: openChunk,
  neighborhood: neighborhoodChunk,
  interior: districtChunk(['office', 'market', 'storefront']),
  industrial: districtChunk(['factory', 'depot_hall']),
  farm: farmChunk,
};

/**
 * THE REGION GRAMMAR — carve the west contested band into a stack of regions,
 * assign each a chunk kind + density (seeded, so every map is a fresh mix),
 * and fill it. The chunk tools mirror every write to the east half, so the two
 * sides are identical. Runs in place of the old scatter for field maps.
 *
 * Regions tile from the compound edge to the center line; the lane-cross
 * contract each chunk honors stitches them into a connected street network.
 */
export function fillRegions(ctx: StampCtx, half: number, weights: Partial<Record<ChunkKind, number>>): ChunkKind[] {
  const t = chunkTools(ctx);
  const X0 = 29, X1 = half;            // west-middle band (east is the mirror)
  const Z0 = 4, Z1 = GRID - 5;
  const rows = 4;
  const rh = Math.floor((Z1 - Z0) / rows);
  const kinds = Object.keys(weights) as ChunkKind[];
  const total = kinds.reduce((a, k) => a + (weights[k] ?? 0), 0);
  const pick = (): ChunkKind => {
    let roll = t.rng.next() * total;
    for (const k of kinds) { roll -= weights[k] ?? 0; if (roll <= 0) return k; }
    return 'open';
  };
  const used: ChunkKind[] = [];
  for (let ri = 0; ri < rows; ri++) {
    const region: RegionRect = { tx: X0, tz: Z0 + ri * rh, tw: X1 - X0, th: ri === rows - 1 ? Z1 - (Z0 + ri * rh) : rh };
    // the middle row (the hill's row) stays OPEN — objectives need the room
    const kind = ri === Math.floor(rows / 2) ? 'open' : pick();
    used.push(kind);
    CHUNKS[kind](t, region, t.rng.range(0.5, 0.8));
  }
  // ONE guaranteed shallow pond in a safe corner (north band, clear of the
  // bases, the motor pool, the objectives, and the lanes) — enough water for
  // the biome + the waterline law, not the flood that bunched bots wading.
  pond(t, { tx: 34, tz: 12, tw: 12, th: 10 }, false);
  return used;
}
