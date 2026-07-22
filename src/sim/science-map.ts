import { generateCityBuilding, type BuildingArchetype, type GeneratedBuilding } from './building-generator';
import { deriveBuildingNavigation } from './building-navigation';
import { stampBuilding, type StampCtx } from './buildings';
import { CITY_MAP_PROFILES } from './city-profile';
import {
  F2_BALCONY,
  F2_DOOR_H,
  F2_DOOR_H_OPEN,
  F2_DOOR_V,
  F2_DOOR_V_OPEN,
  F2_FLOOR,
  F2_STAIR_N,
  F2_STAIR_W,
  F2_WELL,
  S_DIRT,
  S_GRASS,
  S_GRIT,
  S_PLATE,
  S_WET,
  T_COVER,
  T_LADDER,
  T_OPEN,
  T_RUBBLE,
  T_STAIRS_N,
  T_STAIRS_W,
  T_WALL,
  isDoorTile,
  losClear,
  registerThinGrid,
  type GameMap,
} from './map';
import {
  LEGACY_GEOMETRY,
  geometryLength,
  inBounds,
  tileIndex,
  tileToWorld as geometryTileToWorld,
  worldToTile as geometryWorldToTile,
  type MapGeometry,
} from './map-geometry';
import { floorLayer, ladderWellAt, stairDirectionAt } from './map-layers';
import { Rng } from './rng';
import type { ScienceMissionSpec, ScienceSite } from './science';
import { generateScienceOperationGraph, validateScienceOperationGraph, type ScienceOperationGraph } from './science-operation';
import type { ThemeId, Vec3 } from './types';

export interface ScienceMapLayout {
  map: GameMap;
  building: GeneratedBuilding;
  entry: Vec3;
  extraction: Vec3;
  objectiveSockets: Vec3[];
  guardPosts: Vec3[];
  civilianSpawns: Vec3[];
  dogPosts: Vec3[];
  reinforcementPosts: Vec3[];
  convoyRoute: Vec3[];
  bounds: { minTx: number; minTz: number; maxTx: number; maxTz: number };
  operationGraph: ScienceOperationGraph;
}

interface SiteProfile {
  archetype: BuildingArchetype;
  floors: 1 | 2 | 3;
  yard?: 'rail' | 'airfield';
}

export const SCIENCE_SITE_BUILDINGS: Record<ScienceSite, SiteProfile> = {
  'clone-vault': { archetype: 'secure-archive', floors: 3 },
  'research-annex': { archetype: 'research-annex', floors: 2 },
  'rail-yard': { archetype: 'depot', floors: 1, yard: 'rail' },
  'comms-relay': { archetype: 'command-post', floors: 2 },
  'field-hospital': { archetype: 'clinic', floors: 2 },
  foundry: { archetype: 'factory', floors: 2 },
  'buried-archive': { archetype: 'secure-archive', floors: 3 },
  'enemy-airfield': { archetype: 'command-post', floors: 2, yard: 'airfield' },
  'officer-villa': { archetype: 'command-villa', floors: 2 },
  'quarantine-zone': { archetype: 'processing-hall', floors: 2 },
};

const SURFACE: Record<ThemeId, number> = {
  savanna: S_GRASS,
  starship: S_PLATE,
  asteroid: S_DIRT,
  europa: S_WET,
  titan: S_GRIT,
  triton: S_GRIT,
  hardpan: S_DIRT,
  winter: S_GRIT,
};

const tileToWorld = (tx: number, tz: number, floor = 0, geometry: MapGeometry = LEGACY_GEOMETRY): Vec3 => ({
  ...geometryTileToWorld(geometry, tx, tz),
  y: floor * 4,
});

const worldToTile = (pos: Vec3, geometry: MapGeometry = LEGACY_GEOMETRY): [number, number] =>
  geometryWorldToTile(geometry, pos.x, pos.z);

function pickSpread(points: Vec3[], count: number): Vec3[] {
  if (!points.length || count <= 0) return [];
  if (points.length <= count) return points.map((point) => ({ ...point }));
  return Array.from({ length: count }, (_, index) => ({
    ...points[Math.floor(index * (points.length - 1) / Math.max(1, count - 1))],
  }));
}

