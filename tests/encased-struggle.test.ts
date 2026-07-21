// ---------------------------------------------------------------------------
// UI-MASTER §6 — the encased-in-ice struggle. The renderer now surfaces this
// as the crack web on the block (opacity = struggle) plus the two drain-choice
// labels over your own body: MASH — BREAK −STRUGGLE_HP · HOLD — BLEED
// ICE_HOLD_DRAIN/s. The readout reads the SIM'S numbers, so this pins them: if
// the mechanic drifts, the HUD would start lying and this test catches it.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { ICE_HOLD_DRAIN, STRUGGLE_HP, STRUGGLE_SECS } from '../src/sim/lsw';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const mkCmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

describe('the encased-in-ice struggle (the numbers the HUD now reads)', () => {
  it('MASH shatters the block yourself — and you crawl out STRUGGLE_HP hurt', () => {
    const w = new World({ seed: 5, mode: 'tdm', matchMinutes: 10 });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const witness = w.addSoldier('W', 'infantry', 1, 'bot'); // keep the match live, far away
    a.pos = { x: 0, y: 0, z: 0 }; witness.pos = { x: 300, y: 0, z: 0 };
    a.armor = 0;                       // isolate the HP cost from any plate
    const hp0 = a.hp;
    a.encasedUntil = w.time + 100;     // frozen, a long clock so it can't melt out first
    a.encasedBy = witness.id;
    let steps = 0;
    while (a.encasedUntil !== undefined && steps < Math.ceil(STRUGGLE_SECS * 60) + 60) {
      w.step(1 / 60, new Map([[a.id, mkCmd({ moveX: 1 })]])); // moving IS mashing
      steps++;
    }
    expect(a.encasedUntil, 'the mash broke the ice').toBeUndefined();
    expect(a.alive).toBe(true);
    expect(hp0 - a.hp, 'crawled out STRUGGLE_HP hurt').toBeCloseTo(STRUGGLE_HP, 0);
    expect(steps / 60, 'it took roughly the full struggle time, not an instant').toBeGreaterThan(STRUGGLE_SECS * 0.75);
  });

  it('HOLD STILL bleeds ICE_HOLD_DRAIN per second while the shield blocks all else', () => {
    const w = new World({ seed: 5, mode: 'tdm', matchMinutes: 10 });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const witness = w.addSoldier('W', 'infantry', 1, 'bot');
    a.pos = { x: 0, y: 0, z: 0 }; witness.pos = { x: 300, y: 0, z: 0 };
    const hp0 = a.hp;
    a.encasedUntil = w.time + 100;
    a.encasedBy = witness.id;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[a.id, mkCmd()]])); // one second, no input
    expect(a.encasedUntil, 'still frozen — it did not melt in a second').toBeDefined();
    expect(hp0 - a.hp, 'exactly one second of hold-still bleed').toBeCloseTo(ICE_HOLD_DRAIN, 0);
  });
});
