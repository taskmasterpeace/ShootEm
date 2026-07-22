import { BUILDINGS, stampBuilding, type StampCtx } from '../buildings';
import { T_COVER, T_GRASS, T_OPEN, T_WALL, type GameMap, type PropSpec } from '../map';
import { inBounds, tileIndex, tileToWorld } from '../map-geometry';
import {
  addLandingZone, carveRoute, createTheaterBase, finalizeTheater, placeDomainPad,
  requiredLaneTiles, routePoints, seededTheaterRng, stageRotorcraftPads,
} from '../theater-builder';
import type { TheaterDef } from '../theater-types';

const MAX_HULL_RADIUS = 2.4;
const laneWidth = (map: GameMap, passing = true, extraTiles = 0) =>
  (requiredLaneTiles(MAX_HULL_RADIUS, passing, map.geometry.tile) + extraTiles) * map.geometry.tile;

function setTile(map: GameMap, x: number, z: number, tile: number): void {
  if (x <= 0 || z <= 0 || x >= map.geometry.cols - 1 || z >= map.geometry.rows - 1) return;
  map.grid[tileIndex(map.geometry, x, z)] = tile;
}

function stampRect(map: GameMap, x0: number, z0: number, width: number, height: number, tile: number): void {
  for (let z = z0; z < z0 + height; z++) for (let x = x0; x < x0 + width; x++) setTile(map, x, z, tile);
}

function buildingCtx(map: GameMap, seed: number): StampCtx & { claims: Array<{ idx: number; t: number }> } {
  return {
    geometry: map.geometry, grid: map.grid, grid2: map.grid2, props: map.props,
    pickups: map.pickups, houses: map.houses, claims: [], rng: seededTheaterRng({ ...map, seed }),
  };
}

function settleClaims(map: GameMap, claims: Array<{ idx: number; t: number }>): void {
  map.propCovered = [...new Set([
    ...map.propCovered,
    ...claims.filter((claim) => map.grid[claim.idx] === claim.t).map((claim) => claim.idx),
  ])];
}

function addProp(map: GameMap, type: PropSpec['type'], tx: number, tz: number, scale: number, rot: number, blocker?: number): void {
  if (!inBounds(map.geometry, tx, tz) || tx === 0 || tz === 0 || tx === map.geometry.cols - 1 || tz === map.geometry.rows - 1) return;
  map.props.push({ type, pos: tileToWorld(map.geometry, tx, tz), scale, rot });
  if (blocker !== undefined) {
    const idx = tileIndex(map.geometry, tx, tz);
    map.grid[idx] = blocker;
    map.propCovered.push(idx);
  }
}

export function generateCityTheater(def: TheaterDef, seed: number): GameMap {
  const map = createTheaterBase(def, seed);
  const rng = seededTheaterRng(map);
  const ctx = buildingCtx(map, seed ^ 0x63697479);
  const cityDefs = BUILDINGS.filter((building) => ['rowhouse', 'villa', 'warehouse', 'machine_shop', 'garage', 'guard_post'].includes(building.id));
  const count = rng.int(16, 24);
  const plots: Array<[number, number]> = [];
  for (const z of [18, 42, 68, 118, 144, 170]) for (const x of [18, 48, 122, 154]) plots.push([x, z]);
  for (let i = 0; i < count && plots.length; i++) {
    const pick = rng.int(0, plots.length - 1);
    const [tx, tz] = plots.splice(pick, 1)[0];
    stampBuilding(ctx, cityDefs[rng.int(0, cityDefs.length - 1)], tx + rng.int(-2, 2), tz + rng.int(-2, 2), i * 2);
  }
  const avenue = laneWidth(map, true, 4);
  const freight = laneWidth(map, true, 4);
  const bypass = laneWidth(map, true, 1);
  carveRoute(map, { id: 'city:grand-avenue', domain: 'ground', width: avenue, points: routePoints(map, [[0.03, 0.5], [0.32, 0.5], [0.68, 0.5], [0.97, 0.5]]) });
  carveRoute(map, { id: 'city:freight-spine', domain: 'ground', width: freight, points: routePoints(map, [[0.03, 0.68], [0.35, 0.62], [0.68, 0.38], [0.97, 0.32]]) });
  carveRoute(map, { id: 'city:ring-bypass', domain: 'ground', width: bypass, points: routePoints(map, [[0.03, 0.25], [0.3, 0.18], [0.7, 0.18], [0.97, 0.25]]) });
  carveRoute(map, { id: 'city:air-west', domain: 'air', width: 90, points: routePoints(map, [[0.01, 0.15], [0.3, 0.12], [0.7, 0.12], [0.99, 0.15]]) });
  carveRoute(map, { id: 'city:air-east', domain: 'air', width: 90, points: routePoints(map, [[0.01, 0.85], [0.3, 0.88], [0.7, 0.88], [0.99, 0.85]]) });
  map.controlPoints = [
    { name: 'DOWNTOWN', pos: routePoints(map, [[0.5, 0.5]])[0] },
    { name: 'RAIL YARD', pos: routePoints(map, [[0.67, 0.36]])[0] },
    { name: 'RESIDENTIAL', pos: routePoints(map, [[0.3, 0.22]])[0] },
  ];
  addLandingZone(map, { id: 'city:west-rooftop', pos: routePoints(map, [[0.2, 0.12]])[0], radius: 15, slope: 0, side: 0 });
  addLandingZone(map, { id: 'city:east-rooftop', pos: routePoints(map, [[0.8, 0.88]])[0], radius: 15, slope: 0, side: 1 });
  placeDomainPad(map, 'tank', 0, routePoints(map, [[0.08, 0.5]])[0]);
  placeDomainPad(map, 'tank', 1, routePoints(map, [[0.92, 0.5]])[0]);
  settleClaims(map, ctx.claims);
  stageRotorcraftPads(map);
  return finalizeTheater(map);
}