const AUTHOR_WALKABLE = new Set(['.', 'h', 'v', 'A', 'L', 'B', 'P']);

function authoredWalkable(building: GeneratedBuilding, tx: number, tz: number): Vec3[] {
  const points: Vec3[] = [];
  for (let floor = 0; floor < building.layers.length; floor++) {
    for (let z = 0; z < building.layers[floor].length; z++) {
      for (let x = 0; x < building.width; x++) {
        if (AUTHOR_WALKABLE.has(building.layers[floor][z]?.[x] ?? ' ')) points.push(tileToWorld(tx + x, tz + z, floor));
      }
    }
  }
  return points;
}

function outsideEntry(building: GeneratedBuilding, tx: number, tz: number): Vec3 {
  const socket = building.sockets.find((entry) => entry.kind === 'entry')!;
  const layer = building.layers[0];
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    if ((layer[socket.z + dz]?.[socket.x + dx] ?? ' ') === ' ') return tileToWorld(tx + socket.x + dx, tz + socket.z + dz);
  }
  return tileToWorld(tx + socket.x, tz + socket.z);
}

function uniquePoints(points: Vec3[]): Vec3[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const id = `${point.x}:${point.y}:${point.z}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Generate a compact operation around one complete city building. Rail-yard
 * and airfield sites keep a small exterior apron; every indoor site uses the
 * same whole-building grammar as the Map Maker. */
export function generateScienceMap(spec: ScienceMissionSpec): ScienceMapLayout {
  const geometry = { ...LEGACY_GEOMETRY };
  const profile = SCIENCE_SITE_BUILDINGS[spec.site];
  const cityId = spec.cityId ?? CITY_MAP_PROFILES[spec.seed % CITY_MAP_PROFILES.length].id;
  const building = generateCityBuilding({
    cityId,
    archetype: profile.archetype,
    seed: spec.seed,
    floors: profile.floors,
  });
  const rng = new Rng(spec.seed ^ 0x5c1e7e);
  const grid = new Uint8Array(geometryLength(geometry));
  const grid2 = new Uint8Array(geometryLength(geometry));
  const upperLayers = [grid2];
  const surface = new Uint8Array(geometryLength(geometry));
  surface.fill(SURFACE[spec.theme]);
  const props: GameMap['props'] = [];
  const pickups: GameMap['pickups'] = [];
  const houses: GameMap['houses'] = [];
  const claims: { idx: number; t: number }[] = [];

  const tx = Math.floor(geometry.cols / 2) - Math.floor(building.width / 2);
  const tz = Math.floor(geometry.rows / 2) - Math.floor(building.height / 2);
  const bounds = {
    minTx: tx - 3,
    minTz: tz - 3,
    maxTx: tx + building.width + 2,
    maxTz: tz + building.height + 2,
  };
  for (let x = bounds.minTx; x <= bounds.maxTx; x++) {
    grid[tileIndex(geometry, x, bounds.minTz)] = T_WALL;
    grid[tileIndex(geometry, x, bounds.maxTz)] = T_WALL;
  }
  for (let z = bounds.minTz; z <= bounds.maxTz; z++) {
    grid[tileIndex(geometry, bounds.minTx, z)] = T_WALL;
    grid[tileIndex(geometry, bounds.maxTx, z)] = T_WALL;
  }

  const ctx: StampCtx = { grid, grid2, upperLayers, geometry, props, pickups, houses, claims, rng };
  if (!stampBuilding(ctx, building.def, tx, tz)) throw new Error(`science site out of bounds: ${spec.site}`);
  registerThinGrid(grid);
  for (const layer of upperLayers) registerThinGrid(layer);

  const entry = outsideEntry(building, tx, tz);
  const [entryTx, entryTz] = worldToTile(entry, geometry);
  const extraction = tileToWorld(Math.max(bounds.minTx + 1, entryTx - 1), Math.min(bounds.maxTz - 1, entryTz + 1));
  const cloneTx = Math.max(bounds.minTx + 1, entryTx - 2);
  const cloneTz = entryTz;
  const clonePos = tileToWorld(cloneTx, cloneTz);
  const cloneIdx = tileIndex(geometry, cloneTx, cloneTz);
  grid[cloneIdx] = T_COVER;
  claims.push({ idx: cloneIdx, t: T_COVER });
  props.push({ type: 'clone_bay', pos: clonePos, scale: 0.9, rot: Math.PI / 2 });

  const walkable = authoredWalkable(building, tx, tz)
    .sort((a, b) => Math.hypot(b.x - entry.x, b.z - entry.z) - Math.hypot(a.x - entry.x, a.z - entry.z));
  const authoredObjectives = building.sockets.filter((socket) => socket.kind === 'objective')
    .map((socket) => tileToWorld(tx + socket.x, tz + socket.z, socket.floor));
  const objectiveSockets = uniquePoints([...authoredObjectives, ...walkable]).slice(0, 4);
  const byFloorThenDistance = [...walkable].sort((a, b) => a.y - b.y
    || Math.hypot(a.x - entry.x, a.z - entry.z) - Math.hypot(b.x - entry.x, b.z - entry.z));
  const navigation = deriveBuildingNavigation(building);
  const roomPosts = navigation.rooms.map((room) => {
    const tile = room.tiles[Math.floor(room.tiles.length / 2)];
    return tileToWorld(tx + tile.x, tz + tile.z, room.floor);
  });
  const guardPosts = uniquePoints([
    ...building.sockets.filter((socket) => socket.kind === 'guard').map((socket) => tileToWorld(tx + socket.x, tz + socket.z, socket.floor)),
    ...roomPosts,
    ...pickSpread(byFloorThenDistance.slice(Math.floor(byFloorThenDistance.length * 0.18)), 12),
  ]).sort((a, b) => {
    const exposed = (post: Vec3) => post.y === entry.y
      && Math.hypot(post.x - entry.x, post.z - entry.z) <= 32
      && losClear(grid, { ...entry, y: entry.y + 1.4 }, { ...post, y: post.y + 1.4 }, 1.4, geometry);
    return Number(exposed(a)) - Number(exposed(b))
      || Math.hypot(b.x - entry.x, b.z - entry.z) - Math.hypot(a.x - entry.x, a.z - entry.z);
  }).slice(0, 12);
  const civilianSpawns = uniquePoints([
    ...building.sockets.filter((socket) => socket.kind === 'civilian').map((socket) => tileToWorld(tx + socket.x, tz + socket.z, socket.floor)),
    ...pickSpread(walkable.slice(Math.floor(walkable.length * 0.25)), 4),
  ]).slice(0, 4);
  const dogPosts = pickSpread(guardPosts.filter((post) => post.y === 0), 2);
  const reinforcementPosts = [entry, tileToWorld(bounds.minTx + 1, bounds.minTz + 1), tileToWorld(bounds.maxTx - 1, bounds.maxTz - 1)];

  const convoyRoute = [
    tileToWorld(bounds.minTx + 1, bounds.maxTz - 2),
    tileToWorld(tx - 1, bounds.maxTz - 2),
    tileToWorld(bounds.maxTx - 1, bounds.maxTz - 2),
  ];
  if (profile.yard) {
    for (let i = 0; i < 3; i++) props.push({
      type: profile.yard === 'airfield' ? 'crate' : 'wreck',
      pos: tileToWorld(bounds.minTx + 2 + i * 2, bounds.maxTz - 2),
      scale: 0.8,
      rot: profile.yard === 'airfield' ? 0 : Math.PI / 2,
    });
  }

  const safeGuard = guardPosts[guardPosts.length - 1] ?? objectiveSockets[0] ?? entry;
  const map: GameMap = {
    seed: spec.seed,
    theme: spec.theme,
    geometry,
    grid,
    grid2,
    upperLayers,
    buildingMeta: {
      ...building.provenance,
      floors: building.floors,
      footprint: building.footprint,
      origin: { tx, tz },
      width: building.width,
      height: building.height,
      sockets: building.sockets,
      sections: building.sections,
    },
    surface,
    basePos: [entry, safeGuard],
    spawns: [[entry, extraction], guardPosts],
    flagPos: [entry, objectiveSockets[0]],
    hillPos: objectiveSockets[1] ?? objectiveSockets[0],
    controlPoints: objectiveSockets.slice(0, 3).map((pos, index) => ({ name: `LAB ${index + 1}`, pos })),
    vehiclePads: [],
    pickups,
    props,
    zombieSpawns: spec.site === 'quarantine-zone' ? civilianSpawns : [],
    houses,
    gates: [],
    pads: [],
    propCovered: [...new Set(claims.filter((claim) => grid[claim.idx] === claim.t).map((claim) => claim.idx))],
  };
  const operationGraph = generateScienceOperationGraph({
    seed: spec.seed,
    map,
    building,
    entry,
    extraction,
    objectives: objectiveSockets,
    guardPosts,
    reinforcementPosts,
  });
  const operationIssues = validateScienceOperationGraph(operationGraph);
  if (operationIssues.length) throw new Error(`invalid science operation graph: ${operationIssues.join('; ')}`);
  return { map, building, entry, extraction, objectiveSockets, guardPosts, civilianSpawns, dogPosts, reinforcementPosts, convoyRoute, bounds, operationGraph };
}

function walkableAt(map: GameMap, floor: number, tx: number, tz: number): boolean {
  if (!inBounds(map.geometry, tx, tz)) return false;
  const tile = floorLayer(map, floor)[tileIndex(map.geometry, tx, tz)];
  if (floor === 0) return tile === T_OPEN || tile === T_RUBBLE || tile === T_LADDER
    || (tile >= T_STAIRS_N && tile <= T_STAIRS_W) || isDoorTile(tile);
  return tile === F2_FLOOR || tile === F2_WELL || tile === F2_BALCONY
    || (tile >= F2_STAIR_N && tile <= F2_STAIR_W)
    || tile === F2_DOOR_H || tile === F2_DOOR_V || tile === F2_DOOR_H_OPEN || tile === F2_DOOR_V_OPEN;
}

/** Reachability contract over all authored storeys. Doors are operable,
 * aligned stairs are walked, and ladder wells are explicit vertical links. */
export function scienceMapReachable(layout: ScienceMapLayout): boolean {
  const { map } = layout;
  const [startX, startZ] = worldToTile(layout.entry, map.geometry);
  const area = geometryLength(map.geometry);
  const start = tileIndex(map.geometry, startX, startZ);
  const queue = [start];
  const seen = new Set<number>(queue);
  while (queue.length) {
    const node = queue.shift()!;
    const floor = Math.floor(node / area);
    const tile = node % area;
    const x = tile % map.geometry.cols, z = Math.floor(tile / map.geometry.cols);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      const next = floor * area + tileIndex(map.geometry, nx, nz);
      if (!seen.has(next) && walkableAt(map, floor, nx, nz)) { seen.add(next); queue.push(next); }
    }
    for (const nextFloor of [floor - 1, floor + 1]) {
      if (nextFloor < 0 || nextFloor >= layout.building.floors) continue;
      const world = tileToWorld(x, z, 0, map.geometry);
      const wx = world.x, wz = world.z;
      const ladder = ladderWellAt(map, floor, wx, wz) && ladderWellAt(map, nextFloor, wx, wz);
      const stair = stairDirectionAt(map, floor, wx, wz);
      const other = stairDirectionAt(map, nextFloor, wx, wz);
      if (!ladder && !(stair && other && stair.x === other.x && stair.z === other.z)) continue;
      const next = nextFloor * area + tile;
      if (!seen.has(next) && walkableAt(map, nextFloor, x, z)) { seen.add(next); queue.push(next); }
    }
  }
  return [...layout.objectiveSockets, layout.extraction].every((target) => {
    const [x, z] = worldToTile(target, map.geometry);
    const floor = Math.max(0, Math.min(layout.building.floors - 1, Math.floor(target.y / 4)));
    return seen.has(floor * area + tileIndex(map.geometry, x, z));
  });
}
