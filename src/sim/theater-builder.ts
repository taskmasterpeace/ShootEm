import {
  S_DIRT, S_GRASS, S_GRIT, S_PLATE,
  T_DEEP, T_OPEN, T_WALL, T_WATER,
  type GameMap,
} from './map';
import {
  allocateLayer, geometryLength, inBounds, tileIndex, tileToWorld, validateGeometry, worldToTile,
} from './map-geometry';
import { Rng } from './rng';
import type { Team, Vec3, VehicleKind } from './types';
import type { LandingZone, TheaterDef, TheaterDomain, TheaterRoute } from './theater-types';

const SURFACE_BY_THEME = {
  savanna: S_GRASS,
  starship: S_PLATE,
  asteroid: S_GRIT,
  europa: S_GRIT,
  titan: S_GRIT,
  triton: S_DIRT,
  hardpan: S_DIRT,
} as const;

/** Minimum whole-tile corridor for one hull or two opposing hulls to pass. */
export function requiredLaneTiles(maxHullRadius: number, passing: boolean, tile = 3): number {
  const hullWidth = maxHullRadius * 2;
  const clearance = passing ? hullWidth * 2 + 3 : hullWidth + 2;
  return Math.max(1, Math.ceil(clearance / tile));
}

function spawnRing(map: GameMap, center: Vec3): Vec3[] {
  const [cx, cz] = worldToTile(map.geometry, center.x, center.z);
  return Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return tileToWorld(map.geometry, cx + Math.round(Math.cos(angle) * 3), cz + Math.round(Math.sin(angle) * 3));
  });
}

export function createTheaterBase(def: TheaterDef, seed: number): GameMap {
  validateGeometry(def.geometry);
  const geometry = { ...def.geometry };
  const grid = allocateLayer(geometry, T_OPEN);
  const grid2 = allocateLayer(geometry);
  const surface = allocateLayer(geometry, SURFACE_BY_THEME[def.theme]);
  for (let x = 0; x < geometry.cols; x++) {
    grid[tileIndex(geometry, x, 0)] = T_WALL;
    grid[tileIndex(geometry, x, geometry.rows - 1)] = T_WALL;
  }
  for (let z = 0; z < geometry.rows; z++) {
    grid[tileIndex(geometry, 0, z)] = T_WALL;
    grid[tileIndex(geometry, geometry.cols - 1, z)] = T_WALL;
  }
  const midZ = Math.floor(geometry.rows / 2);
  const west = tileToWorld(geometry, 10, midZ);
  const east = tileToWorld(geometry, geometry.cols - 11, midZ);
  const center = tileToWorld(geometry, Math.floor(geometry.cols / 2), midZ);
  const map: GameMap = {
    seed, theme: def.theme, geometry, grid, grid2, surface,
    basePos: [west, east], spawns: [[], []], flagPos: [{ ...west }, { ...east }], hillPos: center,
    controlPoints: [], vehiclePads: [], pickups: [], props: [], zombieSpawns: [], houses: [],
    gates: [], pads: [], propCovered: [],
    theater: {
      id: def.id, name: def.name, domains: [...def.domains], routes: [], landingZones: [],
      deepWater: [], freeDogfight: def.freeDogfight,
    },
  };
  map.spawns = [spawnRing(map, west), spawnRing(map, east)];
  return map;
}

function stampDisc(map: GameMap, pos: Vec3, radius: number, value: number): void {
  const [cx, cz] = worldToTile(map.geometry, pos.x, pos.z);
  const rt = Math.ceil(radius / map.geometry.tile);
  for (let dz = -rt; dz <= rt; dz++) for (let dx = -rt; dx <= rt; dx++) {
    const tx = cx + dx;
    const tz = cz + dz;
    if (!inBounds(map.geometry, tx, tz) || tx === 0 || tz === 0 || tx === map.geometry.cols - 1 || tz === map.geometry.rows - 1) continue;
    const center = tileToWorld(map.geometry, tx, tz);
    if (Math.hypot(center.x - pos.x, center.z - pos.z) <= radius) map.grid[tileIndex(map.geometry, tx, tz)] = value;
  }
}

