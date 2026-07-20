// ---------------------------------------------------------------------------
// J1 THE AIR WAR FEELS RIGHT (Robert: "the missiles seem like they go too
// slow — the plane goes faster than the missiles… we need to fly up and fly
// down easily, Q and E… we need the afterburners… machine guns, of course").
//
// The missile bug was a FRAME SHEAR: every non-arc round scaled by
// projectileSpeedMul (default 0.35) while vehicles scaled by vehicleSpeedMul
// (default 0.8). A strike jet at 32 u/s fired rockets doing 21.7; the homing
// aa_missile flew 15.4 against prey at 32+ and could never close. The fix is
// a frame rule, not a number: ordnance that lives in the vehicle-speed frame
// scales WITH the vehicles.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES, WEAPONS } from '../src/sim/data';
import type { PlayerCmd, VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

function fly(kind: VehicleKind, opts: { proj?: number; veh?: number } = {}) {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  for (const [id, v] of w.vehicles) if (v.kind === 'aatrack') w.vehicles.delete(id);
  w.projectileSpeedMul = opts.proj ?? 0.35;   // the shipped defaults —
  w.vehicleSpeedMul = opts.veh ?? 0.8;        // exactly the shear that bit
  const p = w.addSoldier('P', 'infantry', 0, 'human');
  const v = w.spawnVehicle(kind, 0, { x: 0, y: 0, z: 0 });
  v.alive = true; v.seats[0] = p.id;
  p.vehicleId = v.id; p.seat = 0; p.alive = true;
  p.enteredVehicleAt = w.time - 10;
  v.spoolUntil = 0;
  return { w, p, v };
}
const run = (w: World, id: number, c: PlayerCmd, secs: number) => {
  for (let i = 0; i < Math.round(60 * secs); i++) w.step(1 / 60, new Map([[id, c]]));
};

describe('J1 — the air frame (missiles faster than planes again)', () => {
  it('A JET NO LONGER OUTRUNS ITS OWN ROCKETS at default sliders', () => {
    const { w, p, v } = fly('strikejet');
    run(w, p.id, cmd({ moveZ: -1 }), 3);                       // full cruise
    const jetSpeed = Math.hypot(v.vel.x, v.vel.z);
    run(w, p.id, cmd({ moveZ: -1, fire: true }), 0.1);         // loose a rocket
    const rocket = [...w.projectiles.values()].find((r) => r.weapon === 'vulture_rockets');
    expect(rocket, 'no rocket left the rail').toBeTruthy();
    const rocketSpeed = Math.hypot(rocket!.vel.x, rocket!.vel.z);
    expect(rocketSpeed, `rocket ${rocketSpeed.toFixed(1)} vs jet ${jetSpeed.toFixed(1)}`)
      .toBeGreaterThan(jetSpeed * 1.2);
  });

  it('A HOMING MISSILE CAN CLOSE: aa rounds pace the fastest airframe', () => {
    const w = new World({ seed: 7, mode: 'tdm', botsPerTeam: 0 });
    w.projectileSpeedMul = 0.35;
    w.vehicleSpeedMul = 0.8;
    const gunner = w.addSoldier('G', 'infantry', 0, 'human');
    const lance = w.spawnVehicle('aatrack', 0, { x: 0, y: 0, z: 0 });
    lance.alive = true;
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    const jet = w.spawnVehicle('interceptor', 1, { x: 40, y: 0, z: 0 });
    jet.alive = true; jet.seats[0] = foe.id;
    foe.vehicleId = jet.id; foe.seat = 0; foe.enteredVehicleAt = w.time - 10;
    jet.spoolUntil = 0;
    w.fireHullSam(lance, jet, gunner.id);
    const missile = [...w.projectiles.values()].find((r) => r.weapon === 'aa_missile')!;
    const missileSpeed = Math.hypot(missile.vel.x, missile.vel.z);
    const preyTop = VEHICLES.interceptor.speed * w.vehicleSpeedMul;
    // the V3 predator/prey law: slightly slower than a straight-line sprint
    // (escapable), but far faster than any TURNING aircraft holds
    expect(missileSpeed / preyTop).toBeGreaterThan(0.85);
    expect(missileSpeed / preyTop).toBeLessThan(1.0);
  });

  it('GROUND fire still respects the projectile knob (Robert asked for that too)', () => {
    const { w, p, v } = fly('buggy');
    void v;
    run(w, p.id, cmd({ fire: true, aimYaw: 0 }), 0.2);
    const round = [...w.projectiles.values()].find((r) => r.weapon === 'buggy_mg');
    expect(round, 'the buggy MG never fired').toBeTruthy();
    const sp = Math.hypot(round!.vel.x, round!.vel.z);
    expect(sp).toBeCloseTo(WEAPONS.buggy_mg.speed * 0.35, 0);
  });
});

describe('J1 — Q climbs, E dives, the deck is the door', () => {
  it('a jet opens at band 3, Q is capped there, E walks it down to the deck', () => {
    const { w, p, v } = fly('strikejet');
    run(w, p.id, cmd({ moveZ: -1 }), 0.5);
    expect(v.band, 'a flown jet lives at band 3').toBe(3);
    const tap = (c: PlayerCmd) => { run(w, p.id, c, 0.05); run(w, p.id, cmd({ moveZ: -1 }), 0.3); };
    tap(cmd({ moveZ: -1, ability: true }));                  // Q at the ceiling
    expect(v.band).toBe(3);
    tap(cmd({ moveZ: -1, use: true }));                      // E: dive
    expect(v.band).toBe(2);
    tap(cmd({ moveZ: -1, use: true }));
    expect(v.band).toBe(1);
    tap(cmd({ moveZ: -1, use: true }));
    expect(v.band).toBe(0);
    expect(p.vehicleId, 'reaching the deck must NOT eject the pilot').toBe(v.id);
    // the door press is a real oneShot — ONE cmd, like the input layer sends
    // (a multi-tick hold walks out and straight back in through
    // tryEnterVehicle, which is exactly what real taps exist to avoid)
    run(w, p.id, cmd({ moveZ: -1, use: true }), 1 / 60);
    expect(p.vehicleId).toBe(-1);

    // and a HELD E never falls through the floors: board again, hold the key
    const q = w.addSoldier('Q2', 'infantry', 0, 'human');
    v.seats[0] = q.id; q.vehicleId = v.id; q.seat = 0;
    q.enteredVehicleAt = w.time - 10; v.spoolUntil = 0;
    run(w, q.id, cmd({ moveZ: -1 }), 0.5);
    expect(v.band).toBe(3);
    run(w, q.id, cmd({ moveZ: -1, use: true }), 0.3);        // held for 18 ticks
    // 0.3s spans exactly two debounce windows (t=0 and t=0.28) — two steps,
    // never eighteen. The floor the assertion guards is "not the deck".
    expect(v.band, 'a held key steps per debounce, not per tick').toBeGreaterThanOrEqual(1);
  });

  it('a helicopter tops out at band 2 — rotors never own jet country', () => {
    const { w, p, v } = fly('flyer');
    run(w, p.id, cmd({ moveZ: -1 }), 0.5);
    expect(v.band).toBe(2);
    run(w, p.id, cmd({ ability: true }), 0.05);
    expect(v.band).toBe(2);
  });

  it('an abandoned aircraft is parked — band drops with its pilot gone', () => {
    const { w, p, v } = fly('strikejet');
    run(w, p.id, cmd({ moveZ: -1 }), 0.5);
    expect(v.band).toBe(3);
    w.exitVehicle(p, v);
    run(w, p.id, cmd(), 0.1);
    expect(v.band).toBe(0);
  });
});

describe('J1 — the afterburner', () => {
  it('sprint lights the burner: faster than cruise, and it drinks the tank', () => {
    const { w, p, v } = fly('strikejet');
    run(w, p.id, cmd({ moveZ: -1 }), 3);
    const cruise = Math.hypot(v.vel.x, v.vel.z);
    const fuelBefore = p.energy;
    run(w, p.id, cmd({ moveZ: -1, sprint: true }), 2);
    const lit = Math.hypot(v.vel.x, v.vel.z);
    expect(lit, 'the burner must be worth the fuel').toBeGreaterThan(cruise * 1.2);
    expect(p.energy, 'and the fuel must be real').toBeLessThan(fuelBefore - 20);
    expect(v.burnerOn).toBe(true);
  });

  it('a cold burner refills the tank — pilots regen while seated now', () => {
    const { w, p } = fly('strikejet');
    p.energy = 30;
    run(w, p.id, cmd({ moveZ: -1 }), 3);
    expect(p.energy, 'the seated pilot used to be frozen at 30 forever').toBeGreaterThan(45);
  });
});

describe('J1 — the belly gun', () => {
  it('the Vulture strafes with alt-fire on its own clock', () => {
    const { w, p } = fly('strikejet');
    run(w, p.id, cmd({ moveZ: -1 }), 0.5);
    run(w, p.id, cmd({ moveZ: -1, altFire: true }), 0.5);
    const mg = [...w.projectiles.values()].filter((r) => r.weapon === 'vulture_mg');
    expect(mg.length, 'the belly gun must actually fire').toBeGreaterThan(2);
    // and it flies in the air frame — faster than the jet, always
    const sp = Math.hypot(mg[0].vel.x, mg[0].vel.z);
    expect(sp).toBeGreaterThan(VEHICLES.strikejet.speed * 0.8);
  });

  it('the Anvil keeps the Cradle — no MG on the bomber', () => {
    expect(VEHICLES.bomber.altWeapon).toBeUndefined();
    expect(VEHICLES.strikejet.altWeapon).toBe('vulture_mg');
  });
});
