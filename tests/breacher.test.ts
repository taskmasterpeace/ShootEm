// ---------------------------------------------------------------------------
// The Breacher: depth-stealth for the Mole Tunneling Machine. Deep runs are
// silent, off-minimap, and pass UNDER walls — but crawl and cannot dig.
// Surface runs grind fast and loud. The trade is the fun.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_OPEN, T_WALL, TILE, WORLD } from '../src/sim/map';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import type { PlayerCmd, Vehicle } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const run = (w: World, cmds: Map<number, PlayerCmd>, seconds: number) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) w.step(1 / 60, cmds);
};

/** World + a human driver seated in the team-0 tunneler. */
const crewedBreacher = () => {
  const w = new World({ seed: 42, mode: 'tdm' });
  const tun = [...w.vehicles.values()].find((v) => v.kind === 'tunneler' && v.team === 0)!;
  const d = w.addSoldier('D', 'engineer', 0, 'human');
  d.pos = { ...tun.pos };
  w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
  expect(d.vehicleId).toBe(tun.id);
  return { w, tun, d };
};

/** Interior wall tile with 4 open tiles east — a staging lane for the machine. */
// Carve a LONE wall in guaranteed-open ground with clear approaches both
// sides — the breacher's target shouldn't depend on where a given seed's map
// happens to grow a wall (the region grammar moved them all).
const findWall = (w: World): [number, number] => {
  const tx = 50, tz = 40;
  for (let i = -6; i <= 6; i++)
    for (let dz = -2; dz <= 2; dz++) w.map.grid[(tz + dz) * GRID + tx + i] = T_OPEN;
  w.map.grid[tz * GRID + tx] = T_WALL;
  return [tx, tz];
};

/** Park the machine 3 tiles east of the wall, nose pointed straight at it. */
const stageAtWall = (tun: Vehicle, wallTx: number, wallTz: number) => {
  tun.pos = { x: (wallTx + 3.5) * TILE - WORLD / 2, y: 0, z: (wallTz + 0.5) * TILE - WORLD / 2 };
  tun.vel = { x: 0, y: 0, z: 0 };
  tun.yaw = Math.PI; // face -X
};

describe('the Breacher', () => {
  it('the driver toggles depth with the ability key, and the wire carries it', () => {
    const { w, tun, d } = crewedBreacher();
    expect(tun.burrowed).toBeFalsy();
    w.step(1 / 60, new Map([[d.id, cmd({ ability: true })]]));
    expect(tun.burrowed).toBe(true);
    expect(w.events.some((e) => e.type === 'beacon_planted' && e.text === 'Breacher DIVING')).toBe(true);

    // burrowed replicates: a puppet applying the snapshot sees the dive
    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));
    const w2 = new World({ seed: 42, mode: 'tdm' });
    w2.puppet = true;
    applySnapshot(w2, snap);
    expect(w2.vehicles.get(tun.id)!.burrowed).toBe(true);

    // 1.5s cooldown, then the same key surfaces it
    run(w, new Map([[d.id, cmd()]]), 1.6);
    w.step(1 / 60, new Map([[d.id, cmd({ ability: true })]]));
    expect(tun.burrowed).toBe(false);
    expect(w.events.some((e) => e.type === 'beacon_planted' && e.text === 'Breacher SURFACING')).toBe(true);
  });

  it('deep, it passes UNDER a wall without digging it', () => {
    const { w, tun, d } = crewedBreacher();
    const [wallTx, wallTz] = findWall(w);
    stageAtWall(tun, wallTx, wallTz);
    w.step(1 / 60, new Map([[d.id, cmd({ ability: true })]]));
    expect(tun.burrowed).toBe(true);

    run(w, new Map([[d.id, cmd({ moveZ: -1 })]]), 8);
    const wallX = (wallTx + 0.5) * TILE - WORLD / 2;
    expect(tun.pos.x).toBeLessThan(wallX - TILE); // came out the far side
    expect(w.map.grid[wallTz * GRID + wallTx]).toBe(T_WALL); // the wall never felt it
    expect(w.dug.length).toBe(0);
    expect(w.events.some((e) => e.type === 'dig')).toBe(false);
  });

  it('surfaced, it grinds the wall to open ground — loudly', () => {
    const { w, tun, d } = crewedBreacher();
    const [wallTx, wallTz] = findWall(w);
    stageAtWall(tun, wallTx, wallTz);

    let dug = false;
    for (let i = 0; i < 60 * 20 && !dug; i++) {
      w.step(1 / 60, new Map([[d.id, cmd({ moveZ: -1 })]]));
      dug = w.dug.length > 0;
    }
    expect(dug).toBe(true);
    expect(w.map.grid[w.dug[0]]).toBe(T_OPEN);
    expect(w.events.some((e) => e.type === 'dig')).toBe(true);
  });

  it('deep running is the slow way round', () => {
    const { w, tun, d } = crewedBreacher();
    const topSpeed = () => {
      tun.pos = { ...w.map.hillPos };
      tun.vel = { x: 0, y: 0, z: 0 };
      tun.yaw = 0;
      let top = 0;
      for (let i = 0; i < 90; i++) {
        w.step(1 / 60, new Map([[d.id, cmd({ moveZ: -1 })]]));
        top = Math.max(top, Math.hypot(tun.vel.x, tun.vel.z));
      }
      return top;
    };
    const surfaced = topSpeed();
    w.step(1 / 60, new Map([[d.id, cmd({ ability: true })]]));
    expect(tun.burrowed).toBe(true);
    const deep = topSpeed();
    expect(deep).toBeGreaterThan(0);
    expect(deep).toBeLessThan(surfaced * 0.7); // half pace through packed earth
  });
});
