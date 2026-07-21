import { describe, expect, it } from 'vitest';
import { THEATER_DEFS, generateTheater } from '../src/sim/theaters';
import { deserializeDoc, serializeDoc } from '../src/sim/mapedit';
import { Rng } from '../src/sim/rng';

describe('vehicle theater catalog and base builder', () => {
  const seeds = [7, 31, 42, 99, 4207, 5150, 7749, 1337, 90210, 606];
  it('locks the six approved dimensions', () => {
    expect(Object.fromEntries(Object.entries(THEATER_DEFS).map(([id, def]) => [id, def.geometry]))).toEqual({
      city: { cols: 200, rows: 200, tile: 3 },
      desert: { cols: 300, rows: 300, tile: 3 },
      countryside: { cols: 300, rows: 300, tile: 3 },
      mountain: { cols: 200, rows: 300, tile: 3 },
      coastal: { cols: 300, rows: 200, tile: 3 },
      ocean: { cols: 300, rows: 300, tile: 3 },
    });
  });

  it('publishes typed routes and matching geometry', () => {
    const map = generateTheater('desert', 42);
    expect(map.geometry).toEqual(THEATER_DEFS.desert.geometry);
    expect(map.theater?.id).toBe('desert');
    expect(map.theater?.routes.some((route) => route.domain === 'air' && route.points.length >= 4)).toBe(true);
  });

  it('allocates complete layers and a sealed rim for every base theater', () => {
    for (const id of Object.keys(THEATER_DEFS) as Array<keyof typeof THEATER_DEFS>) {
      const map = generateTheater(id, 7);
      const { cols, rows } = map.geometry;
      expect(map.grid).toHaveLength(cols * rows);
      expect(map.grid2).toHaveLength(cols * rows);
      expect(map.surface).toHaveLength(cols * rows);
      for (let x = 0; x < cols; x++) {
        expect(map.grid[x]).not.toBe(0);
        expect(map.grid[(rows - 1) * cols + x]).not.toBe(0);
      }
    }
  });

  it('preserves route metadata through Map Maker serialization', () => {
    const map = generateTheater('city', 11);
    const doc = { frontId: null, size: 'large' as const, seed: 11, mode: 'tdm', map, claims: [], rng: new Rng(11), undoStack: [], redoStack: [] };
    const reopened = deserializeDoc(serializeDoc(doc));
    expect(reopened.map.theater).toEqual(map.theater);
  });

  it.each(['city', 'desert', 'countryside'] as const)('%s carries its land vehicle grammar', (id) => {
    for (const seed of seeds) {
      const map = generateTheater(id, seed);
      const ground = map.theater!.routes.filter((route) => route.domain === 'ground');
      const air = map.theater!.routes.filter((route) => route.domain === 'air');
      expect(ground.length).toBeGreaterThanOrEqual(3);
      expect(ground.every((route) => route.points.length >= 4 && route.width >= 15)).toBe(true);
      expect(air.some((route) => {
        const xs = route.points.map((point) => point.x);
        const zs = route.points.map((point) => point.z);
        return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) >= 540;
      })).toBe(true);
    }
  });

  it('city publishes named districts and two heavy through-routes without free dogfighting', () => {
    const map = generateTheater('city', 7749);
    expect(map.controlPoints.map((point) => point.name)).toEqual(expect.arrayContaining(['DOWNTOWN', 'RAIL YARD', 'RESIDENTIAL']));
    expect(map.theater!.routes.filter((route) => route.domain === 'ground' && route.width >= 24)).toHaveLength(2);
    expect(map.theater?.freeDogfight).toBe(false);
  });

  it('countryside supplies six distributed helicopter landing zones', () => {
    const map = generateTheater('countryside', 4207);
    expect(map.theater?.landingZones).toHaveLength(6);
    expect(new Set(map.theater?.landingZones.map((zone) => zone.side))).toEqual(new Set([0, 1, null]));
  });
});