export function generateDesertTheater(def: TheaterDef, seed: number): GameMap {
  const map = createTheaterBase(def, seed);
  const rng = seededTheaterRng(map);
  const ctx = buildingCtx(map, seed ^ 0x64756e65);
  // Long dune/rock bands make masked approaches without uniform noise.
  for (let band = 0; band < 14; band++) {
    const z0 = 20 + band * 18 + rng.int(-4, 4);
    const x0 = rng.int(18, 90);
    const length = rng.int(55, 125);
    for (let x = x0; x < Math.min(map.geometry.cols - 2, x0 + length); x += 2) {
      const z = z0 + Math.round(Math.sin(x * 0.09 + band) * 3);
      setTile(map, x, z, band % 3 === 0 ? T_WALL : T_COVER);
      if (band % 4 === 0) addProp(map, 'rock', x, z, 0.8 + rng.next() * 0.7, rng.range(0, Math.PI));
    }
  }
  const compoundDefs = BUILDINGS.filter((building) => ['bunker', 'guard_post', 'barracks_hall'].includes(building.id));
  const compounds = rng.int(2, 4);
  for (let i = 0; i < compounds; i++) {
    const tx = 75 + i * Math.floor(145 / Math.max(1, compounds - 1)) + rng.int(-5, 5);
    const tz = i % 2 === 0 ? 70 + rng.int(-8, 8) : 220 + rng.int(-8, 8);
    stampBuilding(ctx, compoundDefs[i % compoundDefs.length], tx, tz, i * 2);
  }
  const armorWidth = laneWidth(map, true, 2);
  carveRoute(map, { id: 'desert:northwest-axis', domain: 'ground', width: armorWidth, points: routePoints(map, [[0.03, 0.5], [0.28, 0.3], [0.68, 0.35], [0.97, 0.5]]) });
  carveRoute(map, { id: 'desert:southeast-axis', domain: 'ground', width: armorWidth, points: routePoints(map, [[0.03, 0.5], [0.3, 0.7], [0.7, 0.65], [0.97, 0.5]]) });
  carveRoute(map, { id: 'desert:wadi', domain: 'ground', width: laneWidth(map, true), points: routePoints(map, [[0.03, 0.5], [0.28, 0.52], [0.72, 0.48], [0.97, 0.5]]) });
  carveRoute(map, { id: 'desert:high-loop', domain: 'air', width: 120, points: routePoints(map, [[0.01, 0.08], [0.35, 0.03], [0.7, 0.06], [0.99, 0.12], [0.7, 0.94], [0.3, 0.96], [0.01, 0.9]]) });
  carveRoute(map, { id: 'desert:low-loop', domain: 'air', width: 75, points: routePoints(map, [[0.01, 0.3], [0.32, 0.4], [0.68, 0.6], [0.99, 0.7]]) });
  map.controlPoints = [
    { name: 'WADI CROSSING', pos: routePoints(map, [[0.5, 0.5]])[0] },
    { name: 'DUNE FORT', pos: routePoints(map, [[0.3, 0.3]])[0] },
    { name: 'SALT WORKS', pos: routePoints(map, [[0.7, 0.68]])[0] },
  ];
  for (const [index, fraction] of [[0, [0.18, 0.2]], [1, [0.82, 0.8]], [2, [0.5, 0.25]]] as const) {
    const pos = routePoints(map, [fraction as [number, number]])[0];
    addLandingZone(map, { id: `desert:lz-${index}`, pos, radius: 24, slope: 0.02, side: index < 2 ? index as 0 | 1 : null });
  }
  placeDomainPad(map, 'tank', 0, routePoints(map, [[0.08, 0.5]])[0]);
  placeDomainPad(map, 'tank', 1, routePoints(map, [[0.92, 0.5]])[0]);
  settleClaims(map, ctx.claims);
  stageRotorcraftPads(map);
  return finalizeTheater(map);
}

