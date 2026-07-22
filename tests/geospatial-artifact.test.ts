import { describe, expect, it } from 'vitest';
import {
  artifactFromMap,
  decodeByteRuns,
  encodeByteRuns,
  mapFromArtifact,
} from '../src/sim/geospatial/artifact';
import { blankGeometryDoc } from '../src/sim/mapedit';
import type { GeoSliceSource } from '../src/sim/geospatial/types';

const source = (): GeoSliceSource => ({
  schemaVersion: 1,
  id: 'fixture',
  name: 'Fixture',
  bbox: [-1, -1, 1, 1],
  origin: { longitude: 0, latitude: 0 },
  roads: [], buildings: [], water: [], land: [],
  elevation: { cols: 2, rows: 2, bbox: [-1, -1, 1, 1], values: [0, 0, 0, 0], resolution: 1 },
  attribution: [{ label: 'Fixture data', url: 'https://example.com', license: 'Test', licenseUrl: 'https://example.com/license' }],
  retrievedAt: '2026-07-22',
});

describe('geospatial artifact codec', () => {
  it('round-trips byte runs and rejects malformed streams', () => {
    const bytes = Uint8Array.from([0, 0, 0, 4, 4, 2, 2, 2, 2]);
    expect(decodeByteRuns(encodeByteRuns(bytes), bytes.length)).toEqual(bytes);
    expect(() => decodeByteRuns([0, 3, 1], 4)).toThrow(/run/i);
    expect(() => decodeByteRuns([0, 5], 4)).toThrow(/length/i);
  });

  it('restores a normal GameMap without sharing artifact object arrays', () => {
    const doc = blankGeometryDoc({ cols: 16, rows: 16, tile: 3 }, 4207, 'titan');
    doc.map.height = Uint8Array.from({ length: 256 }, (_, index) => index % 3);
    doc.map.ramp = Uint8Array.from({ length: 256 }, (_, index) => index % 11 === 0 ? 1 : 0);
    const classification = Uint8Array.from({ length: 256 }, (_, index) => index % 5);
    const artifact = artifactFromMap(doc.map, {
      classification,
      source: source(),
      overlay: [{ index: 42, reason: 'mission_anchor' }],
    });
    const restored = mapFromArtifact(artifact);

    expect(restored.grid).toEqual(doc.map.grid);
    expect(restored.height).toEqual(doc.map.height);
    expect(restored.ramp).toEqual(doc.map.ramp);
    expect(artifact.geography.classification).toEqual(encodeByteRuns(classification));
    restored.controlPoints[0].name = 'changed';
    expect(artifact.gameplay.objects.controlPoints[0].name).not.toBe('changed');
  });
});
