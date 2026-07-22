// ---------------------------------------------------------------------------
// THE WEIGHT LAW (#102 — evolved from row 240's ice-only skate, by Robert's
// 2026-07-22 ruling: "fix that snappiness. I do wanna decelerate depending on
// what surface you're on"). Boots never teleport to intent: grounded velocity
// EASES toward it at the floor material's GRIP, and BRAKES at the same grip
// when the input stops. Metal deck bites hardest, dirt is firm, grit shifts,
// mud sucks, ice barely holds — one dial, read from MATERIALS. Ice keeps its
// row-240/246 identity (the slow ease-in and the long coast) as the dial's
// low end. Grounded only — the arc owns the air.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, S_DIRT, S_GRIT, S_ICE, S_MUD, S_PLATE, TILE, WORLD } from '../src/sim/map';
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

/** first-tick push-off velocity on a surface — the bite of that floor */
function firstTick(surf: number): number {
  const { w, s } = onSurface(surf);
  w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
  return Math.abs(s.vel.x);
}

describe('the weight law — grip is a material property', () => {
  it('a first step EASES in everywhere — no floor snaps you to full stride', () => {
    const { w, s } = onSurface(S_DIRT);
    // full stride = where the ease converges (1.5s of running)
    for (let i = 0; i < 90; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    const full = Math.abs(s.vel.x);
    const bite = firstTick(S_DIRT);
    expect(bite, 'dirt bites HARD on tick one — real push-off').toBeGreaterThan(full * 0.15);
    expect(bite, 'but it EASES — tick one is not full stride (the snap is dead)').toBeLessThan(full * 0.5);
    expect(full, 'and the ease converges to a real run').toBeGreaterThan(3);
  });

  it('the grip ladder: plate ≥ dirt > grit > mud > ice', () => {
    const plate = firstTick(S_PLATE);
    const dirt = firstTick(S_DIRT);
    const grit = firstTick(S_GRIT);
    const mud = firstTick(S_MUD);
    const ice = firstTick(S_ICE);
    expect(plate, 'boots on deck bite hardest').toBeGreaterThanOrEqual(dirt);
    expect(dirt, 'firm earth beats loose gravel').toBeGreaterThan(grit);
    expect(grit, 'gravel beats the suck of mud').toBeGreaterThan(mud);
    expect(mud, 'and even mud grips better than ice').toBeGreaterThan(ice);
  });

  it('ice still slips — the first tick barely moves you (row 240 holds)', () => {
    expect(firstTick(S_ICE)).toBeLessThan(firstTick(S_DIRT) * 0.4);
  });

  it('letting go on dirt SETTLES in a beat; on ice you coast on', () => {
    const dirt = onSurface(S_DIRT);
    const ice = onSurface(S_ICE);
    for (let i = 0; i < 60; i++) {
      dirt.w.step(1 / 60, new Map([[dirt.s.id, cmd({ moveX: 1 })]]));
      ice.w.step(1 / 60, new Map([[ice.s.id, cmd({ moveX: 1 })]]));
    }
    const v0 = Math.abs(dirt.s.vel.x);
    // release — no input
    dirt.w.step(1 / 60, new Map([[dirt.s.id, cmd()]]));
    ice.w.step(1 / 60, new Map([[ice.s.id, cmd()]]));
    expect(Math.abs(dirt.s.vel.x), 'dirt: the brake grabs immediately').toBeLessThan(v0 * 0.75);
    expect(Math.abs(ice.s.vel.x), 'ice: momentum carries you on').toBeGreaterThan(2);
    // a fifth of a second later the dirt runner has PLANTED —
    // deceleration, not a freeze frame, not a skate
    for (let i = 0; i < 11; i++) dirt.w.step(1 / 60, new Map([[dirt.s.id, cmd()]]));
    expect(Math.abs(dirt.s.vel.x), 'settled within ~0.2s').toBeLessThan(0.3);
  });

  it('the ice glide DECAYS — a coast is not perpetual motion (row 246 holds)', () => {
    const { w, s } = onSurface(S_ICE);
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    const v0 = Math.abs(s.vel.x);
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[s.id, cmd()]])); // coast 0.5s
    const v1 = Math.abs(s.vel.x);
    expect(v1, 'still sliding half a second later').toBeGreaterThan(0.3);
    expect(v1, 'but bleeding off — not frictionless').toBeLessThan(v0 * 0.85);
  });
});
