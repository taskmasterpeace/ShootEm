// ---------------------------------------------------------------------------
// The Goliath Assault Walker — the walking middle ground. Its LEGS are the
// mechanic: low cover that stops every wheeled and tracked hull is a stair
// step to it; the stomp scatters whoever crowds it. Balance is relational:
// hp between APC and tank, slowest armed ground unit, best heavy pivot.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES, WEAPONS } from '../src/sim/data';
import { GRID, T_COVER, T_OPEN, TILE, WORLD, generateMap } from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

/** World + a driver seated in a vehicle of the given kind, parked at pos. */
function crewed(kind: 'mech' | 'tank') {
  const w = new World({ seed: 42, mode: 'tdm' });
  const v = [...w.vehicles.values()].find((x) => x.kind === kind && x.team === 0)!;
  const d = w.addSoldier('D', 'infantry', 0, 'human');
  d.pos = { ...v.pos };
  w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
  expect(d.vehicleId).toBe(v.id);
  return { w, v, d };
}

/** Park the hull west of a hand-stamped cover line and floor it eastward. */
function chargeCoverLine(w: ReturnType<typeof crewed>['w'], v: { pos: { x: number; y: number; z: number }; vel: { x: number; y: number; z: number }; yaw: number }, d: { id: number }) {
  const tz = Math.floor(GRID / 2) + 6;
  const tx = Math.floor(GRID / 2);
  for (let dz = -4; dz <= 4; dz++) {
    w.map.grid[(tz + dz) * GRID + tx] = T_COVER; // a 9-tile cover wall
    for (let cx = -4; cx <= 4; cx++) if (cx !== 0) w.map.grid[(tz + dz) * GRID + tx + cx] = T_OPEN;
  }
  const wallX = (tx + 0.5) * TILE - WORLD / 2;
  v.pos = { x: wallX - 8, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 };
  v.vel = { x: 0, y: 0, z: 0 };
  v.yaw = 0; // face +x, straight at the cover
  const cmds = new Map([[d.id, cmd({ moveZ: -1 })]]);
  for (let i = 0; i < 60 * 6; i++) w.step(1 / 60, cmds);
  return { crossed: v.pos.x > wallX + TILE, wallX };
}

describe('the Goliath Assault Walker', () => {
  it('balance slot holds: between APC and tank in hp, slowest armed walker, best heavy pivot', () => {
    const m = VEHICLES.mech;
    expect(m.strider).toBe(true);
    expect(m.stomps).toBe(true);
    expect(m.hp).toBeGreaterThan(VEHICLES.apc.hp);
    expect(m.hp).toBeLessThan(VEHICLES.tank.hp);
    expect(m.speed).toBeLessThan(VEHICLES.tank.speed);
    expect(m.turnRate).toBeGreaterThan(VEHICLES.tank.turnRate);
    // the gun kills infantry, not tanks: strong sustained dps, weak per-hit
    const dps = WEAPONS.mech_autocannon.damage * WEAPONS.mech_autocannon.rof;
    expect(dps).toBeGreaterThan(70);
    expect(WEAPONS.mech_autocannon.damage).toBeLessThan(WEAPONS.tank_cannon.damage / 3);
  });

  it('legs step over the cover line that stops a tank cold', () => {
    const a = crewed('mech');
    const mech = chargeCoverLine(a.w, a.v, a.d);
    expect(mech.crossed).toBe(true); // strode over the sandbags

    const b = crewed('tank');
    const tank = chargeCoverLine(b.w, b.v, b.d);
    expect(tank.crossed).toBe(false); // treads stack up against them
    expect(b.v.pos.x).toBeLessThan(tank.wallX); // still on the near side
  });

  it('the stomp shoves and bruises whoever crowds the legs — on a 6s cooldown', () => {
    const { w, v, d } = crewed('mech');
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    foe.pos = { x: v.pos.x + 2.5, y: 0, z: v.pos.z };
    const hp0 = foe.hp;
    w.step(1 / 60, new Map([[d.id, cmd({ ability: true })]]));
    expect(foe.pushX).toBeGreaterThan(0); // shoved away from the walker
    expect(foe.hp).toBeLessThan(hp0);     // bruised, not deleted
    expect(foe.alive).toBe(true);

    // cooldown: an immediate second stomp does nothing
    foe.pushX = 0; foe.pushZ = 0;
    const hp1 = foe.hp;
    w.step(1 / 60, new Map([[d.id, cmd({ ability: true })]]));
    expect(foe.pushX).toBe(0);
    expect(foe.hp).toBe(hp1);
  });

  it('every battlefield fields one per team, parked on open ground', () => {
    const m = generateMap(7, 'tdm', 'savanna');
    const pads = m.vehiclePads.filter((p) => p.kind === 'mech');
    expect(pads.length).toBe(2);
    expect(new Set(pads.map((p) => p.team)).size).toBe(2);
  });
});
