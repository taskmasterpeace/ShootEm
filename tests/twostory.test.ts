// ---------------------------------------------------------------------------
// The second storey (§8.4 Phase-2): grid2 layer, T_LADDER, floor state.
// E climbs, the well descends, edges drop you, upper walls stop bullets in
// the 4..8 band, and upstairs muzzles clear every ground wall for free.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { generateHouse, stampBuilding, type StampCtx } from '../src/sim/buildings';
import {
  F2_FLOOR, F2_SLIT, F2_WALL, F2_WELL, GRID, T_LADDER, T_WALL, TILE, WORLD,
  blocksShotUpper, losClear,
} from '../src/sim/map';
import { Rng } from '../src/sim/rng';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;

/** A hand-built loft: 5x5 upper floor with a well, ladder foot below. */
function loftScene() {
  const w = new World({ seed: 5, mode: 'tdm' });
  const cx = Math.floor(GRID / 2) + 8, cz = Math.floor(GRID / 2);
  for (let dz = -4; dz <= 4; dz++)
    for (let dx = -4; dx <= 4; dx++) {
      w.map.grid[(cz + dz) * GRID + cx + dx] = 0;
      w.map.grid2[(cz + dz) * GRID + cx + dx] = 0;
    }
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) w.map.grid2[(cz + dz) * GRID + cx + dx] = F2_FLOOR;
  const idx = cz * GRID + cx;
  w.map.grid[idx] = T_LADDER;
  w.map.grid2[idx] = F2_WELL;
  const s = w.addSoldier('Climber', 'infantry', 0, 'human');
  s.pos = { x: toWorld(cx), y: 0, z: toWorld(cz) };
  s.yaw = 0;
  return { w, s, cx, cz, idx };
}

describe('the ladder — E is still the activation key', () => {
  it('E climbs to the loft; E on the well comes back down', () => {
    const { w, s } = loftScene();
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.floor).toBe(1);
    expect(s.pos.y).toBe(4);
    w.step(1 / 60, new Map()); // settle (use released)
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.floor).toBe(0);
    expect(s.pos.y).toBe(0);
  });

  it('upstairs movement is blocked by upper walls, not ground tiles', () => {
    const { w, s, cx, cz } = loftScene();
    w.map.grid2[cz * GRID + cx + 1] = F2_WALL;      // wall to the east, upstairs
    w.map.grid[cz * GRID + cx - 1] = T_WALL;        // wall to the west, DOWNSTAIRS only
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.floor).toBe(1);
    // pushing east hits the upper wall
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    expect(s.pos.x).toBeLessThan(toWorld(cx + 1) - 1);
    // pushing west sails over the ground wall — it only exists downstairs
    for (let i = 0; i < 40; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: -1 })]]));
    expect(s.pos.x).toBeLessThan(toWorld(cx - 1) + TILE);
    expect(s.floor).toBe(1);
  });

  it('walking off the edge is a FALL back to the ground floor', () => {
    const { w, s } = loftScene();
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.floor).toBe(1);
    // run east past the 2-tile floor edge into the void
    for (let i = 0; i < 90; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    expect(s.floor).toBe(0);
    expect(s.pos.y).toBe(0); // gravity finished the argument
  });

  it('floor state rides the wire', () => {
    const { w, s, idx } = loftScene();
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));
    const w2 = new World({ seed: 5, mode: 'tdm' });
    w2.puppet = true;
    applySnapshot(w2, snap);
    const puppet = [...w2.soldiers.values()].find((x) => x.name === 'Climber')!;
    expect(puppet.floor).toBe(1);
    expect(puppet.pos.y).toBe(4);
    expect(idx).toBeGreaterThan(0);
  });
});

