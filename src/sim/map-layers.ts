import {
  F2_VOID,
  blocksShot,
  blocksShotUpper,
  isBlocked,
  tileAt,
  upperBlocked,
  GRID,
  type GameMap,
} from './map';

export const MAX_BUILDING_FLOORS = 3;
export const STOREY_HEIGHT = 4;

function assertFloor(floor: number): void {
  if (!Number.isInteger(floor) || floor < 0 || floor >= MAX_BUILDING_FLOORS) {
    throw new Error(`invalid floor ${floor}; expected 0–${MAX_BUILDING_FLOORS - 1}`);
  }
}

export function floorHeight(floor: number): number {
  assertFloor(floor);
  return floor * STOREY_HEIGHT;
}

/** Resolve a logical storey while retaining grid2 as the compatibility rail. */
export function floorLayer(map: GameMap, floor: number): Uint8Array {
  assertFloor(floor);
  if (floor === 0) return map.grid;
  if (floor === 1) return map.upperLayers?.[0] ?? map.grid2;
  const layer = map.upperLayers?.[floor - 1];
  if (!layer) throw new Error(`map has no floor ${floor}`);
  return layer;
}

/** Allocate an upper storey only for maps that opt into indexed floors. */
export function ensureUpperFloor(map: GameMap, floor: number): Uint8Array {
  assertFloor(floor);
  if (floor === 0) return map.grid;
  if (!map.upperLayers) map.upperLayers = [map.grid2];
  // Repair imported/constructed documents that copied Level 2 instead of
  // preserving its alias. grid2 remains the canonical compatibility field.
  map.upperLayers[0] = map.grid2;
  while (map.upperLayers.length < floor) map.upperLayers.push(new Uint8Array(GRID * GRID));
  return map.upperLayers[floor - 1];
}

export function tileAtFloor(map: GameMap, floor: number, x: number, z: number): number {
  return tileAt(floorLayer(map, floor), x, z);
}

export function floorBlocked(map: GameMap, floor: number, x: number, z: number): boolean {
  if (floor === 0) return isBlocked(map.grid, x, z);
  return upperBlocked(floorLayer(map, floor), x, z);
}

export function floorShotBlocked(map: GameMap, floor: number, x: number, z: number, y: number): boolean {
  if (floor === 0) return blocksShot(map.grid, x, z, y);
  // Upper collision codes are storey-relative. Rebase Level 3's world height
  // into the original Level 2 band used by blocksShotUpper.
  return blocksShotUpper(floorLayer(map, floor), x, z, y - (floor - 1) * STOREY_HEIGHT);
}

export function hasFloorAt(map: GameMap, floor: number, x: number, z: number): boolean {
  return tileAtFloor(map, floor, x, z) !== F2_VOID;
}
