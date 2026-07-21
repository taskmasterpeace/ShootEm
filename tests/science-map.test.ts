import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import {
  F2_WELL,
  GRID,
  TILE,
  T_THIN_DOOR_H,
  T_THIN_DOOR_H_OPEN,
  T_THIN_DOOR_V,
  T_THIN_WALL_H,
  T_THIN_WALL_HV,
  T_THIN_WALL_V,
  WORLD,
  blocksShot,
  isBlocked,
  isDoorTile,
  losClear,
  registerThinGrid,
  toggleDoorTile,
} from '../src/sim/map';
import { stampBuilding, stencilConnected, type BuildingDef, type StampCtx } from '../src/sim/buildings';
import { generateScienceMap, scienceMapReachable } from '../src/sim/science-map';
import { SCIENCE_SITES, generateScienceMission } from '../src/sim/science';

const tileCenter = (tx: number, tz: number) => ({
  x: (tx + 0.5) * TILE - WORLD / 2,
  y: 0,
  z: (tz + 0.5) * TILE - WORLD / 2,
});

describe('science mission wall substrate', () => {
  it('blocks only on the narrow axis of an oriented wall', () => {
    const grid = new Uint8Array(GRID * GRID);
    const tx = 50;
    const tz = 50;
    const center = tileCenter(tx, tz);
    registerThinGrid(grid);

    grid[tz * GRID + tx] = T_THIN_WALL_H;
    expect(isBlocked(grid, center.x, center.z)).toBe(true);
    expect(isBlocked(grid, center.x, center.z + TILE * 0.35)).toBe(false);
    expect(blocksShot(grid, center.x, center.z, 1.4)).toBe(true);
    expect(losClear(
      grid,
      { x: center.x, y: 1.4, z: center.z - TILE },
      { x: center.x, y: 1.4, z: center.z + TILE },
    )).toBe(false);

    grid[tz * GRID + tx] = T_THIN_WALL_V;
    expect(isBlocked(grid, center.x, center.z)).toBe(true);
    expect(isBlocked(grid, center.x + TILE * 0.35, center.z)).toBe(false);

    grid[tz * GRID + tx] = T_THIN_WALL_HV;
    expect(isBlocked(grid, center.x, center.z + TILE * 0.35)).toBe(true);
    expect(isBlocked(grid, center.x + TILE * 0.35, center.z)).toBe(true);
  });

  it('opens and closes oriented doors without losing orientation', () => {
    expect(isDoorTile(T_THIN_DOOR_H)).toBe(true);
    expect(isDoorTile(T_THIN_DOOR_V)).toBe(true);
    expect(toggleDoorTile(T_THIN_DOOR_H)).toBe(T_THIN_DOOR_H_OPEN);
    expect(toggleDoorTile(T_THIN_DOOR_H_OPEN)).toBe(T_THIN_DOOR_H);
    expect(isDoorTile(toggleDoorTile(T_THIN_DOOR_V))).toBe(true);
  });

  it('stamps thin walls and doors from authored building stencils', () => {
    const def: BuildingDef = {
      id: 'thin_test',
      name: 'Thin Test',
      kind: 'commercial',
      floors: 1,
      rows: ['+-h-+', '|...|', 'v...|', '|...|', '+---+'],
    };
    const ctx: StampCtx = {
      grid: new Uint8Array(GRID * GRID),
      grid2: new Uint8Array(GRID * GRID),
      props: [],
      pickups: [],
      houses: [],
      claims: [],
      rng: new Rng(7),
    };

    expect(stencilConnected(def)).toBe(true);
    expect(stampBuilding(ctx, def, 20, 20)).toBe(true);
    expect(ctx.grid[20 * GRID + 20]).toBe(T_THIN_WALL_HV);
    expect(ctx.grid[20 * GRID + 21]).toBe(T_THIN_WALL_H);
    expect(ctx.grid[20 * GRID + 22]).toBe(T_THIN_DOOR_H);
    expect(ctx.grid[21 * GRID + 20]).toBe(T_THIN_WALL_V);
    expect(ctx.grid[22 * GRID + 20]).toBe(T_THIN_DOOR_V);
  });
});

describe('science mission maps', () => {
  it.each(SCIENCE_SITES)('builds a deterministic, playable %s site', (site) => {
    const spec = generateScienceMission(4102, { site, complication: null });
    const first = generateScienceMap(spec);
    const second = generateScienceMap(spec);

    expect(first.map.grid).toEqual(second.map.grid);
    expect(first.bounds).toEqual(second.bounds);
    expect(first.map.props.filter((prop) => prop.type === 'clone_bay')).toHaveLength(1);
    expect(first.objectiveSockets.length).toBeGreaterThanOrEqual(3);
    expect(first.guardPosts.length).toBeGreaterThanOrEqual(4);
    expect(first.civilianSpawns.length).toBeGreaterThanOrEqual(2);
    expect(first.bounds.maxTx - first.bounds.minTx).toBeLessThanOrEqual(32);
    expect(first.bounds.maxTz - first.bounds.minTz).toBeLessThanOrEqual(32);
    expect(scienceMapReachable(first)).toBe(true);
  });

  it('always gives the officer villa a navigable second storey', () => {
    const layout = generateScienceMap(generateScienceMission(99, {
      site: 'officer-villa',
      complication: null,
    }));

    expect(layout.map.houses.some((house) => house.floors === 2)).toBe(true);
    expect(layout.map.grid.some((tile) => tile === 8)).toBe(true);
    expect(layout.map.grid2.some((tile) => tile === F2_WELL)).toBe(true);
  });
});
