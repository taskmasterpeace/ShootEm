import { describe, expect, it } from 'vitest';
import { parseEpqs, parseOverpass } from '../src/sim/geospatial/sources';

describe('geospatial source adapters', () => {
  it('normalizes Overpass roads, buildings, water, and green space', () => {
    const result = parseOverpass({
      elements: [
        {
          type: 'way', id: 101,
          tags: { highway: 'primary', lanes: '2', bridge: 'yes' },
          geometry: [
            { lon: -122.401, lat: 37.755 },
            { lon: -122.399, lat: 37.755 },
          ],
        },
        {
          type: 'way', id: 202,
          tags: { building: 'industrial', 'building:levels': '3', height: '14.5 m' },
          geometry: [
            { lon: -122.401, lat: 37.754 },
            { lon: -122.400, lat: 37.754 },
            { lon: -122.400, lat: 37.755 },
            { lon: -122.401, lat: 37.754 },
          ],
        },
        {
          type: 'way', id: 303,
          tags: { natural: 'water' },
          geometry: [
            { lon: -122.399, lat: 37.754 },
            { lon: -122.398, lat: 37.754 },
            { lon: -122.399, lat: 37.754 },
          ],
        },
        {
          type: 'way', id: 404,
          tags: { leisure: 'park' },
          geometry: [
            { lon: -122.402, lat: 37.756 },
            { lon: -122.401, lat: 37.756 },
            { lon: -122.402, lat: 37.756 },
          ],
        },
      ],
    });

    expect(result.roads).toEqual([expect.objectContaining({
      id: 'way/101', roadClass: 'primary', bridge: true, tunnel: false,
    })]);
    expect(result.buildings).toEqual([expect.objectContaining({
      id: 'way/202', use: 'industrial', floors: 3, height: 14.5,
    })]);
    expect(result.water).toEqual([expect.objectContaining({ id: 'way/303', kind: 'water' })]);
    expect(result.land).toEqual([expect.objectContaining({ id: 'way/404', kind: 'park' })]);
  });

  it('parses a numeric USGS EPQS elevation', () => {
    expect(parseEpqs({ value: '65.498779297' })).toBeCloseTo(65.4988, 4);
    expect(parseEpqs({ value: 12.25 })).toBe(12.25);
  });

  it('rejects unavailable USGS EPQS samples', () => {
    expect(() => parseEpqs({ value: 'NoData' })).toThrow(/elevation/i);
    expect(() => parseEpqs({})).toThrow(/elevation/i);
  });
});
