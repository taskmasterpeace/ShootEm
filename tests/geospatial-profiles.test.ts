import { describe, expect, it } from 'vitest';
import { inferBuildingSemantics, profileFor } from '../src/sim/geospatial/profiles';
import type { NeighborhoodPlacement } from '../src/sim/geospatial/neighborhood';
import type {
  GeoBuilding,
  NsiBuildingMatch,
  ProjectedGeoBuilding,
} from '../src/sim/geospatial/types';

const sourceBuilding = (id: string, overrides: Partial<GeoBuilding> = {}): GeoBuilding => ({
  id,
  polygon: [],
  ...overrides,
});

const projectedBuilding = (id: string, offset = 0): ProjectedGeoBuilding => ({
  id,
  polygon: [
    { x: offset, z: 0 }, { x: offset + 12, z: 0 },
    { x: offset + 12, z: 9 }, { x: offset, z: 9 },
  ],
});

const placement = (id: string): NeighborhoodPlacement => ({
  buildingId: id,
  blockId: 'block:1',
  lotId: `lot:${id}`,
  frontageRoadId: 'road:main',
  entrance: {
    id: `entrance:${id}`,
    buildingId: id,
    position: { x: 6, z: 0 },
    facing: Math.PI,
    pedestrianConnector: [1, 2, 3],
  },
  setback: 9,
  yardDepth: 18,
  parking: true,
});

describe('regional semantic building profiles', () => {
  it('turns identical sparse data into visibly different regional buildings', () => {
    const source = [sourceBuilding('building:1')];
    const projected = [projectedBuilding('building:1')];
    const placements = [placement('building:1')];
    const miami = inferBuildingSemantics(source, projected, placements, { profile: 'miami-gardens' })[0];
    const nyc = inferBuildingSemantics(source, projected, placements, { profile: 'lower-manhattan' })[0];
    const tarboro = inferBuildingSemantics(source, projected, placements, { profile: 'tarboro' })[0];

    expect(miami.facade).toBe('detached');
    expect(miami.floors.value).toBeLessThanOrEqual(2);
    expect(['hip', 'gable']).toContain(miami.roof);
    expect(nyc.facade).toBe('podium-tower');
    expect(nyc.floors.value).toBeGreaterThanOrEqual(6);
    expect(nyc.roof).toBe('flat');
    expect(tarboro.facade).toBe('porch');
    expect(tarboro.floors.value).toBeLessThanOrEqual(2);
    expect(['gable', 'hip']).toContain(tarboro.roof);
  });

  it('uses explicit OSM measurements before NSI and records evidence provenance', () => {
    const source = [sourceBuilding('building:1', { use: 'retail', floors: 3, height: 13 })];
    const nsiMatches: NsiBuildingMatch[] = [{
      buildingId: 'building:1',
      distanceMeters: 2,
      record: {
        id: 'nsi:1', longitude: -77, latitude: 35,
        occupancy: 'RES1', stories: 1, height: 4,
      },
    }];
    const result = inferBuildingSemantics(source, [projectedBuilding('building:1')], [placement('building:1')], {
      profile: 'tarboro', nsiMatches,
    })[0];

    expect(result.use).toEqual({ value: 'retail', source: 'osm', confidence: 'high' });
    expect(result.floors).toEqual({ value: 3, source: 'osm', confidence: 'high' });
    expect(result.height).toEqual({ value: 13, source: 'osm', confidence: 'high' });
    expect(result.facade).toBe('storefront');
  });

  it('selects six to twelve embedded interiors and gives every building a policy and entrance', () => {
    const sources = Array.from({ length: 15 }, (_, index) => sourceBuilding(`building:${index}`));
    const projected = sources.map((building, index) => projectedBuilding(building.id, index * 15));
    const placements = sources.map((building) => placement(building.id));
    const result = inferBuildingSemantics(sources, projected, placements, {
      profile: 'miami-gardens', minEmbedded: 6, maxEmbedded: 12,
    });

    expect(result.filter((building) => building.interiorPolicy === 'embedded')).toHaveLength(12);
    expect(result.every((building) => building.entrances.length === 1)).toBe(true);
    expect(result.every((building) => ['embedded', 'instanced', 'sealed'].includes(building.interiorPolicy))).toBe(true);
  });

  it('publishes profile-specific road and lot defaults', () => {
    expect(profileFor('lower-manhattan').defaultSetback).toBeLessThan(profileFor('miami-gardens').defaultSetback);
    expect(profileFor('tarboro').porchBias).toBeGreaterThan(profileFor('lower-manhattan').porchBias);
    expect(profileFor('lower-manhattan').roadWidths.primary).toBeGreaterThan(0);
  });
});
