// ---------------------------------------------------------------------------
// row 246 — WATER THAT FREEZES INTO A CROSSABLE SURFACE. Frostbite, the ice
// god, freezes the water he stands near into a crossable sheet: you WALK
// across (no swim, no wade drag) and it's SLICK (the row-240 skate), and it
// THAWS a few seconds after he moves on. Only water takes; dry ground is never
// "frozen". The visual is a pale sheet the renderer overlays per live tile.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_DEEP, T_OPEN, T_WATER, TILE, WORLD } from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

const tileIdx = (x: number, z: number) =>
  Math.floor((z + WORLD / 2) / TILE) * GRID + Math.floor((x + WORLD / 2) / TILE);

/** a pond of deep water at the origin, a soldier standing in it */
function pond() {
  const w = new World({ seed: 9, mode: 'tdm', matchMinutes: 10 });
  for (let x = -12; x <= 12; x += 1) for (let z = -12; z <= 12; z += 1) w.map.grid[tileIdx(x, z)] = T_DEEP;
  const s = w.addSoldier('Wader', 'infantry', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 }; s.yaw = 0; s.protectedUntil = 0;
  return { w, s };
}

describe('row 246 — the frost bridge', () => {
  it('freezeWaterNear only takes on WATER, and marks it frozen until the thaw', () => {
    const { w } = pond();
    w.map.grid[tileIdx(5, 0)] = T_OPEN; // a dry patch inside the pond
    w.freezeWaterNear(0, 0, 7, w.time + 5);
    expect(w.isFrozenWater(0, 0), 'water at the center froze').toBe(true);
    expect(w.isFrozenWater(5, 0), 'the dry tile never freezes').toBe(false);
    expect(w.isFrozenWater(40, 40), 'far off the pond — untouched').toBe(false);
  });

  it('frozen deep water is CROSSED, not swum — full stride, no wade drag', () => {
    const wet = pond();
    const ice = pond();
    ice.w.freezeWaterNear(0, 0, 10, ice.w.time + 5);
    // both push east through the water for a beat
    for (let i = 0; i < 40; i++) {
      wet.w.step(1 / 60, new Map([[wet.s.id, cmd({ moveX: 1 })]]));
      ice.w.step(1 / 60, new Map([[ice.s.id, cmd({ moveX: 1 })]]));
    }
    expect(ice.s.pos.x, 'the frozen crossing carries you far past the swimmer')
      .toBeGreaterThan(wet.s.pos.x + 2);
  });

  it('the frost bridge is SLICK — let go and you coast (row 240 inherited)', () => {
    const { w, s } = pond();
    w.freezeWaterNear(0, 0, 12, w.time + 8);
    for (let i = 0; i < 40; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    w.freezeWaterNear(0, 0, 12, w.time + 8); // keep it frozen under him
    w.step(1 / 60, new Map([[s.id, cmd()]])); // release
    expect(Math.abs(s.vel.x), 'ice under the water — momentum carries').toBeGreaterThan(2);
  });

  it('it THAWS on its clock — the ford is temporary', () => {
    const { w } = pond();
    w.freezeWaterNear(0, 0, 7, w.time + 2);
    expect(w.isFrozenWater(0, 0)).toBe(true);
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map()); // 3s, past the 2s thaw
    expect(w.isFrozenWater(0, 0), 'the ice melted back to water').toBe(false);
  });

  it('FROSTBITE lays the bridge under himself as he crosses', () => {
    const { w } = pond();
    const g = w.addLsw('frostbite', 0, { x: 0, y: 0, z: 0 })!;
    expect(g).toBeTruthy();
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map()); // let his brain run
    expect(w.isFrozenWater(g.pos.x, g.pos.z), 'the ice god froze the water at his feet').toBe(true);
    const froze = w.takeEvents().some((e) => e.type === 'water_froze');
    expect(froze, 'the freeze announced itself for the renderer').toBe(true);
  });
});
