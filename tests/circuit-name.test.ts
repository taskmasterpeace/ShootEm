// ───────────────────────────────────────────────────────────────────────────
// EVERY CIRCUIT HAS A NAME.
//
// The venues vary and describe themselves — but they all filed under one id,
// `savanna-circuit`, so the flowing 666u sweeper and the technical 486u loop
// OVERWROTE EACH OTHER on the record board, and the standings could not tell
// two racetracks apart. A record with no venue is not a record; it is the last
// person to drive.
//
// The name is derived from the seed, so it is stable and needs no store — and
// its TYPE half is read off the same character measurement the desk trusts, so
// a circuit called "…SWEEP" really flows and a "…KNOT" really is a knot.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { circuitName, circuitProfile, type CircuitCharacter } from '../src/sim/tracks';
import { circuitRing } from '../src/sim/map';
import { World } from '../src/sim/world';

const SEEDS = [7, 11, 42, 1234, 99999, 31337, 5150, 88, 314, 2718, 4040, 12321];
const nameFor = (seed: number) => {
  const p = circuitProfile(circuitRing(seed).gates.map((g) => ({ pos: g })));
  return { name: circuitName(seed, p.character), character: p.character };
};

describe('the name is stable, and it is a real id', () => {
  it('the same seed is the same name, forever', () => {
    for (const seed of SEEDS) {
      expect(circuitName(seed, 'sweeper')).toEqual(circuitName(seed, 'sweeper'));
    }
  });

  it('the id is a clean board key — lowercase, hyphenated, no spaces', () => {
    for (const seed of SEEDS) {
      const { name } = nameFor(seed);
      expect(name.id).toMatch(/^[a-z-]+$/);
      expect(name.id).toBe(name.name.toLowerCase().replace(/\s+/g, '-'));
    }
  });

  it('a name is a place AND a type — two words, both real', () => {
    for (const seed of SEEDS) {
      const parts = nameFor(seed).name.name.split(' ');
      expect(parts.length, `${nameFor(seed).name.name}`).toBeGreaterThanOrEqual(2);
      expect(parts.every((p) => p.length > 0)).toBe(true);
    }
  });
});

describe('the name never lies about the tarmac', () => {
  const SWEEP = ['SWEEP', 'FLYER', 'CURVE', 'MILE'];
  const TWIST = ['TWIST', 'KNOT', 'MAZE', 'SNAKE'];

  it('a sweeper is called a sweep-word and a technical is called a twist-word', () => {
    for (const c of ['sweeper', 'technical'] as CircuitCharacter[]) {
      const type = circuitName(1234, c).name.split(' ').pop()!;
      if (c === 'sweeper') expect(SWEEP, `sweeper got "${type}"`).toContain(type);
      if (c === 'technical') expect(TWIST, `technical got "${type}"`).toContain(type);
    }
  });

  it('the type word matches the measured character on every real circuit', () => {
    for (const seed of SEEDS) {
      const { name, character } = nameFor(seed);
      const type = name.name.split(' ').pop()!;
      if (character === 'sweeper') expect(SWEEP).toContain(type);
      if (character === 'technical') expect(TWIST).toContain(type);
    }
  });

  it('the same place can host a sweep and a knot — different venues, shared town', () => {
    // the place is the seed's; the type is the character's — so REDLINE SWEEP
    // and REDLINE KNOT are two circuits, the way real towns host two tracks
    const a = circuitName(7, 'sweeper');
    const b = circuitName(7, 'technical');
    expect(a.name.split(' ')[0]).toBe(b.name.split(' ')[0]);   // same place
    expect(a.id).not.toBe(b.id);                                // different venue
  });
});

describe('the board can finally tell circuits apart', () => {
  it('different savanna seeds file under different venue ids', () => {
    const ids = new Set<string>();
    for (const seed of [7, 42, 99999, 1234]) {
      const w = new World({ seed, mode: 'race', theme: 'savanna' } as never);
      ids.add(w.map.raceTrack!.venueId!);
    }
    expect(ids.size, 'circuits still share one record row').toBe(4);
  });

  it('the venue name lives on the track the sim actually built', () => {
    const w = new World({ seed: 99999, mode: 'race', theme: 'savanna' } as never);
    const rt = w.map.raceTrack!;
    expect(rt.venueName).toBeTruthy();
    expect(rt.venueId).toBe(rt.venueName!.toLowerCase().replace(/\s+/g, '-'));
    // and it agrees with naming the seed's ring straight
    const light = nameFor(99999).name;
    expect(rt.venueId).toBe(light.id);
  });

  it('the name and the character on the built track are consistent', () => {
    for (const seed of [7, 42, 99999]) {
      const w = new World({ seed, mode: 'race', theme: 'savanna' } as never);
      const rt = w.map.raceTrack!;
      const character = circuitProfile(rt.checkpoints).character;
      expect(rt.venueId).toBe(circuitName(seed, character).id);
    }
  });
});