export function carveRoute(map: GameMap, route: TheaterRoute): void {
  if (!map.theater) throw new Error('theater route requires theater metadata');
  if (route.points.length < 2) throw new Error(`theater ${map.theater.id}: route ${route.id} needs at least two points`);
  if (route.width <= 0) throw new Error(`theater ${map.theater.id}: route ${route.id} width must be positive`);
  if (route.domain !== 'air') {
    const value = route.domain === 'surface' ? T_WATER : route.domain === 'deep' ? T_DEEP : T_OPEN;
    for (let pointIndex = 1; pointIndex < route.points.length; pointIndex++) {
      const a = route.points[pointIndex - 1];
      const b = route.points[pointIndex];
      const distance = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(distance / (map.geometry.tile * 0.5)));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        stampDisc(map, { x: a.x + (b.x - a.x) * t, y: 0, z: a.z + (b.z - a.z) * t }, route.width / 2, value);
      }
    }
  }
  map.theater.routes.push({ ...route, points: route.points.map((point) => ({ ...point })) });
}

const DOMAIN_BY_PAD: Partial<Record<VehicleKind, TheaterDomain>> = {
  strikejet: 'air', interceptor: 'air', bomber: 'air', flyer: 'air', transport: 'air', boat: 'surface',
};

export function placeDomainPad(map: GameMap, kind: VehicleKind, team: Team, pos: Vec3): void {
  const domain = DOMAIN_BY_PAD[kind] ?? 'ground';
  if (!map.theater?.domains.includes(domain)) throw new Error(`theater ${map.theater?.id ?? 'unknown'}: ${kind} requires ${domain}`);
  const [tx, tz] = worldToTile(map.geometry, pos.x, pos.z);
  if (!inBounds(map.geometry, tx, tz)) throw new Error(`theater ${map.theater.id}: ${kind} pad is out of bounds`);
  const terrain = map.grid[tileIndex(map.geometry, tx, tz)];
  if (domain === 'surface' && terrain !== T_WATER && terrain !== T_DEEP) throw new Error(`theater ${map.theater.id}: boat pad requires water`);
  if (domain === 'ground' && terrain !== T_OPEN) throw new Error(`theater ${map.theater.id}: ${kind} pad requires open ground`);
  map.vehiclePads.push({ kind, team, pos: { ...pos } });
}

export function addLandingZone(map: GameMap, zone: LandingZone): void {
  if (!map.theater) throw new Error('landing zone requires theater metadata');
  map.theater.landingZones.push({ ...zone, pos: { ...zone.pos } });
}

export function finalizeTheater(map: GameMap): GameMap {
  const id = map.theater?.id ?? 'unknown';
  const fail = (law: string): never => { throw new Error(`theater ${id} seed ${map.seed}: ${law}`); };
  try { validateGeometry(map.geometry, map.grid, map.grid2, map.surface); } catch (error) { fail((error as Error).message); }
  for (let x = 0; x < map.geometry.cols; x++) {
    if (map.grid[x] === T_OPEN || map.grid[(map.geometry.rows - 1) * map.geometry.cols + x] === T_OPEN) fail('unsealed north/south rim');
  }
  for (let z = 0; z < map.geometry.rows; z++) {
    if (map.grid[z * map.geometry.cols] === T_OPEN || map.grid[z * map.geometry.cols + map.geometry.cols - 1] === T_OPEN) fail('unsealed east/west rim');
  }
  map.propCovered = [...new Set(map.propCovered.filter((index) =>
    index >= 0 && index < geometryLength(map.geometry) && map.grid[index] !== T_OPEN && map.grid[index] !== T_WATER && map.grid[index] !== T_DEEP,
  ))];
  if (map.theater) map.theater.deepWater = [...map.grid.entries()].filter(([, tile]) => tile === T_DEEP).map(([index]) => index);
  return map;
}

export function routePoints(map: GameMap, fractions: Array<[number, number]>): Vec3[] {
  return fractions.map(([x, z]) => tileToWorld(
    map.geometry,
    Math.max(1, Math.min(map.geometry.cols - 2, Math.round(x * (map.geometry.cols - 1)))),
    Math.max(1, Math.min(map.geometry.rows - 2, Math.round(z * (map.geometry.rows - 1)))),
  ));
}

