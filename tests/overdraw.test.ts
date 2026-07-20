// ---------------------------------------------------------------------------
// M4 THE OVERDRAW (Robert: "the guy who can pull people in — he should have
// the ability to be MORE POWERFUL with it, use more of his power… and we need
// that energy meter and be able to see it regenerate, and certain people can
// regenerate faster").
//
// Oblivion's black hole is now a COMMITMENT: it eats the tank, and everything
// the well is scales with what went in.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { LSWS } from '../src/sim/lsw';
import { active as oblivionActive } from '../src/sim/lsw/oblivion';
import { World } from '../src/sim/world';

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const cmd = () => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
});

/** open a hole at a chosen tank level and report what it bought */
function open(energy: number) {
  const w = quiet();
  const g = w.addLsw('oblivion', LSWS.oblivion.faction, { x: 0, y: 0, z: 0 })!;
  g.energy = energy;
  g.yaw = 0;
  oblivionActive(w, g);
  const hole = w.blackHoles[w.blackHoles.length - 1];
  const field = w.forceFields[w.forceFields.length - 1];
  return { w, g, hole, field, life: hole.burstAt - w.time };
}

describe('M4 — Oblivion overdraws the well', () => {
  it('opening the hole SPENDS the tank', () => {
    const { g } = open(100);
    expect(g.energy, 'the whole tank goes in — a commitment, not a tap').toBe(0);
  });

  it('a full tank buys reach, pull, and hold time over an empty one', () => {
    const weak = open(0);
    const strong = open(100);
    expect(strong.field.r, 'reach').toBeGreaterThan(weak.field.r);
    expect(strong.field.radial, 'pull is negative — stronger means MORE negative')
      .toBeLessThan(weak.field.radial);
    // the FUSE is deliberately NOT scaled — a stronger hole must not hand you
    // a longer escape window (see oblivion.ts burstAt)
    expect(strong.life, 'the way out is always the same size').toBeCloseTo(weak.life, 5);
    expect(strong.hole.charge).toBe(1);
    expect(weak.hole.charge).toBe(0);
  });

  it('an OVERDRAWN collapse ragdolls; a starved one only shoves', () => {
    const bystander = (energy: number) => {
      const w = quiet();
      const g = w.addLsw('oblivion', LSWS.oblivion.faction, { x: 0, y: 0, z: 0 })!;
      g.energy = energy; g.yaw = 0;
      const enemy = g.team === 0 ? 1 : 0;
      const v = w.addSoldier('V', 'infantry', enemy as 0 | 1, 'human');
      // stand at the collapse point (8u down his aim). A TOUGH dummy on
      // purpose: a full-power collapse KILLS a 100hp trooper outright, and a
      // corpse can't be ragdolled — the first cut of this test proved the
      // damage, not the throw. 500hp survives to be thrown.
      v.pos = { x: 8, y: 0, z: 0 }; v.alive = true; v.protectedUntil = 0;
      v.hp = 500; v.maxHp = 500;
      oblivionActive(w, g);
      for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map());
      return v;
    };
    expect(bystander(100).ragdollUntil, 'a full-power collapse flips people').toBeDefined();
    expect(bystander(0).ragdollUntil, 'a starved one is just a bang').toBeUndefined();
  });

  it('he regenerates faster than a mortal — the overdraw god earns it back', () => {
    expect(LSWS.oblivion.energyRegen).toBeGreaterThan(1.2);
    const w = quiet();
    const g = w.addLsw('oblivion', LSWS.oblivion.faction, { x: 0, y: 0, z: 0 })!;
    g.energy = 0;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[g.id, cmd()]]));
    expect(g.energy, 'a second of standing still is real progress').toBeGreaterThan(20);
  });
});
