import { TILE, WORLD, houseAt, type GameMap } from './map';
import type { K9Command, Soldier, Vec3 } from './types';
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
