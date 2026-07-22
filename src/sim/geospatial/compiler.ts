import { generateCityBuilding, type BuildingArchetype } from '../building-generator';
import { stampBuilding, type StampCtx } from '../buildings';
import {
  S_GRASS,
  S_GRIT,
  S_MUD,
  S_PLATE,
  T_DEEP,
  T_GRASS,
  T_OPEN,
  T_WALL,
  T_WATER,
  type GameMap,
} from '../map';
import {
  geometryLength,
  inBounds,
  tileIndex,
  tileToWorld,
  worldToTile,
  type MapGeometry,
} from '../map-geometry';
import { Rng } from '../rng';
import { frontWalkable } from '../fronts';
import { createTheaterBase } from '../theater-builder';
import type { TheaterDef } from '../theater-types';
import type { GameplayOverlayChange } from './artifact';
import { dominantRoadAngle, projectSlice, rasterLine, rasterPolygon } from './geometry';
import { compileTerrain } from './terrain';
import type { GeoBuilding, GeoSliceSource, ProjectedGeoBuilding, ProjectedGeoSlice } from './types';

export const GEO_CLASS_EMPTY = 0;
export const GEO_CLASS_ROAD = 1;
export const GEO_CLASS_WATER = 2;
export const GEO_CLASS_BUILDING = 3;
export const GEO_CLASS_GREEN = 4;

export interface CompileGeospatialOptions {
  seed: number;
  cityId: string;
  geometry?: MapGeometry;
  rotation?: number;
  maxPlayableBuildings?: number;
}

export interface CompiledGeospatialMap {
  map: GameMap;
  classification: Uint8Array;
  overlay: GameplayOverlayChange[];
  projected: ProjectedGeoSlice;
  diagnostics: {
    sourceRoads: number;
    sourceBuildings: number;
    playableBuildings: number;
    backgroundBuildings: number;
    roadCells: number;
  };
}

const ROAD_WIDTHS: Record<string, number> = {
  motorway: 18,
  trunk: 15,
  primary: 12,
  secondary: 10,
  tertiary: 8,
  residential: 6,
  unclassified: 6,
  living_street: 6,
  service: 3,
  track: 3,
  path: 3,
  footway: 3,
  cycleway: 3,
};

const roadWidth = (roadClass: string, hint?: number): number =>
  hint && hint > 0 ? hint : ROAD_WIDTHS[roadClass] ?? 3;

function largestConnectedRoad(cells: ReadonlySet<number>, geometry: MapGeometry): number[] {
  const remaining = new Set(cells);
  let largest: number[] = [];
  while (remaining.size) {
    const start = remaining.values().next().value as number;
    remaining.delete(start);
    const component = [start];
    for (let cursor = 0; cursor < component.length; cursor++) {
      const index = component[cursor];
      const x = index % geometry.cols;
      const z = Math.floor(index / geometry.cols);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inBounds(geometry, nx, nz)) continue;
        const neighbor = tileIndex(geometry, nx, nz);
        if (remaining.delete(neighbor)) component.push(neighbor);
      }
    }
    if (component.length > largest.length) largest = component;
  }
  return largest;
}

function pathWithin(component: readonly number[], start: number, target: number, geometry: MapGeometry): number[] {
  const allowed = new Set(component);
  const previous = new Map<number, number>();
  const queue = [start];
  previous.set(start, -1);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (index === target) break;
    const x = index % geometry.cols;
    const z = Math.floor(index / geometry.cols);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds(geometry, nx, nz)) continue;
      const neighbor = tileIndex(geometry, nx, nz);
      if (allowed.has(neighbor) && !previous.has(neighbor)) {
        previous.set(neighbor, index);
        queue.push(neighbor);
      }
    }
  }
  if (!previous.has(target)) return [];
  const path: number[] = [];
  for (let at = target; at >= 0; at = previous.get(at) ?? -1) path.push(at);
  return path.reverse();
}

function chooseRoadEnds(component: readonly number[], geometry: MapGeometry): [number, number] {
  const margin = Math.min(6, Math.floor(Math.min(geometry.cols, geometry.rows) / 4));
  const staging = component.filter((index) => {
    const x = index % geometry.cols;
    const z = Math.floor(index / geometry.cols);
    return x >= margin && z >= margin && x < geometry.cols - margin && z < geometry.rows - margin;
  });
  const byX = [...(staging.length >= 2 ? staging : component)].sort((a, b) => {
    const ax = a % geometry.cols;
    const bx = b % geometry.cols;
    if (ax !== bx) return ax - bx;
    const center = geometry.rows / 2;
    return Math.abs(Math.floor(a / geometry.cols) - center) - Math.abs(Math.floor(b / geometry.cols) - center);
  });
  return [byX[0], byX.at(-1)!];
}