describe('upstairs ballistics — the sniper nest', () => {
  it('an upstairs muzzle (y 5.4) clears a ground wall that blocks a ground muzzle', () => {
    const g = new Uint8Array(GRID * GRID);
    g[50 * GRID + 50] = T_WALL;
    const a = { x: toWorld(46), y: 0, z: toWorld(50) };
    const b = { x: toWorld(54), y: 0, z: toWorld(50) };
    expect(losClear(g, a, b, 1.4)).toBe(false); // ground: the wall wins
    expect(losClear(g, a, b, 5.4)).toBe(true);  // upstairs: over the top
  });

  it('upper walls block the 4..8 band; the upper slit passes only its fire band', () => {
    const g2 = new Uint8Array(GRID * GRID);
    const x = toWorld(50), z = toWorld(50);
    g2[50 * GRID + 50] = F2_WALL;
    expect(blocksShotUpper(g2, x, z, 5.4)).toBe(true);
    expect(blocksShotUpper(g2, x, z, 1.4)).toBe(false); // below the storey
    expect(blocksShotUpper(g2, x, z, 9)).toBe(false);   // above the roofline
    g2[50 * GRID + 50] = F2_SLIT;
    expect(blocksShotUpper(g2, x, z, 5.4)).toBe(false); // the nest band
    expect(blocksShotUpper(g2, x, z, 4.5)).toBe(true);
    expect(blocksShotUpper(g2, x, z, 6.5)).toBe(true);
  });

  it('a blast downstairs does not gut the loft (the slab eats it)', () => {
    const { w, s, cx, cz } = loftScene();
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.floor).toBe(1);
    const hpBefore = s.hp;
    w.explode({ x: toWorld(cx), y: 0, z: toWorld(cz) }, { ...w2gl(), splash: 5, splashDamage: 50 }, -1, 1);
    expect(s.hp).toBe(hpBefore);
  });
});

// tiny helper: a gl-shaped weapon def for the blast test
function w2gl() {
  return {
    id: 'gl', name: 'gl', damage: 55, rof: 1, speed: 34, spread: 0, pellets: 1,
    clip: 5, reloadTime: 1, reserve: 30, range: 46, splash: 5, splashDamage: 50,
    arc: true, heals: false, knockback: 10, sound: 'thump', tracer: 'shell' as const,
  };
}

describe('the grown two-storey manor', () => {
  it('some manors grow a loft: ladder foot below, well above, windows all around', () => {
    let found = 0;
    for (let seed = 1; seed <= 40 && found < 3; seed++) {
      const def = generateHouse(new Rng(seed), 'manor');
      if (def.floors !== 2) continue;
      found++;
      expect(def.rows2).toBeDefined();
      const h = def.rows.length, w = Math.max(...def.rows.map((r) => r.length));
      let ladder: [number, number] | null = null;
      for (let z = 0; z < h; z++)
        for (let x = 0; x < w; x++) if (def.rows[z][x] === 'L') ladder = [x, z];
      expect(ladder, `seed ${seed} loft needs a ladder`).not.toBeNull();
      expect(def.rows2![ladder![1]][ladder![0]]).toBe('L'); // the well sits on the ladder
      const wins = def.rows2!.reduce((n, r) => n + r.split('').filter((c) => c === 'S').length, 0);
      expect(wins).toBeGreaterThanOrEqual(4); // the nest is lit
    }
    expect(found).toBeGreaterThanOrEqual(1);
  });

  it('stamping a two-storey manor writes both layers and the taller roof rect', () => {
    let def = generateHouse(new Rng(1), 'manor');
    for (let seed = 2; def.floors !== 2 && seed < 60; seed++) def = generateHouse(new Rng(seed), 'manor');
    expect(def.floors).toBe(2);
    const grid = new Uint8Array(GRID * GRID);
    const grid2 = new Uint8Array(GRID * GRID);
    const ctx: StampCtx = { grid, grid2, props: [], pickups: [], houses: [], claims: [], rng: new Rng(1) };
    expect(stampBuilding(ctx, def, 40, 40)).toBe(true);
    expect(grid.includes(T_LADDER)).toBe(true);
    expect(grid2.some((t) => t === F2_FLOOR)).toBe(true);
    expect(grid2.some((t) => t === F2_WELL)).toBe(true);
    expect(ctx.houses[0].floors).toBe(2);
  });
});
