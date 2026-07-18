// ---------------------------------------------------------------------------
// THE SOUND-DESIGN LAW — you hear what your character would hear. These are
// the acoustic classes' sentences, verified: booms roll across the map,
// gunfire carries a street, a footstep dies at the wall.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, distanceCutoff, earshotFor, voVoicesToCut } from '../src/client/audio';

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
// THE VOICE CAP — a teamfight used to stack a dozen gods talking at once
// (uncapped bus, 30ms same-name throttle only). The bus now holds at most 2
// positional god-mouths + 1 announcer; the rest yield oldest-first.
// ---------------------------------------------------------------------------
describe('voice cap — no wall of overlapping VO', () => {
  // model the live-voice list evolving as lines fire, applying the policy each time
  const fire = (live: { ann: boolean }[], ann: boolean) => {
    const cut = new Set(voVoicesToCut(live, ann));
    const next = live.filter((v) => !cut.has(v));
    next.push({ ann });
    return next;
  };

  it('five god lines in a row leave at most 2 voices live', () => {
    let live: { ann: boolean }[] = [];
    for (let i = 0; i < 5; i++) {
      live = fire(live, false);
      expect(live.filter((v) => !v.ann).length, `after ${i + 1} god lines`).toBeLessThanOrEqual(2);
    }
  });

  it('the announcer never talks over itself', () => {
    let live: { ann: boolean }[] = [];
    for (let i = 0; i < 4; i++) {
      live = fire(live, true);
      expect(live.filter((v) => v.ann).length, `after ${i + 1} announcer calls`).toBe(1);
    }
  });

  it('a fresh god line always gets a slot (newest survives)', () => {
    // two gods live, a third fires — the oldest yields, the newcomer plays
    let live: { ann: boolean }[] = [{ ann: false }, { ann: false }];
    const cut = voVoicesToCut(live, false);
    expect(cut.length).toBe(1);            // exactly one yields
    live = fire(live, false);
    expect(live.filter((v) => !v.ann).length).toBe(2);
  });

  it('gods and the announcer share the bus without cutting each other', () => {
    let live: { ann: boolean }[] = [{ ann: false }, { ann: false }];
    live = fire(live, true);               // announcer joins
    expect(live.filter((v) => !v.ann).length).toBe(2); // gods untouched
    expect(live.filter((v) => v.ann).length).toBe(1);
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
