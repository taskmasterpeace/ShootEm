import {
  F2_STAIR_E,
  F2_STAIR_N,
  F2_STAIR_S,
  F2_STAIR_W,
  F2_VOID,
  F2_WELL,
  T_LADDER,
  T_STAIRS_E,
  T_STAIRS_N,
  T_STAIRS_S,
  T_STAIRS_W,
  blocksShot,
  blocksShotUpper,
  isBlocked,
  tileAt,
  upperBlocked,
  GRID,
  type GameMap,
} from './map';
import type { SoldierKind } from './types';

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

export function worldFloorForHeight(y: number): number {
  return Math.max(0, Math.min(MAX_BUILDING_FLOORS - 1, Math.floor(Math.max(0, y) / STOREY_HEIGHT)));
}

/** Terrain collision at a world-space height, including the matching upper layer. */
export function shotBlockedAtHeight(map: GameMap, x: number, z: number, y: number): boolean {
  if (blocksShot(map.grid, x, z, y)) return true;
  const floor = worldFloorForHeight(y);
  return floor > 0 && floorExists(map, floor) && floorShotBlocked(map, floor, x, z, y);
}

export function hasFloorAt(map: GameMap, floor: number, x: number, z: number): boolean {
  return tileAtFloor(map, floor, x, z) !== F2_VOID;
}

export function floorExists(map: GameMap, floor: number): boolean {
  if (floor === 0) return true;
  if (floor === 1) return map.grid2.length > 0;
  return floor < MAX_BUILDING_FLOORS && map.upperLayers?.[floor - 1] !== undefined;
}

export function highestSupportedFloorBelow(map: GameMap, floor: number, x: number, z: number): number {
  for (let candidate = Math.min(floor - 1, MAX_BUILDING_FLOORS - 1); candidate > 0; candidate--) {
    if (floorExists(map, candidate) && hasFloorAt(map, candidate, x, z)) return candidate;
  }
  return 0;
}

export type VerticalTransition = 'stairs' | 'ladder';

/** Dogs understand a ramped stair flight. A rung ladder still requires hands. */
export function actorCanUseVerticalTransition(kind: SoldierKind, transition: VerticalTransition): boolean {
  return transition === 'stairs' || kind !== 'dog';
}

export interface StairDirection { x: -1 | 0 | 1; z: -1 | 0 | 1 }

export function stairDirection(tile: number): StairDirection | null {
  switch (tile) {
    case T_STAIRS_N: case F2_STAIR_N: return { x: 0, z: -1 };
    case T_STAIRS_E: case F2_STAIR_E: return { x: 1, z: 0 };
    case T_STAIRS_S: case F2_STAIR_S: return { x: 0, z: 1 };
    case T_STAIRS_W: case F2_STAIR_W: return { x: -1, z: 0 };
    default: return null;
  }
}

export function stairDirectionAt(map: GameMap, floor: number, x: number, z: number): StairDirection | null {
  if (!floorExists(map, floor)) return null;
  return stairDirection(tileAtFloor(map, floor, x, z));
}

export function ladderWellAt(map: GameMap, floor: number, x: number, z: number): boolean {
  if (!floorExists(map, floor)) return false;
  return floor === 0
    ? tileAtFloor(map, 0, x, z) === T_LADDER
    : tileAtFloor(map, floor, x, z) === F2_WELL;
}