export function seededTheaterRng(map: GameMap): Rng {
  return new Rng(map.seed ^ 0x74686561);
}

export interface TheaterValidation {
  ok: boolean;
  issues: string[];
}

export function routeSpan(_map: GameMap, route: TheaterRoute): number {
  if (!route.points.length) return 0;
  const xs = route.points.map((point) => point.x);
  const zs = route.points.map((point) => point.z);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
}

export function routesConnectBases(map: GameMap, domain: TheaterDomain): boolean {
  const routes = map.theater?.routes.filter((route) => route.domain === domain) ?? [];
  const west = -map.geometry.cols * map.geometry.tile * 0.4;
  const east = map.geometry.cols * map.geometry.tile * 0.4;
  return routes.some((route) => {
    const xs = route.points.map((point) => point.x);
    return xs.length >= 2 && Math.min(...xs) <= west && Math.max(...xs) >= east;
  });
}

export function deepWaterConnected(map: GameMap): boolean {
  const deep = map.grid.map((tile) => tile === T_DEEP ? 1 : 0);
  const start = deep.findIndex((tile) => tile === 1);
  if (start < 0) return false;
  const seen = new Uint8Array(deep.length);
  const queue = [start];
  seen[start] = 1;
  while (queue.length) {
    const index = queue.pop()!;
    const x = index % map.geometry.cols;
    const z = Math.floor(index / map.geometry.cols);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= map.geometry.cols || nz >= map.geometry.rows) continue;
      const next = tileIndex(map.geometry, nx, nz);
      if (deep[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
    }
  }
  return deep.every((tile, index) => tile === 0 || seen[index] === 1);
}

export function heavyVehicleRouteCount(map: GameMap): number {
  const heavyWidth = (requiredLaneTiles(2.4, true, map.geometry.tile) + 3) * map.geometry.tile;
  return map.theater?.routes.filter((route) => route.domain === 'ground' && route.width >= heavyWidth).length ?? 0;
}

function finitePoint(point: Vec3): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}

