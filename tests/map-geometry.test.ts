import { describe, expect, it } from 'vitest';
import {
  LEGACY_GEOMETRY,
  allocateLayer,
  clampWorld,
  geometryLength,
  tileIndex,
  tileToWorld,
  validateGeometry,
  worldDepth,
  worldToTile,
  worldWidth,
  wrapWorld,
} from '../src/sim/map-geometry';
import { blankDoc, deserializeDoc, serializeDoc, type MapJSON } from '../src/sim/mapedit';

describe('map-owned geometry', () => {
  const rect = { cols: 200, rows: 300, tile: 3 } as const;

  it('indexes and converts a 600x900 rectangular world', () => {
    expect(geometryLength(rect)).toBe(60_000);
    expect(worldWidth(rect)).toBe(600);
    expect(worldDepth(rect)).toBe(900);
    expect(tileIndex(rect, 199, 299)).toBe(59_999);
    const p = tileToWorld(rect, 0, 0);
    expect(p).toEqual({ x: -298.5, y: 0, z: -448.5 });
    expect(worldToTile(rect, p.x, p.z)).toEqual([0, 0]);
  });

  it('clamps and wraps each rectangular axis independently', () => {
    expect(clampWorld(rect, { x: 999, y: 0, z: -999 }, 3)).toEqual({ x: 297, y: 0, z: -447 });
    expect(wrapWorld(rect, { x: 301, y: 2, z: -451 }, 1)).toEqual({ x: -299, y: 2, z: 449 });
  });

  it('rejects malformed geometry and layer sizes', () => {
    expect(() => validateGeometry({ cols: 0, rows: 100, tile: 3 })).toThrow(/cols/);
    expect(() => validateGeometry(rect, allocateLayer(rect).subarray(1))).toThrow(/60000/);
  });

  it('serializes geometry and migrates v1 documents to legacy geometry', () => {
    const doc = blankDoc('small', 44);
    const serialized = serializeDoc(doc);
    expect(deserializeDoc(serialized).map.geometry).toEqual(doc.map.geometry);

    const old = { ...serialized, v: 1 } as unknown as Record<string, unknown>;
    delete old.geometry;
    expect(deserializeDoc(old as unknown as MapJSON).map.geometry).toEqual(LEGACY_GEOMETRY);
  });
});
