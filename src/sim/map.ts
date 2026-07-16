import { Rng } from './rng';
import { generateHouse, placeBuildings, stampBuilding, type StampCtx } from './buildings';
import { THEMES } from './data';
import type { ModeId, Team, ThemeId, Vec3, VehicleKind } from './types';

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

/** What the breacher's drill grinds to rubble — the ONE authoritative menu,
 *  shared by the sim (digTile + drill face) and the harness Terrain tab.
 *  Not on the menu: METAL (sparks, zero progress), water (nothing to eat),
 *  ladders, open ground, and the map border. */
export const DRILL_EATS: ReadonlySet<number> = new Set([T_WALL, T_COVER, T_SLIT, T_DOOR, T_DOOR_OPEN]);

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
export function surfaceAt(surface: Uint8Array, x: number, z: number): number {
  const tx = Math.floor((x + WORLD / 2) / TILE);
  const tz = Math.floor((z + WORLD / 2) / TILE);
  if (tx < 0 || tz < 0 || tx >= GRID || tz >= GRID) return S_DIRT;
  return surface[tz * GRID + tx];
}

/** which house (index into map.houses) contains this point, -1 = open sky */
export function houseAt(houses: House[], x: number, z: number): number {
  const tx = Math.floor((x + WORLD / 2) / TILE);
  const tz = Math.floor((z + WORLD / 2) / TILE);
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i];
    if (tx >= h.tx && tx < h.tx + h.tw && tz >= h.tz && tz < h.tz + h.th) return i;
  }
  return -1;
}

export interface PropSpec {
  type: 'rock' | 'bunker' | 'crate' | 'tree' | 'ruin' | 'clone_bay';
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
  /** footprint in tiles — roofs, concealment, and interior checks key off this */
  tx: number; tz: number; tw: number; th: number;
  /** 2 = has a second storey (roof sits at 8, not 4) */
  floors?: number;
  /** roof style, decided by the building's kind — gable for whole-rect
   *  houses, parapet lips for commercial, vents for industry, none on ruins */
  roof?: 'gable' | 'flat' | 'parapet' | 'vents' | 'none';
  /** footprint bitmask per stencil row (bit x = tile tx+x is covered) — the
   *  roof is shaped by the FOOTPRINT, not the bounding rect */
  maskRows?: number[];
}

export interface GameMap {
  seed: number;
  theme: ThemeId;
  grid: Uint8Array; // GRID*GRID
  /** the SECOND STOREY (§8.4 Phase-2): F2_* per tile — void unless a
   *  two-storey building stamped an upper floor here. Static after gen. */
  grid2: Uint8Array;
  /** the SURFACE layer (§8.6): S_* per tile — movement, sound, and tracks */
  surface: Uint8Array;
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
  /** SINGLE SOURCE OF TRUTH for prop-rendered collision: tile indices whose
   *  blocking geometry is visually owned by a prop (rock disc, tree trunk,
   *  crate). The generator records these AT THE STAMP SITE and prunes any
   *  claim a later stamp overwrote. The renderer skips EXACTLY this set and
   *  never re-derives footprints — the drift that caused every invisible-wall
   *  bug is structurally impossible. Guarded by tests/walls.test.ts. */
  propCovered: number[];
}

export function tileAt(grid: Uint8Array, x: number, z: number): number {
  const tx = Math.floor((x + WORLD / 2) / TILE);
  const tz = Math.floor((z + WORLD / 2) / TILE);
  if (tx < 0 || tz < 0 || tx >= GRID || tz >= GRID) return T_WALL;
  return grid[tz * GRID + tx];
}

export function isBlocked(grid: Uint8Array, x: number, z: number, hover = false): boolean {
  const t = tileAt(grid, x, z);
  if (t === T_WATER) return false;   // shallow: wadeable by everyone (slowly)
  if (t === T_DEEP) return !hover;   // deep: hover only — soldiers SWIM via their own physics
  // slits and CLOSED doors block movement always; open doors are a doorway
  return t === T_WALL || t === T_COVER || t === T_SLIT || t === T_DOOR || t === T_METAL;
}

