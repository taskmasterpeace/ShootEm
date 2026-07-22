import { describe, expect, it } from 'vitest';
import {
  dominantRoadAngle,
  projectSlice,
  rasterLine,
  rasterPolygon,
} from '../src/sim/geospatial/geometry';
import type { GeoSliceSource, LocalPoint } from '../src/sim/geospatial/types';

const source = (): GeoSliceSource => ({
  schemaVersion: 1,
  id: 'fixture-city',
  name: 'Fixture City',
  bbox: [-122.405, 37.75, -122.395, 37.76],
  origin: { longitude: -122.4, latitude: 37.755 },
  roads: [{
    id: 'way/1',
    roadClass: 'primary',
    points: [
      { longitude: -122.403, latitude: 37.752 },
      { longitude: -122.397, latitude: 37.758 },
    ],
    bridge: false,
    tunnel: false,
  }],
  buildings: [{
    id: 'way/2',
    polygon: [
      { longitude: -122.401, latitude: 37.754 },
      { longitude: -122.399, latitude: 37.754 },
      { longitude: -122.399, latitude: 37.756 },
      { longitude: -122.401, latitude: 37.756 },
    ],
    floors: 2,
  }],
  water: [],
  land: [],
  elevation: {
    cols: 2,
    rows: 2,
    bbox: [-122.405, 37.75, -122.395, 37.76],
    values: [0, 1, 2, 3],
    resolution: 30,
  },
  attribution: [{
    label: 'OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  }],
  retrievedAt: '2026-07-22',
});

describe('geospatial projection and raster core', () => {
  it('rotates the dominant road axis onto local X around a zero origin', () => {
    const input = source();
    const angle = dominantRoadAngle(input.roads, input.origin);
    const projected = projectSlice(input, angle);
    const road = projected.roads[0].points;

    expect(projected.origin).toEqual({ x: 0, z: 0 });
    expect(Math.abs(road.at(-1)!.z - road[0].z)).toBeLessThan(0.01);
    expect(road.at(-1)!.x - road[0].x).toBeGreaterThan(700);
  });

  it('rasterizes a buffered line into a continuous tile corridor', () => {
    const geometry = { cols: 20, rows: 20, tile: 3 };
    const cells = rasterLine([{ x: -12, z: 0 }, { x: 12, z: 0 }], 6, geometry);

    expect(cells.size).toBeGreaterThanOrEqual(16);
    for (let x = 6; x <= 13; x++) expect(cells.has(10 * geometry.cols + x)).toBe(true);
  });

  it('fills polygon interiors without painting distant tiles', () => {
    const geometry = { cols: 20, rows: 20, tile: 3 };
    const square: LocalPoint[] = [
      { x: -6, z: -6 },
      { x: 6, z: -6 },
      { x: 6, z: 6 },
      { x: -6, z: 6 },
    ];
    const cells = rasterPolygon(square, geometry);

    expect(cells.has(10 * geometry.cols + 10)).toBe(true);
    expect(cells.has(1 * geometry.cols + 1)).toBe(false);
  });
});
