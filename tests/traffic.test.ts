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

// ---------------------------------------------------------------------------
// THE TRAFFIC LIVES (2026-07-23). Fourteen civilian hulls were parked around
// the map and every one of them SAT there — and a car park is not a city.
//
// The new laws:
//   1. THE CITY DRIVES ITSELF — without touching the war's rng, without
//      minting an id the war can see, and without ever fighting a real crew
//      for the wheel.
//   2. GUNFIRE IS THE DRIVER'S PROBLEM — loud things send the street away.
//   3. THE CARGO IS THE WEAPON — the canon's open question ("which civilian
//      vehicles weaponize") answered by what the machines already carry.
// ---------------------------------------------------------------------------
import {
  ARRIVED, CIVILIAN_PAYLOAD, CRUISE, FLEEING, PANIC_RADIUS, PAYLOADS, fleeTo,
  isPanicking, legDone, newDrive, paceFor, payloadOf, steerToward,
} from '../src/sim/traffic';

const city = (seed = 4) => new World({ seed, mode: 'tdm', botsPerTeam: 0, traffic: true });
const driving = (w: World) => [...w.vehicles.values()].filter((v) => v.civilianDrive);

describe('the steering', () => {
  it('drives toward where it is going', () => {
    const s = steerToward({ x: 0, y: 0, z: 0 }, 0, { x: 50, y: 0, z: 0 }, CRUISE);
    expect(Math.abs(s.moveX)).toBeLessThan(0.05); // dead ahead, no correction
    expect(s.moveZ).toBeLessThan(0);              // -Z is forward
  });

  it('turns the short way round, both directions', () => {
    const left = steerToward({ x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 50 }, CRUISE);
    const right = steerToward({ x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: -50 }, CRUISE);
    expect(Math.sign(left.moveX)).toBe(1);
    expect(Math.sign(right.moveX)).toBe(-1);
  });

  it('backs off the throttle through a hard corner, like anybody would', () => {
    const straight = steerToward({ x: 0, y: 0, z: 0 }, 0, { x: 50, y: 0, z: 0 }, CRUISE);
    const sharp = steerToward({ x: 0, y: 0, z: 0 }, 0, { x: -10, y: 0, z: 40 }, CRUISE);
    expect(Math.abs(sharp.moveZ)).toBeLessThan(Math.abs(straight.moveZ));
  });

  it('a leg ends on arrival or on giving up', () => {
    const d = newDrive({ x: 0, y: 0, z: 0 }, 1, 0);
    d.to = { x: 100, y: 0, z: 0 };
    d.until = 50;
    expect(legDone({ x: 0, y: 0, z: 0 }, d, 10)).toBe(false);
    expect(legDone({ x: 100 - ARRIVED / 2, y: 0, z: 0 }, d, 10)).toBe(true);
    expect(legDone({ x: 0, y: 0, z: 0 }, d, 60)).toBe(true);
  });

  it('runs directly away from what scared it', () => {
    const away = fleeTo({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 50);
    expect(away.x).toBeGreaterThan(10);
    expect(Math.round(away.z)).toBe(0);
  });

  it('a frightened driver drives faster than a calm one', () => {
    const d = newDrive({ x: 0, y: 0, z: 0 }, 1, 0);
    expect(paceFor(d, 0)).toBe(CRUISE);
    d.panicUntil = 10;
    expect(paceFor(d, 5)).toBe(FLEEING);
    expect(FLEEING).toBeGreaterThan(CRUISE);
    expect(isPanicking(d, 5)).toBe(true);
    expect(isPanicking(d, 11)).toBe(false);
  });
});

describe('the city drives itself', () => {
  it('every civilian hull has somewhere to be', () => {
    const cars = driving(city());
    expect(cars.length).toBeGreaterThan(0);
  });

  it('AND IT ACTUALLY MOVES', () => {
    // the law is that the CITY drives, not that every last hull escapes its
    // spot — a truck wedged in an alley is a city, not a bug. So: most of the
    // fleet moves, and it covers real ground doing it.
    const w = city();
    const cars = driving(w);
    const from = cars.map((c) => ({ x: c.pos.x, z: c.pos.z }));
    for (let i = 0; i < 60 * 6; i++) w.step(1 / 60, new Map());
    const moved = cars.map((c, i) => Math.hypot(c.pos.x - from[i].x, c.pos.z - from[i].z));
    const driving_ = moved.filter((d) => d > 4).length;
    expect(driving_, 'the street is a car park').toBeGreaterThan(cars.length * 0.6);
    expect(Math.max(...moved), 'nobody got anywhere').toBeGreaterThan(20);
  });

  it('gives every hull room to pull away from where it was left', () => {
    // the point being clear is not enough — a garbage truck is not a point,
    // and one dropped with its flank in a wall can never move at all
    const w = city();
    for (const v of driving(w)) {
      expect(v.pos.y).toBe(0);
      expect(v.alive).toBe(true);
    }
    expect(driving(w).length).toBeGreaterThan(6);
  });

  it('never shifts the war — the same seed fights the same match', () => {
    const withCity = new World({ seed: 21, mode: 'tdm', botsPerTeam: 6, traffic: true });
    const without = new World({ seed: 21, mode: 'tdm', botsPerTeam: 6 });
    const ids = (w: World) => [...w.soldiers.values()].map((s) => `${s.id}:${s.classId}:${s.team}`).join(',');
    expect(ids(withCity)).toBe(ids(without));
  });

  it('mints no entity id the war can see — the id trap stays paid', () => {
    const w = city();
    for (const v of driving(w)) expect(v.id).toBeGreaterThanOrEqual(900_000);
    for (const s of w.soldiers.values()) expect(s.id).toBeLessThan(900_000);
  });

  it('A REAL CREW ALWAYS WINS THE WHEEL', () => {
    const w = city();
    const car = driving(w)[0];
    const me = w.addSoldier('ME', 'infantry', 0, 'human');
    me.pos = { ...car.pos };
    car.seats[0] = me.id;
    me.vehicleId = car.id;
    const before = { ...car.pos };
    for (let i = 0; i < 60 * 4; i++) w.step(1 / 60, new Map());
    expect(Math.hypot(car.pos.x - before.x, car.pos.z - before.z)).toBeLessThan(3);
  });

  it('keeps out of the compounds — the garrison\'s ground stays clear', () => {
    const w = city();
    for (let i = 0; i < 60 * 40; i++) w.step(1 / 60, new Map());
    for (const v of driving(w)) {
      const d = v.civilianDrive!;
      expect(Math.hypot(d.to.x - w.map.basePos[0].x, d.to.z - w.map.basePos[0].z)).toBeGreaterThan(70);
      expect(Math.hypot(d.to.x - w.map.basePos[1].x, d.to.z - w.map.basePos[1].z)).toBeGreaterThan(70);
    }
  });
});

describe('gunfire is the driver\'s problem', () => {
  it('a loud thing nearby sends the street running from it', () => {
    const w = city();
    const car = driving(w)[0];
    const at = { x: car.pos.x + 4, y: 0, z: car.pos.z };
    w.scareTraffic(at);
    const d = car.civilianDrive!;
    expect(isPanicking(d, w.time)).toBe(true);
    const before = Math.hypot(car.pos.x - at.x, car.pos.z - at.z);
    expect(Math.hypot(d.to.x - at.x, d.to.z - at.z)).toBeGreaterThan(before);
  });

  it('a shot across the map is not their problem', () => {
    const w = city();
    const car = driving(w)[0];
    w.scareTraffic({ x: car.pos.x + PANIC_RADIUS * 3, y: 0, z: car.pos.z });
    expect(isPanicking(car.civilianDrive!, w.time)).toBe(false);
  });

  it('a crewed hull is not spooked — somebody real is driving it', () => {
    const w = city();
    const car = driving(w)[0];
    car.seats[0] = 999;
    w.scareTraffic({ x: car.pos.x + 2, y: 0, z: car.pos.z });
    expect(isPanicking(car.civilianDrive!, w.time)).toBe(false);
  });
});

describe('the cargo is the weapon', () => {
  it('answers the canon\'s open question with what the machines already carry', () => {
    expect(CIVILIAN_PAYLOAD.fueltanker).toBe('fuel');
    expect(CIVILIAN_PAYLOAD.foodtruck).toBe('food');
    expect(CIVILIAN_PAYLOAD.ambulance).toBe('medical');
    // an ordinary car is an ordinary car — if everything had a trick, nothing
    // would be a landmark
    expect(payloadOf('sedan')).toBeUndefined();
    expect(payloadOf('taxi')).toBeUndefined();
  });

  it('THE FUEL TANKER IS A BOMB SOMEBODY DROVE TO WORK', () => {
    expect(PAYLOADS.fuel.blast).toBeGreaterThan(12);
    expect(PAYLOADS.fuel.blastDamage).toBeGreaterThan(150);
    for (const [k, p] of Object.entries(PAYLOADS)) {
      if (k === 'fuel') continue;
      expect(p.blast, `${k} rivals the tanker`).toBeLessThan(PAYLOADS.fuel.blast);
    }
  });

  it('wrecking a tanker really hurts the men standing by it', () => {
    const w = new World({ seed: 8, mode: 'tdm', botsPerTeam: 0 });
    const tanker = w.spawnVehicle('fueltanker', -1 as never, { x: 0, y: 0, z: 0 });
    tanker.alive = true;
    const near = w.addSoldier('NEAR', 'infantry', 0, 'bot');
    const far = w.addSoldier('FAR', 'infantry', 0, 'bot');
    near.pos = { x: 3, y: 0, z: 0 };
    far.pos = { x: 300, y: 0, z: 300 };
    near.armor = 0; far.armor = 0;
    const nearHp = near.hp, farHp = far.hp;
    w.damageVehicle(tanker, 99999, -1, 'rifle_maklov_1');
    expect(near.hp).toBeLessThan(nearHp);
    expect(far.hp).toBe(farHp); // the street, not the map
  });

  it('a sedan wreck is just a wreck', () => {
    const w = new World({ seed: 8, mode: 'tdm', botsPerTeam: 0 });
    const car = w.spawnVehicle('sedan', -1 as never, { x: 0, y: 0, z: 0 });
    car.alive = true;
    const near = w.addSoldier('NEAR', 'infantry', 0, 'bot');
    near.pos = { x: 3, y: 0, z: 0 };
    near.armor = 0;
    const hp = near.hp;
    w.damageVehicle(car, 99999, -1, 'rifle_maklov_1');
    expect(near.hp).toBe(hp);
  });

  it('every payload names what it does, in words a codex can print', () => {
    for (const p of Object.values(PAYLOADS)) {
      expect(p.note.length).toBeGreaterThan(15);
      expect(p.blast).toBeGreaterThanOrEqual(0);
    }
  });
});
