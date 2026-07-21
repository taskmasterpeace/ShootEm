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
  map.propCovered = [...new Set(map.propCovered.filter((index) => index >= 0 && index < geometryLength(map.geometry)))];
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
