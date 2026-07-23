import { describe, expect, it } from 'vitest';
import fixture from './fixtures/geospatial/nsi-sample.json';
import {
  fetchAndMatchNsi,
  fetchNsiSlice,
  matchNsiBuildings,
  parseNsiFeatures,
} from '../src/sim/geospatial/nsi';
import type { GeoBuilding } from '../src/sim/geospatial/types';

const square = (id: string, longitude: number, latitude: number): GeoBuilding => ({
  id,
  polygon: [
    { longitude: longitude - 0.00002, latitude: latitude - 0.00002 },
    { longitude: longitude + 0.00002, latitude: latitude - 0.00002 },
    { longitude: longitude + 0.00002, latitude: latitude + 0.00002 },
    { longitude: longitude - 0.00002, latitude: latitude + 0.00002 },
  ],
});

describe('USACE NSI source adapter', () => {
  it('normalizes occupancy, stories, area, height, and construction', () => {
    expect(parseNsiFeatures(fixture)).toEqual([
      {
        id: 'nsi-100', longitude: -77.53605, latitude: 35.89705,
        occupancy: 'RES1-1SNB', stories: 2, squareFeet: 1840, height: 7.4, construction: 'M',
      },
      {
        id: 'nsi-200', longitude: -77.5356, latitude: 35.8973,
        occupancy: 'COM4', stories: 3, squareFeet: 6200, height: 11.5, construction: 'C',
      },
    ]);
  });

  it('matches records one-to-one by building centroid with stable tie-breaking', () => {
    const records = parseNsiFeatures(fixture);
    const buildings = [
      square('building:b', -77.53561, 35.89730),
      square('building:a', -77.53604, 35.89705),
      square('building:far', -77.55, 35.90),
    ];

    expect(matchNsiBuildings(buildings, records, 30)).toEqual([
      expect.objectContaining({ buildingId: 'building:a', record: expect.objectContaining({ id: 'nsi-100' }) }),
      expect.objectContaining({ buildingId: 'building:b', record: expect.objectContaining({ id: 'nsi-200' }) }),
    ]);
  });

  it('skips malformed and incomplete records', () => {
    expect(parseNsiFeatures({ features: [
      { geometry: { coordinates: ['bad', 35] }, properties: { fd_id: 'bad' } },
      { geometry: { coordinates: [-77, 35] }, properties: {} },
    ] })).toEqual([]);
  });

  it('fetches a bounded GeoJSON slice from the official API', async () => {
    let requested = '';
    const fetcher = (async (input: string | URL | Request) => {
      requested = String(input);
      return new Response(JSON.stringify(fixture), { status: 200 });
    }) as typeof fetch;

    const records = await fetchNsiSlice([-77.54, 35.89, -77.53, 35.90], fetcher);
    expect(requested).toMatch(/^https:\/\/nsi\.sec\.usace\.army\.mil\/nsiapi\/structures\?/);
    expect(new URL(requested).searchParams.get('bbox')).toBe('-77.54,35.89,-77.53,35.9');
    expect(records).toHaveLength(2);
  });

  it('makes NSI enrichment optional and reports an unavailable service', async () => {
    const unavailable = (async () => new Response('offline', { status: 503 })) as typeof fetch;
    const result = await fetchAndMatchNsi(
      [square('building:a', -77.53604, 35.89705)],
      [-77.54, 35.89, -77.53, 35.90],
      unavailable,
    );
    expect(result.status).toBe('unavailable');
    expect(result.matches).toEqual([]);
    expect(result.warning).toMatch(/503/);
  });
});
