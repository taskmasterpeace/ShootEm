import { describe, expect, it } from 'vitest';
import {
  blankDoc,
  deserializeDoc,
  paintFloorTile,
  redo,
  serializeDoc,
  undo,
  type MapJSON,
} from '../src/sim/mapedit';
import { F2_FLOOR, F2_WALL, GRID } from '../src/sim/map';
import { ensureUpperFloor, floorLayer } from '../src/sim/map-layers';

describe('Map Maker document v2', () => {
  it('round-trips three storeys and building provenance', () => {
    const doc = blankDoc('small', 71);
    const third = ensureUpperFloor(doc.map, 2);
    doc.map.grid2[51 * GRID + 51] = F2_FLOOR;
    third[51 * GRID + 51] = F2_WALL;
    doc.map.buildingMeta = {
      cityId: '135:belgrade:aa0:100',
      archetype: 'command-villa',
      grammarVersion: 1,
      floors: 3,
    };

    const json = serializeDoc(doc);
    expect(json.v).toBe(2);
    if (json.v !== 2) throw new Error('expected v2');
    expect(json.upperLayers).toHaveLength(2);
    const back = deserializeDoc(JSON.parse(JSON.stringify(json)) as MapJSON);
    expect(back.map.upperLayers).toHaveLength(2);
    expect(back.map.upperLayers![0]).toBe(back.map.grid2);
    expect(Buffer.from(floorLayer(back.map, 2))).toEqual(Buffer.from(third));
    expect(back.map.buildingMeta).toEqual(doc.map.buildingMeta);
  });

  it('imports a legacy v1 document without inventing level three', () => {
    const v2 = serializeDoc(blankDoc('small', 72));
    const { upperLayers: _upperLayers, buildingMeta: _buildingMeta, ...base } = v2;
    const legacy = { ...base, v: 1 as const } as MapJSON;
    const doc = deserializeDoc(legacy);
    expect(doc.map.upperLayers).toBeUndefined();
    expect(floorLayer(doc.map, 1)).toBe(doc.map.grid2);
  });

  it('undo and redo preserve edits on level three', () => {
    const doc = blankDoc('small', 73);
    paintFloorTile(doc, 2, 48, 49, F2_WALL);
    expect(floorLayer(doc.map, 2)[49 * GRID + 48]).toBe(F2_WALL);
    expect(undo(doc)).toBe(true);
    expect(doc.map.upperLayers).toHaveLength(1);
    expect(() => floorLayer(doc.map, 2)).toThrow('no floor 2');
    expect(redo(doc)).toBe(true);
    expect(floorLayer(doc.map, 2)[49 * GRID + 48]).toBe(F2_WALL);
  });
});
