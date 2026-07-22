import { T_DEEP, T_METAL, T_OPEN, T_WATER, type GameMap } from '../map';
import { inBounds, tileIndex, tileToWorld } from '../map-geometry';
import {
  addLandingZone, carveRoute, createTheaterBase, finalizeTheater, placeDomainPad,
  requiredLaneTiles, routePoints, seededTheaterRng, stageRotorcraftPads, stageSubmarinePads,
} from '../theater-builder';
import type { TheaterDef } from '../theater-types';

const MAX_HULL_RADIUS = 2.4;
const laneWidth = (map: GameMap, extraTiles = 0) =>
  (requiredLaneTiles(MAX_HULL_RADIUS, true, map.geometry.tile) + extraTiles) * map.geometry.tile;

function setTile(map: GameMap, tx: number, tz: number, value: number): void {
  if (!inBounds(map.geometry, tx, tz) || tx === 0 || tz === 0 || tx === map.geometry.cols - 1 || tz === map.geometry.rows - 1) return;
  map.grid[tileIndex(map.geometry, tx, tz)] = value;
}

function fillRect(map: GameMap, x0: number, z0: number, x1: number, z1: number, value: number): void {
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) setTile(map, x, z, value);
}

function fillDisc(map: GameMap, cx: number, cz: number, radius: number, value: number): void {
  for (let z = cz - radius; z <= cz + radius; z++) for (let x = cx - radius; x <= cx + radius; x++) {
    if ((x - cx) ** 2 + (z - cz) ** 2 <= radius ** 2) setTile(map, x, z, value);
  }
}

function moveBase(map: GameMap, team: 0 | 1, tx: number, tz: number): void {
  const pos = tileToWorld(map.geometry, tx, tz);
  map.basePos[team] = pos;
  map.flagPos[team] = { ...pos };
  map.spawns[team] = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return tileToWorld(map.geometry, tx + Math.round(Math.cos(angle) * 3), tz + Math.round(Math.sin(angle) * 3));
  });
}

function sealMountainPockets(map: GameMap): void {
  const [sx, sz] = [10, Math.floor(map.geometry.rows / 2)];
  const seen = new Uint8Array(map.grid.length);
  const queue = [tileIndex(map.geometry, sx, sz)];
  seen[queue[0]] = 1;
  while (queue.length) {
    const index = queue.pop()!;
    const x = index % map.geometry.cols;
    const z = Math.floor(index / map.geometry.cols);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (!inBounds(map.geometry, nx, nz)) continue;
      const next = tileIndex(map.geometry, nx, nz);
      if (!seen[next] && map.grid[next] === T_OPEN) { seen[next] = 1; queue.push(next); }
    }
  }
  // Noise at overlapping massif edges can leave one-cell caves that have no
  // entrance and no gameplay. Make them solid mountain instead of orphaned
  // walkable terrain.
  for (let index = 0; index < map.grid.length; index++) {
    if (map.grid[index] === T_OPEN && !seen[index]) map.grid[index] = T_METAL;
  }
}

