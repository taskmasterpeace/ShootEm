import { describe, expect, it } from 'vitest';
import {
  compileTerrainSamples,
  markRoadRamps,
  sampleElevationGrid,
} from '../src/sim/geospatial/terrain';
import type { GeoElevationGrid } from '../src/sim/geospatial/types';

describe('geospatial terrain compiler', () => {
  it('bilinearly samples the geographic elevation grid', () => {
    const grid: GeoElevationGrid = {
      cols: 2,
      rows: 2,
      bbox: [-1, -1, 1, 1],
      values: [0, 10, 20, 30],
      resolution: 10,
    };

    expect(sampleElevationGrid(grid, { longitude: 0, latitude: 0 })).toBe(15);
    expect(sampleElevationGrid(grid, { longitude: -1, latitude: -1 })).toBe(0);
  });

  it('turns relative relief into stable low, hill, and high bands', () => {
    const geometry = { cols: 16, rows: 16, tile: 3 };
    const samples = Array.from({ length: 256 }, (_, index) => {
      const x = index % geometry.cols;
      return x < 5 ? 100 : x < 11 ? 106 : 120;
    });
    const roadCells = new Set(Array.from({ length: 16 }, (_, x) => 8 * 16 + x));
    const result = compileTerrainSamples(samples, geometry, roadCells);

    expect(result.height[8 * 16 + 2]).toBe(0);
    expect(result.height[8 * 16 + 8]).toBe(1);
    expect(result.height[8 * 16 + 13]).toBe(2);
    expect(result.ramp.some((value) => value === 1)).toBe(true);
    expect(result.thresholds.high - result.thresholds.middle).toBeGreaterThanOrEqual(2);
  });

  it('never marks a direct low-to-high road edge as a ramp', () => {
    const geometry = { cols: 16, rows: 16, tile: 3 };
    const height = new Uint8Array(256);
    height[8 * 16 + 8] = 2;
    const roadCells = new Set([8 * 16 + 7, 8 * 16 + 8]);
    const ramp = markRoadRamps(height, roadCells, geometry);

    expect(ramp[8 * 16 + 7]).toBe(0);
    expect(ramp[8 * 16 + 8]).toBe(0);
  });
});
