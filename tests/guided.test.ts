// ---------------------------------------------------------------------------
// GUIDED / HOMING (mountain warfare) — the Copperhead/Hydra guided multi-rocket
// (homes on a ground HULL) and the Kite/Specter heat-seeker AAM (homes on
// AIRCRAFT, but capped below jet speed so a maneuvering pilot can still extend).
// Robert: "the multi guided rocket" + "get inside its missile and it folds."
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import type { Projectile } from '../src/sim/types';

const quiet = () => new World({ seed: 7, mode: 'tdm', botsPerTeam: 0 });

let pid = 900001;
function fire(w: World, weapon: string, team: 0 | 1, from: { x: number; z: number }, aimYaw: number): Projectile {
  const spd = WEAPONS[weapon].speed;
  return w.launch({
    id: pid++, weapon, ownerId: -1, team,
    pos: { x: from.x, y: 1.8, z: from.z },
    vel: { x: Math.cos(aimYaw) * spd, y: 0, z: Math.sin(aimYaw) * spd },
    bornAt: 0, ttl: 8, arc: false, airScaled: true, elevationWeapon: 'aircraft',
  } as Projectile);
}
const angTo = (p: Projectile, tx: number, tz: number) => {
  const da = Math.atan2(tz - p.pos.z, tx - p.pos.x) - Math.atan2(p.vel.z, p.vel.x);
  return Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
};

describe('guided / homing', () => {
  it('the Hydra guided rocket ACQUIRES a ground hull and steers onto it', () => {
    // anchor to the base AA launcher — guaranteed open ground (antiair-v3 law)
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const lance = [...w.vehicles.values()].find((v) => v.kind === 'aatrack' && v.team === 0)!;
    const tank = w.spawnVehicle('tank', 1, { x: lance.pos.x + 26, y: 0, z: lance.pos.z });
    tank.alive = true;
    const from = { x: lance.pos.x, z: lance.pos.z };
    const direct = Math.atan2(tank.pos.z - from.z, tank.pos.x - from.x);
    const p = fire(w, 'hydra_guided', 0, from, direct + 0.35); // aimed 0.35rad OFF
    expect(p.homingVehicleId, 'acquired the hull').toBe(tank.id);
    expect(p.guided, 'flagged guided').toBe(true);
    const before = angTo(p, tank.pos.x, tank.pos.z);
    for (let i = 0; i < 10 && w.projectiles.has(p.id); i++) w.step(1 / 60, new Map());
    const after = w.projectiles.has(p.id) ? angTo(p, tank.pos.x, tank.pos.z) : 0; // gone = bit it
    expect(after, 'the rocket steered onto the tank').toBeLessThan(before - 0.1);
  });

  it('with NO hull in the forward cone it flies DUMB (a plain rocket)', () => {
    const w = quiet();
    const p = fire(w, 'hydra_guided', 0, { x: 150, z: 150 }, 0);
    expect(p.homingVehicleId).toBeUndefined();
    expect(p.guided).toBeFalsy();
  });

  it('the Specter AAM heat-seeks AIRCRAFT and is CAPPED below jet speed (dodgeable)', () => {
    const w = quiet();
    const jet = w.spawnVehicle('interceptor', 1, { x: 150, y: 0, z: 150 });
    jet.alive = true;
    const pilot = w.addSoldier('P', 'infantry', 1, 'human');
    jet.seats[0] = pilot.id; pilot.vehicleId = jet.id; pilot.seat = 0; pilot.alive = true;
    const from = { x: jet.pos.x - 50, z: jet.pos.z };
    const direct = Math.atan2(jet.pos.z - from.z, jet.pos.x - from.x);
    const locked = fire(w, 'specter_aam', 0, from, direct + 0.3);
    expect(locked.homingVehicleId, 'locked the jet').toBe(jet.id);
    expect(locked.guided, 'air homing is not the ground profile').toBeFalsy();
    const lockedSpeed = Math.hypot(locked.vel.x, locked.vel.z);
    // an AAM fired with no aircraft ahead flies uncapped — the lock must be SLOWER
    const dumb = fire(w, 'specter_aam', 0, { x: jet.pos.x + 30, z: jet.pos.z }, 0); // jet is behind → no lock
    expect(dumb.homingVehicleId).toBeUndefined();
    expect(lockedSpeed, 'the SAM speed law capped it').toBeLessThan(Math.hypot(dumb.vel.x, dumb.vel.z));
  });

  it('the AAM does NOT lock a ground tank — aircraft only', () => {
    const w = quiet();
    const tank = w.spawnVehicle('tank', 1, { x: 150, y: 0, z: 150 });
    tank.alive = true;
    const from = { x: tank.pos.x - 50, z: tank.pos.z };
    const direct = Math.atan2(tank.pos.z - from.z, tank.pos.x - from.x);
    const p = fire(w, 'specter_aam', 0, from, direct);
    expect(p.homingVehicleId, 'air homing skips ground hulls').toBeUndefined();
  });
});
