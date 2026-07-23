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

const fixtureWithSixParcels = (): GeoSliceSource => {
  const source = fixture();
  const parcel = (
    id: string,
    west: number,
    south: number,
    use: string,
  ): GeoSliceSource['buildings'][number] => ({
    id,
    use,
    floors: use === 'house' ? 1 : 2,
    polygon: [
      { longitude: west, latitude: south },
      { longitude: west + 0.00036, latitude: south },
      { longitude: west + 0.00036, latitude: south + 0.0003 },
      { longitude: west, latitude: south + 0.0003 },
    ],
  });
  source.buildings = [
    parcel('way/north-west', -122.40105, 37.75525, 'house'),
    parcel('way/north-east', -122.39936, 37.75525, 'retail'),
    parcel('way/south-west', -122.40105, 37.75445, 'house'),
    parcel('way/south-east', -122.39936, 37.75445, 'house'),
    parcel('way/far-north', -122.40085, 37.75568, 'school'),
    parcel('way/far-south', -122.39955, 37.75404, 'house'),
  ];
  return source;
};

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
    expect(first.diagnostics.streetConnectors).toBeGreaterThanOrEqual(5);
    expect(first.diagnostics.streetSegments).toBeGreaterThanOrEqual(4);
    expect(first.diagnostics.sidewalkCells).toBeGreaterThan(0);
    expect(first.neighborhood.blocks.length).toBeGreaterThanOrEqual(2);
    expect(first.neighborhood.placements.map((placement) => placement.buildingId)).toContain('way/factory');

    const toIndex = (position: { x: number; z: number }) => {
      const x = Math.floor((position.x + options.geometry.cols * options.geometry.tile / 2) / options.geometry.tile);
      const z = Math.floor((position.z + options.geometry.rows * options.geometry.tile / 2) / options.geometry.tile);
      return z * options.geometry.cols + x;
    };
    expect(reachable(first.map.grid, options.geometry.cols, toIndex(first.map.basePos[0]), toIndex(first.map.basePos[1]))).toBe(true);
  });

  it('adds Miami district routes, distributed interiors, labels, and presentation', () => {
    const geometry = { cols: 96, rows: 96, tile: 3 } as const;
    const result = compileGeospatialMap(fixtureWithSixParcels(), {
      seed: 33056,
      cityId: '69:miami:e08:2700000',
      geometry,
      style: 'miami-gardens',
      maxPlayableBuildings: 4,
      controlPointNames: ['183RD STREET', 'CIVIC CENTER', 'CAROL CITY EAST'],
    });

    expect(result.map.theater?.routes.filter((route) => route.domain === 'ground')).toHaveLength(2);
    expect(result.map.theater?.routes.some((route) => route.domain === 'foot')).toBe(true);
    expect(result.map.houses.length).toBeGreaterThanOrEqual(2);
    expect(result.map.controlPoints.map((point) => point.name)).toEqual([
      '183RD STREET',
      'CIVIC CENTER',
      'CAROL CITY EAST',
    ]);
    expect(result.map.geospatial?.style).toBe('miami-gardens');
    expect(result.map.geospatial?.buildingHeight).toHaveLength(96 * 96);
    expect(result.map.geospatial?.decor.some((decor) => decor.kind === 'palm')).toBe(true);
    expect(result.semanticBuildings).toHaveLength(result.neighborhood.placements.length);
    expect(result.semanticBuildings.filter((building) => building.interiorPolicy === 'embedded')).toHaveLength(4);
    expect(result.semanticBuildings.some((building) => building.facade === 'detached')).toBe(true);
    for (const base of result.map.basePos) {
      const x = Math.floor((base.x + geometry.cols * geometry.tile / 2) / geometry.tile);
      const z = Math.floor((base.z + geometry.rows * geometry.tile / 2) / geometry.tile);
      expect(Math.min(x, z, geometry.cols - 1 - x, geometry.rows - 1 - z)).toBeGreaterThanOrEqual(9);
    }
  });
});
