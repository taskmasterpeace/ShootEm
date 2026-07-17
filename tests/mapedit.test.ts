// ---------------------------------------------------------------------------
// THE MAP MAKER ENGINE'S LAWS — the editing core holds the same oath the
// shipped fronts do: a map that leaves the maker clean enters the suite clean.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  blankDoc, loadFront, serializeDoc, deserializeDoc, validateDoc,
  paintTile, paintSurface, placeProp, erasePropAt,
  addControlPoint, addPickup, addPad, addMouth, moveObject, deleteObject, pickObject,
  stamp, deleteHouse, undo, redo, buildingById,
  T_WALL, T_OPEN, T_WATER, S_MUD,
} from '../src/sim/mapedit';
import { GRID, TILE, WORLD, T_DEEP, T_SLIT } from '../src/sim/map';
import { FRONT_GROUNDS } from '../src/sim/fronts';

const tw = (tx: number, tz: number) => ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });

describe('the map maker engine', () => {
  it('every front loads CLEAN at every tier — the maker starts from lawful ground', () => {
    for (const id of Object.keys(FRONT_GROUNDS)) {
      for (const size of ['small', 'standard', 'large'] as const) {
        const doc = loadFront(id, 4207, size);
        const report = validateDoc(doc);
        expect(report.ok, `${id}.${size} fails laws out of the gate: ${report.issues.map((i) => i.law).join(', ')}`).toBe(true);
      }
    }
  });

  it('wall off the enemy base and ZERO ORPHANS + READABLE fire', () => {
    const doc = loadFront('eastern_plains', 4207, 'large');
    // seal the enemy base inside a wall box
    const [bx] = [doc.map.basePos[1].x, doc.map.basePos[1].z];
    void bx;
    const btx = Math.floor((doc.map.basePos[1].x + WORLD / 2) / TILE);
    const btz = Math.floor((doc.map.basePos[1].z + WORLD / 2) / TILE);
    for (let i = -8; i <= 8; i++) {
      paintTile(doc, btx + i, btz - 8, T_WALL);
      paintTile(doc, btx + i, btz + 8, T_WALL);
      paintTile(doc, btx - 8, btz + i, T_WALL);
      paintTile(doc, btx + 8, btz + i, T_WALL);
    }
    const report = validateDoc(doc);
    expect(report.ok).toBe(false);
    const laws = report.issues.map((i) => i.law);
    expect(laws).toContain('READABLE'); // the base itself can't be reached
  });

  it('a sealed pocket in midfield trips ZERO ORPHANS with the right tiles', () => {
    const doc = loadFront('eastern_plains', 4207, 'standard');
    for (let i = -2; i <= 2; i++) {
      paintTile(doc, 50 + i, 30, T_WALL);
      paintTile(doc, 50 + i, 34, T_WALL);
      paintTile(doc, 48, 30 + 2 + i, T_WALL);
      paintTile(doc, 52, 30 + 2 + i, T_WALL);
    }
    const report = validateDoc(doc);
    const orphanLaw = report.issues.find((i) => i.law === 'ZERO ORPHANS');
    expect(orphanLaw, 'the pocket should burn').toBeTruthy();
    expect(orphanLaw!.tiles.some(([x, z]) => x === 50 && z === 32)).toBe(true);
  });

  it('prop place/erase keeps claims married — the invisible-wall law both ways', () => {
    const doc = loadFront('eastern_plains', 4207, 'small');
    placeProp(doc, 'rock', 40, 30, 1.4, 0);
    expect(doc.map.grid[30 * GRID + 40]).toBe(T_WALL);
    expect(doc.map.propCovered).toContain(30 * GRID + 40);
    expect(validateDoc(doc).issues.find((i) => i.law === 'WALLS')).toBeUndefined();
    expect(erasePropAt(doc, 40, 30)).toBe(true);
    expect(doc.map.grid[30 * GRID + 40]).toBe(T_OPEN);
    expect(doc.map.propCovered).not.toContain(30 * GRID + 40);
    expect(validateDoc(doc).ok).toBe(true);
  });

  it('stamp a building, walk in, then delete it whole', () => {
    const doc = loadFront('eastern_plains', 4207, 'large');
    const before = doc.map.houses.length;
    expect(stamp(doc, buildingById('bunker'), 44, 40)).toBe(true);
    expect(doc.map.houses.length).toBe(before + 1);
    expect(validateDoc(doc).ok, 'a stamped bunker should stay lawful').toBe(true);
    // slits and doors came with it
    expect([...doc.map.grid].some((t) => t === T_SLIT)).toBe(true);
    expect(deleteHouse(doc, before)).toBe(true);
    expect(doc.map.houses.length).toBe(before);
    expect(validateDoc(doc).ok).toBe(true);
  });

  it('objects: add, move, pick, delete — bases carry their spawns', () => {
    const doc = blankDoc('small', 99);
    addControlPoint(doc, 30, 49, 'TEST');
    const cp = doc.map.controlPoints[doc.map.controlPoints.length - 1];
    expect(cp.name).toBe('TEST');
    const ref = pickObject(doc, cp.pos.x, cp.pos.z)!;
    expect(ref).toEqual({ kind: 'cp', index: doc.map.controlPoints.length - 1 });
    moveObject(doc, ref!, 32, 51);
    expect(doc.map.controlPoints[doc.map.controlPoints.length - 1].pos).toEqual(tw(32, 51));
    expect(deleteObject(doc, ref!)).toBe(true);

    addPickup(doc, 'medkit', 40, 49);
    addPad(doc, 'tank', 42, 49);
    addMouth(doc, 44, 49);
    expect(doc.map.pickups.length).toBe(1);
    expect(doc.map.vehiclePads[0].team).toBe(0); // west half
    expect(doc.map.zombieSpawns.length).toBe(1);

    // moving the base moves the spawn ring with it
    const before = doc.map.spawns[0].map((s) => ({ ...s }));
    moveObject(doc, { kind: 'base', team: 0 }, 25, 49);
    expect(doc.map.spawns[0][0]).not.toEqual(before[0]);
    expect(validateDoc(doc).ok, 'blank canvas with edits stays lawful').toBe(true);
  });

  it('undo/redo walks the doc backward and forward', () => {
    const doc = loadFront('the_city', 4207, 'small');
    const laddersBefore = [...doc.map.grid].filter((t) => t === 8).length;
    paintTile(doc, 30, 61, T_OPEN); // erase a manhole column area
    const laddersAfter = [...doc.map.grid].filter((t) => t === 8).length;
    expect(laddersAfter).toBeLessThan(laddersBefore);
    expect(undo(doc)).toBe(true);
    expect([...doc.map.grid].filter((t) => t === 8).length).toBe(laddersBefore);
    expect(redo(doc)).toBe(true);
    expect([...doc.map.grid].filter((t) => t === 8).length).toBe(laddersAfter);
  });

  it('serialize → deserialize round-trips byte-for-byte on the grids', () => {
    const doc = loadFront('the_city', 4207, 'standard');
    paintSurface(doc, 40, 40, S_MUD, 3);
    paintTile(doc, 40, 40, T_WATER, 2);
    const json = serializeDoc(doc);
    const back = deserializeDoc(JSON.parse(JSON.stringify(json)));
    expect(Buffer.from(back.map.grid).equals(Buffer.from(doc.map.grid))).toBe(true);
    expect(Buffer.from(back.map.surface).equals(Buffer.from(doc.map.surface))).toBe(true);
    expect(back.map.houses.length).toBe(doc.map.houses.length);
    expect(validateDoc(back).ok).toBe(true);
  });

  it('a water trench painted through a wall re-opens the route (paint is real)', () => {
    const doc = loadFront('highland_pass', 4207, 'small');
    // carve a brand-new canal through the rock from west to east edge of the box
    for (let x = 20; x <= 79; x++) paintTile(doc, x, 55, T_DEEP);
    const report = validateDoc(doc);
    expect(report.issues.find((i) => i.law === 'ZERO ORPHANS')).toBeUndefined();
  });

  it('deleteHouse on the city sewer opens the tunnel and kills its claims', () => {
    const doc = loadFront('the_city', 4207, 'small');
    const trunks = doc.map.houses.map((h, i) => ({ h, i })).filter(({ h }) => h.tw === 4 && h.th >= 5);
    expect(trunks.length).toBeGreaterThanOrEqual(2);
    const claimsBefore = doc.claims.length;
    expect(deleteHouse(doc, trunks[0].i)).toBe(true);
    expect(doc.claims.length).toBeLessThan(claimsBefore);
    // the tunnel corridor is open ground now — and still lawful (it was a through-route)
    expect(validateDoc(doc).issues.find((i) => i.law === 'WALLS')).toBeUndefined();
  });
});
