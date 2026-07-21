// ---------------------------------------------------------------------------
// §16.4 / W7.4 — per-material impact VFX. The renderer no longer hardcodes
// three buckets; it reads each substance's `.impact` kind straight off the
// materials table. This pins that contract: a round meeting each tile/surface
// must resolve to the RIGHT debris, so wood splinters, water splashes, ice
// shatters and grass rustles instead of all thudding as generic dirt.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  S_GRIT, S_ICE, S_PLATE, S_WET, T_COVER, T_DOOR, T_GRASS, T_METAL, T_WALL, T_WATER,
} from '../src/sim/map';
import { MATERIALS, materialForSurface, materialOf, type ImpactKind } from '../src/sim/materials';

const KINDS: ImpactKind[] = ['spark', 'dust', 'splinter', 'puff', 'splash', 'shatter', 'rustle', 'chips'];

describe('per-material impact kind (W7.4 contract)', () => {
  it('a structural tile answers as its own fabric', () => {
    expect(materialOf(T_METAL).impact).toBe('spark');   // metal FLASHES
    expect(materialOf(T_WALL).impact).toBe('dust');      // masonry hangs dust
    expect(materialOf(T_DOOR).impact).toBe('splinter');  // wood throws splinters
    expect(materialOf(T_WATER).impact).toBe('splash');   // water leaps
    expect(materialOf(T_COVER).impact).toBe('puff');     // an earthwork puffs, never sparks
    expect(materialOf(T_GRASS).impact).toBe('rustle');   // grass rustles
  });

  it('open ground answers as the SURFACE you walk on', () => {
    expect(materialForSurface(S_ICE).impact).toBe('shatter');  // ice shatters bright
    expect(materialForSurface(S_PLATE).impact).toBe('spark');  // the deck is metal
    expect(materialForSurface(S_WET).impact).toBe('splash');   // a wet floor splashes
    expect(materialForSurface(S_GRIT).impact).toBe('puff');    // grit puffs
  });

  it('every material carries a valid, renderable impact kind', () => {
    for (const m of Object.values(MATERIALS)) {
      expect(KINDS).toContain(m.impact);
    }
  });

  it('the distinct materials genuinely span more than the old 3 buckets', () => {
    const distinct = new Set(Object.values(MATERIALS).map(m => m.impact));
    // splinter / splash / shatter / rustle are the four that used to collapse
    // into "dirt" — their presence is the whole point of this slice.
    for (const k of ['splinter', 'splash', 'shatter', 'rustle'] as ImpactKind[]) {
      expect(distinct.has(k), `${k} must be a real, distinct impact`).toBe(true);
    }
    expect(distinct.size).toBeGreaterThanOrEqual(6);
  });
});
