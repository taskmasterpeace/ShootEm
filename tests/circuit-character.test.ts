// ───────────────────────────────────────────────────────────────────────────
// THE CIRCUIT'S CHARACTER — what kind of racetrack this is.
//
// Last cycle gave the procedural circuit a real SHAPE (510–724u, 10–13 gates,
// every seed a different ribbon). But a venue that varies and cannot say HOW is
// still not a place: the league had seven different racetracks and one
// description. A sport talks about its circuits — the fast one, the twisty one,
// the one with the long back straight — and that talk is most of what makes a
// fixture list feel like a season instead of a queue.
//
// THE LAW: THE CHARACTER IS MEASURED, NEVER ASSIGNED. Every figure is read off
// the checkpoint ring itself, so a circuit can never be described as a flowing
// sweeper while actually being a knot of hairpins — the same repair the reticle
// and the service file needed. These tests exist to keep the words honest.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { CHARACTER_LABEL, circuitProfile } from '../src/sim/tracks';
import { circuitRing } from '../src/sim/map';
import { World } from '../src/sim/world';

const SEEDS = [7, 11, 42, 1234, 99999, 31337, 5150];
const profileOf = (seed: number) =>
  circuitProfile(circuitRing(seed).gates.map((g) => ({ pos: g })));

/** a perfect circle: the flowing extreme */
const ring = (n: number, r: number) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return { pos: { x: Math.cos(a) * r, z: Math.sin(a) * r } };
});

describe('the description is measured off the tarmac', () => {
  it('a big smooth ring reads as a sweeper; a tight one does not', () => {
    const big = circuitProfile(ring(16, 120));
    const tight = circuitProfile(ring(16, 22));
    expect(big.turnPerUnit).toBeLessThan(tight.turnPerUnit);
    expect(big.character).toBe('sweeper');
  });

  it('length and longest straight are real geometry, not vibes', () => {
    const p = circuitProfile(ring(12, 100));
    const circumference = 2 * Math.PI * 100;
    // a 12-gon inscribed in r=100 is a little under the true circumference
    expect(p.length).toBeGreaterThan(circumference * 0.9);
    expect(p.length).toBeLessThan(circumference * 1.02);
    expect(p.longestStraight).toBeGreaterThan(0);
    expect(p.longestStraight).toBeLessThan(p.length);
  });

  it('a degenerate ring says so instead of inventing a racetrack', () => {
    const p = circuitProfile([{ pos: { x: 0, z: 0 } }, { pos: { x: 1, z: 1 } }]);
    expect(p.length).toBe(0);
    expect(p.strap).toMatch(/unfinished/i);
  });
});

describe('the venues actually differ in character', () => {
  it('the seeds do not all come back as the same kind of circuit', () => {
    const kinds = new Set(SEEDS.map((s) => profileOf(s).character));
    expect(kinds.size, `every circuit is ${[...kinds][0]}`).toBeGreaterThan(1);
  });

  it('every circuit gets a label and a sentence with real numbers in it', () => {
    for (const seed of SEEDS) {
      const p = profileOf(seed);
      expect(CHARACTER_LABEL[p.character]).toBeTruthy();
      expect(p.strap.length).toBeGreaterThan(30);
      expect(p.strap).toMatch(/\d/);            // it cites a figure
      expect(p.gates).toBe(circuitRing(seed).gates.length);
      expect(p.length).toBeGreaterThan(300);
      expect(p.hardCorners).toBeGreaterThanOrEqual(0);
    }
  });

  it('the sentence agrees with the numbers behind it', () => {
    for (const seed of SEEDS) {
      const p = profileOf(seed);
      if (p.character === 'sweeper') {
        expect(p.strap, `seed ${seed}`).toMatch(/flowing/);
        expect(p.strap).toContain(String(p.longestStraight));
      }
      if (p.character === 'technical') {
        expect(p.strap, `seed ${seed}`).toMatch(/technical/);
        expect(p.strap).toContain(String(p.hardCorners));
      }
    }
  });

  it('a long circuit is called long and a short one short', () => {
    expect(circuitProfile(ring(20, 130)).strap).toMatch(/^A long/);
    expect(circuitProfile(ring(10, 55)).strap).toMatch(/^A short/);
  });
});

describe('the desk and the tarmac can never disagree', () => {
  it('the light ring the laptop reads IS the ring the map carves', () => {
    for (const seed of [7, 42, 99999]) {
      const w = new World({ seed, mode: 'race', theme: 'savanna' } as never);
      const built = w.map.raceTrack!.checkpoints;
      const light = circuitRing(seed).gates;
      expect(light.length).toBe(built.length);
      built.forEach((c, i) => {
        expect(c.pos.x).toBeCloseTo(light[i].x, 9);
        expect(c.pos.z).toBeCloseTo(light[i].z, 9);
      });
    }
  });

  it('describing a venue costs no world — the laptop stays a laptop', () => {
    // circuitRing allocates no grids; it is pure geometry, so a fixture list
    // can describe next week's circuit without building next week's map
    const before = Date.now();
    for (let i = 0; i < 400; i++) profileOf(i);
    expect(Date.now() - before, '400 venue descriptions should be instant').toBeLessThan(2000);
  });

  it('the same seed is the same circuit, described the same way', () => {
    for (const seed of SEEDS) {
      expect(JSON.stringify(profileOf(seed))).toBe(JSON.stringify(profileOf(seed)));
    }
  });
});
