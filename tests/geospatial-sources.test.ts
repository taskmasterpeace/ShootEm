import { describe, expect, it } from 'vitest';
import { buildOverpassQuery, parseEpqs, parseOverpass } from '../src/sim/geospatial/sources';
import { parseImportArgs, stringifyArtifact } from '../scripts/import-geospatial-map';

describe('geospatial source adapters', () => {
  it('accepts bounded import coordinates and rejects oversized slices', () => {
    const parsed = parseImportArgs([
      '--id', 'sf-potrero',
      '--name', 'Potrero Hill / Dogpatch',
      '--bbox', '-122.4045,37.7520,-122.3943,37.7601',
      '--city', '69:san-francisco:cr7:896047',
      '--seed', '4207',
      '--retrieved-at', '2026-07-22',
      '--output', 'pilot.json',
    ]);
    expect(parsed.bbox).toEqual([-122.4045, 37.752, -122.3943, 37.7601]);
    expect(parsed.seed).toBe(4207);
    expect(() => parseImportArgs([
      '--id', 'huge', '--name', 'Huge', '--bbox', '-122.5,37.7,-122.4,37.8',
      '--city', '69:san-francisco:cr7:896047', '--seed', '1',
      '--retrieved-at', '2026-07-22', '--output', 'huge.json',
    ])).toThrow(/1.2 km/i);
  });

  it('accepts the Miami district style and three control-point names', () => {
    const parsed = parseImportArgs([
      '--id', 'miami-gardens-33056-civic-front',
      '--name', 'Miami Gardens 33056 / Civic Front',
      '--bbox', '-80.24827,25.93991,-80.23929,25.94799',
      '--city', '69:miami:e08:2700000',
      '--seed', '33056',
      '--retrieved-at', '2026-07-22',
      '--style', 'miami-gardens',
      '--control-points', '183RD STREET|CIVIC CENTER|CAROL CITY EAST',
      '--output', 'src/data/geospatial/miami-gardens-33056.json',
    ]);

    expect(parsed.style).toBe('miami-gardens');
    expect(parsed.controlPointNames).toEqual(['183RD STREET', 'CIVIC CENTER', 'CAROL CITY EAST']);
    expect(() => parseImportArgs([
      '--id', 'bad', '--name', 'Bad', '--bbox', '-80.24827,25.93991,-80.23929,25.94799',
      '--city', '69:miami:e08:2700000', '--seed', '1', '--retrieved-at', '2026-07-22',
      '--style', 'purple-city', '--control-points', 'ONE|TWO', '--output', 'bad.json',
    ])).toThrow(/style|control/i);
  });

  it('accepts explicit optional NSI enrichment', () => {
    const parsed = parseImportArgs([
      '--id', 'tarboro', '--name', 'Tarboro', '--bbox', '-77.54,35.89,-77.53,35.90',
      '--city', 'tarboro', '--seed', '2', '--retrieved-at', '2026-07-22',
      '--nsi', 'true', '--output', 'tarboro.json',
    ]);
    expect(parsed.nsi).toBe(true);
  });

  it('keeps numeric artifact arrays compact inside readable JSON', () => {
    const json = stringifyArtifact({ name: 'fixture', values: [1, 2, 3], nested: { ok: true } });
    expect(json).toContain('"values": [1,2,3]');
    expect(json.endsWith('\n')).toBe(true);
    expect(JSON.parse(json)).toEqual({ name: 'fixture', values: [1, 2, 3], nested: { ok: true } });
  });

  it('normalizes Overpass roads, buildings, water, and green space', () => {
    const result = parseOverpass({
      elements: [
        {
          type: 'node', id: 99, lon: -122.4005, lat: 37.754,
          tags: { entrance: 'main', access: 'yes' },
        },
        {
          type: 'way', id: 101,
          tags: {
            highway: 'primary', lanes: '2', bridge: 'yes', width: '8.5 m',
            surface: 'asphalt', sidewalk: 'both', service: 'alley', access: 'destination',
          },
          geometry: [
            { lon: -122.401, lat: 37.755 },
            { lon: -122.399, lat: 37.755 },
          ],
        },
        {
          type: 'way', id: 202,
          tags: {
            building: 'industrial', 'building:levels': '3', height: '14.5 m',
            'building:material': 'brick', 'roof:shape': 'sawtooth',
            'addr:housenumber': '42', 'addr:street': 'Foundry Street', name: 'Forge Works',
          },
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
      lanes: 2, width: 8.5, surface: 'asphalt', sidewalk: 'both',
      service: 'alley', access: 'destination',
    })]);
    expect(result.buildings).toEqual([expect.objectContaining({
      id: 'way/202', use: 'industrial', floors: 3, height: 14.5,
      material: 'brick', roofShape: 'sawtooth', address: '42 Foundry Street', name: 'Forge Works',
    })]);
    expect(result.water).toEqual([expect.objectContaining({ id: 'way/303', kind: 'water' })]);
    expect(result.land).toEqual([expect.objectContaining({ id: 'way/404', kind: 'park' })]);
    expect(result.entrances).toEqual([expect.objectContaining({
      id: 'node/99', kind: 'main', access: 'yes',
      point: { longitude: -122.4005, latitude: 37.754 },
    })]);
  });

  it('parses a numeric USGS EPQS elevation', () => {
    expect(parseEpqs({ value: '65.498779297' })).toBeCloseTo(65.4988, 4);
    expect(parseEpqs({ value: 12.25 })).toBe(12.25);
  });

  it('requests building relations and entrance nodes for semantic compilation', () => {
    const query = buildOverpassQuery([-77.54, 35.89, -77.53, 35.90]);
    expect(query).toContain('relation["building"]');
    expect(query).toContain('node["entrance"]');
  });

  it('rejects unavailable USGS EPQS samples', () => {
    expect(() => parseEpqs({ value: 'NoData' })).toThrow(/elevation/i);
    expect(() => parseEpqs({})).toThrow(/elevation/i);
  });
});
