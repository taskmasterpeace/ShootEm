import {
  GRID,
  TILE,
  T_METAL_DOOR,
  WORLD,
  doorIsOpen,
  houseAt,
  isDoorTile,
  type GameMap,
} from './map';
import { floorLayer } from './map-layers';
import type { K9Command, Soldier, Team, Vec3 } from './types';
import type { World } from './world';

export const K9_BUILDING_SNAP = 8;

export type K9CommandResult =
  | { ok: true; dog: Soldier }
  | { ok: false; reason: 'no-dog' | 'dog-down' | 'no-building' };

export function ownedDog(soldiers: Iterable<Soldier>, handlerId: number): Soldier | undefined {
  for (const soldier of soldiers) {
    if (soldier.kind === 'dog' && soldier.ownerId === handlerId) return soldier;
  }
  return undefined;
}

/** One K9 per side; the local eligible soldier gets first refusal offline. */
export function k9HandlerForTeam(
  soldiers: Iterable<Soldier>, team: Team, preferredId = -1,
): Soldier | undefined {
  const eligible = [...soldiers].filter((soldier) =>
    soldier.alive && soldier.team === team
    && (soldier.kind === 'human' || soldier.kind === 'bot')
    && (soldier.classId === 'infantry' || soldier.classId === 'engineer'),
  );
  return eligible.find((soldier) => soldier.id === preferredId) ?? eligible.find((soldier) => soldier.kind === 'bot') ?? eligible[0];
}

export function k9AimPoint(pos: Vec3, yaw: number, distance: number): Vec3 {
  const d = Number.isFinite(distance) ? Math.max(0, Math.min(80, distance)) : 0;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: pos.x + (Math.abs(cos) < 1e-12 ? 0 : cos * d),
    y: 0,
    z: pos.z + (Math.abs(sin) < 1e-12 ? 0 : sin * d),
  };
}

function distanceToHouse(map: GameMap, index: number, point: Vec3): number {
  const house = map.houses[index];
  const minX = house.tx * TILE - WORLD / 2;
  const maxX = (house.tx + house.tw) * TILE - WORLD / 2;
  const minZ = house.tz * TILE - WORLD / 2;
  const maxZ = (house.tz + house.th) * TILE - WORLD / 2;
  const dx = Math.max(minX - point.x, 0, point.x - maxX);
  const dz = Math.max(minZ - point.z, 0, point.z - maxZ);
  return Math.hypot(dx, dz);
}

export function buildingAtOrderPoint(map: GameMap, point: Vec3): number {
  const direct = houseAt(map.houses, point.x, point.z);
  if (direct >= 0) return direct;
  let best = -1;
  let distance = K9_BUILDING_SNAP;
  for (let index = 0; index < map.houses.length; index++) {
    const candidate = distanceToHouse(map, index, point);
    if (candidate <= distance) {
      best = index;
      distance = candidate;
    }
  }
  return best;
}

export function setK9Heel(dog: Soldier) {
  dog.k9Order = 'heel';
  dog.k9BuildingId = undefined;
  dog.k9OrderPos = undefined;
  dog.k9StayAnchor = undefined;
  dog.k9TargetId = undefined;
  dog.k9Door = undefined;
  dog.k9NextBarkAt = undefined;
  dog.k9SearchIndex = undefined;
  dog.k9ClearSince = undefined;
  dog.botGoal = undefined;
  dog.botRepathAt = 0;
}

export function setK9Stay(dog: Soldier) {
  if (dog.k9Order === 'stay') {
    setK9Heel(dog);
    return;
  }
  dog.k9Order = 'stay';
  dog.k9BuildingId = undefined;
  dog.k9OrderPos = undefined;
  dog.k9StayAnchor = { ...dog.pos };
  dog.k9TargetId = undefined;
  dog.k9Door = undefined;
  dog.k9NextBarkAt = undefined;
  dog.k9SearchIndex = undefined;
  dog.k9ClearSince = undefined;
  dog.botGoal = undefined;
  dog.botRepathAt = 0;
}

export function setK9Sic(dog: Soldier, buildingId: number, point: Vec3) {
  dog.k9Order = 'sic';
  dog.k9BuildingId = buildingId;
  dog.k9OrderPos = { ...point };
  dog.k9StayAnchor = undefined;
  dog.k9TargetId = undefined;
  dog.k9Door = undefined;
  dog.k9NextBarkAt = undefined;
  dog.k9SearchIndex = 0;
  dog.k9ClearSince = undefined;
  dog.botGoal = undefined;
  dog.botRepathAt = 0;
}

export function hostilesInK9Building(
  map: GameMap,
  dog: Soldier,
  soldiers: Iterable<Soldier>,
): Soldier[] {
  if (dog.k9Order !== 'sic' || dog.k9BuildingId === undefined) return [];
  const result: Soldier[] = [];
  for (const soldier of soldiers) {
    if (!soldier.alive || soldier.downed || soldier.team === dog.team) continue;
    if (soldier.kind !== 'human' && soldier.kind !== 'bot') continue;
    if (houseAt(map.houses, soldier.pos.x, soldier.pos.z) === dog.k9BuildingId) result.push(soldier);
  }
  return result;
}

export function k9SearchWaypoints(world: World, dog: Soldier): readonly Vec3[] {
  if (dog.k9BuildingId === undefined) return [];
  const house = world.map.houses[dog.k9BuildingId];
  if (!house) return [];
  const rooms = world.indoorTactics?.roomCenters.filter((center) =>
    houseAt(world.map.houses, center.x, center.z) === dog.k9BuildingId);
  if (rooms?.length) return rooms;
  return [house.door, house.center];
}

export function dogInsideAssignedBuilding(map: GameMap, dog: Soldier): boolean {
  return dog.k9BuildingId !== undefined
    && houseAt(map.houses, dog.pos.x, dog.pos.z) === dog.k9BuildingId;
}

/** Closed door in the dog's immediate travel direction, packed with its floor. */
export function closedDoorAhead(map: GameMap, dog: Soldier): number {
  let layer: Uint8Array;
  try { layer = floorLayer(map, dog.floor); } catch { return -1; }
  for (const reach of [TILE * 0.6, TILE * 1.3]) {
    const tx = Math.floor((dog.pos.x + Math.cos(dog.yaw) * reach + WORLD / 2) / TILE);
    const tz = Math.floor((dog.pos.z + Math.sin(dog.yaw) * reach + WORLD / 2) / TILE);
    if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) continue;
    const index = tz * GRID + tx;
    const tile = layer[index];
    const upper = dog.floor > 0;
    if (isDoorTile(tile, upper) && !doorIsOpen(tile, upper) && (upper || tile !== T_METAL_DOOR)) {
      return dog.floor * GRID * GRID + index;
    }
  }
  return -1;
}

export function issueK9Command(
  world: World,
  handler: Soldier,
  command: K9Command,
  aim: Vec3,
): K9CommandResult {
  const dog = ownedDog(world.soldiers.values(), handler.id);
  if (!dog) return { ok: false, reason: 'no-dog' };
  if (!handler.alive || !dog.alive) return { ok: false, reason: 'dog-down' };
  if (command === 'stay') {
    setK9Stay(dog);
    return { ok: true, dog };
  }
  const buildingId = buildingAtOrderPoint(world.map, aim);
  if (buildingId < 0) return { ok: false, reason: 'no-building' };
  setK9Sic(dog, buildingId, aim);
  return { ok: true, dog };
}
