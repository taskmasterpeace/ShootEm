// ---------------------------------------------------------------------------
// THE CIRCUIT (docs/RACING.md) — the droppables and the record board.
// RDS's soul: you race AND you fight. A mine arms late so it can never kill
// its own driver; oil turns the floor to ice for whoever crosses it; and a
// record is a time with a NAME on it.
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import { GRID, S_DIRT, TILE, WORLD } from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';
import { fileRun, raceClassOf, recordFor, recordStorage } from '../src/client/records';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});
const tileIdx = (x: number, z: number) =>
  Math.floor((z + WORLD / 2) / TILE) * GRID + Math.floor((x + WORLD / 2) / TILE);

function racer(kind: 'sedan' | 'musclecar' = 'sedan') {
  const w = new World({ seed: 9, mode: 'tdm', botsPerTeam: 0 });
  for (let x = -78; x <= -20; x += 1) for (let z = -78; z <= -20; z += 2) w.map.surface[tileIdx(x, z)] = S_DIRT;
  const p = w.addSoldier('Driver', 'infantry', 0, 'human');
  p.alive = true;
  const v = w.spawnVehicle(kind, 0, { x: -60, y: 0, z: -60 });
  v.alive = true; v.seats[0] = p.id; v.yaw = 0;
  p.vehicleId = v.id; p.seat = 0; p.enteredVehicleAt = w.time - 10;
  return { w, p, v };
}
const run = (w: World, id: number, c: PlayerCmd, secs: number) => {
  for (let i = 0; i < 60 * secs; i++) w.step(1 / 60, new Map([[id, c]]));
};

describe('the droppables', () => {
  it('a loaded hull drops a mine BEHIND itself, and it costs a mine', () => {
    const { w, p, v } = racer();
    v.mines = 3;
    run(w, p.id, cmd({ grenade: true }), 0.1);
    expect(v.mines, 'the drop spent one').toBe(2);
    const mine = [...w.gadgets.values()].find((g) => g.type === 'race_mine');
    expect(mine, 'nothing was dropped').toBeTruthy();
    // behind = opposite the nose (yaw 0 faces +X, so the mine sits at -X)
    expect(mine!.pos.x).toBeLessThan(v.pos.x);
    expect(mine!.ownerVehicleId).toBe(v.id);
  });

  it('it CANNOT kill its own driver — the arming beat is the whole fairness', () => {
    const { w, p, v } = racer();
    v.mines = 1;
    run(w, p.id, cmd({ grenade: true }), 0.1);
    const before = v.hp;
    // sit on top of your own mine for two seconds — well past its arming time
    const mine = [...w.gadgets.values()].find((g) => g.type === 'race_mine')!;
    v.pos.x = mine.pos.x; v.pos.z = mine.pos.z;
    run(w, p.id, cmd(), 2);
    expect(v.hp, 'your own mine never bites you').toBe(before);
  });

  it('…but it takes a chunk out of a RIVAL, and pitches them into the air', () => {
    const { w, p, v } = racer();
    v.mines = 1;
    run(w, p.id, cmd({ grenade: true }), 0.1);
    const mine = [...w.gadgets.values()].find((g) => g.type === 'race_mine')!;
    const rival = w.spawnVehicle('sedan', 1, { x: mine.pos.x, y: 0, z: mine.pos.z });
    rival.alive = true;
    const before = rival.hp;
    run(w, p.id, cmd(), 2);
    expect(rival.hp, 'the rival ate it').toBeLessThan(before);
    expect(rival.airborneAt !== undefined || (rival.vel.y ?? 0) > 0, 'and got pitched').toBe(true);
  });

  it('oil turns the floor to ice for whoever crosses it — but not for you', () => {
    const { w, p, v } = racer();
    v.oil = 2;
    run(w, p.id, cmd({ grenade: true }), 0.1);
    expect(v.oil).toBe(1);
    const slick = [...w.gadgets.values()].find((g) => g.type === 'oil_slick');
    expect(slick).toBeTruthy();
    const rival = w.spawnVehicle('sedan', 1, { x: slick!.pos.x, y: 0, z: slick!.pos.z });
    rival.alive = true;
    run(w, p.id, cmd(), 0.5);
    expect((rival.oiledUntil ?? 0), 'the rival is on oil').toBeGreaterThan(w.time);
    expect((v.oiledUntil ?? 0), 'the dropper is not').toBeLessThanOrEqual(w.time);
  });

  it('mines go out first, then oil — the cargo empties in order', () => {
    const { w, p, v } = racer();
    v.mines = 1; v.oil = 1;
    run(w, p.id, cmd({ grenade: true }), 0.1);
    expect(v.mines).toBe(0);
    expect(v.oil, 'oil waits its turn').toBe(1);
    run(w, p.id, cmd({ grenade: true }), 1);
    expect(v.oil).toBe(0);
  });
});

describe('the record board', () => {
  let mem: string | null = null;
  beforeEach(() => {
    mem = null;
    recordStorage.get = () => mem;
    recordStorage.set = (v: string) => { mem = v; };
  });

  it('machines race their own kind', () => {
    expect(raceClassOf('bike')).toBe('bike');
    expect(raceClassOf('hoverboard')).toBe('board');
    expect(raceClassOf('sedan', VEHICLES.sedan.mass)).toBe('car');
    expect(raceClassOf('racetruck', VEHICLES.racetruck.mass)).toBe('truck');
  });

  it('a first run takes the record, and the board remembers WHO', () => {
    const r = fileRun({ trackId: 'yard_alpha', hull: 'sedan', holder: 'MACHINE KING', lap: 42.5, at: 1 });
    expect(r.tookLap).toBe(true);
    const rec = recordFor('yard_alpha', 'car')!;
    expect(rec.lap).toBe(42.5);
    expect(rec.holder, 'a time nobody holds is just a number').toBe('MACHINE KING');
  });

  it('a faster run TAKES it off the holder by name; a slower one does not', () => {
    fileRun({ trackId: 'yard_alpha', hull: 'sedan', holder: 'MACHINE KING', lap: 42.5, at: 1 });
    const slower = fileRun({ trackId: 'yard_alpha', hull: 'sedan', holder: 'VEX', lap: 44, at: 2 });
    expect(slower.tookLap).toBe(false);
    expect(recordFor('yard_alpha', 'car')!.holder).toBe('MACHINE KING');
    const faster = fileRun({ trackId: 'yard_alpha', hull: 'sedan', holder: 'VEX', lap: 40.1, at: 3 });
    expect(faster.tookLap).toBe(true);
    expect(faster.previous?.holder, 'the board knows who you beat').toBe('MACHINE KING');
    expect(recordFor('yard_alpha', 'car')!.holder).toBe('VEX');
  });

  it('classes keep separate books — a truck time never touches the car record', () => {
    fileRun({ trackId: 'yard_alpha', hull: 'sedan', holder: 'MACHINE KING', lap: 42.5, at: 1 });
    fileRun({ trackId: 'yard_alpha', hull: 'racetruck', mass: VEHICLES.racetruck.mass, holder: 'VEX', lap: 55, at: 2 });
    expect(recordFor('yard_alpha', 'car')!.holder).toBe('MACHINE KING');
    expect(recordFor('yard_alpha', 'truck')!.holder).toBe('VEX');
  });
});
