import { describe, expect, it } from 'vitest';
import { compileGeospatialMap } from '../src/sim/geospatial/compiler';
import { T_WALL } from '../src/sim/map';
import type { GeoSliceSource } from '../src/sim/geospatial/types';

const fixture = (): GeoSliceSource => ({
  schemaVersion: 1,
  id: 'crossroads',
  name: 'Crossroads',
  bbox: [-122.4012, 37.7538, -122.3988, 37.7562],
  origin: { longitude: -122.4, latitude: 37.755 },
  roads: [
    {
      id: 'way/east-west', roadClass: 'primary', bridge: false, tunnel: false,
      points: [
        { longitude: -122.401, latitude: 37.755 },
        { longitude: -122.399, latitude: 37.755 },
      ],
    },
    {
      id: 'way/north-south', roadClass: 'residential', bridge: false, tunnel: false,
      points: [
        { longitude: -122.4, latitude: 37.754 },
        { longitude: -122.4, latitude: 37.756 },
      ],
    },
  ],
  buildings: [{
    id: 'way/factory', use: 'industrial', floors: 2,
    polygon: [
      { longitude: -122.4009, latitude: 37.75525 },
      { longitude: -122.40035, latitude: 37.75525 },
      { longitude: -122.40035, latitude: 37.75575 },
      { longitude: -122.4009, latitude: 37.75575 },
    ],
  }],
  water: [],
  land: [{
    id: 'way/park', kind: 'park',
    polygon: [
      { longitude: -122.3998, latitude: 37.7542 },
      { longitude: -122.3993, latitude: 37.7542 },
      { longitude: -122.3993, latitude: 37.7547 },
      { longitude: -122.3998, latitude: 37.7547 },
    ],
  }],
  elevation: {
    cols: 3, rows: 3,
    bbox: [-122.4012, 37.7538, -122.3988, 37.7562],
    values: [0, 4, 8, 3, 8, 14, 6, 12, 22],
    resolution: 90,
  },
  attribution: [{
    label: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright',
    license: 'ODbL-1.0', licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  }],
  retrievedAt: '2026-07-22',
});

const reachable = (grid: Uint8Array, cols: number, start: number, target: number): boolean => {
  const seen = new Uint8Array(grid.length);
  const queue = [start];
  seen[start] = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (index === target) return true;
    const x = index % cols;
    const z = Math.floor(index / cols);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      const next = nz * cols + nx;
      if (nx >= 0 && nz >= 0 && nx < cols && next < grid.length && !seen[next] && grid[next] !== T_WALL) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  return false;
};

describe('geospatial map compiler', () => {
  it('deterministically produces a playable hybrid city map', () => {
    const options = {
      seed: 4207,
      cityId: '69:san-francisco:cr7:896047',
      geometry: { cols: 64, rows: 64, tile: 3 },
    } as const;
    const first = compileGeospatialMap(fixture(), options);
    const second = compileGeospatialMap(fixture(), options);

    expect(first.map.grid).toEqual(second.map.grid);
    expect(first.map.height).toEqual(second.map.height);
    expect(first.classification).toContain(1);
    expect(first.classification).toContain(3);
    expect(first.map.houses.length).toBeGreaterThanOrEqual(1);
    expect(first.overlay.some((change) => change.reason === 'mission_anchor')).toBe(true);

    const toIndex = (position: { x: number; z: number }) => {
      const x = Math.floor((position.x + options.geometry.cols * options.geometry.tile / 2) / options.geometry.tile);
      const z = Math.floor((position.z + options.geometry.rows * options.geometry.tile / 2) / options.geometry.tile);
      return z * options.geometry.cols + x;
    };
    expect(reachable(first.map.grid, options.geometry.cols, toIndex(first.map.basePos[0]), toIndex(first.map.basePos[1]))).toBe(true);
  });
});
