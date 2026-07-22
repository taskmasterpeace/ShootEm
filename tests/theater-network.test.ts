import { describe, expect, it } from 'vitest';
import { assertMapIdentity, mapIdentity } from '../src/sim/map-identity';
import { generateTheater } from '../src/sim/theaters';
import { createPuppetWorld, mapHandshake } from '../src/sim/snapshot';
import { World } from '../src/sim/world';
import { ReplayPlayer } from '../src/client/replay';

describe('Theater network identity', () => {
  it('is stable for identical theater seeds and changes with the seed or terrain', () => {
    const first = generateTheater('mountain', 99);
    const again = generateTheater('mountain', 99);
    const other = generateTheater('mountain', 100);
    expect(mapIdentity(first)).toBe(mapIdentity(again));
    expect(mapIdentity(first)).not.toBe(mapIdentity(other));

    again.grid[again.grid.length >> 1] ^= 1;
    expect(mapIdentity(first)).not.toBe(mapIdentity(again));
  });

  it('hashes theater, seed, geometry, and every terrain layer', () => {
    const map = generateTheater('coastal', 42);
    const identity = mapIdentity(map);
    for (const layer of ['grid', 'grid2', 'surface'] as const) {
      const changed = generateTheater('coastal', 42);
      changed[layer][17] ^= 1;
      expect(mapIdentity(changed), layer).not.toBe(identity);
    }
    const changedGeometry = generateTheater('coastal', 42);
    changedGeometry.geometry = { ...changedGeometry.geometry, tile: changedGeometry.geometry.tile + 1 };
    expect(mapIdentity(changedGeometry)).not.toBe(identity);
  });

  it('fails fast when a client or replay regenerates different ground', () => {
    const map = generateTheater('ocean', 8080);
    expect(() => assertMapIdentity(map, mapIdentity(map))).not.toThrow();
    expect(() => assertMapIdentity(map, '00000000')).toThrow(/map identity mismatch/i);
  });

  it('regenerates the same theater for multiplayer puppets and replays', () => {
    const authoritative = new World({ seed: 404, mode: 'tdm', theaterId: 'desert' });
    const handshake = mapHandshake(authoritative);
    expect(handshake).toEqual({ theaterId: 'desert', mapIdentity: mapIdentity(authoritative.map) });

    const puppet = createPuppetWorld(404, 'tdm', authoritative.map.theme, handshake.theaterId, handshake.mapIdentity);
    expect(puppet.map.theater?.id).toBe('desert');
    expect(mapIdentity(puppet.map)).toBe(handshake.mapIdentity);

    const replay = new ReplayPlayer(404, 'tdm', authoritative.map.theme, handshake.theaterId, handshake.mapIdentity);
    expect(replay.world.map.theater?.id).toBe('desert');
    expect(mapIdentity(replay.world.map)).toBe(handshake.mapIdentity);
  });

  it('preserves classic generation when the welcome payload has no theater', () => {
    const puppet = createPuppetWorld(7, 'tdm', 'savanna');
    expect(puppet.map.theater).toBeUndefined();
  });
});