function setDiscOpen(map: GameMap, center: number, radius: number, overlay: GameplayOverlayChange[]): void {
  const cx = center % map.geometry.cols;
  const cz = Math.floor(center / map.geometry.cols);
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dz * dz > radius * radius) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (!inBounds(map.geometry, x, z) || x === 0 || z === 0 || x === map.geometry.cols - 1 || z === map.geometry.rows - 1) continue;
      const index = tileIndex(map.geometry, x, z);
      if (map.grid[index] !== T_OPEN) overlay.push({ index, reason: 'armor_clearance' });
      map.grid[index] = T_OPEN;
      map.surface[index] = S_PLATE;
    }
  }
}

function spawnRing(map: GameMap, center: number): Array<{ x: number; y: number; z: number }> {
  const cx = center % map.geometry.cols;
  const cz = Math.floor(center / map.geometry.cols);
  return Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return tileToWorld(map.geometry, cx + Math.round(Math.cos(angle) * 3), cz + Math.round(Math.sin(angle) * 3));
  });
}

function boundsOf(building: ProjectedGeoBuilding, geometry: MapGeometry) {
  const xs = building.polygon.map((point) => point.x);
  const zs = building.polygon.map((point) => point.z);
  const [minX, minZ] = worldToTile(geometry, Math.min(...xs), Math.min(...zs));
  const [maxX, maxZ] = worldToTile(geometry, Math.max(...xs), Math.max(...zs));
  return {
    minX: Math.max(2, minX),
    minZ: Math.max(2, minZ),
    maxX: Math.min(geometry.cols - 3, maxX),
    maxZ: Math.min(geometry.rows - 3, maxZ),
    area: Math.max(0, maxX - minX + 1) * Math.max(0, maxZ - minZ + 1),
  };
}

function archetypeFor(building: GeoBuilding): BuildingArchetype {
  const use = building.use?.toLowerCase() ?? '';
  if (/industrial|warehouse|factory|manufacture/.test(use)) return 'workshop';
  if (/commercial|retail|office|hotel/.test(use)) return 'storefront';
  if (/school|civic|hospital|clinic/.test(use)) return 'clinic';
  return 'cottage';
}

function stampPlayableBuilding(
  map: GameMap,
  sourceBuildings: readonly GeoBuilding[],
  projectedBuildings: readonly ProjectedGeoBuilding[],
  cityId: string,
  seed: number,
  roadCells: ReadonlySet<number>,
  overlay: GameplayOverlayChange[],
): number {
  const candidates = projectedBuildings
    .map((building, index) => ({ building, source: sourceBuildings[index], bounds: boundsOf(building, map.geometry) }))
    .sort((a, b) => b.bounds.area - a.bounds.area || a.building.id.localeCompare(b.building.id));
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const floors = Math.max(1, Math.min(3, Math.round(candidate.source.floors ?? ((candidate.source.height ?? 4) / 4)))) as 1 | 2 | 3;
    const generated = generateCityBuilding({
      cityId,
      archetype: archetypeFor(candidate.source),
      seed: seed ^ (index + 1) * 0x45d9f3b,
      floors,
      footprint: 'rectangle',
    });
    const availableWidth = candidate.bounds.maxX - candidate.bounds.minX + 1;
    const availableHeight = candidate.bounds.maxZ - candidate.bounds.minZ + 1;
    if (generated.width > availableWidth || generated.height > availableHeight) continue;
    const tx = candidate.bounds.minX + Math.floor((availableWidth - generated.width) / 2);
    const tz = candidate.bounds.minZ + Math.floor((availableHeight - generated.height) / 2);
    const claims: Array<{ idx: number; t: number }> = [];
    const upperLayers = [map.grid2];
    const ctx: StampCtx = {
      geometry: map.geometry,
      grid: map.grid,
      grid2: map.grid2,
      upperLayers,
      props: map.props,
      pickups: map.pickups,
      houses: map.houses,
      claims,
      rng: new Rng(seed ^ 0x6275696c),
    };
    if (!stampBuilding(ctx, generated.def, tx, tz)) continue;
    if (upperLayers.length > 1 || generated.floors > 1) map.upperLayers = upperLayers;
    map.propCovered.push(...claims.filter((claim) => map.grid[claim.idx] === claim.t).map((claim) => claim.idx));
    map.buildingMeta = {
      ...generated.provenance,
      floors: generated.floors,
      footprint: generated.footprint,
      origin: { tx, tz },
      width: generated.width,
      height: generated.height,
      sockets: generated.sockets,
      sections: generated.sections,
    };
    for (let z = tz; z < tz + generated.height; z++) {
      for (let x = tx; x < tx + generated.width; x++) {
        overlay.push({ index: tileIndex(map.geometry, x, z), reason: 'mission_anchor' });
      }
    }

    const house = map.houses.at(-1)!;
    const start = { x: house.door.x, z: house.door.z + map.geometry.tile };
    let nearest = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const roadIndex of roadCells) {
      const road = tileToWorld(map.geometry, roadIndex % map.geometry.cols, Math.floor(roadIndex / map.geometry.cols));
      const distance = Math.hypot(road.x - start.x, road.z - start.z);
      if (distance < nearestDistance) {
        nearest = roadIndex;
        nearestDistance = distance;
      }
    }
    if (nearest >= 0) {
      const target = tileToWorld(map.geometry, nearest % map.geometry.cols, Math.floor(nearest / map.geometry.cols));
      for (const cell of rasterLine([start, target], map.geometry.tile, map.geometry)) {
        const cellX = cell % map.geometry.cols;
        const cellZ = Math.floor(cell / map.geometry.cols);
        if (cellX >= house.tx && cellX < house.tx + house.tw && cellZ >= house.tz && cellZ < house.tz + house.th) continue;
        if (map.grid[cell] === T_WALL) overlay.push({ index: cell, reason: 'open_flank' });
        map.grid[cell] = T_OPEN;
        map.surface[cell] = S_PLATE;
      }
    }
    return 1;
  }
  return 0;
}

