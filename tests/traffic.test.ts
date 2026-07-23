// ---------------------------------------------------------------------------
// THE TRAFFIC (#94's second half — "military vehicles make war; civilian
// vehicles make the world feel alive"). 48 civilian hulls existed and none
// were ever in a match. The laws: they park where the war isn't, they belong
// to nobody, they are deterministic from the map seed, and the dead city
// (outbreak) and the circuit park nothing.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import { World } from '../src/sim/world';

const civ = (w: World) => [...w.vehicles.values()].filter((v) => VEHICLES[v.kind].civilian);

describe('the traffic', () => {
  it('a war map has civilian machines parked on it', () => {
    const w = new World({ seed: 21, mode: 'ctf', botsPerTeam: 0, traffic: true });
    expect(civ(w).length, 'the streets are empty').toBeGreaterThan(2);
  });

  it('nobody owns them — a parked car is not war materiel', () => {
    const w = new World({ seed: 21, mode: 'ctf', botsPerTeam: 0, traffic: true });
    for (const v of civ(w)) expect(v.team).toBe(-1);
  });

  it('they never park in a base lap', () => {
    const w = new World({ seed: 33, mode: 'ctf', botsPerTeam: 0, traffic: true });
    for (const v of civ(w)) {
      for (const b of w.map.basePos) {
        expect(Math.hypot(v.pos.x - b.x, v.pos.z - b.z), `${v.kind} parked on a base`).toBeGreaterThan(74);
      }
    }
  });

  it('the same city keeps the same cars — deterministic from the seed', () => {
    const a = civ(new World({ seed: 77, mode: 'ctf', botsPerTeam: 0, traffic: true }));
    const b = civ(new World({ seed: 77, mode: 'ctf', botsPerTeam: 0, traffic: true }));
    expect(a.map((v) => v.kind)).toEqual(b.map((v) => v.kind));
    expect(a.map((v) => Math.round(v.pos.x))).toEqual(b.map((v) => Math.round(v.pos.x)));
  });

  it('seeding traffic never touches the match rng stream (the harness law)', () => {
    const a = new World({ seed: 5, mode: 'ctf', botsPerTeam: 0, traffic: true });
    const b = new World({ seed: 5, mode: 'ctf', botsPerTeam: 0, traffic: true });
    expect(a.rng.next()).toBeCloseTo(b.rng.next(), 12);
  });

  it('the dead city parks nothing — an intact street never fell', () => {
    for (const mode of ['horde', 'tide', 'survival'] as const) {
      const w = new World({ seed: 21, mode, botsPerTeam: 0, traffic: true });
      expect(civ(w).length, `${mode} spawned traffic`).toBe(0);
    }
  });

  it('the circuit and the school stay clear', () => {
    for (const mode of ['race', 'timetrial', 'school', 'range'] as const) {
      const w = new World({ seed: 21, mode, botsPerTeam: 0, traffic: true });
      expect(civ(w).length, `${mode} spawned traffic`).toBe(0);
    }
  });

  it('every parked machine actually drives — a fit resolves and it has a card', () => {
    const w = new World({ seed: 21, mode: 'ctf', botsPerTeam: 0, traffic: true });
    for (const v of civ(w)) {
      const d = VEHICLES[v.kind];
      expect(d.mass).toBeGreaterThan(0);
      expect(d.traction, `${v.kind} has no card`).toBeTruthy();
      expect(v.alive).toBe(true);
    }
  });
});
