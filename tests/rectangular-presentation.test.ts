import { describe, expect, it } from 'vitest';
import { minimapPoint } from '../src/client/hud';
import { T_WALL, addPad, blankGeometryDoc, deserializeDoc, loadTheater, paintTile, serializeDoc, validateDoc } from '../src/sim/mapedit';
import { tileIndex, tileToWorld } from '../src/sim/map-geometry';

describe('rectangular presentation and authoring', () => {
  it('projects rectangular corners independently', () => {
    const geometry = { cols: 300, rows: 200, tile: 3 } as const;
    expect(minimapPoint(geometry, 240, { x: -450, y: 0, z: -300 })).toEqual([0, 0]);
    expect(minimapPoint(geometry, 240, { x: 450, y: 0, z: 300 })).toEqual([240, 240]);
    expect(minimapPoint(geometry, 240, { x: 0, y: 0, z: 0 })).toEqual([120, 120]);
  });

  it('round-trips and validates a 900x600 Map Maker document', () => {
    const geometry = { cols: 300, rows: 200, tile: 3 } as const;
    const doc = blankGeometryDoc(geometry, 77, 'savanna');
    expect(doc.map.grid).toHaveLength(60_000);
    expect(doc.map.grid2).toHaveLength(60_000);
    expect(doc.map.surface).toHaveLength(60_000);
    paintTile(doc, 250, 150, T_WALL);
    addPad(doc, 'tank', 260, 150);
    expect(doc.map.grid[tileIndex(geometry, 250, 150)]).toBe(T_WALL);
    expect(doc.map.vehiclePads[0].pos).toEqual(tileToWorld(geometry, 260, 150));
    expect(validateDoc(doc).ok).toBe(true);
    expect(deserializeDoc(serializeDoc(doc)).map.geometry).toEqual(geometry);
  });

  it.each(['city', 'desert', 'countryside', 'mountain', 'coastal', 'ocean'] as const)('loads the %s theater into Map Maker', (id) => {
    const doc = loadTheater(id, 77);
    expect(doc.frontId).toBe(`theater:${id}`);
    expect(doc.map.theater?.id).toBe(id);
    expect(deserializeDoc(serializeDoc(doc)).map.theater?.id).toBe(id);
  });
});