export function generateMountainTheater(def: TheaterDef, seed: number): GameMap {
  const map = createTheaterBase(def, seed);
  const rng = seededTheaterRng(map);
  // Alternating massifs form three readable north/south choices.
  for (const [cx, cz, rx, rz] of [[48, 68, 31, 48], [145, 104, 30, 55], [55, 205, 34, 58], [146, 245, 32, 42]] as const) {
    for (let z = cz - rz; z <= cz + rz; z++) for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x - cx) / rx, nz = (z - cz) / rz;
      if (nx * nx + nz * nz <= 1 + rng.next() * 0.05) setTile(map, x, z, T_METAL);
    }
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const tx = Math.round(cx + Math.cos(angle) * rx * 0.9);
      const tz = Math.round(cz + Math.sin(angle) * rz * 0.9);
      if (!inBounds(map.geometry, tx, tz)) continue;
      const idx = tileIndex(map.geometry, tx, tz);
      map.grid[idx] = T_METAL;
      map.props.push({ type: 'rock', pos: tileToWorld(map.geometry, tx, tz), scale: 1.2 + rng.next() * 1.1, rot: rng.range(0, Math.PI) });
      map.propCovered.push(idx);
    }
  }
  carveRoute(map, { id: 'mountain:pass', domain: 'ground', width: laneWidth(map, 4), points: routePoints(map, [[0.03, 0.5], [0.28, 0.42], [0.7, 0.55], [0.97, 0.5]]) });
  carveRoute(map, { id: 'mountain:ridge', domain: 'ground', width: laneWidth(map, 1), points: routePoints(map, [[0.03, 0.5], [0.3, 0.2], [0.72, 0.18], [0.97, 0.5]]) });
  carveRoute(map, { id: 'mountain:valley', domain: 'ground', width: laneWidth(map, 2), points: routePoints(map, [[0.03, 0.5], [0.32, 0.78], [0.68, 0.82], [0.97, 0.5]]) });
  carveRoute(map, { id: 'mountain:north-south-air', domain: 'air', width: 105, points: routePoints(map, [[0.5, 0.01], [0.42, 0.33], [0.58, 0.67], [0.5, 0.99]]) });
  sealMountainPockets(map);
  map.controlPoints = [
    { name: 'HIGH PASS', pos: routePoints(map, [[0.5, 0.5]])[0] },
    { name: 'RIDGE BATTERY', pos: routePoints(map, [[0.65, 0.18]])[0] },
    { name: 'VALLEY DEPOT', pos: routePoints(map, [[0.35, 0.8]])[0] },
  ];
  const zones: Array<[string, number, number, 0 | 1 | null]> = [
    ['west-shelf', 0.16, 0.32, 0], ['east-shelf', 0.84, 0.68, 1],
    ['north-saddle', 0.5, 0.13, null], ['south-saddle', 0.5, 0.87, null],
  ];
  for (const [id, x, z, side] of zones) addLandingZone(map, { id: `mountain:${id}`, pos: routePoints(map, [[x, z]])[0], radius: 18, slope: 0.08, side });
  placeDomainPad(map, 'aatrack', 0, routePoints(map, [[0.3, 0.2]])[0]);
  placeDomainPad(map, 'aatrack', 1, routePoints(map, [[0.7, 0.8]])[0]);
  stageRotorcraftPads(map);
  return finalizeTheater(map);
}

export function generateCoastalTheater(def: TheaterDef, seed: number): GameMap {
  const map = createTheaterBase(def, seed);
  const shore = Math.floor(map.geometry.rows * 0.55);
  fillRect(map, 1, shore, map.geometry.cols - 2, map.geometry.rows - 2, T_WATER);
  fillRect(map, 1, shore + 16, map.geometry.cols - 2, map.geometry.rows - 2, T_DEEP);
  moveBase(map, 0, 10, shore - 18);
  moveBase(map, 1, map.geometry.cols - 11, shore - 18);
  carveRoute(map, { id: 'coastal:inland-highway', domain: 'ground', width: laneWidth(map, 3), points: routePoints(map, [[0.03, 0.42], [0.3, 0.35], [0.7, 0.35], [0.97, 0.42]]) });
  carveRoute(map, { id: 'coastal:cliff-road', domain: 'ground', width: laneWidth(map), points: routePoints(map, [[0.03, 0.42], [0.3, 0.22], [0.7, 0.22], [0.97, 0.42]]) });
  carveRoute(map, { id: 'coastal:port-road', domain: 'ground', width: laneWidth(map, 1), points: routePoints(map, [[0.03, 0.42], [0.35, 0.5], [0.65, 0.5], [0.97, 0.42]]) });
  carveRoute(map, { id: 'coastal:convoy-lane', domain: 'surface', width: 33, points: routePoints(map, [[0.03, 0.72], [0.32, 0.68], [0.7, 0.68], [0.97, 0.72]]) });
  carveRoute(map, { id: 'coastal:offshore-route', domain: 'surface', width: 42, points: routePoints(map, [[0.03, 0.9], [0.32, 0.84], [0.68, 0.84], [0.97, 0.9]]) });
  carveRoute(map, { id: 'coastal:deep-patrol', domain: 'deep', width: 30, points: routePoints(map, [[0.03, 0.82], [0.35, 0.78], [0.65, 0.78], [0.97, 0.82]]) });
  carveRoute(map, { id: 'coastal:air-axis', domain: 'air', width: 120, points: routePoints(map, [[0.01, 0.08], [0.33, 0.2], [0.66, 0.8], [0.99, 0.92]]) });
  map.controlPoints = [
    { name: 'PORT', pos: routePoints(map, [[0.5, 0.52]])[0] },
    { name: 'CLIFF BATTERY', pos: routePoints(map, [[0.5, 0.22]])[0] },
    { name: 'BEACHHEAD', pos: routePoints(map, [[0.72, 0.58]])[0] },
  ];
  for (const [id, x, side] of [['west-beach', 0.22, 0], ['east-beach', 0.78, 1], ['port', 0.5, null]] as const) {
    addLandingZone(map, { id: `coastal:${id}`, pos: routePoints(map, [[x, 0.48]])[0], radius: 21, slope: 0.02, side });
  }
  placeDomainPad(map, 'boat', 0, routePoints(map, [[0.1, 0.72]])[0]);
  placeDomainPad(map, 'boat', 1, routePoints(map, [[0.9, 0.72]])[0]);
  placeDomainPad(map, 'tank', 0, routePoints(map, [[0.08, 0.42]])[0]);
  placeDomainPad(map, 'tank', 1, routePoints(map, [[0.92, 0.42]])[0]);
  stageRotorcraftPads(map);
  stageSubmarinePads(map);
  return finalizeTheater(map);
}

