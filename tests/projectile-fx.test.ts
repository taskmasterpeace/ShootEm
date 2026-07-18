import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { WEAPONS } from '../src/sim/data';
import { GRID, TILE, WORLD } from '../src/sim/map';
import type { Projectile } from '../src/sim/types';

// helper: launch a bare projectile aimed +x from origin
function shot(w: World, weapon: string, over: Partial<Projectile> = {}) {
  return w.launch({
    id: w.id(), weapon, ownerId: -1, team: 0,
    pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 60, y: 0, z: 0 },
    bornAt: w.time, ttl: 3, arc: false, ...over,
  } as Projectile);
}

describe('launch copies effect flags from the weapon def', () => {
  it('a pierce weapon hands its projectile the pierce count', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    (WEAPONS.lsw_pulse as { pierce?: number }).pierce = 3; // arrange
    const p = shot(w, 'lsw_pulse');
    expect(p.pierce).toBe(3);
  });

  it('defaults dmgMul to 1 on every round', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const p = shot(w, 'ar606');
    expect(p.dmgMul).toBe(1);
  });
});

describe('pierce passes through bodies', () => {
  it('a pierce:2 round damages three lined-up enemies before dying', () => {
    const w = new World({ seed: 2, mode: 'tdm' });
    // 'human' (not 'bot'): bots path/reposition on their own every tick, and
    // that drift compounds on BOTH axes — by the time the round would reach
    // the third body its z has wandered enough that the 2D hit-radius check
    // misses even when x lines up. 'human' targets take no autonomous input
    // (no cmds submitted below), so they hold the exact line the test sets
    // up — the same convention every other stationary-target test in this
    // suite uses (altfire/armor/ascendants tests, and Task 4's own victim).
    const foes = [3, 6, 9].map((x, i) => {
      const s = w.addSoldier(`F${i}`, 'infantry', 1, 'human');
      s.pos = { x, y: 0, z: 0 }; s.hp = 100; s.maxHp = 100; return s;
    });
    (WEAPONS.rg2 as { pierce?: number }).pierce = 2; // RG-2 rail
    // clear a straight lane so the generated map's terrain can't stop the round
    const tz = Math.floor((0 + WORLD / 2) / TILE);
    for (let x = -2; x <= 12; x++) w.map.grid[tz * GRID + Math.floor((x + WORLD / 2) / TILE)] = 0; // T_OPEN
    // vel 40 (~0.67u/60Hz step) so the round can't step OVER a body between
    // frames — this test proves pierce, not swept collision (fast rounds
    // tunnelling past a point-check is a separate, pre-existing limitation).
    w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 40, y: 0, z: 0 },
      bornAt: w.time, ttl: 3, arc: false } as Projectile);
    for (let i = 0; i < 40; i++) w.step(1 / 60, new Map());
    const hurt = foes.filter((s) => s.hp < 100).length;
    expect(hurt).toBe(3); // pierced two, died in/after the third
  });
});
