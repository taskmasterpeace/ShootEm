// ---------------------------------------------------------------------------
// THE DEAD BITE STRUCTURES. The horde's target filter only ever accepted
// `human` and `bot`, so every sentry a player built was invulnerable scenery
// and no defence could be tested — the blocker under the whole tower-defence
// idea. A structure in reach of a zed with nothing better to do is a target.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

function siege() {
  const w = new World({ seed: 11, mode: 'horde', botsPerTeam: 0 });
  const eng = w.addSoldier('Engineer', 'engineer', 0, 'human');
  eng.pos = { x: 0, y: 0, z: 0 };
  eng.alive = true;
  // build one the way the engineer does (the sim has no public spawner)
  const turret = { id: 9001, team: 0 as const, pos: { x: 20, y: 0, z: 0 }, yaw: 0,
    hp: 180, maxHp: 180, nextFireAt: 0, ownerId: eng.id, alive: true };
  w.turrets.set(turret.id, turret);
  return { w, eng, turret };
}

describe('the horde and the sentry', () => {
  it('a zed walks to a turret and tears it down', () => {
    const { w, turret } = siege();
    const before = turret.hp;
    // a BRUTE right beside it (tough enough to survive the sentry's own
    // fire long enough to swing), and the nearest survivor far away
    const z = w.addZombie('brute', { x: 22, y: 0, z: 0 });
    z.hp = z.maxHp = 4000; // the law under test is the BITE, not the duel
    for (let i = 0; i < 60 * 8; i++) w.step(1 / 60, new Map());
    expect(turret.hp, 'the sentry was never touched').toBeLessThan(before);
  });

  it('it prefers a SURVIVOR in reach over the scenery', () => {
    const { w, eng, turret } = siege();
    const before = turret.hp;
    // the engineer stands right on top of the zed; the turret is far
    eng.pos = { x: 60, y: 0, z: 0 };
    const z = w.addZombie('zombie', { x: 62, y: 0, z: 0 });
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map());
    expect(turret.hp, 'it wandered off to chew scenery').toBe(before);
    expect(z.alive).toBe(true);
  });

  it('a friendly turret is never a target', () => {
    const { w, turret } = siege();
    const before = turret.hp;
    const z = w.addZombie('zombie', { x: 24, y: 0, z: 0 });
    z.team = 0; // same side as the sentry
    for (let i = 0; i < 60 * 5; i++) w.step(1 / 60, new Map());
    expect(turret.hp).toBe(before);
  });
});
