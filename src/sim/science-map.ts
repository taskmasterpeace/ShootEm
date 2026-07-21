import { stampBuilding, type BuildingDef, type StampCtx } from './buildings';
import {
  F2_FLOOR,
  F2_WALL,
  F2_WELL,
  GRID,
  S_DIRT,
  S_GRASS,
  S_GRIT,
  S_PLATE,
  S_WET,
  T_COVER,
  T_LADDER,
  T_OPEN,
  T_WALL,
  TILE,
  WORLD,
  isDoorTile,
  registerThinGrid,
  type GameMap,
} from './map';
import { Rng } from './rng';
import type { ScienceMissionSpec, ScienceSite } from './science';
import type { ThemeId, Vec3 } from './types';

export interface ScienceMapLayout {
  map: GameMap;
  entry: Vec3;
  extraction: Vec3;
  objectiveSockets: Vec3[];
  guardPosts: Vec3[];
  civilianSpawns: Vec3[];
  convoyRoute: Vec3[];
  bounds: { minTx: number; minTz: number; maxTx: number; maxTz: number };
}

interface SiteProfile {
  width: number;
  height: number;
  kind: BuildingDef['kind'];
  name: string;
  floors?: 2;
}

const SITES: Record<ScienceSite, SiteProfile> = {
  'clone-vault': { width: 17, height: 13, kind: 'military', name: 'Clone Vault' },
  'research-annex': { width: 15, height: 13, kind: 'commercial', name: 'Research Annex' },
  'rail-yard': { width: 21, height: 11, kind: 'industrial', name: 'Rail Yard Depot' },
  'comms-relay': { width: 13, height: 13, kind: 'military', name: 'Comms Relay' },
  'field-hospital': { width: 19, height: 11, kind: 'commercial', name: 'Field Hospital' },
  foundry: { width: 19, height: 15, kind: 'industrial', name: 'Foundry' },
  'buried-archive': { width: 15, height: 15, kind: 'military', name: 'Buried Archive' },
  'enemy-airfield': { width: 21, height: 13, kind: 'military', name: 'Airfield Operations' },
  'officer-villa': { width: 17, height: 15, kind: 'house', name: "Officer's Villa", floors: 2 },
  'quarantine-zone': { width: 19, height: 15, kind: 'industrial', name: 'Quarantine Block' },
};

const SURFACE: Record<ThemeId, number> = {
  savanna: S_GRASS,
  starship: S_PLATE,
  asteroid: S_DIRT,
  europa: S_WET,
  titan: S_GRIT,
  triton: S_GRIT,
  hardpan: S_DIRT,
};

const tileToWorld = (tx: number, tz: number, y = 0): Vec3 => ({
  x: (tx + 0.5) * TILE - WORLD / 2,
  y,
  z: (tz + 0.5) * TILE - WORLD / 2,
});

const worldToTile = (pos: Vec3): [number, number] => [
  Math.floor((pos.x + WORLD / 2) / TILE),
  Math.floor((pos.z + WORLD / 2) / TILE),
];

function makeSiteDef(site: ScienceSite): BuildingDef {
  const profile = SITES[site];
  const w = profile.width;
  const h = profile.height;
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));

  for (let x = 0; x < w; x++) {
    rows[0][x] = '-';
    rows[h - 1][x] = '-';
  }
  for (let z = 0; z < h; z++) {
    rows[z][0] = '|';
    rows[z][w - 1] = '|';
  }
  rows[0][0] = rows[0][w - 1] = rows[h - 1][0] = rows[h - 1][w - 1] = '+';
  const midZ = Math.floor(h / 2);
  rows[midZ][0] = 'v';
  rows[midZ][w - 1] = 'v';

  // Every site has a readable room-clearing spine: a vertical security line
  // and a smaller rear room. Doors remain explicit in the authored stencil.
  const splitX = Math.floor(w / 2);
  for (let z = 1; z < h - 1; z++) rows[z][splitX] = '|';
  rows[midZ][splitX] = 'v';
  const rearZ = Math.max(3, Math.floor(h / 3));
  for (let x = splitX + 1; x < w - 1; x++) rows[rearZ][x] = '-';
  rows[rearZ][Math.min(w - 3, splitX + 3)] = 'h';
  rows[rearZ][splitX] = '+';

  rows[2][2] = 'C';
  rows[h - 3][w - 3] = 'C';
  rows[2][w - 3] = 'P';

  let rows2: string[] | undefined;
  if (profile.floors === 2) {
    const ladderX = 3;
    const ladderZ = h - 3;
    rows[ladderZ][ladderX] = 'L';
    const upper = Array.from({ length: h }, () => Array.from({ length: w }, () => ' '));
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        if (x === 0 || z === 0 || x === w - 1 || z === h - 1) upper[z][x] = '#';
        else upper[z][x] = '.';
      }
    }
    upper[ladderZ][ladderX] = 'L';
    rows2 = upper.map((row) => row.join(''));
  }

  return {
    id: `science_${site}`,
    name: profile.name,
    kind: profile.kind,
    floors: profile.floors ?? 1,
    rows: rows.map((row) => row.join('')),
    ...(rows2 ? { rows2 } : {}),
  };
}

function pickSpread(points: Vec3[], count: number): Vec3[] {
  if (points.length <= count) return points.slice();
  return Array.from({ length: count }, (_, i) => points[Math.floor(i * (points.length - 1) / (count - 1))]);
}