export function generateCountrysideTheater(def: TheaterDef, seed: number): GameMap {
  const map = createTheaterBase(def, seed);
  const rng = seededTheaterRng(map);
  // Field rectangles and hedges: gates are carved by the roads afterward.
  for (let z = 22; z < map.geometry.rows - 22; z += 34) {
    for (let x = 24; x < map.geometry.cols - 24; x += 42) {
      const w = rng.int(20, 31), h = rng.int(14, 24);
      for (let xx = x; xx <= Math.min(map.geometry.cols - 2, x + w); xx++) {
        setTile(map, xx, z, T_COVER); setTile(map, xx, Math.min(map.geometry.rows - 2, z + h), T_COVER);
      }
      for (let zz = z; zz <= Math.min(map.geometry.rows - 2, z + h); zz++) {
        setTile(map, x, zz, T_COVER); setTile(map, Math.min(map.geometry.cols - 2, x + w), zz, T_COVER);
      }
      if ((x + z) % 3 === 0) stampRect(map, x + 3, z + 3, Math.max(2, w - 6), Math.max(2, h - 6), T_GRASS);
      // Every hedged field has opposing tractor gates. Besides being readable
      // vehicle access, this prevents decorative crop plots becoming sealed
      // infantry islands under the shared map reachability law.
      const gateX = x + Math.floor(w / 2);
      for (let dx = -1; dx <= 1; dx++) {
        setTile(map, gateX + dx, z, T_OPEN);
        setTile(map, gateX + dx, Math.min(map.geometry.rows - 2, z + h), T_OPEN);
      }
    }
  }
  // Two dense woodlots sit outside the three vehicle corridors.
  for (const [x0, z0] of [[72, 24], [178, 246]] as const) {
    for (let i = 0; i < 52; i++) {
      const tx = x0 + rng.int(0, 42), tz = z0 + rng.int(0, 28);
      addProp(map, 'tree', tx, tz, 0.85 + rng.next() * 0.55, rng.range(0, Math.PI), T_WALL);
    }
  }
  const ctx = buildingCtx(map, seed ^ 0x6661726d);
  const villageDefs = BUILDINGS.filter((building) => ['farmhouse', 'barn', 'villa', 'garage'].includes(building.id));
  const villages = rng.int(3, 5);
  for (let i = 0; i < villages; i++) {
    const tx = 45 + i * Math.floor(205 / Math.max(1, villages - 1));
    const tz = i % 2 === 0 ? 82 + rng.int(-8, 8) : 190 + rng.int(-8, 8);
    stampBuilding(ctx, villageDefs[i % villageDefs.length], tx, tz, i * 2);
  }
  carveRoute(map, { id: 'countryside:trunk-road', domain: 'ground', width: laneWidth(map, true, 2), points: routePoints(map, [[0.03, 0.5], [0.25, 0.36], [0.5, 0.62], [0.75, 0.4], [0.97, 0.5]]) });
  carveRoute(map, { id: 'countryside:north-track', domain: 'ground', width: laneWidth(map, true), points: routePoints(map, [[0.03, 0.5], [0.28, 0.25], [0.7, 0.22], [0.97, 0.5]]) });
  carveRoute(map, { id: 'countryside:south-track', domain: 'ground', width: laneWidth(map, true), points: routePoints(map, [[0.03, 0.5], [0.3, 0.76], [0.72, 0.78], [0.97, 0.5]]) });
  carveRoute(map, { id: 'countryside:air-axis', domain: 'air', width: 120, points: routePoints(map, [[0.01, 0.08], [0.33, 0.18], [0.66, 0.82], [0.99, 0.92]]) });
  map.controlPoints = [
    { name: 'WEST VILLAGE', pos: routePoints(map, [[0.3, 0.36]])[0] },
    { name: 'CROSSROADS', pos: routePoints(map, [[0.5, 0.62]])[0] },
    { name: 'EAST FARM', pos: routePoints(map, [[0.72, 0.4]])[0] },
  ];
  const zones: Array<[string, number, number, 0 | 1 | null]> = [
    ['west-rear', 0.12, 0.2, 0], ['west-front', 0.35, 0.7, 0],
    ['center-north', 0.5, 0.18, null], ['center-south', 0.5, 0.82, null],
    ['east-front', 0.65, 0.3, 1], ['east-rear', 0.88, 0.8, 1],
  ];
  for (const [id, x, z, side] of zones) addLandingZone(map, { id: `countryside:${id}`, pos: routePoints(map, [[x, z]])[0], radius: 24, slope: 0.01, side });
  placeDomainPad(map, 'apc', 0, routePoints(map, [[0.08, 0.5]])[0]);
  placeDomainPad(map, 'apc', 1, routePoints(map, [[0.92, 0.5]])[0]);
  settleClaims(map, ctx.claims);
  stageRotorcraftPads(map);
  return finalizeTheater(map);
}
