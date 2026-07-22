import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { generateTheater } from '../src/sim/theaters';
import { validateTheater } from '../src/sim/theater-builder';

describe('real-city theater integration', () => {
  it('hydrates a fresh validated Miami Gardens map for every match', () => {
    const first = generateTheater('geocity', 4207);
    const second = generateTheater('geocity', 99);

    expect(first.geometry).toEqual({ cols: 300, rows: 300, tile: 3 });
    expect(first.theater?.name).toContain('Miami Gardens');
    expect(first.geospatial?.sourceId).toBe('miami-gardens-33056-civic-front');
    expect(first.geospatial?.style).toBe('miami-gardens');
    expect(first.houses.length).toBeGreaterThanOrEqual(2);
    expect(first.controlPoints.map((point) => point.name)).toEqual([
      '183RD STREET',
      'CIVIC CENTER',
      'CAROL CITY EAST',
    ]);
    expect(first.height).toHaveLength(90_000);
    expect(validateTheater(first).issues).toEqual([]);
    expect(first.seed).toBe(4207);
    expect(second.seed).toBe(99);
    first.grid[1] = 255;
    expect(second.grid[1]).not.toBe(255);
  });

  it('launches through the normal World theater path', () => {
    const world = new World({ seed: 4207, mode: 'conquest', theaterId: 'geocity', botsPerTeam: 0 });
    expect(world.map.grid).toHaveLength(90_000);
    expect(world.map.theater?.id).toBe('geocity');
  });
});
