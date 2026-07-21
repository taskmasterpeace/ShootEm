// ---------------------------------------------------------------------------
// ICE IS SLICK (row 240 — the `slick` flag on MATERIALS.ice was dead data).
// On a slick floor the boots don't bite: velocity EASES toward intent instead
// of snapping to it, and COASTS when the input stops. You skate, you overshoot
// the corner, a shove sends you sliding. Grounded only — the arc owns the air.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, S_DIRT, S_ICE, TILE, WORLD } from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

const tileIdx = (x: number, z: number) =>
  Math.floor((z + WORLD / 2) / TILE) * GRID + Math.floor((x + WORLD / 2) / TILE);

/** paint a broad patch of one surface under the origin, drop a soldier on it */
function onSurface(surf: number) {
  const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
  for (let x = -30; x <= 30; x += 1) for (let z = -30; z <= 30; z += 3) w.map.surface[tileIdx(x, z)] = surf;
  const s = w.addSoldier('Skater', 'infantry', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 }; s.yaw = 0; s.protectedUntil = 0;
  return { w, s };
}

describe('row 240 — ice is slick', () => {
  it('a first step on ICE lags — grip eases in, it does not snap to full speed', () => {
    const dirt = onSurface(S_DIRT);
    const ice = onSurface(S_ICE);
    dirt.w.step(1 / 60, new Map([[dirt.s.id, cmd({ moveX: 1 })]]));
    ice.w.step(1 / 60, new Map([[ice.s.id, cmd({ moveX: 1 })]]));
    expect(Math.abs(dirt.s.vel.x), 'dirt bites instantly — full stride tick one').toBeGreaterThan(3);
    expect(Math.abs(ice.s.vel.x), 'ice slips — the first tick barely moves you')
      .toBeLessThan(Math.abs(dirt.s.vel.x) * 0.4);
  });

  it('letting go on ICE COASTS; on dirt you stop dead', () => {
    const dirt = onSurface(S_DIRT);
    const ice = onSurface(S_ICE);
    // build up speed
    for (let i = 0; i < 60; i++) {
      dirt.w.step(1 / 60, new Map([[dirt.s.id, cmd({ moveX: 1 })]]));
      ice.w.step(1 / 60, new Map([[ice.s.id, cmd({ moveX: 1 })]]));
    }
    // release — no input
    dirt.w.step(1 / 60, new Map([[dirt.s.id, cmd()]]));
    ice.w.step(1 / 60, new Map([[ice.s.id, cmd()]]));
    expect(Math.abs(dirt.s.vel.x), 'dirt: boots plant, you stop').toBeLessThan(0.01);
    expect(Math.abs(ice.s.vel.x), 'ice: momentum carries you on').toBeGreaterThan(2);
  });

  it('the glide DECAYS — a coast is not perpetual motion', () => {
    const { w, s } = onSurface(S_ICE);
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    const v0 = Math.abs(s.vel.x);
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[s.id, cmd()]])); // coast 0.5s
    const v1 = Math.abs(s.vel.x);
    expect(v1, 'still sliding half a second later').toBeGreaterThan(0.3);
    expect(v1, 'but bleeding off — not frictionless').toBeLessThan(v0 * 0.85);
  });

  it('dirt is unchanged — the skate is ICE-ONLY, player feel elsewhere is untouched', () => {
    const { w, s } = onSurface(S_DIRT);
    w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    const full = Math.abs(s.vel.x);
    w.step(1 / 60, new Map([[s.id, cmd()]]));
    expect(Math.abs(s.vel.x), 'instant stop on dirt').toBeLessThan(0.01);
    expect(full, 'and instant go').toBeGreaterThan(3);
  });
});
