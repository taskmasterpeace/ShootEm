import { describe, expect, it } from 'vitest';
import { balconySpansSupported, generateCityBuilding } from '../src/sim/building-generator';
import { CITY_MAP_PROFILES } from '../src/sim/city-profile';
import { stampBuilding, type StampCtx } from '../src/sim/buildings';
import {
  F2_BALCONY,
  F2_DOOR_V,
  F2_DOOR_V_OPEN,
  F2_RAIL_H,
  F2_STAIR_N,
  F2_THIN_WALL_H,
  F2_THIN_WALL_V,
  F2_WINDOW_H,
  F2_WINDOW_V,
  GRID,
  T_STAIRS_N,
  T_WINDOW_H,
  T_WINDOW_V,
  doorIsOpen,
  isDoorTile,
  toggleDoorTile,
} from '../src/sim/map';
import { Rng } from '../src/sim/rng';

const city = CITY_MAP_PROFILES.find((candidate) => candidate.name === 'Montevideo')!;
const count = (layer: Uint8Array, ...tiles: number[]) => layer.reduce((total, tile) => total + Number(tiles.includes(tile)), 0);

describe('architectural stencil stamping', () => {
  it('stamps thin walls, framed windows, stairs, balconies, and all three storeys', () => {
    const generated = generateCityBuilding({ cityId: city.id, archetype: 'command-villa', seed: 144, floors: 3, footprint: 'rectangle' });
    const grid = new Uint8Array(GRID * GRID);
    const grid2 = new Uint8Array(GRID * GRID);
    const grid3 = new Uint8Array(GRID * GRID);
    const ctx: StampCtx = {
      grid,
      grid2,
      upperLayers: [grid2, grid3],
      props: [], pickups: [], houses: [], claims: [], rng: new Rng(1),
    };
    expect(stampBuilding(ctx, generated.def, 30, 30)).toBe(true);
    expect(count(grid, T_WINDOW_H, T_WINDOW_V)).toBeGreaterThan(4);
    expect(count(grid, T_STAIRS_N)).toBe(1);
    expect(count(grid2, F2_THIN_WALL_H, F2_THIN_WALL_V)).toBeGreaterThan(4);
    expect(count(grid2, F2_WINDOW_H, F2_WINDOW_V)).toBeGreaterThan(4);
    expect(count(grid2, F2_STAIR_N)).toBe(1);
    expect(count(grid2, F2_BALCONY)).toBeGreaterThan(0);
    expect(count(grid2, F2_RAIL_H)).toBeGreaterThan(0);
    expect(count(grid3, F2_WINDOW_H, F2_WINDOW_V)).toBeGreaterThan(4);
    expect(ctx.houses[0].floors).toBe(3);
  });

  it('keeps every upper layer aligned to the ground stencil dimensions', () => {
    const generated = generateCityBuilding({ cityId: city.id, archetype: 'hotel', seed: 145, floors: 3 });
    const widths = generated.layers.flatMap((rows) => rows.map((row) => row.length));
    expect(new Set(widths)).toEqual(new Set([generated.width]));
    expect(generated.layers.every((rows) => rows.length === generated.height)).toBe(true);
  });

  it('rejects balcony cantilevers wider than the supported three-tile span', () => {
    expect(balconySpansSupported([' RBBBR ', ' RRRRR '])).toBe(true);
    expect(balconySpansSupported(['RBBBBR', 'RRRRRR'])).toBe(false);
  });

  it('distinguishes upper doors from numerically overlapping ground tiles', () => {
    expect(isDoorTile(F2_DOOR_V, true)).toBe(true);
    expect(doorIsOpen(F2_DOOR_V, true)).toBe(false);
    expect(doorIsOpen(F2_DOOR_V_OPEN, true)).toBe(true);
    expect(isDoorTile(F2_THIN_WALL_V, true)).toBe(false);
    expect(toggleDoorTile(F2_DOOR_V, true)).toBe(F2_DOOR_V_OPEN);
    expect(toggleDoorTile(F2_DOOR_V_OPEN, true)).toBe(F2_DOOR_V);
  });
});
