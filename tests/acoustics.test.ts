// ---------------------------------------------------------------------------
// THE SOUND-DESIGN LAW — you hear what your character would hear. These are
// the acoustic classes' sentences, verified: booms roll across the map,
// gunfire carries a street, a footstep dies at the wall.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, earshotFor } from '../src/client/audio';

describe('acoustic classes', () => {
  it('a cannon carries the map; a rifle carries a street; a footstep barely a room', () => {
    expect(earshotFor('cannon').range).toBeGreaterThanOrEqual(120);
    expect(earshotFor('explosion_big').range).toBeGreaterThanOrEqual(120);
    expect(earshotFor('rifle').range).toBeGreaterThan(earshotFor('flame').range);
    expect(earshotFor('footstep').range).toBeLessThanOrEqual(24);
    expect(earshotFor('footstep_grass').range).toBeLessThanOrEqual(24);
  });

  it('walls eat movement almost whole, dent gunfire, barely touch the booms', () => {
    expect(earshotFor('footstep').muffle).toBeGreaterThan(earshotFor('rifle').muffle);
    expect(earshotFor('rifle').muffle).toBeGreaterThan(earshotFor('explosion').muffle);
  });

  it('weather dulls the exposed sounds hardest (§8.8 sound column)', () => {
    expect(earshotFor('rifle').weather).toBeGreaterThan(earshotFor('footstep').weather);
  });

  it('every shipped sound resolves to a sane class — no zero ranges, no purple defaults', () => {
    for (const n of SOUND_NAMES) {
      const e = earshotFor(n);
      expect(e.range, n).toBeGreaterThan(0);
      expect(e.muffle, n).toBeGreaterThanOrEqual(0);
      expect(e.muffle, n).toBeLessThanOrEqual(1);
    }
  });
});
