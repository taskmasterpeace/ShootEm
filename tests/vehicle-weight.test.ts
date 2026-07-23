// ---------------------------------------------------------------------------
// WEIGHT & HANDLING (Robert: "give vehicles handling and weight… we need cars
// to be able to have handbrakes… make sure we have some pickups and faster
// cars, so we can have races"). Three dials, one drivetrain:
//   MASS   — resists a change of motion: slower to build speed, longer to
//            stop, wider through a corner. Reference 1.6t = neutral.
//   GRIP   — the chassis' own contribution, independent of weight.
//   THE HANDBRAKE — now on EVERY wheeled hull, not just the tuned ones.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import { GRID, S_DIRT, TILE, WORLD } from '../src/sim/map';
import { licenceFor } from '../src/sim/licenses';
import type { PlayerCmd, SoldierKind, VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});
const tileIdx = (x: number, z: number) =>
  Math.floor((z + WORLD / 2) / TILE) * GRID + Math.floor((x + WORLD / 2) / TILE);

function drive(kind: VehicleKind, driverKind: SoldierKind = 'human') {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  for (let x = -78; x <= -20; x += 1) for (let z = -78; z <= -20; z += 2) w.map.surface[tileIdx(x, z)] = S_DIRT;
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
const driftAngle = (v: { vel: { x: number; z: number }; yaw: number }) => {
  const va = Math.atan2(v.vel.z, v.vel.x);
  let d = Math.abs(va - v.yaw) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
};

describe('weight — mass is a real dial', () => {
  it('every hull in the fleet declares a mass and a handling figure', () => {
    for (const kind of Object.keys(VEHICLES) as VehicleKind[]) {
      const d = VEHICLES[kind];
      expect(d.mass, `${kind} has no mass`).toBeGreaterThan(0);
      expect(d.grip, `${kind} has no handling`).toBeGreaterThan(0);
    }
  });

  it('a heavy hull takes longer to reach its own pace than a light one', () => {
    // fraction of top speed reached in one second — the light car is quicker
    const frac = (kind: VehicleKind) => {
      const { w, p, v } = drive(kind);
      run(w, p.id, cmd({ moveZ: -1 }), 1);
      return speedOf(v) / VEHICLES[kind].speed;
    };
    expect(frac('roadster'), 'the 1.05t roadster is up and gone')
      .toBeGreaterThan(frac('racetruck')); // 5.5t
    expect(frac('sedan')).toBeGreaterThan(frac('firetruck')); // 1.5t vs 12t
  });

  it('a heavy hull needs longer to stop — braking is mass, honestly', () => {
    const stopped = (kind: VehicleKind) => {
      const { w, p, v } = drive(kind);
      run(w, p.id, cmd({ moveZ: -1 }), 1.5); // enough to be moving, short of the far wall
      const before = speedOf(v);
      expect(before, `${kind} never got going`).toBeGreaterThan(4);
      run(w, p.id, cmd({ moveZ: 1 }), 0.4); // stand on the brake
      return speedOf(v) / before; // fraction of speed RETAINED
    };
    expect(stopped('racetruck'), 'the heavy truck carries its speed into the corner')
      .toBeGreaterThan(stopped('roadster'));
  });

  it('handling is separate from weight — same class, different corner', () => {
    // the roadster (grip 1.4, slip 1.4) and the hot rod (grip 0.9, slip 4.0)
    // are within a tonne of each other and corner nothing alike
    const corner = (kind: VehicleKind) => {
      const { w, p, v } = drive(kind);
      run(w, p.id, cmd({ moveZ: -1 }), 2);
      run(w, p.id, cmd({ moveZ: -1, moveX: 1 }), 0.3);
      return driftAngle(v);
    };
    expect(Math.abs((VEHICLES.roadster.mass ?? 0) - (VEHICLES.hotrod.mass ?? 0))).toBeLessThan(1);
    expect(corner('roadster'), 'the roadster bites').toBeLessThan(corner('hotrod'));
  });
});

describe('the handbrake — every car has a lever now', () => {
  it('a slip-LESS civilian van can be thrown sideways (it had no lever before)', () => {
    const plain = drive('ambulance');
    run(plain.w, plain.p.id, cmd({ moveZ: -1 }), 2);
    run(plain.w, plain.p.id, cmd({ moveZ: -1, moveX: 1 }), 0.3);
    const without = driftAngle(plain.v);
    const yanked = drive('ambulance');
    run(yanked.w, yanked.p.id, cmd({ moveZ: -1 }), 2);
    run(yanked.w, yanked.p.id, cmd({ moveZ: -1, moveX: 1, jump: true }), 0.3);
    expect(driftAngle(yanked.v), 'the tail steps out').toBeGreaterThan(without * 1.5);
  });

  it('a tank has no handbrake — tracks do not do that', () => {
    const a = drive('tank');
    run(a.w, a.p.id, cmd({ moveZ: -1 }), 2);
    run(a.w, a.p.id, cmd({ moveZ: -1, moveX: 1 }), 0.3);
    const b = drive('tank');
    run(b.w, b.p.id, cmd({ moveZ: -1 }), 2);
    run(b.w, b.p.id, cmd({ moveZ: -1, moveX: 1, jump: true }), 0.3);
    expect(driftAngle(b.v)).toBeCloseTo(driftAngle(a.v), 5);
  });

  it('bots never yank it — a bot driver looks competent, not broken', () => {
    const a = drive('sedan', 'bot');
    run(a.w, a.p.id, cmd({ moveZ: -1 }), 2);
    run(a.w, a.p.id, cmd({ moveZ: -1, moveX: 1 }), 0.3);
    const b = drive('sedan', 'bot');
    run(b.w, b.p.id, cmd({ moveZ: -1 }), 2);
    run(b.w, b.p.id, cmd({ moveZ: -1, moveX: 1, jump: true }), 0.3);
    expect(driftAngle(b.v)).toBeCloseTo(driftAngle(a.v), 5);
  });
});

describe('the fast lane — cars worth racing', () => {
  const FAST: VehicleKind[] = ['musclecar', 'roadster', 'rallytruck', 'racetruck', 'hotrod'];

  it('all five exist, are civilian, unarmed, and need only a Basic Driver licence', () => {
    for (const kind of FAST) {
      const d = VEHICLES[kind];
      expect(d, kind).toBeTruthy();
      expect(d.civilian).toBe(true);
      expect(d.weapon).toBe('');
      expect(licenceFor(kind)).toBe('basic_driver');
    }
  });

  it('they are genuinely FAST — quicker than the sedan they park beside', () => {
    for (const kind of FAST) {
      expect(VEHICLES[kind].speed, `${kind} is not fast`).toBeGreaterThan(VEHICLES.sedan.speed + 4);
    }
    expect(VEHICLES.musclecar.speed, 'the muscle car owns the top end')
      .toBeGreaterThanOrEqual(Math.max(...FAST.map((k) => VEHICLES[k].speed)));
  });

  it('they are SIDEGRADES — nothing is strictly best (the arsenal law, on wheels)', () => {
    for (const a of FAST) {
      for (const b of FAST) {
        if (a === b) continue;
        const A = VEHICLES[a], B = VEHICLES[b];
        const betterEverywhere = A.speed > B.speed && (A.grip ?? 1) > (B.grip ?? 1)
          && A.hp > B.hp && A.turnRate > B.turnRate;
        expect(betterEverywhere, `${a} strictly dominates ${b}`).toBe(false);
      }
    }
  });

  it('nothing in the fast lane outruns a bullet (the ground ceiling holds)', () => {
    for (const kind of FAST) expect(VEHICLES[kind].speed).toBeLessThan(33.3);
  });
});