function sealUnreachablePockets(map: GameMap, start: number, overlay: GameplayOverlayChange[]): void {
  const seen = new Uint8Array(map.grid.length);
  const queue = [start];
  seen[start] = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % map.geometry.cols;
    const z = Math.floor(index / map.geometry.cols);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds(map.geometry, nx, nz)) continue;
      const neighbor = tileIndex(map.geometry, nx, nz);
      if (!seen[neighbor] && frontWalkable(map.grid[neighbor])) {
        seen[neighbor] = 1;
        queue.push(neighbor);
      }
    }
  }
  for (let index = 0; index < map.grid.length; index++) {
    if (!seen[index] && frontWalkable(map.grid[index])) {
      map.grid[index] = T_WALL;
      map.surface[index] = S_GRIT;
      overlay.push({ index, reason: 'remove_low_confidence' });
    }
  }
}

export function compileGeospatialMap(
  source: GeoSliceSource,
  options: CompileGeospatialOptions,
): CompiledGeospatialMap {
  if (!source.attribution.length) throw new Error('geospatial source attribution is required');
  const geometry = options.geometry ?? { cols: 300, rows: 300, tile: 3 };
  const rotation = options.rotation ?? dominantRoadAngle(source.roads, source.origin);
  const projected = projectSlice(source, rotation);
  projected.geometry = { ...geometry };
  const def: TheaterDef = {
    id: 'city',
    name: source.name,
    geometry,
    theme: 'titan',
    domains: ['foot', 'ground', 'air'],
    freeDogfight: false,
    defaultPads: ['tank', 'attackheli', 'transportheli'],
  };
  const map = createTheaterBase(def, options.seed);
  map.surface.fill(S_GRIT);
  const classification = new Uint8Array(geometryLength(geometry));
  const overlay: GameplayOverlayChange[] = [];

  for (const feature of projected.land) {
    for (const index of rasterPolygon(feature.polygon, geometry)) {
      classification[index] = GEO_CLASS_GREEN;
      map.grid[index] = T_GRASS;
      map.surface[index] = S_GRASS;
    }
  }

  const buildingCells = new Set<number>();
  for (const building of projected.buildings) {
    for (const index of rasterPolygon(building.polygon, geometry)) {
      buildingCells.add(index);
      classification[index] = GEO_CLASS_BUILDING;
      map.grid[index] = T_WALL;
    }
  }

  const waterCells = new Set<number>();
  for (const feature of projected.water) {
    for (const index of rasterPolygon(feature.polygon, geometry)) waterCells.add(index);
  }
  for (const index of waterCells) {
    const x = index % geometry.cols;
    const z = Math.floor(index / geometry.cols);
    const deep = [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dz]) =>
      waterCells.has(tileIndex(geometry, x + dx, z + dz)));
    classification[index] = GEO_CLASS_WATER;
    map.grid[index] = deep ? T_DEEP : T_WATER;
    map.surface[index] = S_MUD;
  }

  const roadCells = new Set<number>();
  for (const road of projected.roads) {
    if (road.tunnel) continue;
    for (const index of rasterLine(road.points, roadWidth(road.roadClass, road.width), geometry)) {
      roadCells.add(index);
      classification[index] = GEO_CLASS_ROAD;
      map.grid[index] = T_OPEN;
      map.surface[index] = S_PLATE;
    }
  }

  const component = largestConnectedRoad(roadCells, geometry);
  if (component.length < Math.max(8, Math.floor(geometry.cols / 4))) {
    throw new Error(`geospatial source has no usable connected road component (${component.length} cells)`);
  }
  const [westRoad, eastRoad] = chooseRoadEnds(component, geometry);
  const routePath = pathWithin(component, westRoad, eastRoad, geometry);
  if (!routePath.length) throw new Error('geospatial road component cannot connect insertion and extraction');

  const terrain = compileTerrain(source.elevation, geometry, source.origin, rotation, roadCells);
  map.height = terrain.height;
  map.ramp = terrain.ramp;

  const playableBuildings = options.maxPlayableBuildings === 0 ? 0 : stampPlayableBuilding(
    map,
    source.buildings,
    projected.buildings,
    options.cityId,
    options.seed,
    roadCells,
    overlay,
  );

  // A parcel may touch a mapped centerline. The route contract wins: keep the
  // selected source component continuously driveable after interior stamping.
  for (const index of routePath) {
    if (map.grid[index] !== T_OPEN) overlay.push({ index, reason: 'armor_clearance' });
    map.grid[index] = T_OPEN;
    map.surface[index] = S_PLATE;
  }

  setDiscOpen(map, westRoad, 5, overlay);
  setDiscOpen(map, eastRoad, 5, overlay);
  const west = tileToWorld(geometry, westRoad % geometry.cols, Math.floor(westRoad / geometry.cols));
  const east = tileToWorld(geometry, eastRoad % geometry.cols, Math.floor(eastRoad / geometry.cols));
  map.basePos = [west, east];
  map.flagPos = [{ ...west }, { ...east }];
  map.spawns = [spawnRing(map, westRoad), spawnRing(map, eastRoad)];
  const routeAt = (fraction: number) => routePath[Math.min(routePath.length - 1, Math.floor((routePath.length - 1) * fraction))];
  map.controlPoints = [
    { name: 'POTRERO WEST', pos: tileToWorld(geometry, routeAt(0.25) % geometry.cols, Math.floor(routeAt(0.25) / geometry.cols)) },
    { name: 'DOGPATCH', pos: tileToWorld(geometry, routeAt(0.5) % geometry.cols, Math.floor(routeAt(0.5) / geometry.cols)) },
    { name: 'INDUSTRIAL EAST', pos: tileToWorld(geometry, routeAt(0.75) % geometry.cols, Math.floor(routeAt(0.75) / geometry.cols)) },
  ];
  map.hillPos = { ...map.controlPoints[1].pos };
  const routePoints = routePath
    .filter((_, index) => index === 0 || index === routePath.length - 1 || index % 12 === 0)
    .map((index) => tileToWorld(geometry, index % geometry.cols, Math.floor(index / geometry.cols)));
  map.theater = {
    id: 'city',
    name: source.name,
    domains: ['foot', 'ground', 'air'],
    routes: [
      { id: 'geocity:street-spine', domain: 'ground', width: 18, points: routePoints },
      { id: 'geocity:air-corridor', domain: 'air', width: 90, points: [{ ...west }, { ...east }] },
    ],
    landingZones: [
      { id: 'geocity:west-lz', pos: { ...west }, radius: 15, slope: 0.08, side: 0 },
      { id: 'geocity:east-lz', pos: { ...east }, radius: 15, slope: 0.08, side: 1 },
    ],
    deepWater: [...waterCells].filter((index) => map.grid[index] === T_DEEP),
    freeDogfight: false,
  };
  map.vehiclePads = [
    { kind: 'tank', team: 0, pos: { ...west } },
    { kind: 'tank', team: 1, pos: { ...east } },
    { kind: 'attackheli', team: 0, pos: { ...west } },
    { kind: 'attackheli', team: 1, pos: { ...east } },
    { kind: 'transportheli', team: 0, pos: { ...west } },
    { kind: 'transportheli', team: 1, pos: { ...east } },
  ];

  sealUnreachablePockets(map, westRoad, overlay);

  for (let x = 0; x < geometry.cols; x++) {
    map.grid[tileIndex(geometry, x, 0)] = T_WALL;
    map.grid[tileIndex(geometry, x, geometry.rows - 1)] = T_WALL;
  }
  for (let z = 0; z < geometry.rows; z++) {
    map.grid[tileIndex(geometry, 0, z)] = T_WALL;
    map.grid[tileIndex(geometry, geometry.cols - 1, z)] = T_WALL;
  }
  map.propCovered = [...new Set(map.propCovered)];

  return {
    map,
    classification,
    overlay,
    projected,
    diagnostics: {
      sourceRoads: source.roads.length,
      sourceBuildings: source.buildings.length,
      playableBuildings,
      backgroundBuildings: Math.max(0, source.buildings.length - playableBuildings),
      roadCells: roadCells.size,
    },
  };
}
