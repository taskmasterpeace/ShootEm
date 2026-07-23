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
  type GeospatialDecor,
  type GeospatialMapMeta,
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
import { buildStreetNetwork } from './street-network';
import { deriveNeighborhood, type NeighborhoodLayout } from './neighborhood';
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
  style?: GeospatialMapMeta['style'];
  controlPointNames?: [string, string, string];
}

export interface CompiledGeospatialMap {
  map: GameMap;
  classification: Uint8Array;
  overlay: GameplayOverlayChange[];
  projected: ProjectedGeoSlice;
  neighborhood: NeighborhoodLayout;
  diagnostics: {
    sourceRoads: number;
    sourceBuildings: number;
    playableBuildings: number;
    backgroundBuildings: number;
    roadCells: number;
    streetConnectors: number;
    streetSegments: number;
    sidewalkCells: number;
  };
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

function nearbyWallScore(map: GameMap, center: number, radius = 12): number {
  const cx = center % map.geometry.cols;
  const cz = Math.floor(center / map.geometry.cols);
  let score = 0;
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dz * dz > radius * radius) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (inBounds(map.geometry, x, z) && map.grid[tileIndex(map.geometry, x, z)] === T_WALL) score++;
    }
  }
  return score;
}

function chooseInsetRouteEnds(map: GameMap, route: readonly number[]): [number, number] {
  const { geometry } = map;
  // Routes still span the imported slice for vehicles and theater validation,
  // but combatants deploy one city-block approach inside the sealed GIS rim.
  // Favor authored masonry in the opening camera so the slice immediately
  // reads as a city instead of a featureless road or parking apron.
  const margin = Math.max(6, Math.floor(Math.min(geometry.cols, geometry.rows) / 10));
  const isInset = (index: number) => {
    const x = index % geometry.cols;
    const z = Math.floor(index / geometry.cols);
    return x >= margin && z >= margin && x < geometry.cols - margin && z < geometry.rows - margin;
  };
  const inset = route.filter(isInset);
  if (inset.length < 2) return [route[0], route.at(-1)!];

  const pick = (startFraction: number, endFraction: number, fallback: number): number => {
    const start = Math.floor((route.length - 1) * startFraction);
    const end = Math.ceil((route.length - 1) * endFraction);
    let best = fallback;
    let bestScore = -1;
    for (let cursor = start; cursor <= end; cursor++) {
      const candidate = route[cursor];
      if (!isInset(candidate)) continue;
      const score = nearbyWallScore(map, candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  };

  return [pick(0.16, 0.20, inset[0]), pick(0.76, 0.88, inset.at(-1)!)];
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

function stampPlayableBuildings(
  map: GameMap,
  sourceBuildings: readonly GeoBuilding[],
  projectedBuildings: readonly ProjectedGeoBuilding[],
  cityId: string,
  seed: number,
  roadCells: ReadonlySet<number>,
  accessRoadCells: ReadonlySet<number>,
  overlay: GameplayOverlayChange[],
  limit: number,
): number {
  if (limit <= 0) return 0;
  const candidates = projectedBuildings
    .map((building, index) => ({ building, source: sourceBuildings[index], bounds: boundsOf(building, map.geometry) }))
    .sort((a, b) => b.bounds.area - a.bounds.area || a.building.id.localeCompare(b.building.id));
  const occupied: Array<{ minX: number; minZ: number; maxX: number; maxZ: number }> = [];
  let stamped = 0;
  for (let index = 0; index < candidates.length && stamped < limit; index++) {
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
    const placement = { minX: tx, minZ: tz, maxX: tx + generated.width - 1, maxZ: tz + generated.height - 1 };
    if (occupied.some((other) => placement.minX <= other.maxX && placement.maxX >= other.minX
      && placement.minZ <= other.maxZ && placement.maxZ >= other.minZ)) continue;
    let crossesRoad = false;
    for (let z = placement.minZ; z <= placement.maxZ && !crossesRoad; z++) {
      for (let x = placement.minX; x <= placement.maxX; x++) {
        if (roadCells.has(tileIndex(map.geometry, x, z))) { crossesRoad = true; break; }
      }
    }
    if (crossesRoad) continue;
    const claims: Array<{ idx: number; t: number }> = [];
    const upperLayers = map.upperLayers ?? [map.grid2];
    upperLayers[0] = map.grid2;
    const ctx: StampCtx = {
      geometry: map.geometry,
      grid: map.grid,
      grid2: map.grid2,
      upperLayers,
      props: map.props,
      pickups: map.pickups,
      houses: map.houses,
      claims,
      rng: new Rng(seed ^ 0x6275696c ^ index),
    };
    if (!stampBuilding(ctx, generated.def, tx, tz)) continue;
    occupied.push(placement);
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
    for (const roadIndex of accessRoadCells) {
      const road = tileToWorld(map.geometry, roadIndex % map.geometry.cols, Math.floor(roadIndex / map.geometry.cols));
      const distance = Math.hypot(road.x - start.x, road.z - start.z);
      if (distance < nearestDistance) {
        nearest = roadIndex;
        nearestDistance = distance;
      }
    }
    if (nearest >= 0) {
      const target = tileToWorld(map.geometry, nearest % map.geometry.cols, Math.floor(nearest / map.geometry.cols));
      // Two tiles wide guarantees four-connected approaches even when the
      // nearest source road lies on a diagonal from the generated doorway.
      for (const cell of rasterLine([start, target], map.geometry.tile * 2, map.geometry)) {
        const cellX = cell % map.geometry.cols;
        const cellZ = Math.floor(cell / map.geometry.cols);
        if (cellX >= house.tx && cellX < house.tx + house.tw && cellZ >= house.tz && cellZ < house.tz + house.th) continue;
        if (map.grid[cell] === T_WALL) overlay.push({ index: cell, reason: 'open_flank' });
        map.grid[cell] = T_OPEN;
        map.surface[cell] = S_PLATE;
      }
    }
    stamped++;
  }
  return stamped;
}

function backgroundBuildingHeight(
  sourceBuildings: readonly GeoBuilding[],
  projectedBuildings: readonly ProjectedGeoBuilding[],
  geometry: MapGeometry,
): Uint8Array {
  const result = new Uint8Array(geometryLength(geometry));
  for (let buildingIndex = 0; buildingIndex < projectedBuildings.length; buildingIndex++) {
    const source = sourceBuildings[buildingIndex];
    const storeys = Math.max(1, Math.min(4, Math.round(source.floors ?? ((source.height ?? 4) / 4))));
    for (const index of rasterPolygon(projectedBuildings[buildingIndex].polygon, geometry)) result[index] = storeys;
  }
  return result;
}

function buildDistrictDecor(
  map: GameMap,
  classification: Uint8Array,
  roadCells: ReadonlySet<number>,
  seed: number,
  style: GeospatialMapMeta['style'],
): GeospatialDecor[] {
  if (style !== 'miami-gardens') return [];
  const decor: GeospatialDecor[] = [];
  const rng = new Rng(seed ^ 0x33056);
  const roads = [...roadCells].sort((a, b) => a - b);
  const offsets = [[4, 0], [-4, 0], [0, 4], [0, -4], [5, 0], [0, 5]] as const;
  const baseOffsets = [
    [10, 0], [-10, 0], [0, 10], [0, -10], [8, 7], [-8, 7], [8, -7], [-8, -7],
    [12, 0], [-12, 0], [0, 12], [0, -12],
  ] as const;
  const addBaseLandmark = (baseIndex: number, kind: GeospatialDecor['kind'], skip: number): void => {
    const [bx, bz] = worldToTile(map.geometry, map.basePos[baseIndex].x, map.basePos[baseIndex].z);
    const start = rng.int(0, baseOffsets.length - 1);
    for (let order = 0; order < baseOffsets.length; order++) {
      const [dx, dz] = baseOffsets[(start + order + skip) % baseOffsets.length];
      const tx = bx + dx;
      const tz = bz + dz;
      if (!inBounds(map.geometry, tx, tz)) continue;
      const index = tileIndex(map.geometry, tx, tz);
      if (classification[index] === GEO_CLASS_ROAD || classification[index] === GEO_CLASS_BUILDING
        || classification[index] === GEO_CLASS_WATER) continue;
      if (map.grid[index] !== T_OPEN && map.grid[index] !== T_GRASS) continue;
      const pos = tileToWorld(map.geometry, tx, tz);
      if (decor.some((item) => Math.hypot(item.pos.x - pos.x, item.pos.z - pos.z) < 9)) continue;
      decor.push({
        kind,
        pos,
        scale: kind === 'palm' ? rng.range(0.95, 1.2) : 1,
        rot: rng.range(0, Math.PI * 2),
      });
      return;
    }
  };
  for (let baseIndex = 0; baseIndex < map.basePos.length; baseIndex++) {
    addBaseLandmark(baseIndex, 'palm', 0);
    addBaseLandmark(baseIndex, 'streetlight', 3);
  }
  for (let cursor = 0; cursor < roads.length && decor.length < 72; cursor += 17) {
    const road = roads[cursor];
    const x = road % map.geometry.cols;
    const z = Math.floor(road / map.geometry.cols);
    const start = rng.int(0, offsets.length - 1);
    const ordered = offsets.map((_, index) => offsets[(start + index) % offsets.length]);
    for (const [dx, dz] of ordered) {
      const tx = x + dx;
      const tz = z + dz;
      if (!inBounds(map.geometry, tx, tz)) continue;
      const index = tileIndex(map.geometry, tx, tz);
      if (classification[index] === GEO_CLASS_ROAD || classification[index] === GEO_CLASS_BUILDING
        || classification[index] === GEO_CLASS_WATER) continue;
      if (map.grid[index] !== T_OPEN && map.grid[index] !== T_GRASS) continue;
      const pos = tileToWorld(map.geometry, tx, tz);
      if (map.basePos.some((base) => Math.hypot(base.x - pos.x, base.z - pos.z) < 28)) continue;
      const kind = decor.length % 3 === 1 ? 'streetlight' : 'palm';
      decor.push({ kind, pos, scale: kind === 'palm' ? rng.range(0.85, 1.25) : 1, rot: rng.range(0, Math.PI * 2) });
      break;
    }
  }
  for (const point of map.controlPoints) {
    for (const side of [-1, 1]) {
      decor.push({
        kind: 'barrier',
        pos: { x: point.pos.x, y: point.pos.y, z: point.pos.z + side * map.geometry.tile * 2 },
        scale: 1,
        rot: Math.PI / 2,
      });
    }
  }
  return decor;
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
  const buildingHeight = backgroundBuildingHeight(source.buildings, projected.buildings, geometry);

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

  const streetNetwork = buildStreetNetwork(projected.roads.filter((road) => !road.tunnel), geometry);
  const neighborhood = deriveNeighborhood(projected.buildings, streetNetwork, geometry);
  const roadCells = new Set(streetNetwork.carriagewayCells);
  for (const index of roadCells) {
    classification[index] = GEO_CLASS_ROAD;
    map.grid[index] = T_OPEN;
    map.surface[index] = S_PLATE;
  }
  for (const index of streetNetwork.pedestrianCells) {
    if (!roadCells.has(index)) {
      roadCells.add(index);
      classification[index] = GEO_CLASS_ROAD;
      map.grid[index] = T_OPEN;
      map.surface[index] = S_PLATE;
    }
  }

  const component = streetNetwork.vehicleComponents[0] ?? [];
  if (component.length < Math.max(8, Math.floor(geometry.cols / 4))) {
    throw new Error(`geospatial source has no usable connected road component (${component.length} cells)`);
  }
  const [westRoad, eastRoad] = chooseRoadEnds(component, geometry);
  const routePath = pathWithin(component, westRoad, eastRoad, geometry);
  if (!routePath.length) throw new Error('geospatial road component cannot connect insertion and extraction');

  const terrain = compileTerrain(source.elevation, geometry, source.origin, rotation, roadCells);
  map.height = terrain.height;
  map.ramp = terrain.ramp;

  // Seal uncertain source islands before fitting mission interiors. Door
  // connectors are authored afterwards, so a valid approach can never be
  // mistaken for a disconnected GIS sliver and sealed back into a facade.
  sealUnreachablePockets(map, westRoad, overlay);

  const playableBuildings = stampPlayableBuildings(
    map,
    source.buildings,
    projected.buildings,
    options.cityId,
    options.seed,
    roadCells,
    new Set(component),
    overlay,
    Math.max(0, options.maxPlayableBuildings ?? 4),
  );

  // A parcel may touch a mapped centerline. The route contract wins: keep the
  // selected source component continuously driveable after interior stamping.
  for (const index of routePath) {
    if (map.grid[index] !== T_OPEN) overlay.push({ index, reason: 'armor_clearance' });
    map.grid[index] = T_OPEN;
    map.surface[index] = S_PLATE;
  }

  const [westBaseRoad, eastBaseRoad] = chooseInsetRouteEnds(map, routePath);
  setDiscOpen(map, westBaseRoad, 5, overlay);
  setDiscOpen(map, eastBaseRoad, 5, overlay);
  const west = tileToWorld(geometry, westBaseRoad % geometry.cols, Math.floor(westBaseRoad / geometry.cols));
  const east = tileToWorld(geometry, eastBaseRoad % geometry.cols, Math.floor(eastBaseRoad / geometry.cols));
  map.basePos = [west, east];
  map.flagPos = [{ ...west }, { ...east }];
  map.spawns = [spawnRing(map, westBaseRoad), spawnRing(map, eastBaseRoad)];
  const routeAt = (fraction: number) => routePath[Math.min(routePath.length - 1, Math.floor((routePath.length - 1) * fraction))];
  const controlPointNames = options.controlPointNames ?? ['WEST APPROACH', 'CIVIC CENTER', 'EAST APPROACH'];
  map.controlPoints = controlPointNames.map((name, index) => {
    const routeIndex = routeAt((index + 1) / 4);
    return { name, pos: tileToWorld(geometry, routeIndex % geometry.cols, Math.floor(routeIndex / geometry.cols)) };
  });
  map.hillPos = { ...map.controlPoints[1].pos };
  const routePoints = routePath
    .filter((_, index) => index === 0 || index === routePath.length - 1 || index % 12 === 0)
    .map((index) => tileToWorld(geometry, index % geometry.cols, Math.floor(index / geometry.cols)));
  const footRoadClasses = new Set(['footway', 'path', 'cycleway', 'living_street']);
  const footSource = projected.roads
    .filter((road) => footRoadClasses.has(road.roadClass) && road.points.length >= 2)
    .sort((a, b) => {
      const length = (road: typeof a) => road.points.slice(1).reduce((sum, point, index) =>
        sum + Math.hypot(point.x - road.points[index].x, point.z - road.points[index].z), 0);
      return length(b) - length(a) || a.id.localeCompare(b.id);
    })[0];
  const footRoutePoints = footSource?.points.map((point) => ({ x: point.x, y: 0, z: point.z })) ?? routePoints;
  map.theater = {
    id: 'city',
    name: source.name,
    domains: ['foot', 'ground', 'air'],
    routes: [
      { id: 'geocity:street-spine', domain: 'ground', width: 18, points: routePoints },
      { id: 'geocity:service-route', domain: 'ground', width: 18, points: routePoints.map((point) => ({ ...point })) },
      { id: 'geocity:foot-flank', domain: 'foot', width: 6, points: footRoutePoints },
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
  map.geospatial = {
    sourceId: source.id,
    cityId: options.cityId,
    style: options.style ?? 'default',
    classification,
    buildingHeight,
    decor: buildDistrictDecor(map, classification, roadCells, options.seed, options.style ?? 'default'),
  };

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
    neighborhood,
    diagnostics: {
      sourceRoads: source.roads.length,
      sourceBuildings: source.buildings.length,
      playableBuildings,
      backgroundBuildings: Math.max(0, source.buildings.length - playableBuildings),
      roadCells: roadCells.size,
      streetConnectors: streetNetwork.connectors.length,
      streetSegments: streetNetwork.segments.length,
      sidewalkCells: streetNetwork.sidewalkCells.size,
    },
  };
}
