// ---------------------------------------------------------------------------
// THE SOUND-DESIGN LAW — you hear what your character would hear. These are
// the acoustic classes' sentences, verified: booms roll across the map,
// gunfire carries a street, a footstep dies at the wall.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, distanceCutoff, earshotFor } from '../src/client/audio';

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

// ---------------------------------------------------------------------------
// THE SOUND-DESIGN PASS — humanization discipline and the color of distance.
// ---------------------------------------------------------------------------
describe('humanization (per-class jitter)', () => {
  it('gunfire wears the widest wobble — repetition is the machine-gun tell', () => {
    expect(earshotFor('rifle').jitter).toBeGreaterThanOrEqual(0.08);
    expect(earshotFor('rifle').jitter).toBeGreaterThan(earshotFor('explosion').jitter);
  });

  it("the referee's whistle barely wavers — it is a pea, not a synth patch", () => {
    expect(earshotFor('whistle').jitter).toBeLessThanOrEqual(0.02);
  });

  it('every class jitters a sane amount — never still, never seasick', () => {
    for (const n of SOUND_NAMES) {
      const j = earshotFor(n).jitter;
      expect(j, n).toBeGreaterThan(0);
      expect(j, n).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('air absorption (distance darkens before it silences)', () => {
  it('close is bright, the edge of earshot is a rumble floor', () => {
    expect(distanceCutoff(2, 95)).toBeGreaterThan(10000);   // a rifle in your face cracks
    expect(distanceCutoff(94, 95)).toBeLessThan(1600);      // the same rifle far off thuds
    expect(distanceCutoff(94, 95)).toBeGreaterThan(1000);   // …but never drowns entirely
  });

  it('the curve only ever falls with distance', () => {
    let prev = Infinity;
    for (let d = 0; d <= 140; d += 10) {
      const c = distanceCutoff(d, 140);
      expect(c).toBeLessThanOrEqual(prev);
      prev = c;
    }
  });

  it('beyond earshot the floor holds — no negative or absurd cutoffs', () => {
    expect(distanceCutoff(500, 95)).toBeGreaterThanOrEqual(1100);
    expect(distanceCutoff(0, 1)).toBeLessThanOrEqual(16100);
  });
});
