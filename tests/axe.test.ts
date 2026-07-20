// ---------------------------------------------------------------------------
// M5 THROW AND RETRIEVE (Robert: "you can give them a thing they can throw and
// retrieve stuff"). The Breacher Axe is one object with three states: on your
// back, buried in the world, or flying home. The decision it creates: a bad
// throw disarms you until you go get it — and a good one sets up a LANE, because
// calling it back opens everything between the axe and your hand.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const thrower = (w: World) => {
  const s = w.addSoldier('AXE', 'infantry', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0; s.yaw = 0;
  // V1: the axe costs an equipment slot — a soldier without it on his rig has
  // a rifle, not a sci-fi returning weapon
  s.equipment = [...s.equipment, 'breacher_axe'];
  return s;
};
const settle = (w: World, secs = 2) => { for (let i = 0; i < 60 * secs; i++) w.step(1 / 60, new Map()); };

describe('M5 — the Breacher Axe', () => {
  it('THROWN: it leaves the hand and BURIES itself where it stops', () => {
    const w = quiet(); const s = thrower(w);
    w.applyCmd(s, cmd({ melee: true, aimDist: 14 }), 1 / 60);
    expect(s.axeId, 'claimed the moment it flies').toBeDefined();
    settle(w);
    const axe = [...w.gadgets.values()].find((g) => g.type === 'axe');
    expect(axe, 'it is in the ground now, not gone').toBeDefined();
    expect(s.axeId, 'and the thrower knows exactly where').toBe(axe!.id);
    expect(Math.hypot(axe!.pos.x - s.pos.x, axe!.pos.z - s.pos.z), 'downrange').toBeGreaterThan(3);
  });

  it('ONE AXE: a second press while it is buried does not throw another', () => {
    const w = quiet(); const s = thrower(w);
    w.applyCmd(s, cmd({ melee: true, aimDist: 14 }), 1 / 60);
    settle(w);
    w.applyCmd(s, cmd({ melee: true, aimDist: 14 }), 1 / 60); // this RECALLS, never duplicates
    settle(w);
    expect([...w.gadgets.values()].filter((g) => g.type === 'axe'), 'never two axes').toHaveLength(0);
  });

  it('RECALLED: it comes home and is throwable again', () => {
    const w = quiet(); const s = thrower(w);
    w.applyCmd(s, cmd({ melee: true, aimDist: 14 }), 1 / 60);
    settle(w);
    expect(s.axeId).toBeDefined();
    w.applyCmd(s, cmd({ melee: true }), 1 / 60); // call it back
    expect(s.axeId, 'out of the ground').toBeUndefined();
    expect(s.axeRecallAt, 'in the air, briefly').toBeDefined();
    settle(w);
    expect(s.axeRecallAt, 'landed — ready to throw again').toBeUndefined();
  });

  it('THE LANE: the return path opens everyone standing on it', () => {
    const w = quiet(); const s = thrower(w);
    const victim = w.addSoldier('V', 'infantry', 1, 'human');
    const bystander = w.addSoldier('B', 'infantry', 1, 'human');
    for (const v of [victim, bystander]) { v.alive = true; v.protectedUntil = 0; }
    w.applyCmd(s, cmd({ melee: true, aimDist: 16 }), 1 / 60);
    settle(w);
    const axe = [...w.gadgets.values()].find((g) => g.type === 'axe')!;
    // one ON the line home, one well off it
    victim.pos = { x: axe.pos.x * 0.5, y: 0, z: axe.pos.z * 0.5 };
    bystander.pos = { x: axe.pos.x * 0.5, y: 0, z: axe.pos.z * 0.5 + 6 };
    const vBefore = victim.hp, bBefore = bystander.hp;
    w.applyCmd(s, cmd({ melee: true }), 1 / 60);
    expect(victim.hp, 'on the line — it goes through him').toBeLessThan(vBefore);
    expect(bystander.hp, 'off the line — untouched').toBe(bBefore);
  });

  it('friendlies are never on the lane', () => {
    const w = quiet(); const s = thrower(w);
    const mate = w.addSoldier('M', 'infantry', 0, 'human'); // same team
    mate.alive = true; mate.protectedUntil = 0;
    w.applyCmd(s, cmd({ melee: true, aimDist: 16 }), 1 / 60);
    settle(w);
    const axe = [...w.gadgets.values()].find((g) => g.type === 'axe')!;
    mate.pos = { x: axe.pos.x * 0.5, y: 0, z: axe.pos.z * 0.5 };
    const before = mate.hp;
    w.applyCmd(s, cmd({ melee: true }), 1 / 60);
    expect(mate.hp).toBe(before);
  });
});
