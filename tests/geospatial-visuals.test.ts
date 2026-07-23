import { describe, expect, it } from 'vitest';
import {
  backgroundWallStyle,
  buildSemanticDistrictVisuals,
  paletteKeyForMap,
  semanticBuildingVisualSpecs,
  semanticShellCellSet,
} from '../src/client/geospatial-visuals';
import type { GeospatialMapMeta } from '../src/sim/map';
import type { SemanticBuilding, SemanticDistrict } from '../src/sim/geospatial/types';
import { THEME_PALETTES } from '../src/client/renderer';

const building = (
  id: string,
  interiorPolicy: SemanticBuilding['interiorPolicy'],
  floors: number,
  height: number,
  offset = 0,
): SemanticBuilding => ({
  id,
  footprint: [
    { x: offset, z: 0 }, { x: offset + 18, z: 0 },
    { x: offset + 18, z: 12 }, { x: offset, z: 12 },
  ],
  blockId: 'block:1',
  lotId: `lot:${id}`,
  use: { value: 'office', source: 'osm', confidence: 'high' },
  floors: { value: floors, source: 'osm', confidence: 'high' },
  height: { value: height, source: 'osm', confidence: 'high' },
  archetype: 'masonry-tower',
  roof: floors > 3 ? 'flat' : 'gable',
  facade: floors > 3 ? 'podium-tower' : 'porch',
  entrances: [{
    id: `entrance:${id}`, buildingId: id, position: { x: offset + 9, z: 0 },
    facing: Math.PI, pedestrianConnector: [1, 2],
  }],
  interiorPolicy,
});

const meta = (style: GeospatialMapMeta['style']): GeospatialMapMeta => {
  const buildings = [
    building('tower', 'instanced', 28, 112),
    building('playable', 'embedded', 2, 8, 24),
  ];
  return {
    sourceId: 'fixture',
    cityId: 'fixture-city',
    style,
    classification: Uint8Array.from([3, 3, 0, 0]),
    buildingHeight: Uint8Array.from([10, 1, 0, 0]),
    decor: [],
    district: {
      schemaVersion: 2,
      id: 'fixture', name: 'Fixture', profile: style === 'tarboro' ? 'tarboro' : 'lower-manhattan',
      buildings,
    } as unknown as SemanticDistrict,
  };
};

describe('semantic district visuals', () => {
  it('selects distinct real-city palette keys', () => {
    expect(paletteKeyForMap({ theme: 'titan', geospatial: meta('lower-manhattan') })).toBe('lower-manhattan');
    expect(paletteKeyForMap({ theme: 'titan', geospatial: meta('tarboro') })).toBe('tarboro');
    expect(THEME_PALETTES['lower-manhattan']).toBeTruthy();
    expect(THEME_PALETTES.tarboro).toBeTruthy();
  });

  it('does not cap legacy background massing at two storeys', () => {
    expect(backgroundWallStyle(meta('lower-manhattan'), 0)?.storeys).toBe(10);
  });

  it('preserves measured height and excludes embedded interiors from shells', () => {
    const specs = semanticBuildingVisualSpecs(meta('lower-manhattan'));
    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({ id: 'tower', height: 112, floors: 28, roof: 'flat' });
    expect(specs[0].windowModules).toBeGreaterThan(100);
    expect(semanticShellCellSet(meta('lower-manhattan'), { cols: 32, rows: 32, tile: 3 }).size).toBeGreaterThan(0);
  });

  it('builds named low-poly shells with instanced facade modules', () => {
    const group = buildSemanticDistrictVisuals(meta('lower-manhattan'));
    expect(group?.name).toBe('semantic-district:fixture');
    expect(group?.getObjectByName('semantic-shell:tower')).toBeTruthy();
    expect(group?.getObjectByName('semantic-windows')).toBeTruthy();
    expect(group?.getObjectByName('semantic-shell:playable')).toBeFalsy();
    expect(group?.userData.semanticBuildingCount).toBe(1);
    expect(group?.userData.facadeBatchCount).toBeGreaterThan(0);
  });
});