export function generateOceanTheater(def: TheaterDef, seed: number): GameMap {
  const map = createTheaterBase(def, seed);
  const rng = seededTheaterRng(map);
  fillRect(map, 1, 1, map.geometry.cols - 2, map.geometry.rows - 2, T_DEEP);
  const islands: Array<[number, number, number]> = [
    [24, 150, 14], [275, 150, 14], [150, 150, 18],
  ];
  const extras = rng.int(0, 3);
  for (let i = 0; i < extras; i++) islands.push([rng.int(70, 230), rng.int(55, 245), rng.int(7, 12)]);
  for (const [cx, cz, radius] of islands) {
    fillDisc(map, cx, cz, radius + 3, T_WATER);
    fillDisc(map, cx, cz, radius, T_OPEN);
  }
  moveBase(map, 0, 24, 150);
  moveBase(map, 1, 275, 150);
  carveRoute(map, { id: 'ocean:north-convoy', domain: 'surface', width: 36, points: routePoints(map, [[0.04, 0.42], [0.32, 0.32], [0.68, 0.32], [0.96, 0.42]]) });
  carveRoute(map, { id: 'ocean:south-convoy', domain: 'surface', width: 36, points: routePoints(map, [[0.04, 0.58], [0.32, 0.68], [0.68, 0.68], [0.96, 0.58]]) });
  carveRoute(map, { id: 'ocean:west-patrol', domain: 'deep', width: 30, points: routePoints(map, [[0.08, 0.15], [0.32, 0.08], [0.38, 0.5], [0.32, 0.92], [0.08, 0.85]]) });
  carveRoute(map, { id: 'ocean:east-patrol', domain: 'deep', width: 30, points: routePoints(map, [[0.92, 0.15], [0.68, 0.08], [0.62, 0.5], [0.68, 0.92], [0.92, 0.85]]) });
  carveRoute(map, { id: 'ocean:air-box', domain: 'air', width: 150, points: routePoints(map, [[0.01, 0.08], [0.99, 0.08], [0.99, 0.92], [0.01, 0.92]]) });
  map.controlPoints = islands.map(([cx, cz], index) => ({ name: index === 0 ? 'WEST PORT' : index === 1 ? 'EAST PORT' : `ISLAND ${index - 1}`, pos: tileToWorld(map.geometry, cx, cz) }));
  islands.forEach(([cx, cz, radius], index) => addLandingZone(map, {
    id: `ocean:island-${index}`, pos: tileToWorld(map.geometry, cx, cz), radius: Math.max(12, radius * map.geometry.tile * 0.5), slope: 0, side: index === 0 ? 0 : index === 1 ? 1 : null,
  }));
  placeDomainPad(map, 'boat', 0, routePoints(map, [[0.09, 0.42]])[0]);
  placeDomainPad(map, 'boat', 1, routePoints(map, [[0.91, 0.42]])[0]);
  stageSubmarinePads(map);
  return finalizeTheater(map);
}
