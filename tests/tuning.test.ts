// ---------------------------------------------------------------------------
// THE GLOBAL SPEED KNOBS (Robert): projectile + movement multipliers, live
// and offline. The laws that make them safe:
//   · default 1 changes NOTHING (tests + the authoritative server untouched)
//   · a slower bullet still LANDS WHERE AIMED — range is preserved, only the
//     time-of-flight grows (ttl = reach/speed compensates)
//   · arcs are left alone, so grenades still hit the cursor
//   · movement scales cleanly
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { WEAPONS } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const shooter = () => {
  const w = new World({ seed: 42, mode: 'tdm' });
  const s = w.addSoldier('S', 'infantry', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 }; s.yaw = 0; s.alive = true;
  return { w, s };
};

const speedOf = (v: { x: number; z: number }) => Math.hypot(v.x, v.z);

describe('the projectile-speed knob', () => {
  it('defaults to 1 — a fresh world fires at the shipped speed', () => {
    const { w, s } = shooter();
    expect(w.projectileSpeedMul).toBe(1);
    w.throwProjectile(s, 'ar606', 1.4, WEAPONS.ar606.speed, false, 40);
    const p = [...w.projectiles.values()][0];
    expect(speedOf(p.vel)).toBeCloseTo(WEAPONS.ar606.speed, 1);
  });

  it('a lower knob slows the round but keeps its RANGE — it still lands where aimed', () => {
    const base = shooter();
    base.w.throwProjectile(base.s, 'ar606', 1.4, WEAPONS.ar606.speed, false, 40);
    const p1 = [...base.w.projectiles.values()][0];
    const range1 = speedOf(p1.vel) * p1.ttl;

    const slow = shooter();
    slow.w.projectileSpeedMul = 0.5;
    slow.w.throwProjectile(slow.s, 'ar606', 1.4, WEAPONS.ar606.speed, false, 40);
    const p2 = [...slow.w.projectiles.values()][0];
    const range2 = speedOf(p2.vel) * p2.ttl;

    expect(speedOf(p2.vel), 'the round did not slow down').toBeLessThan(speedOf(p1.vel) * 0.6);
    expect(p2.ttl, 'a slower round must fly LONGER to reach the same spot').toBeGreaterThan(p1.ttl * 1.5);
    expect(range2, 'the landing distance moved with the knob').toBeCloseTo(range1, 0);
  });

  it('a round fired slow actually TRAVELS the same distance before it dies', () => {
    // clear a long lane so nothing but ttl stops the round
    const build = (mul: number) => {
      const { w, s } = shooter();
      w.projectileSpeedMul = mul;
      const GRID = 100;
      for (let z = 48; z <= 52; z++) for (let x = 50; x < GRID - 1; x++) w.map.grid[z * GRID + x] = 0;
      w.throwProjectile(s, 'ar606', 1.4, WEAPONS.ar606.speed, false, 40);
      const id = [...w.projectiles.keys()][0];
      let last = { x: 0, z: 0 };
      for (let i = 0; i < 60 * 6; i++) {
        const p = w.projectiles.get(id);
        if (p) last = { x: p.pos.x, z: p.pos.z };
        w.step(1 / 60, new Map());
        if (!w.projectiles.has(id)) break;
      }
      return Math.hypot(last.x, last.z);
    };
    const full = build(1);
    const half = build(0.5);
    expect(half, 'the slowed round fell short of where the fast one landed').toBeCloseTo(full, -0.5); // within ~a couple units
  });

  it('leaves ARCS alone — a grenade at half knob still lands on the cursor', () => {
    const base = shooter();
    base.w.throwProjectile(base.s, 'gl', 1.4, 16, true, 22, 1, true);
    const a = [...base.w.projectiles.values()][0];

    const slow = shooter();
    slow.w.projectileSpeedMul = 0.5;
    slow.w.throwProjectile(slow.s, 'gl', 1.4, 16, true, 22, 1, true);
    const b = [...slow.w.projectiles.values()][0];

    expect(speedOf(b.vel), 'the knob bent the grenade arc').toBeCloseTo(speedOf(a.vel), 1);
    expect(b.vel.y, 'the knob changed the lob').toBeCloseTo(a.vel.y, 1);
  });
});

describe('the movement-speed knob', () => {
  it('defaults to 1', () => {
    expect(new World({ seed: 1, mode: 'tdm' }).moveSpeedMul).toBe(1);
  });

  it('a higher knob moves a soldier proportionally farther', () => {
    const run = (mul: number) => {
      const { w, s } = shooter();
      w.moveSpeedMul = mul;
      const x0 = s.pos.x;
      for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
      return Math.abs(s.pos.x - x0);
    };
    const normal = run(1);
    const fast = run(2);
    expect(normal, 'the soldier never moved').toBeGreaterThan(1);
    expect(fast / normal, 'doubling the knob did not roughly double the distance').toBeGreaterThan(1.7);
  });
});
