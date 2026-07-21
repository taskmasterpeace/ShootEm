// ---------------------------------------------------------------------------
// W5.5 CARS HANDLE LIKE CARS — the wheeled runabouts ride the slip dial:
// momentum carries through a hard turn (velocity lags the nose), and SPACE
// is the HANDBRAKE: rear grip breaks (sideways survives 3× longer), the
// nose whips (turn ×1.6), the engine drags. Tracks stay on rails: a tank
// corners like a tank ON PURPOSE.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import type { PlayerCmd, VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

function drive(kind: VehicleKind) {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  const p = w.addSoldier('P', 'infantry', 0, 'human');
  p.alive = true;
  const v = w.spawnVehicle(kind, 0, { x: -60, y: 0, z: -60 }); // open corner
  v.alive = true; v.seats[0] = p.id; v.yaw = 0;
  p.vehicleId = v.id; p.seat = 0; p.enteredVehicleAt = w.time - 10;
  return { w, p, v };
}
const run = (w: World, id: number, c: PlayerCmd, secs: number) => {
  for (let i = 0; i < 60 * secs; i++) w.step(1 / 60, new Map([[id, c]]));
};
/** how far velocity points OFF the nose (radians) — the drift angle */
const driftAngle = (v: { vel: { x: number; z: number }; yaw: number }) => {
  const va = Math.atan2(v.vel.z, v.vel.x);
  let d = Math.abs(va - v.yaw) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
};

describe('W5.5 — cars handle like cars', () => {
  it('the wheeled trio carries the slip dial; tracks stay on rails', () => {
    expect(VEHICLES.buggy.slip).toBeGreaterThan(0);
    expect(VEHICLES.bike.slip).toBeGreaterThan(0);
    expect(VEHICLES.transport.slip).toBeGreaterThan(0);
    expect(VEHICLES.tank.slip).toBeUndefined();
    expect(VEHICLES.apc.slip).toBeUndefined();
  });

  it('a buggy in a hard turn DRIFTS — velocity lags the nose; a tank does not', () => {
    const { w, p, v } = drive('buggy');
    run(w, p.id, cmd({ moveZ: -1 }), 1.5);            // build speed
    run(w, p.id, cmd({ moveZ: -1, moveX: 1 }), 0.18); // crank the wheel
    const carDrift = driftAngle(v);
    const { w: w2, p: p2, v: t } = drive('tank');
    run(w2, p2.id, cmd({ moveZ: -1 }), 1.5);
    run(w2, p2.id, cmd({ moveZ: -1, moveX: 1 }), 0.18);
    const tankDrift = driftAngle(t);
    expect(carDrift, 'the buggy slides').toBeGreaterThan(0.05);
    expect(tankDrift, 'the tank is on rails').toBeLessThan(0.01);
  });

  it('the HANDBRAKE breaks the tail out — more drift than the same turn without it', () => {
    const { w, p, v } = drive('buggy');
    run(w, p.id, cmd({ moveZ: -1 }), 1.5);
    run(w, p.id, cmd({ moveZ: -1, moveX: 1, jump: true }), 0.25); // SPACE: handbrake
    const withBrake = driftAngle(v);
    const { w: w2, p: p2, v: v2 } = drive('buggy');
    run(w2, p2.id, cmd({ moveZ: -1 }), 1.5);
    run(w2, p2.id, cmd({ moveZ: -1, moveX: 1 }), 0.25);
    const without = driftAngle(v2);
    expect(withBrake, 'the tail steps out').toBeGreaterThan(without * 1.3);
  });
});
