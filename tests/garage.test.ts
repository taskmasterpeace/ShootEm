// ---------------------------------------------------------------------------
// THE GARAGE (docs/RACING.md — Robert: "I want people to be able to change
// the tires… a little bit of car modification, but not too deep"). Four
// slots. Every fit is a SIDEGRADE, every part is honest about its mass, and
// the tyre rewrites the traction profile the way Racing Destruction Set's
// card did. Also THE CARD itself: traction as three numbers, and shock.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import { CARGO, CHASSIS, DEFAULT_FIT, ENGINES, TIRES, accelRating, fitLegal, fitted } from '../src/sim/garage';
import type { Fit } from '../src/sim/garage';
import type { VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

const fit = (over: Partial<Fit> = {}): Fit => ({ ...DEFAULT_FIT, cargo: [], ...over });

describe('the card — traction is a PROFILE, not a number', () => {
  it('every drivable hull prints ice / dirt / paved and a shock figure', () => {
    for (const kind of Object.keys(VEHICLES) as VehicleKind[]) {
      const d = VEHICLES[kind];
      if (d.flies || d.boat) continue; // the card is a ground document
      expect(d.traction, `${kind} has no traction profile`).toBeTruthy();
      expect(d.shock, `${kind} has no shock strength`).toBeGreaterThan(0);
      for (const v of Object.values(d.traction!)) expect(v).toBeGreaterThan(0);
    }
  });

  it('the profile SEPARATES the specialists — a rally truck is not a muscle car', () => {
    const rally = VEHICLES.rallytruck.traction!;
    const muscle = VEHICLES.musclecar.traction!;
    expect(rally.dirt, 'the rally truck owns the dirt').toBeGreaterThan(muscle.dirt);
    expect(muscle.paved, 'the muscle car owns the tarmac').toBeGreaterThan(rally.paved);
    // …and neither is better at everything (the whole point of a profile)
    expect(rally.paved).toBeLessThan(muscle.paved);
    expect(muscle.dirt).toBeLessThan(rally.dirt);
  });

  it('shock strength tracks the machine — a bike is not a bulldozer', () => {
    expect(VEHICLES.bulldozer.shock!).toBeGreaterThan(VEHICLES.bike.shock!);
    expect(VEHICLES.racetruck.shock!, 'the race truck lands like a brick, on purpose')
      .toBeGreaterThan(VEHICLES.hotrod.shock!);
  });
});

describe('the garage — four slots, every fit a trade', () => {
  it('tires REWRITE the profile: slicks fly on tarmac and drown off it', () => {
    const slick = fitted('sedan', fit({ tires: 'slicks' })).traction!;
    const knob = fitted('sedan', fit({ tires: 'knobblies' })).traction!;
    const stud = fitted('sedan', fit({ tires: 'studs' })).traction!;
    expect(slick.paved).toBeGreaterThan(knob.paved);
    expect(knob.dirt).toBeGreaterThan(slick.dirt);
    expect(stud.ice).toBeGreaterThan(slick.ice);
    expect(stud.paved, 'studs are miserable on tarmac').toBeLessThan(slick.paved);
  });

  it('no tyre, engine or chassis is strictly best — the sidegrade law', () => {
    const ids = Object.keys(TIRES) as (keyof typeof TIRES)[];
    for (const a of ids) for (const b of ids) {
      if (a === b) continue;
      const A = TIRES[a].traction, B = TIRES[b].traction;
      expect(A.ice > B.ice && A.dirt > B.dirt && A.paved > B.paved, `${a} dominates ${b}`).toBe(false);
    }
    // the engine trade is real in both directions
    expect(ENGINES.sprint.accel).toBeGreaterThan(ENGINES.longratio.accel);
    expect(ENGINES.longratio.speed).toBeGreaterThan(ENGINES.sprint.speed);
    // the chassis trade too
    expect(CHASSIS.stripped.mass).toBeLessThan(CHASSIS.reinforced.mass);
    expect(CHASSIS.reinforced.hp).toBeGreaterThan(CHASSIS.stripped.hp);
  });

  it('every part is honest about its weight — cargo is mass, and mass is charged', () => {
    const bare = fitted('pickup', fit());
    const loaded = fitted('pickup', fit({ cargo: ['armour', 'mines'] }));
    expect(loaded.mass!).toBeGreaterThan(bare.mass!);
    expect(loaded.mass! - bare.mass!).toBeCloseTo(CARGO.armour.mass + CARGO.mines.mass, 5);
    // …and that weight COSTS you: the loaded truck accelerates worse
    expect(accelRating('pickup', fit({ cargo: ['armour', 'mines'] })))
      .toBeLessThanOrEqual(accelRating('pickup', fit()));
  });

  it('stripping the car is quicker and more fragile — both, always', () => {
    const light = fitted('sedan', fit({ chassis: 'stripped' }));
    const heavy = fitted('sedan', fit({ chassis: 'reinforced' }));
    expect(light.mass!).toBeLessThan(heavy.mass!);
    expect(light.hp).toBeLessThan(heavy.hp);
    expect(accelRating('sedan', fit({ chassis: 'stripped' })))
      .toBeGreaterThanOrEqual(accelRating('sedan', fit({ chassis: 'reinforced' })));
  });

  it('the long-ratio engine really does raise the top end', () => {
    expect(fitted('sedan', fit({ engine: 'longratio' })).speed)
      .toBeGreaterThan(fitted('sedan', fit({ engine: 'stock' })).speed);
    expect(fitted('sedan', fit({ engine: 'sprint' })).speed)
      .toBeLessThan(fitted('sedan', fit({ engine: 'stock' })).speed);
  });

  it('the garage is for road hulls, and it stays shallow (two cargo slots)', () => {
    expect(fitLegal('sedan', fit())).toBe(true);
    expect(fitLegal('strikejet', fit()), 'you do not fit slicks to a jet').toBe(false);
    expect(fitLegal('yacht', fit())).toBe(false);
    expect(fitLegal('sedan', fit({ cargo: ['mines', 'oil', 'armour'] })), 'three is too deep').toBe(false);
  });

  it('BOLTING ARMOUR ON DOES NOT DENT THE CAR — a fresh hull stays full', () => {
    // setFit clamped hp to the new ceiling and never raised it, so armour
    // (×1.35 max hp) put a factory-fresh musclecar on the grid at 85/115 —
    // the garage was charging you a quarter of your hull for using it.
    const w = new World({ seed: 1, mode: 'race', difficulty: 'veteran', botsPerTeam: 0,
      matchMinutes: 15, theme: 'savanna', hordeRoster: 'zombies',
      moraleBoost: [0, 0], lswPass: 3 } as never);
    const v = w.spawnVehicle('musclecar', 0, { x: 0, y: 0, z: 0 });
    expect(v.hp).toBe(v.maxHp); // fresh off the pad
    w.setFit(v, fit({ cargo: ['armour'] }));
    expect(v.maxHp, 'armour should raise the ceiling').toBeGreaterThan(VEHICLES.musclecar.hp);
    expect(v.hp, 'a fitted hull arrived pre-damaged').toBe(v.maxHp);
  });

  it('a damaged hull keeps its damage across a re-fit (it is not a repair)', () => {
    const w = new World({ seed: 1, mode: 'race', difficulty: 'veteran', botsPerTeam: 0,
      matchMinutes: 15, theme: 'savanna', hordeRoster: 'zombies',
      moraleBoost: [0, 0], lswPass: 3 } as never);
    const v = w.spawnVehicle('musclecar', 0, { x: 0, y: 0, z: 0 });
    v.hp = Math.round(v.maxHp / 2);
    w.setFit(v, fit({ cargo: ['armour'] }));
    const frac = v.hp / v.maxHp;
    expect(frac).toBeGreaterThan(0.4);
    expect(frac).toBeLessThan(0.6);
  });

  it('every part explains its trade in one line — the shop speaks', () => {
    const all = [...Object.values(TIRES), ...Object.values(ENGINES), ...Object.values(CHASSIS), ...Object.values(CARGO)];
    for (const p of all) {
      expect(p.blurb.length, `${p.name} has no blurb`).toBeGreaterThan(25);
      expect(p.name.length).toBeGreaterThan(2);
    }
  });
});
