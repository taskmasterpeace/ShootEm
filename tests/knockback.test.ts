// ---------------------------------------------------------------------------
// Blast knockback — explosions shove people. Distance-scaled push, capped
// vertical pop (drama, not pinball), power-armor immunity, smoke stays gentle.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';

const world = () => new World({ seed: 7, mode: 'tdm' });

describe('blast knockback', () => {
  it('a GL blast shoves a soldier away and pops him off the ground', () => {
    const w = world();
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.pos = { x: 10, y: 0, z: 0 };
    w.explode({ x: 8, y: 0, z: 0 }, WEAPONS.gl, -1, 1);
    expect(s.pushX).toBeGreaterThan(0); // shoved +x, away from the blast
    expect(s.vel.y).toBeGreaterThan(0); // and popped upward
  });

  it('power armor plants its feet: no shove, no pop', () => {
    const w = world();
    const s = w.addSoldier('P', 'infantry', 0, 'human', { equipment: ['power_armor'] });
    s.pos = { x: 10, y: 0, z: 0 };
    w.explode({ x: 8, y: 0, z: 0 }, WEAPONS.gl, -1, 1);
    expect(s.pushX).toBe(0);
    expect(s.pushZ).toBe(0);
    expect(s.vel.y).toBe(0);
  });

  it('closer soldiers get shoved harder — falloff scales with distance', () => {
    const w = world();
    const near = w.addSoldier('N', 'heavy', 0, 'human');
    const far = w.addSoldier('F', 'heavy', 0, 'human');
    near.pos = { x: 1.5, y: 0, z: 0 };
    far.pos = { x: 4, y: 0, z: 0 };
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.gl, -1, 1);
    expect(near.pushX).toBeGreaterThan(far.pushX);
    expect(far.pushX).toBeGreaterThan(0); // still inside the splash, still shoved
  });

  it('smoke rounds conceal, never shove', () => {
    for (const mk of [1, 2, 3]) {
      expect(WEAPONS[`grenade_smoke_${mk}`].knockback).toBe(0);
    }
    // even a forced smoke "blast" moves no one
    const w = world();
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.pos = { x: 1, y: 0, z: 0 };
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.grenade_smoke_1, -1, 1);
    expect(s.pushX).toBe(0);
    expect(s.vel.y).toBe(0);
  });

  it('the vertical pop is clamped — artillery pops, it does not orbit', () => {
    const w = world();
    const s = w.addSoldier('S', 'heavy', 0, 'human');
    s.pos = { x: 1.2, y: 0, z: 0 };
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.artillery_maklov_3, -1, 1); // knockback 30
    expect(s.vel.y).toBeGreaterThan(0);
    expect(s.vel.y).toBeLessThanOrEqual(6);
  });

  it('every splash family shoves, scaled by mk-tier; heal beams never do', () => {
    expect(WEAPONS.gl.knockback).toBe(10);
    expect(WEAPONS.mml.knockback).toBe(14);
    expect(WEAPONS.tank_cannon.knockback).toBe(18);
    expect(WEAPONS.demo_charge.knockback).toBe(16);
    expect(WEAPONS.grenade_frag_1.knockback).toBeGreaterThan(0);
    expect(WEAPONS.grenade_frag_3.knockback).toBeGreaterThan(WEAPONS.grenade_frag_1.knockback);
    expect(WEAPONS.artillery_maklov_3.knockback).toBeGreaterThan(WEAPONS.artillery_maklov_1.knockback);
    expect(WEAPONS.mortar_maklov_1.knockback).toBeGreaterThan(0);
    expect(WEAPONS.at_rocket_maklov_1.knockback).toBeGreaterThan(0);
    expect(WEAPONS.medibeam.knockback).toBe(0);
    expect(WEAPONS.repair.knockback).toBe(0);
  });
});
