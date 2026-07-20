// ---------------------------------------------------------------------------
// THE BOARD DRIFTS (Robert: "the hoverboard's controlled too well. They should
// be a little bit more slippery. And fun.")
//
// Every hull used to rebuild its velocity from its facing every tick — the
// lines `v.vel.x = cos(yaw) * speed` DISCARD whatever direction you were
// actually moving, which makes lateral momentum mathematically impossible.
// The hoverboard now carries `slip`: its velocity CHASES the nose instead of
// obeying it, so a hard carve at speed slides before it bites.
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

function ride(kind: VehicleKind) {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  const p = w.addSoldier('P', 'infantry', 0, 'human');
  const v = w.spawnVehicle(kind, 0, { x: 0, y: 0, z: 0 });
  v.alive = true; v.seats[0] = p.id;
  p.vehicleId = v.id; p.seat = 0; p.alive = true;
  p.enteredVehicleAt = w.time - 10;
  return { w, p, v };
}
const run = (w: World, p: { id: number }, c: PlayerCmd, secs: number) => {
  for (let i = 0; i < Math.round(60 * secs); i++) w.step(1 / 60, new Map([[p.id, c]]));
};

/** angle between where the hull POINTS and where it actually MOVES */
function slipAngle(v: { yaw: number; vel: { x: number; z: number } }): number {
  const sp = Math.hypot(v.vel.x, v.vel.z);
  if (sp < 0.5) return 0;
  let d = Math.atan2(v.vel.z, v.vel.x) - v.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

describe('the hoverboard is slippery — and only the hoverboard', () => {
  it('the board declares slip; the wheeled and tracked fleet stays on rails', () => {
    expect(VEHICLES.hoverboard.slip).toBeGreaterThan(0);
    for (const kind of ['buggy', 'tank', 'apc', 'bike'] as VehicleKind[]) {
      expect(VEHICLES[kind].slip, `${kind} must not drift`).toBeUndefined();
    }
  });

  it('A HARD CARVE SLIDES: mid-turn, the board moves where it WAS going', () => {
    const { w, p, v } = ride('hoverboard');
    run(w, p, cmd({ moveZ: -1 }), 2);                    // wind it up straight
    // the engine must have REAL authority — the first slip cut lagged the
    // whole velocity and this suite passed with the board at walking pace
    expect(Math.hypot(v.vel.x, v.vel.z), 'full throttle must mean full speed')
      .toBeGreaterThan(VEHICLES.hoverboard.speed * 0.5);
    run(w, p, cmd({ moveZ: -1, moveX: 1 }), 0.25);       // …then throw it sideways
    expect(slipAngle(v), 'the nose turned but the board must still be sliding')
      .toBeGreaterThan(0.25);
  });

  it('the same carve on a BUGGY grips instantly — rails are still rails', () => {
    const { w, p, v } = ride('buggy');
    run(w, p, cmd({ moveZ: -1 }), 2);
    run(w, p, cmd({ moveZ: -1, moveX: 1 }), 0.25);
    expect(slipAngle(v), 'a wheeled hull must not have gained drift').toBeLessThan(0.03);
  });

  it('SLIPPERY, NOT SOAP: hold the line after the carve and the board bites', () => {
    const { w, p, v } = ride('hoverboard');
    run(w, p, cmd({ moveZ: -1 }), 2);
    run(w, p, cmd({ moveZ: -1, moveX: 1 }), 0.25);
    run(w, p, cmd({ moveZ: -1 }), 1.2);                  // straighten out
    expect(slipAngle(v), 'a board that never regrips is not fun, it is ice')
      .toBeLessThan(0.1);
  });

  it('boarding any hull announces WHICH hull — the crew row and chatter key off it', () => {
    const w = new World({ seed: 7, mode: 'tdm', botsPerTeam: 0 });
    const p = w.addSoldier('P', 'infantry', 0, 'human');
    const v = w.spawnVehicle('buggy', 0, { x: 6, y: 0, z: 0 });
    v.alive = true;
    p.pos = { x: 5, y: 0, z: 0 };
    w.takeEvents();
    w.step(1 / 60, new Map([[p.id, cmd({ use: true })]]));
    const enter = w.takeEvents().find((e) => e.type === 'vehicle_enter');
    expect(enter, 'boarding must emit').toBeTruthy();
    expect(enter!.vehicleId).toBe(v.id);
    expect(enter!.soldierId).toBe(p.id);
  });
});

describe('a ghost may not hold a chair', () => {
  it('a rider killed aboard frees the seat, and the salvage clock starts', () => {
    const w = new World({ seed: 9, mode: 'tdm', botsPerTeam: 0 });
    const p = w.addSoldier('P', 'infantry', 0, 'human');
    const v = w.spawnVehicle('hoverboard', 0, { x: 0, y: 0, z: 0 });
    v.alive = true; v.seats[0] = p.id;
    p.vehicleId = v.id; p.seat = 0;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map()); // t > 0, so the clock reads
    w.damageSoldier(p, 999, -1, 'gl');
    expect(p.alive).toBe(false);
    expect(v.seats[0], 'the manifest must not keep a dead man').toBe(-1);
    expect(v.abandonedAt, 'an empty hull goes on the salvage clock').toBeGreaterThan(0);
    expect(p.vehicleId).toBe(-1);
    // and the seat is genuinely usable again
    const q = w.addSoldier('Q', 'infantry', 0, 'human');
    q.pos = { x: 1, y: 0, z: 0 };
    w.tryEnterVehicle(q);
    expect(q.vehicleId).toBe(v.id);
  });
});
