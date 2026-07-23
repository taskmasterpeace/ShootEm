import { describe, expect, it } from 'vitest';
import { artifactFromMap, mapFromArtifact } from '../src/sim/geospatial/artifact';
import { compileGeospatialMap } from '../src/sim/geospatial/compiler';
import { districtHardIssues } from '../src/sim/geospatial/diagnostics';
import type { GeoSliceSource } from '../src/sim/geospatial/types';

const source = (): GeoSliceSource => {
  const origin = { longitude: -77.536, latitude: 35.897 };
  const footprint = (id: string, dx: number, dz: number): GeoSliceSource['buildings'][number] => {
    const west = origin.longitude + dx;
    const south = origin.latitude + dz;
    return {
      id,
      use: id.includes('shop') ? 'retail' : 'house',
      floors: id.includes('shop') ? 2 : 1,
      polygon: [
        { longitude: west, latitude: south },
        { longitude: west + 0.00032, latitude: south },
        { longitude: west + 0.00032, latitude: south + 0.00024 },
        { longitude: west, latitude: south + 0.00024 },
      ],
    };
  };
  return {
    schemaVersion: 1,
    id: 'audit-town',
    name: 'Audit Town',
    bbox: [-77.5375, 35.8955, -77.5345, 35.8985],
    origin,
    roads: [
      {
        id: 'road:main', roadClass: 'primary', width: 8, bridge: false, tunnel: false,
        points: [
          { longitude: -77.53745, latitude: 35.897 },
          { longitude: -77.53455, latitude: 35.897 },
        ],
      },
      {
        id: 'road:cross', roadClass: 'residential', width: 6, bridge: false, tunnel: false,
        points: [
          { longitude: -77.536, latitude: 35.89555 },
          { longitude: -77.536, latitude: 35.89845 },
        ],
      },
    ],
    buildings: [
      footprint('house:sw1', -0.00115, -0.00105),
      footprint('house:sw2', -0.00072, -0.00105),
      footprint('house:sw3', -0.00115, -0.00065),
      footprint('shop:se1', 0.00025, -0.00105),
      footprint('house:se2', 0.00068, -0.00105),
      footprint('house:se3', 0.00068, -0.00065),
      footprint('house:nw1', -0.00115, 0.00045),
      footprint('house:nw2', -0.00072, 0.00045),
      footprint('house:nw3', -0.00115, 0.00085),
      footprint('shop:ne1', 0.00025, 0.00045),
      footprint('house:ne2', 0.00068, 0.00045),
      footprint('house:ne3', 0.00068, 0.00085),
    ],
    water: [],
    land: [],
    elevation: {
      cols: 2, rows: 2,
      bbox: [-77.5375, 35.8955, -77.5345, 35.8985],
      values: [10, 10, 10, 10],
      resolution: 150,
    },
    attribution: [{
      label: 'Fixture', url: 'https://example.com', license: 'Test',
      licenseUrl: 'https://example.com/license',
    }],
    retrievedAt: '2026-07-22',
  };
};

describe('semantic district hard diagnostics', () => {
  it('persists a structurally valid district with real embedded interiors', () => {
    const input = source();
    const result = compileGeospatialMap(input, {
      seed: 27886,
      cityId: '69:miami:e08:2700000',
      geometry: { cols: 96, rows: 96, tile: 3 },
      style: 'tarboro',
      profile: 'tarboro',
      maxPlayableBuildings: 8,
    });

    expect(result.district.schemaVersion).toBe(2);
    expect(result.map.geospatial?.district).toEqual(result.district);
    expect(result.district.diagnostics.footprintRetention).toBeGreaterThanOrEqual(0.95);
    expect(result.district.diagnostics.unexplainedRoadOverlaps).toEqual([]);
    expect(result.district.diagnostics.disconnectedEntrances).toEqual([]);
    expect(result.district.diagnostics.disconnectedEmbeddedInteriors).toEqual([]);
    expect(result.district.diagnostics.vehicleAnchorsConnected).toBe(true);
    expect(result.district.diagnostics.walkableIslands).toEqual([]);
    const embedded = result.district.buildings.filter((building) => building.interiorPolicy === 'embedded');
    expect(embedded.length).toBeGreaterThanOrEqual(6);
    expect(embedded.length).toBeLessThanOrEqual(12);
    expect(result.map.houses).toHaveLength(embedded.length);
    expect(districtHardIssues(result.district, 6)).toEqual([]);

    const artifact = artifactFromMap(result.map, { classification: result.classification, source: input });
    expect(artifact.schemaVersion).toBe(2);
    expect(mapFromArtifact(artifact).geospatial?.district).toEqual(result.district);
  });

  it('names every violated hard invariant', () => {
    const result = compileGeospatialMap(source(), {
      seed: 27886, cityId: '69:miami:e08:2700000', geometry: { cols: 96, rows: 96, tile: 3 },
      style: 'tarboro', profile: 'tarboro', maxPlayableBuildings: 8,
    });
    result.district.diagnostics.footprintRetention = 0.5;
    result.district.diagnostics.unexplainedRoadOverlaps = ['building:a'];
    result.district.diagnostics.disconnectedEntrances = ['building:b'];
    result.district.diagnostics.vehicleAnchorsConnected = false;
    result.district.diagnostics.walkableIslands = [[99]];
    expect(districtHardIssues(result.district, 6).join('\n')).toMatch(
      /retention.*overlap.*entrance.*vehicle.*island/is,
    );
  });
});
