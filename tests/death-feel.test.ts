// ---------------------------------------------------------------------------
// THE DEATH IS WORTH SEEING.
//
// Robert: "there is no ragdoll for killing — like if a bullet hits you and it
// kills you, it'd be nice to see it knock you back. If a shotgun hits you it'd
// be nice to see it hit you and then blow you back… knock you into a wall or
// something."
//
// Until now the main loop skipped every dead soldier before physics, so a
// corpse froze at the exact position of the killing frame — mid-stride, mid-
// air, unmoved by the blast that killed it. And death threw away everything
// about the killing blow except its direction.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { GRID, T_OPEN, T_WALL, TILE, WORLD } from '../src/sim/map';
import { World, deathShove } from '../src/sim/world';

const world = () => new World({ seed: 12, mode: 'tdm' });
const run = (w: World, n: number) => { for (let i = 0; i < n; i++) w.step(1 / 60, new Map()); };

describe('the killing blow has weight', () => {
  it('a body MOVES after it dies — it no longer freezes where it stood', () => {
    const w = world();
    const shooter = w.addSoldier('Shooter', 'infantry', 0, 'human');
    const victim = w.addSoldier('Victim', 'infantry', 1, 'human');
    shooter.pos = { x: 0, y: 0, z: 0 };
    victim.pos = { x: 6, y: 0, z: 0 };
    const before = { ...victim.pos };
    w.damageSoldier(victim, 999, shooter.id, 'caw'); // buckshot, point blank
    run(w, 30);
    const moved = Math.hypot(victim.pos.x - before.x, victim.pos.z - before.z);
    expect(moved, 'the corpse never moved').toBeGreaterThan(0.5);
  });

  it('and it is thrown AWAY from the killer, not toward them', () => {
    const w = world();
    const shooter = w.addSoldier('Shooter', 'infantry', 0, 'human');
    const victim = w.addSoldier('Victim', 'infantry', 1, 'human');
    shooter.pos = { x: 0, y: 0, z: 0 };
    victim.pos = { x: 6, y: 0, z: 0 };
    w.damageSoldier(victim, 999, shooter.id, 'caw');
    run(w, 30);
    expect(victim.pos.x, 'shot from the west, fall to the east').toBeGreaterThan(6);
  });

  it('A SHOTGUN BLOWS YOU BACK; a rifle only knocks you down', () => {
    const throwDist = (weapon: string) => {
      const w = world();
      const k = w.addSoldier('K', 'infantry', 0, 'human');
      const v = w.addSoldier('V', 'infantry', 1, 'human');
      k.pos = { x: 0, y: 0, z: 0 };
      v.pos = { x: 6, y: 0, z: 0 };
      w.damageSoldier(v, 999, k.id, weapon as never);
      run(w, 90);
      return v.pos.x - 6;
    };
    const buckshot = throwDist('caw');
    const rifle = throwDist('ar606');
    expect(rifle, 'a rifle round should still tip a man over').toBeGreaterThan(0);
    expect(buckshot, 'buckshot must throw a body noticeably further')
      .toBeGreaterThan(rifle * 1.6);
  });

  it('ENERGY DOES NOT SHOVE — a beam kill drops you where you stood', () => {
    // the contrast is the point: a laser death and a shotgun death must not
    // look like the same death with a different colour
    const beams = Object.values(WEAPONS).filter((d) => d.tracer === 'beam' || d.tracer === 'rail');
    expect(beams.length, 'no energy weapon to check').toBeGreaterThan(0);
    for (const d of beams) expect(deathShove(d), d.id).toBe(0);
    expect(deathShove(WEAPONS.caw), 'buckshot must not be silent').toBeGreaterThan(10);
  });

  it('an explosive throws hardest of all, and lifts you off your feet', () => {
    expect(deathShove(WEAPONS.gl)).toBeGreaterThanOrEqual(11);
    const w = world();
    const k = w.addSoldier('K', 'infantry', 0, 'human');
    const v = w.addSoldier('V', 'infantry', 1, 'human');
    k.pos = { x: 0, y: 0, z: 0 };
    v.pos = { x: 5, y: 0, z: 0 };
    w.damageSoldier(v, 999, k.id, 'gl');
    expect(v.vel.y, 'a blast should get a body airborne').toBeGreaterThan(0);
  });

  it('KNOCKED INTO A WALL: a body arriving hard says so, and stops dead', () => {
    const w = world();
    const k = w.addSoldier('K', 'infantry', 0, 'human');
    const v = w.addSoldier('V', 'infantry', 1, 'human');
    // build a wall just east of the victim and shoot him into it
    const tz = Math.floor((0 + WORLD / 2) / TILE);
    const vx = 0, tx = Math.floor((vx + WORLD / 2) / TILE);
    for (let d = -2; d <= 2; d++) w.map.grid[(tz + d) * GRID + tx + 1] = T_WALL;
    w.map.grid[tz * GRID + tx] = T_OPEN;
    k.pos = { x: vx - 4, y: 0, z: 0 };
    v.pos = { x: vx, y: 0, z: 0 };
    w.takeEvents();
    w.damageSoldier(v, 999, k.id, 'caw');
    let slam = false;
    for (let i = 0; i < 90; i++) {
      w.step(1 / 60, new Map());
      if (w.takeEvents().some((e) => e.type === 'corpse_slam')) slam = true;
    }
    expect(slam, 'a body thrown into masonry should be heard doing it').toBe(true);
    expect(Math.hypot(v.pushX, v.pushZ), 'the wall takes all of it').toBe(0);
  });

  it('the body settles and STAYS settled — no corpse drifts forever', () => {
    const w = world();
    const k = w.addSoldier('K', 'infantry', 0, 'human');
    const v = w.addSoldier('V', 'infantry', 1, 'human');
    k.pos = { x: 0, y: 0, z: 0 };
    v.pos = { x: 6, y: 0, z: 0 };
    w.damageSoldier(v, 999, k.id, 'gl');
    run(w, 140);                       // past CORPSE_PHYSICS_S (2.2s)
    const rest = { ...v.pos };
    run(w, 60);                        // still short of the 4s respawn
    expect(Math.hypot(v.pos.x - rest.x, v.pos.z - rest.z)).toBeLessThan(0.001);
    expect(v.corpseUntil, 'the corpse clock must release the body').toBeUndefined();
    expect(v.alive, 'and this must be measured before the respawn moves him').toBe(false);
  });

  it('a corpse stays inside the world and out of the walls', () => {
    const w = world();
    const k = w.addSoldier('K', 'infantry', 0, 'human');
    const v = w.addSoldier('V', 'infantry', 1, 'human');
    k.pos = { x: WORLD / 2 - 12, y: 0, z: 0 };
    v.pos = { x: WORLD / 2 - 6, y: 0, z: 0 }; // blast him at the map rim
    w.damageSoldier(v, 999, k.id, 'gl');
    run(w, 200);                       // corpse released, respawn not yet due
    expect(Math.abs(v.pos.x)).toBeLessThanOrEqual(WORLD / 2);
    expect(Math.abs(v.pos.z)).toBeLessThanOrEqual(WORLD / 2);
    expect(v.pos.y).toBe(0);
  });
});
