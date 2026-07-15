// ---------------------------------------------------------------------------
// Personal FPV drone: a Ghost deploys it with Q and FLIES it — the body kneels
// at the controller. The control link is the leash: range, EMP, gunfire, or a
// downed operator all end the flight the same way — static, then the crash.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID } from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { DRONE_RANGE, World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

function ghostWithDrone() {
  const w = new World({ seed: 7, mode: 'tdm' });
  for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) w.map.grid[z * GRID + x] = 0;
  const s = w.addSoldier('S', 'ghost', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 };
  s.energy = 100;
  w.step(1 / 60, new Map([[s.id, cmd({ ability: true })]]));
  const drone = w.getPilotedDrone(s.id);
  return { w, s, drone };
}

describe('personal FPV drone', () => {
  it('Q deploys a piloted drone; the cmd flies IT while the body stays put', () => {
    const { w, s, drone } = ghostWithDrone();
    expect(drone, 'drone deployed').toBeTruthy();
    expect(drone!.piloted).toBe(true);
    const bodyX = s.pos.x;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    expect(drone!.pos.x, 'drone flew +X').toBeGreaterThan(8);
    expect(Math.abs(s.pos.x - bodyX), 'body knelt at the controller').toBeLessThan(0.5);
  });

  it('bots keep the auto-orbit drone (never piloted)', () => {
    const w = new World({ seed: 8, mode: 'tdm' });
    const b = w.addSoldier('B', 'ghost', 0, 'bot');
    b.energy = 100;
    w.step(1 / 60, new Map([[b.id, cmd({ ability: true })]]));
    const g = [...w.gadgets.values()].find((x) => x.type === 'drone' && x.ownerId === b.id);
    expect(g, 'bot drone spawned').toBeTruthy();
    expect(g!.piloted ?? false).toBe(false);
    expect(w.getPilotedDrone(b.id)).toBeUndefined();
  });

  it('past control range the link drops: static → crash → wreck on the ground', () => {
    const { w, s, drone } = ghostWithDrone();
    drone!.pos.x = DRONE_RANGE + 4; // flew too far
    w.step(1 / 60, new Map());
    expect(drone!.crashing, 'link lost').toBe(true);
    expect(w.getPilotedDrone(s.id), 'controls dead during the fall').toBeUndefined();
    let crashed = false;
    for (let i = 0; i < 60 * 3; i++) {
      w.step(1 / 60, new Map());
      if (w.takeEvents().some((e) => e.type === 'drone_crash')) { crashed = true; break; }
    }
    expect(crashed, 'the drone hit the dirt').toBe(true);
    expect([...w.gadgets.values()].some((g) => g.type === 'drone' && g.ownerId === s.id)).toBe(false);
  });

  it('an enemy EMP burst jams the drone out of the sky', () => {
    const { w, drone } = ghostWithDrone();
    w.empBlast({ x: drone!.pos.x, y: 0, z: drone!.pos.z }, 1, -1); // enemy team burst
    expect(drone!.crashing).toBe(true);
  });

  it('the operator going down kills the link (dead stick)', () => {
    const { w, s, drone } = ghostWithDrone();
    const killer = w.addSoldier('K', 'infantry', 1, 'bot');
    w.damageSoldier(s, 9999, killer.id, 'ar606');
    w.step(1 / 60, new Map());
    expect(drone!.crashing).toBe(true);
  });

  it('signal reads full up close and fades toward the edge', () => {
    const { w, s, drone } = ghostWithDrone();
    w.step(1 / 60, new Map([[s.id, cmd()]]));
    expect(drone!.signal ?? 0).toBeGreaterThan(0.9);
    drone!.pos.x = DRONE_RANGE * 0.8;
    w.step(1 / 60, new Map([[s.id, cmd()]]));
    expect(drone!.signal ?? 1).toBeLessThan(0.3);
    expect(drone!.crashing ?? false).toBe(false); // degraded, not dead
  });
});
