import { describe, expect, it } from 'vitest';
import { artifactFromMap, mapFromArtifact } from '../src/sim/geospatial/artifact';
import type { GeoSliceSource, SemanticDistrict } from '../src/sim/geospatial/types';
import { blankGeometryDoc } from '../src/sim/mapedit';

const source: GeoSliceSource = {
  schemaVersion: 1,
  id: 'semantic-fixture',
  name: 'Semantic Fixture',
  bbox: [-1, -1, 1, 1],
  origin: { longitude: 0, latitude: 0 },
  roads: [],
  buildings: [],
  water: [],
  land: [],
  elevation: { cols: 2, rows: 2, bbox: [-1, -1, 1, 1], values: [0, 0, 0, 0], resolution: 1 },
  attribution: [{
    label: 'Fixture data',
    url: 'https://example.com/data',
    license: 'Test',
    licenseUrl: 'https://example.com/license',
  }],
  retrievedAt: '2026-07-22',
};

const district: SemanticDistrict = {
  schemaVersion: 2,
  id: 'semantic-fixture',
  name: 'Semantic Fixture',
  profile: 'tarboro',
  source,
  roads: [{
    id: 'road:main',
    sourceRoadId: 'way/1',
    roadClass: 'residential',
    kind: 'carriageway',
    width: 7,
    centerline: [{ x: -12, z: 0 }, { x: 12, z: 0 }],
    connectorIds: ['connector:west', 'connector:east'],
    cells: [127, 128, 129],
  }],
  blocks: [{
    id: 'block:north',
    polygon: [{ x: -12, z: 3 }, { x: 12, z: 3 }, { x: 12, z: 12 }, { x: -12, z: 12 }],
    cells: [143, 144, 145],
    area: 216,
    buildingIds: ['building:house'],
    lotIds: ['lot:house'],
  }],
  lots: [{
    id: 'lot:house',
    blockId: 'block:north',
    polygon: [{ x: -6, z: 4 }, { x: 6, z: 4 }, { x: 6, z: 12 }, { x: -6, z: 12 }],
    cells: [144],
    buildingIds: ['building:house'],
    frontageRoadId: 'road:main',
    frontage: [{ x: -6, z: 4 }, { x: 6, z: 4 }],
    setback: 3,
    yardDepth: 5,
    parking: false,
  }],
  buildings: [{
    id: 'building:house',
    footprint: [{ x: -3, z: 7 }, { x: 3, z: 7 }, { x: 3, z: 11 }, { x: -3, z: 11 }],
    blockId: 'block:north',
    lotId: 'lot:house',
    use: { value: 'residential', source: 'osm', confidence: 'high' },
    floors: { value: 2, source: 'nsi', confidence: 'high' },
    height: { value: 7.2, source: 'nsi', confidence: 'high' },
    archetype: 'historic-house',
    roof: 'gable',
    facade: 'porch',
    entrances: [{
      id: 'entrance:house',
      buildingId: 'building:house',
      position: { x: 0, z: 7 },
      facing: Math.PI,
      pedestrianConnector: [144, 128],
    }],
    interiorPolicy: 'embedded',
  }],
  land: [],
  water: [],
  elevation: source.elevation,
  diagnostics: {
    sourceBuildingCount: 1,
    retainedBuildingCount: 1,
    footprintRetention: 1,
    unexplainedRoadOverlaps: [],
    disconnectedEntrances: [],
    disconnectedEmbeddedInteriors: [],
    vehicleAnchorsConnected: true,
    walkableIslands: [],
    removedBuildings: [],
    warnings: [],
  },
  attribution: source.attribution,
};

describe('semantic geospatial artifact', () => {
  it('round-trips the v2 street, block, lot, building, and entrance graph', () => {
    const doc = blankGeometryDoc({ cols: 16, rows: 16, tile: 3 }, 27886, 'titan');
    const classification = new Uint8Array(256);
    doc.map.geospatial = {
      sourceId: source.id,
      cityId: 'tarboro-town-common',
      style: 'tarboro',
      classification,
      buildingHeight: new Uint8Array(256),
      decor: [],
      district,
    };

    const artifact = artifactFromMap(doc.map, { classification, source });
    expect(artifact.schemaVersion).toBe(2);

    const restored = mapFromArtifact(artifact);
    expect(restored.geospatial?.district).toEqual(district);
    expect(restored.geospatial?.district?.roads[0].connectorIds).toEqual([
      'connector:west',
      'connector:east',
    ]);
    expect(restored.geospatial?.district?.buildings[0].entrances[0].pedestrianConnector).toEqual([144, 128]);
  });
});
