import { describe, expect, it } from 'vitest';
import {
  backgroundWallStyle,
  paletteKeyForMap,
} from '../src/client/geospatial-visuals';
import { GEO_CLASS_BUILDING, GEO_CLASS_ROAD } from '../src/sim/geospatial/compiler';
import type { GameMap, GeospatialMapMeta } from '../src/sim/map';

const meta = (): GeospatialMapMeta => ({
  sourceId: 'miami-gardens-33056-civic-front',
  cityId: '69:miami:e08:2700000',
  style: 'miami-gardens',
  classification: Uint8Array.from([GEO_CLASS_ROAD, GEO_CLASS_BUILDING, GEO_CLASS_BUILDING]),
  buildingHeight: Uint8Array.from([0, 1, 4]),
  decor: [],
});

describe('geospatial district visuals', () => {
  it('selects the district palette before the fallback world theme', () => {
    const map = { theme: 'titan', geospatial: meta() } as GameMap;
    expect(paletteKeyForMap(map)).toBe('miami-gardens');
    expect(paletteKeyForMap({ theme: 'hardpan' } as GameMap)).toBe('hardpan');
  });

  it('styles only source building cells as low-rise Miami masses', () => {
    expect(backgroundWallStyle(meta(), 0)).toBeUndefined();
    expect(backgroundWallStyle(meta(), 1)).toEqual({ color: 0xd8cbb4, storeys: 1 });
    expect(backgroundWallStyle(meta(), 2)).toEqual({ color: 0xb8c8c2, storeys: 2 });
  });
});
