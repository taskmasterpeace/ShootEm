// ───────────────────────────────────────────────────────────────────────────
// THE HOUSE RECORD — somebody else's name, already on the machine.
//
// A cabinet showed YOUR best and nothing else, so walking up to a machine you
// had never played said "NO SCORE ON THIS MACHINE" and gave you nothing to
// chase. That is the one thing a real arcade always has: a name on the glass
// you did not put there.
//
// The mark is DERIVED from the machine — its cartridge and where it stands — so
// it is stable, needs no store, and differs between machines. The par comes off
// the cartridge itself, because every game scores in its own currency at its
// own scale: NIGHTWATCH tops out at 8 hours while DEEP SHAFT runs past 160
// metres, and one number across the shelf would be meaningless on both.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { cabinetKey, houseRecord } from '../src/client/arcade';
import { CARTRIDGES } from '../src/client/gonet/cartridges';
import { GAMES, type GameInput } from '../src/client/gonet/cartridge-games';

const IDLE: GameInput = { up: false, down: false, left: false, right: false, fire: false };

describe('every machine carries a mark', () => {
  it('every cartridge on the shelf has a par to chase', () => {
    for (const c of CARTRIDGES) {
      expect(c.housePar, `${c.title} has no par`).toBeGreaterThan(0);
    }
  });

  it('a machine always shows a name and a number', () => {
    for (const c of CARTRIDGES) {
      const rec = houseRecord(cabinetKey(c.id, 10, 10), c.id)!;
      expect(rec.name.length).toBeGreaterThan(1);
      expect(rec.score).toBeGreaterThan(0);
    }
  });

  it('the same machine always shows the SAME mark', () => {
    const key = cabinetKey('orbit_run', 42, -17);
    expect(houseRecord(key, 'orbit_run')).toEqual(houseRecord(key, 'orbit_run'));
  });

  it('two machines running one game are two different boards', () => {
    const marks = [[10, 10], [40, -22], [-88, 5], [7, 300]]
      .map(([x, z]) => houseRecord(cabinetKey('orbit_run', x, z), 'orbit_run')!);
    const distinct = new Set(marks.map((m) => `${m.name}:${m.score}`));
    expect(distinct.size, 'every ORBIT RUN in the world is the same board').toBeGreaterThan(1);
  });

  it('an unknown cartridge has no mark rather than a made-up one', () => {
    expect(houseRecord('x@0,0', 'not_a_game' as never)).toBeNull();
  });
});

describe('the mark is reachable in that game\'s own currency', () => {
  it('it sits close to the cartridge\'s measured par', () => {
    for (const c of CARTRIDGES) {
      for (const [x, z] of [[0, 0], [55, 12], [-9, -140], [200, 3]] as const) {
        const rec = houseRecord(cabinetKey(c.id, x, z), c.id)!;
        expect(rec.score, `${c.title} @${x},${z}`).toBeGreaterThanOrEqual(Math.round(c.housePar * 0.8));
        expect(rec.score, `${c.title} @${x},${z}`).toBeLessThanOrEqual(Math.round(c.housePar * 1.2));
      }
    }
  });

  it('NIGHTWATCH is never asked for more hours than the shift has', () => {
    // the game ends at 8 hours; a mark of 8 or more could never be beaten
    for (let i = 0; i < 200; i++) {
      const rec = houseRecord(cabinetKey('nightwatch', i, i * 3), 'nightwatch')!;
      expect(rec.score, `machine ${i}`).toBeLessThan(8);
    }
  });

  it('no mark is beatable by simply standing there', () => {
    // an idle run must never clear the house — the mark has to be earned
    for (const c of CARTRIDGES) {
      const g = GAMES[c.id]!();
      let t = 0;
      while (!g.over && t < 200) { g.step(1 / 60, IDLE); t += 1 / 60; }
      const easiest = Math.min(...[[0, 0], [12, 40], [-30, 8]]
        .map(([x, z]) => houseRecord(cabinetKey(c.id, x, z), c.id)!.score));
      expect(g.score, `${c.title}: idling clears the house mark`).toBeLessThan(easiest);
    }
  });
});

describe('the cabinet key is the machine, not the game', () => {
  it('the same game at two places is two keys', () => {
    expect(cabinetKey('orbit_run', 10, 10)).not.toBe(cabinetKey('orbit_run', 11, 10));
  });

  it('two games at one place are two keys', () => {
    expect(cabinetKey('orbit_run', 10, 10)).not.toBe(cabinetKey('deep_shaft', 10, 10));
  });

  it('the key survives a fractional position — a cabinet does not move', () => {
    expect(cabinetKey('orbit_run', 10.4, 9.6)).toBe(cabinetKey('orbit_run', 10, 10));
  });
});
