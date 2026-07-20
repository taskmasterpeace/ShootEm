// ---------------------------------------------------------------------------
// V2 FIXED WING (Robert: "what if there were a JET that COULDN'T hover?").
// The rule that makes an old-school combat-flight feel: a jet carries a
// minimum airspeed. Release the stick and it does NOT stop — it keeps flying.
// Attack runs become passes; you can never park in the sky.
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

/** put a pilot in the named airframe, airborne and flying */
function fly(kind: VehicleKind) {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  const p = w.addSoldier('P', 'infantry', 0, 'human');
  const v = w.spawnVehicle(kind, 0, { x: 0, y: 0, z: 0 });
  v.alive = true; v.seats[0] = p.id;
  p.vehicleId = v.id; p.seat = 0; p.alive = true;
  p.enteredVehicleAt = w.time - 10; // spooled up, past liftoff
  return { w, p, v };
}
const run = (w: World, p: { id: number }, c: PlayerCmd, secs: number) => {
  for (let i = 0; i < 60 * secs; i++) w.step(1 / 60, new Map([[p.id, c]]));
};
const speedOf = (v: { vel: { x: number; z: number } }) => Math.hypot(v.vel.x, v.vel.z);

describe('V2 — the jets cannot stop', () => {
  it('HANDS OFF THE STICK and the jet keeps flying', () => {
    const { w, p, v } = fly('strikejet');
    run(w, p, cmd({ moveZ: -1 }), 2);      // full throttle
    run(w, p, cmd(), 3);                    // …then nothing at all
    const floor = VEHICLES.strikejet.speed * VEHICLES.strikejet.minAirspeed! * 0.7;
    expect(speedOf(v), 'a jet that stopped would be a helicopter').toBeGreaterThan(floor);
  });

  it('a HELICOPTER, given the same hands-off, parks in the air', () => {
    const { w, p, v } = fly('flyer');
    run(w, p, cmd({ moveZ: -1 }), 2);
    run(w, p, cmd(), 3);
    expect(speedOf(v), 'the Kestrel is allowed to hover — that is its whole job')
      .toBeLessThan(speedOf(fly('strikejet').v) + 3);
  });

  it('a jet cannot fly BACKWARD, however hard you pull', () => {
    const { w, p, v } = fly('interceptor');
    run(w, p, cmd({ moveZ: 1 }), 3); // full reverse
    // still moving forward along its own nose
    const forward = Math.cos(v.yaw) * v.vel.x + Math.sin(v.yaw) * v.vel.z;
    expect(forward, 'reverse is not a thing a wing does').toBeGreaterThan(0);
  });

  it('the stall floor scales with the airframe: the Anvil floors highest', () => {
    expect(VEHICLES.bomber.minAirspeed!).toBeGreaterThan(VEHICLES.strikejet.minAirspeed!);
  });
});