/** Blocks projectiles/sight: walls always; cover and water never (shots fly over). */
export function blocksShot(grid: Uint8Array, x: number, z: number, y: number): boolean {
  const t = tileAt(grid, x, z);
  if (t === T_WALL) return y < 4;      // walls are 4 units tall
  if (t === T_COVER) return y < 1.2;   // low cover
  if (t === T_SLIT) return !(y >= 1.2 && y <= 1.8); // the firing band — muzzle height passes
  if (t === T_DOOR) return y < 2.2;    // a closed door stops rounds and eyes
  if (t === T_METAL) return y < 4;     // metal walls are walls
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

/** Upper-layer shot blocking — walls live in the 4..8 band. */
export function blocksShotUpper(grid2: Uint8Array, x: number, z: number, y: number): boolean {
  if (y < 4 || y >= 8) return false;
  const t = tileAt(grid2, x, z);
  if (t === F2_WALL) return true;
  if (t === F2_SLIT) return !(y >= 5.2 && y <= 5.8);
  return false;
}

/** Is this upper tile standable? (Anything but void — walls stop you first.) */
export const upperBlocked = (grid2: Uint8Array, x: number, z: number): boolean => {
  const t = tileAt(grid2, x, z);
  return t === F2_WALL || t === F2_SLIT;
};

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

/** Claims that survived every later stamp — deduped, ready for the map. */
function settleClaims(grid: Uint8Array, claims: TileClaim[]): number[] {
  return [...new Set(claims.filter((c) => grid[c.idx] === c.t).map((c) => c.idx))];
}

function tileToWorld(tx: number, tz: number): Vec3 {
  return { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 };
}

function clearArea(grid: Uint8Array, cx: number, cz: number, r: number) {
  for (let z = cz - r; z <= cz + r; z++)
    for (let x = cx - r; x <= cx + r; x++) setTile(grid, x, z, T_OPEN);
}

/** Generates a symmetric battlefield — or a suburban neighborhood for safehouse mode. */
export function generateMap(seed: number, mode: ModeId, theme: ThemeId = 'savanna'): GameMap {
  if (mode === 'safehouse') return generateNeighborhood(seed);
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
  };
  const mix = MIX[gen];
  for (let b = 0; b < mix.blobs; b++) {
    const tx = rng.int(6, half - 3);
    const tz = rng.int(6, GRID - 7);
    const kind = rng.next();
    const mirror = (x: number) => GRID - 1 - x;
    if (kind < mix.wall) {
      // wall segment (starship corridors run long and orthogonal)
      const len = rng.int(mix.wallLen[0], mix.wallLen[1]);
      const horiz = rng.next() < 0.5;
      for (let i = 0; i < len; i++) {
        setTile(grid, tx + (horiz ? i : 0), tz + (horiz ? 0 : i), T_WALL);
        setTile(grid, mirror(tx + (horiz ? i : 0)), tz + (horiz ? 0 : i), T_WALL);
      }
      // corridor junctions: an L-elbow half the time
      if (gen === 'corridors' && rng.next() < 0.5) {
        const el = rng.int(3, 7);
        for (let i = 0; i < el; i++) {
          setTile(grid, tx + (horiz ? len - 1 : i), tz + (horiz ? i : len - 1), T_WALL);
          setTile(grid, mirror(tx + (horiz ? len - 1 : i)), tz + (horiz ? i : len - 1), T_WALL);
        }
      }
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
      // rock blob (wall tiles, rendered as rocks — ice boulders on Triton)
      const r = rng.int(1, 2);
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++)
          if (x * x + z * z <= r * r) {
            claimTile(grid, claims, tx + x, tz + z, T_WALL);
            claimTile(grid, claims, mirror(tx + x), tz + z, T_WALL);
          }
      const w = tileToWorld(tx, tz);
      props.push({ type: 'rock', pos: w, scale: r * 1.6, rot: rng.range(0, Math.PI * 2) });
      props.push({ type: 'rock', pos: tileToWorld(mirror(tx), tz), scale: r * 1.6, rot: rng.range(0, Math.PI * 2) });
    } else {
      // water: savanna ponds, Europa pools, Triton crevasses (none on starships)
      if (gen === 'corridors') continue;
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

  // ---- the building stock (§8.4 + the ZombsRoyale rule: indoors has STUFF).
  // Hand-authored templates from the library, procedurally dealt and mirrored
  // for fairness: houses, warehouses, bunkers — doors closed, shelves stocked.
  const houses: House[] = [];
  const buildCtx = { grid, grid2, props, pickups, houses, claims, rng };
  placeBuildings(buildCtx, 3, [
    { tx: half, tz: half, r: gen === 'ocean' ? 18 : 12 }, // the hill (+ the moat)
    { tx: half - 22, tz: half - 22, r: 8 },   // CP A clearing
    { tx: half + 22, tz: half + 22, r: 8 },   // CP C clearing
  ]);

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
    // §21 The Reprint: the clone bay — the machine you come back from. ONE
    // glass pod per base, one tile off the spawn ring, so every fresh sleeve
    // walks past its own printer on the way to the front. It claims its tile
    // like every prop (the invisible-wall law, tests/walls.test.ts): T_COVER,
    // because armored glass stops boots and bullets but not eyes.
    claimTile(grid, claims, btx, btz + 4, T_COVER);
    props.push({ type: 'clone_bay', pos: tileToWorld(btx, btz + 4), scale: 1, rot: side === 0 ? 0 : Math.PI });
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

  // Vehicle pads flanking each base — the full motor pool
  const vehiclePads: VehiclePad[] = [];
  const padKinds: VehicleKind[] = ['buggy', 'tank', 'apc', 'skiff', 'bike', 'flyer', 'transport', 'ambulance', 'tunneler', 'hoverboard', 'mech'];
  for (let side = 0 as Team; side < 2; side++) {
    const [btx, btz] = baseT[side];
    const fwd = side === 0 ? 1 : -1;
    const padOffsets = [
      [fwd * 9, -9], [fwd * 9, 9], [fwd * 12, -3], [fwd * 12, 3],
      [fwd * 6, -12], [fwd * 6, 12], [fwd * 15, -8], [fwd * 15, 8],
      [fwd * 12, -12], [fwd * 12, 12],
      [fwd * 16, 4], // mech — off the center row so it doesn't park in the main firing lane
    ];
    padKinds.forEach((kind, i) => {
      const [ox, oz] = padOffsets[i];
      clearArea(grid, btx + ox, btz + oz, 2);
      vehiclePads.push({ kind, team: side as Team, pos: tileToWorld(btx + ox, btz + oz) });
    });
    // one Bulwark emplacement gun guarding each team's midfield approach
    const ex = btx + fwd * 22, ez = btz + (side === 0 ? -14 : 14);
    clearArea(grid, ex, ez, 2);
    vehiclePads.push({ kind: 'emplacement', team: side as Team, pos: tileToWorld(ex, ez) });
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

  // Zombie spawns: map edges
  const zombieSpawns: Vec3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tx = Math.round(half + Math.cos(a) * (half - 6));
    const tz = Math.round(half + Math.sin(a) * (half - 6));
    clearArea(grid, tx, tz, 1);
    zombieSpawns.push(tileToWorld(tx, tz));
  }

  // ---- the SURFACE layer (§8.6): each theme deals its own ground ----
  const surface = new Uint8Array(GRID * GRID);
  const baseSurf = gen === 'field' ? (theme === 'titan' ? S_GRIT : S_GRASS)
    : gen === 'corridors' ? S_PLATE
    : gen === 'rocks' ? S_DIRT
    : gen === 'ocean' ? S_WET
    : S_ICE; // triton
  surface.fill(baseSurf);
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
        // exclusion radii are TILE-SCALED: the base structure spans ~7 tiles,
        // so a fixed world-unit radius shrinks when the map grows (a 300u map
        // once grew a tree IN the base gate and walled a whole team in)
        const far = Math.hypot(w.x - basePos[0].x, w.z - basePos[0].z) > TILE * 10 &&
                    Math.hypot(w.x - basePos[1].x, w.z - basePos[1].z) > TILE * 10 &&
                    Math.hypot(w.x - hillPos.x, w.z - hillPos.z) > TILE * 7;
        if (far) {
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

  return { seed, theme, grid, grid2, surface, basePos, spawns, flagPos, hillPos, controlPoints, vehiclePads, pickups, props, zombieSpawns, houses, gates, pads, propCovered: settleClaims(grid, claims) };
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
      if (grid[tz * GRID + tx] === T_OPEN) {
        claimTile(grid, claims, tx, tz, T_WALL);
        props.push({ type: 'tree', pos: tileToWorld(tx, tz), scale: rng.range(0.8, 1.3), rot: rng.range(0, Math.PI * 2) });
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
  return {
    seed, theme: 'savanna', grid, grid2, surface, basePos, spawns,
    flagPos: [basePos[0], basePos[1]],
    hillPos,
    controlPoints: [
      { name: 'A', pos: tileToWorld(GRID / 2 - 20, GRID / 2) },
      { name: 'B', pos: hillPos },
      { name: 'C', pos: tileToWorld(GRID / 2 + 20, GRID / 2) },
    ],
    vehiclePads,
    pickups, props, zombieSpawns, houses,
    gates: [], pads: [],
    propCovered: settleClaims(grid, claims),
  };
}