export function validateTheater(map: GameMap): TheaterValidation {
  const prefix = `${map.theater?.id ?? 'unknown'} seed ${map.seed}`;
  const issues: string[] = [];
  const issue = (law: string) => issues.push(`${prefix}: ${law}`);
  try { validateGeometry(map.geometry, map.grid, map.grid2, map.surface); } catch (error) { issue((error as Error).message); }
  if (!map.theater) issue('missing theater metadata');

  for (let x = 0; x < map.geometry.cols; x++) {
    if (map.grid[x] === T_OPEN || map.grid[(map.geometry.rows - 1) * map.geometry.cols + x] === T_OPEN) { issue('open north/south rim'); break; }
  }
  for (let z = 0; z < map.geometry.rows; z++) {
    if (map.grid[z * map.geometry.cols] === T_OPEN || map.grid[z * map.geometry.cols + map.geometry.cols - 1] === T_OPEN) { issue('open east/west rim'); break; }
  }

  const positions: Vec3[] = [
    ...map.basePos, ...map.flagPos, map.hillPos, ...map.spawns.flat(),
    ...map.controlPoints.map((point) => point.pos), ...map.vehiclePads.map((pad) => pad.pos),
    ...map.pickups.map((pickup) => pickup.pos), ...map.props.map((prop) => prop.pos), ...map.zombieSpawns,
  ];
  if (positions.some((point) => !finitePoint(point))) issue('non-finite map coordinate');
  if (positions.some((point) => {
    const [tx, tz] = worldToTile(map.geometry, point.x, point.z);
    return !inBounds(map.geometry, tx, tz);
  })) issue('map coordinate outside geometry');

  const routeIds = new Set<string>();
  for (const route of map.theater?.routes ?? []) {
    if (routeIds.has(route.id)) issue(`duplicate route id ${route.id}`);
    routeIds.add(route.id);
    if (route.points.length < 2) issue(`route ${route.id} has fewer than two points`);
    if (route.width <= 0 || !Number.isFinite(route.width)) issue(`route ${route.id} has invalid width`);
    if (route.points.some((point) => !finitePoint(point))) issue(`route ${route.id} has non-finite point`);
    if (route.domain === 'ground' && route.width < requiredLaneTiles(2.4, true, map.geometry.tile) * map.geometry.tile) issue(`route ${route.id} is too narrow for opposing heavy hulls`);
    if (route.domain === 'ground' || route.domain === 'surface' || route.domain === 'deep') {
      for (const point of route.points) {
        const [tx, tz] = worldToTile(map.geometry, point.x, point.z);
        if (!inBounds(map.geometry, tx, tz)) { issue(`route ${route.id} leaves the map`); break; }
        const terrain = map.grid[tileIndex(map.geometry, tx, tz)];
        const correct = route.domain === 'ground' ? terrain === T_OPEN
          : route.domain === 'surface' ? terrain === T_WATER || terrain === T_DEEP
          : terrain === T_DEEP;
        if (!correct) { issue(`route ${route.id} is on the wrong surface`); break; }
      }
    }
  }
  if ((map.theater?.domains.includes('ground') ?? false) && !routesConnectBases(map, 'ground')) issue('ground routes do not span opposing sides');
  if ((map.theater?.domains.includes('surface') ?? false) && !routesConnectBases(map, 'surface')) issue('surface routes do not span opposing sides');
  if ((map.theater?.routes.some((route) => route.domain === 'air' && routeSpan(map, route) >= 540) ?? false) === false) issue('no fixed-wing axis spans 540 units');

  for (const pad of map.vehiclePads) {
    const [tx, tz] = worldToTile(map.geometry, pad.pos.x, pad.pos.z);
    if (!inBounds(map.geometry, tx, tz)) { issue(`${pad.kind} pad outside geometry`); continue; }
    const terrain = map.grid[tileIndex(map.geometry, tx, tz)];
    if (pad.kind === 'boat' && terrain !== T_WATER && terrain !== T_DEEP) issue(`boat pad on wrong surface`);
    if (pad.kind !== 'boat' && !['strikejet', 'interceptor', 'bomber', 'flyer', 'transport'].includes(pad.kind) && terrain !== T_OPEN) issue(`${pad.kind} pad on wrong surface`);
  }

  for (const zone of map.theater?.landingZones ?? []) {
    const [tx, tz] = worldToTile(map.geometry, zone.pos.x, zone.pos.z);
    if (!inBounds(map.geometry, tx, tz)) issue(`landing zone ${zone.id} outside geometry`);
    if (!Number.isFinite(zone.radius) || zone.radius < 10) issue(`landing zone ${zone.id} lacks rotor clearance`);
    if (!Number.isFinite(zone.slope) || zone.slope < 0 || zone.slope > 0.12) issue(`landing zone ${zone.id} has invalid slope`);
  }

  if ((map.theater?.domains.includes('deep') ?? false)) {
    const deepCount = map.grid.reduce((count, tile) => count + (tile === T_DEEP ? 1 : 0), 0);
    if (deepCount < 500) issue('deep-water layer is too small');
    if (!deepWaterConnected(map)) issue('deep-water layer is disconnected');
    if (map.theater && (map.theater.deepWater.length !== deepCount || map.theater.deepWater.some((index) => map.grid[index] !== T_DEEP))) issue('deep-water metadata is stale');
  }

  for (const index of map.propCovered) {
    if (index < 0 || index >= map.grid.length || map.grid[index] === T_OPEN || map.grid[index] === T_WATER || map.grid[index] === T_DEEP) { issue(`stale rendered-blocker claim ${index}`); continue; }
    const center = tileToWorld(map.geometry, index % map.geometry.cols, Math.floor(index / map.geometry.cols));
    if (!map.props.some((prop) => Math.hypot(prop.pos.x - center.x, prop.pos.z - center.z) < 1.6 + prop.scale * 1.2)) issue(`rendered-blocker claim ${index} has no prop`);
  }

  return { ok: issues.length === 0, issues };
}