/** Generate the small, dense mission ground independently from war-front maps. */
export function generateScienceMap(spec: ScienceMissionSpec): ScienceMapLayout {
  const profile = SITES[spec.site];
  const def = makeSiteDef(spec.site);
  const rng = new Rng(spec.seed ^ 0x5c1e7e);
  const grid = new Uint8Array(GRID * GRID);
  grid.fill(T_WALL);
  const grid2 = new Uint8Array(GRID * GRID);
  const surface = new Uint8Array(GRID * GRID);
  surface.fill(SURFACE[spec.theme]);
  const props: GameMap['props'] = [];
  const pickups: GameMap['pickups'] = [];
  const houses: GameMap['houses'] = [];
  const claims: { idx: number; t: number }[] = [];

  const tx = 42 - Math.floor(profile.width / 4);
  const tz = 50 - Math.floor(profile.height / 2);
  const bounds = {
    minTx: tx - 5,
    minTz: tz - 4,
    maxTx: tx + profile.width + 3,
    maxTz: tz + profile.height + 3,
  };
  for (let z = bounds.minTz; z <= bounds.maxTz; z++) {
    for (let x = bounds.minTx; x <= bounds.maxTx; x++) grid[z * GRID + x] = T_OPEN;
  }

  const ctx: StampCtx = { grid, grid2, props, pickups, houses, claims, rng };
  if (!stampBuilding(ctx, def, tx, tz)) throw new Error(`science site out of bounds: ${spec.site}`);
  registerThinGrid(grid);

  const doorZ = tz + Math.floor(profile.height / 2);
  const entry = tileToWorld(tx - 1, doorZ);
  const extraction = tileToWorld(tx - 3, doorZ + 2);
  const cloneTx = tx - 3;
  const cloneTz = doorZ;
  const cloneIdx = cloneTz * GRID + cloneTx;
  grid[cloneIdx] = T_COVER;
  claims.push({ idx: cloneIdx, t: T_COVER });
  props.push({ type: 'clone_bay', pos: tileToWorld(cloneTx, cloneTz), scale: 0.9, rot: Math.PI / 2 });

  const interior: Vec3[] = [];
  for (let z = tz + 1; z < tz + profile.height - 1; z++) {
    for (let x = tx + 1; x < tx + profile.width - 1; x++) {
      const tile = grid[z * GRID + x];
      if (tile === T_OPEN || tile === T_LADDER || isDoorTile(tile)) interior.push(tileToWorld(x, z));
    }
  }
  interior.sort((a, b) => Math.hypot(a.x - entry.x, a.z - entry.z) - Math.hypot(b.x - entry.x, b.z - entry.z));
  const farHalf = interior.slice(Math.floor(interior.length * 0.45));
  const objectiveSockets = pickSpread(farHalf, 4);
  const guardPosts = pickSpread(interior.slice(Math.floor(interior.length * 0.2)), 7);
  const civilianSpawns = pickSpread(interior.slice(Math.floor(interior.length * 0.35)), 4);
  const convoyRoute = [
    tileToWorld(bounds.minTx + 1, bounds.maxTz - 2),
    tileToWorld(tx - 1, bounds.maxTz - 2),
    tileToWorld(bounds.maxTx - 1, bounds.maxTz - 2),
  ];

  const spawns: GameMap['spawns'] = [
    [entry, tileToWorld(tx - 2, doorZ - 1), tileToWorld(tx - 2, doorZ + 1)],
    guardPosts,
  ];
  const map: GameMap = {
    seed: spec.seed,
    theme: spec.theme,
    grid,
    grid2,
    surface,
    basePos: [entry, guardPosts[guardPosts.length - 1]],
    spawns,
    flagPos: [entry, objectiveSockets[0]],
    hillPos: objectiveSockets[1],
    controlPoints: objectiveSockets.slice(0, 3).map((pos, i) => ({ name: `LAB ${i + 1}`, pos })),
    vehiclePads: [],
    pickups,
    props,
    zombieSpawns: spec.site === 'quarantine-zone' ? civilianSpawns : [],
    houses,
    gates: [],
    pads: [],
    propCovered: [...new Set(claims.filter((claim) => grid[claim.idx] === claim.t).map((claim) => claim.idx))],
  };
  return { map, entry, extraction, objectiveSockets, guardPosts, civilianSpawns, convoyRoute, bounds };
}

/** Reachability contract: closed doors are operable, masonry is not. */
export function scienceMapReachable(layout: ScienceMapLayout): boolean {
  const [startX, startZ] = worldToTile(layout.entry);
  const targets = new Set(layout.objectiveSockets.map((pos) => {
    const [x, z] = worldToTile(pos);
    return z * GRID + x;
  }));
  const seen = new Set<number>([startZ * GRID + startX]);
  const queue: [number, number][] = [[startX, startZ]];
  while (queue.length) {
    const [x, z] = queue.shift()!;
    targets.delete(z * GRID + x);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      const idx = nz * GRID + nx;
      if (seen.has(idx)) continue;
      const tile = layout.map.grid[idx];
      if (tile !== T_OPEN && tile !== T_LADDER && !isDoorTile(tile)) continue;
      seen.add(idx);
      queue.push([nx, nz]);
    }
  }
  return targets.size === 0;
}

// Keep these imports intentional: upper-floor output is a public map contract,
// and this assertion makes accidental enum drift obvious during development.
void F2_FLOOR;
void F2_WALL;
void F2_WELL;
