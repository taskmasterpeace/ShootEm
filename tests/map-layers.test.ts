import { describe, expect, it } from 'vitest';
import { blankDoc } from '../src/sim/mapedit';
import { F2_FLOOR, F2_WALL, GRID, T_WALL, TILE, WORLD } from '../src/sim/map';
import {
  MAX_BUILDING_FLOORS,
  ensureUpperFloor,
  floorBlocked,
  floorHeight,
  floorLayer,
  floorShotBlocked,
  tileAtFloor,
} from '../src/sim/map-layers';

const world = (tile: number) => (tile + 0.5) * TILE - WORLD / 2;

describe('indexed map floors', () => {
  it('keeps ground and legacy grid2 as the first two logical floors', () => {
    const map = blankDoc('small', 11).map;
    expect(MAX_BUILDING_FLOORS).toBe(3);
    expect(floorLayer(map, 0)).toBe(map.grid);
    expect(floorLayer(map, 1)).toBe(map.grid2);
    expect(floorHeight(0)).toBe(0);
    expect(floorHeight(1)).toBe(4);
    expect(floorHeight(2)).toBe(8);
  });

  it('allocates level three independently while preserving the grid2 alias', () => {
    const map = blankDoc('small', 12).map;
    const third = ensureUpperFloor(map, 2);
    expect(map.upperLayers).toHaveLength(2);
    expect(map.upperLayers![0]).toBe(map.grid2);
    expect(map.upperLayers![1]).toBe(third);
    expect(third).toHaveLength(GRID * GRID);
    third[42] = F2_FLOOR;
    expect(map.grid2[42]).toBe(0);
    expect(() => ensureUpperFloor(map, 3)).toThrow('floor 3');
  });

  it('reads collision and fire from the selected floor layer', () => {
    const map = blankDoc('small', 13).map;
    const tx = 50, tz = 50, x = world(tx), z = world(tz);
    map.grid[tz * GRID + tx] = T_WALL;
    map.grid2[tz * GRID + tx] = F2_FLOOR;
    ensureUpperFloor(map, 2)[tz * GRID + tx] = F2_WALL;
    expect(tileAtFloor(map, 0, x, z)).toBe(T_WALL);
    expect(tileAtFloor(map, 2, x, z)).toBe(F2_WALL);
    expect(floorBlocked(map, 0, x, z)).toBe(true);
    expect(floorBlocked(map, 1, x, z)).toBe(false);
    expect(floorBlocked(map, 2, x, z)).toBe(true);
    expect(floorShotBlocked(map, 2, x, z, 9.4)).toBe(true);
  });

  it('rejects absent and fractional floors descriptively', () => {
    const map = blankDoc('small', 14).map;
    expect(() => floorLayer(map, 2)).toThrow('no floor 2');
    expect(() => floorLayer(map, 1.5)).toThrow('invalid floor 1.5');
  });
});
