// ---------------------------------------------------------------------------
// #121 CARS DRIVE REAL (Robert, batch 3: "we want the cars to drive a little
// more realistic") — the ground-feel pass. The floor's GRIP (materials.ts,
// the weight law's dial) runs the surface drivetrain:
//   · traction: acceleration scales with grip — ice spins the wheels
//   · braking beats coasting: throttle-against-motion bites; a HUMAN letting
//     go rolls (bots keep the firm stop — the bot-competence law)
//   · wheels steer by ROLLING; tracks pivot in place (W5.5, pinned elsewhere)
//   · even a slip-less wheeled hull sheds lateral velocity at the grip rate —
//     ice slides everyone; tanks alone stay on rails ON PURPOSE
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, S_DIRT, S_ICE, TILE, WORLD } from '../src/sim/map';
import type { PlayerCmd, SoldierKind, VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const tileIdx = (x: number, z: number) =>
  Math.floor((z + WORLD / 2) / TILE) * GRID + Math.floor((x + WORLD / 2) / TILE);

/** the open corner the W5.5 suite proved flat, optionally re-floored */
function drive(kind: VehicleKind, surf?: number, driverKind: SoldierKind = 'human') {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  if (surf !== undefined) {
    for (let x = -78; x <= -20; x += 1) for (let z = -78; z <= -20; z += 2) w.map.surface[tileIdx(x, z)] = surf;
  }
  const p = w.addSoldier('P', 'infantry', 0, driverKind);
  p.alive = true;
  const v = w.spawnVehicle(kind, 0, { x: -60, y: 0, z: -60 });
  v.alive = true; v.seats[0] = p.id; v.yaw = 0;
  p.vehicleId = v.id; p.seat = 0; p.enteredVehicleAt = w.time - 10;
  return { w, p, v };
}
const run = (w: World, id: number, c: PlayerCmd, secs: number) => {
  for (let i = 0; i < 60 * secs; i++) w.step(1 / 60, new Map([[id, c]]));
};
const speedOf = (v: { vel: { x: number; z: number } }) => Math.hypot(v.vel.x, v.vel.z);
/** how far velocity points OFF the nose (radians) — the slide angle */
const driftAngle = (v: { vel: { x: number; z: number }; yaw: number }) => {
  const va = Math.atan2(v.vel.z, v.vel.x);
  let d = Math.abs(va - v.yaw) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
};

describe('#121 — cars drive real', () => {
  it('ice starves TRACTION: one second of full throttle goes nowhere fast', () => {
    const dirt = drive('buggy', S_DIRT);
    run(dirt.w, dirt.p.id, cmd({ moveZ: -1 }), 1);
    const ice = drive('buggy', S_ICE);
    run(ice.w, ice.p.id, cmd({ moveZ: -1 }), 1);
    expect(speedOf(ice.v), 'wheels spin on ice — far under the dirt launch')
      .toBeLessThan(speedOf(dirt.v) * 0.6);
    expect(speedOf(dirt.v), 'and dirt still launches').toBeGreaterThan(10);
  });

  it('the BRAKE bites; a human COASTS — letting go is not an anchor', () => {
    const a = drive('buggy', S_DIRT);
    run(a.w, a.p.id, cmd({ moveZ: -1 }), 1.5);          // build speed
    const v0 = speedOf(a.v);
    run(a.w, a.p.id, cmd(), 0.5);                       // let go: coast
    const coasted = speedOf(a.v);
    const b = drive('buggy', S_DIRT);
    run(b.w, b.p.id, cmd({ moveZ: -1 }), 1.5);
    run(b.w, b.p.id, cmd({ moveZ: 1 }), 0.5);           // stand on the brake
    const braked = speedOf(b.v);
    expect(coasted, 'the truck ROLLS when you let go').toBeGreaterThan(v0 * 0.6);
    expect(braked, 'the brake sheds far more than the coast').toBeLessThan(coasted * 0.55);
  });

  it('bots keep the firm stop — a waypoint driver must not orbit its checkpoint', () => {
    const human = drive('buggy', S_DIRT);
    run(human.w, human.p.id, cmd({ moveZ: -1 }), 1.5);
    run(human.w, human.p.id, cmd(), 0.5);
    const bot = drive('buggy', S_DIRT, 'bot');
    run(bot.w, bot.p.id, cmd({ moveZ: -1 }), 1.5);
    run(bot.w, bot.p.id, cmd(), 0.5); // explicit zero cmd — the bot's own brain never drives
    expect(speedOf(bot.v), 'the bot plants where the human rolls')
      .toBeLessThan(speedOf(human.v) * 0.75);
  });

  it('wheels steer by ROLLING; tracks pivot in place (the W5.5 law holds)', () => {
    const parked = drive('buggy', S_DIRT);
    run(parked.w, parked.p.id, cmd({ moveX: 1 }), 0.5);          // wheel cranked, not rolling
    const rolling = drive('buggy', S_DIRT);
    run(rolling.w, rolling.p.id, cmd({ moveZ: -1 }), 1.5);       // at speed…
    const yaw0 = rolling.v.yaw;
    run(rolling.w, rolling.p.id, cmd({ moveZ: -1, moveX: 1 }), 0.5);
    expect(Math.abs(parked.v.yaw), 'a parked car barely comes around')
      .toBeLessThan(Math.abs(rolling.v.yaw - yaw0) * 0.55);
    const tank = drive('tank', S_DIRT);
    run(tank.w, tank.p.id, cmd({ moveX: 1 }), 0.5);              // neutral steer
    expect(Math.abs(tank.v.yaw), 'a tank pivots at a standstill — full authority')
      .toBeGreaterThan(0.85 * (0.5 * 1.8 * 0.9)); // ≥90% of turnRate·t (guards regressions, not exact trig)
  });

  it('ice slides even a slip-less van — the grip rate owns cornering', () => {
    const dirt = drive('ambulance', S_DIRT);
    run(dirt.w, dirt.p.id, cmd({ moveZ: -1 }), 1.5);
    run(dirt.w, dirt.p.id, cmd({ moveZ: -1, moveX: 1 }), 0.25);
    const ice = drive('ambulance', S_ICE);
    run(ice.w, ice.p.id, cmd({ moveZ: -1 }), 3); // ice launches slow — earn some speed
    run(ice.w, ice.p.id, cmd({ moveZ: -1, moveX: 1 }), 0.25);
    expect(driftAngle(ice.v), 'the van slides wide on ice')
      .toBeGreaterThan(driftAngle(dirt.v) * 2);
    expect(driftAngle(dirt.v), 'and firm dirt still all but bites (near-rails)')
      .toBeLessThan(0.2);
  });
});
