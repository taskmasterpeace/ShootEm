// ---------------------------------------------------------------------------
// V3 THE SKY IS NEVER FREE (Robert: "every base should start off with a
// surface-to-air missile… and when it fires, the AI pilot needs to try to
// EVADE while still ATTACKING").
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { SAM_SPEED_RATIO, VEHICLES, WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

describe('V3 — the anti-air layer', () => {
  it('EVERY BASE fields a launcher, for both teams, on open ground', () => {
    for (const mode of ['tdm', 'ctf', 'koth'] as const) {
      const w = new World({ seed: 42, mode });
      for (const team of [0, 1] as const) {
        const aa = [...w.vehicles.values()].filter((v) => v.kind === 'aatrack' && v.team === team);
        expect(aa.length, `${mode}: team ${team} has no AA`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('an UNCREWED base launcher still fires — the base is never naked', () => {
    const w = quiet();
    const lance = [...w.vehicles.values()].find((v) => v.kind === 'aatrack' && v.team === 0)!;
    // put a hostile aircraft in its reach, with a pilot aboard (airborne)
    const jet = w.spawnVehicle('interceptor', 1, { x: lance.pos.x + 40, y: 0, z: lance.pos.z });
    jet.alive = true;
    const pilot = w.addSoldier('P', 'infantry', 1, 'human');
    jet.seats[0] = pilot.id; pilot.vehicleId = jet.id; pilot.seat = 0; pilot.alive = true;
    expect(lance.seats[0], 'nobody is manning it').toBeLessThan(0);
    for (let i = 0; i < 60 * 6; i++) w.step(1 / 60, new Map());
    const birds = [...w.projectiles.values()].filter((p) => p.weapon === 'aa_missile');
    const hurt = jet.hp < VEHICLES.interceptor.hp;
    expect(birds.length > 0 || hurt, 'the unmanned launcher never engaged').toBe(true);
  });

  it('it hunts AIRCRAFT ONLY — a tank drives past untouched', () => {
    const w = quiet();
    const lance = [...w.vehicles.values()].find((v) => v.kind === 'aatrack' && v.team === 0)!;
    const tank = w.spawnVehicle('tank', 1, { x: lance.pos.x + 30, y: 0, z: lance.pos.z });
    tank.alive = true;
    const crew = w.addSoldier('C', 'infantry', 1, 'human');
    tank.seats[0] = crew.id; crew.vehicleId = tank.id; crew.seat = 0; crew.alive = true;
    for (let i = 0; i < 60 * 6; i++) w.step(1 / 60, new Map());
    expect(tank.hp, 'an AA missile is not a tank killer').toBe(VEHICLES.tank.hp);
  });

  it('THE PREDATOR/PREY LAW holds for the hull launcher too', () => {
    // the missile must always lose a straight drag race to the fastest thing
    // in the sky — that ratio IS the evade-vs-attack decision
    const missile = VEHICLES.interceptor.speed * SAM_SPEED_RATIO;
    expect(missile).toBeLessThan(VEHICLES.interceptor.speed);
    expect(missile).toBeGreaterThan(VEHICLES.interceptor.speed * 0.85);
    // and it out-ranges what it shoots at, or it could never open an engagement
    expect(WEAPONS.aa_missile.range).toBeGreaterThan(100);
  });

  it('the LANCE is paper: it must be escorted or it dies', () => {
    expect(VEHICLES.aatrack.hp).toBeLessThan(VEHICLES.tank.hp / 3);
    expect(VEHICLES.aatrack.speed, 'it cannot run away either').toBeLessThan(VEHICLES.buggy.speed);
  });
});
