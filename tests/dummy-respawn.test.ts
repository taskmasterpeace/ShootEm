// ---------------------------------------------------------------------------
// REGENERATING RANGE DUMMIES (Robert: "the dummies on that one map don't even
// regenerate"). A dummy flagged `respawns` pops back up at its `dummyHome` a
// few seconds after it drops, so a weapon-test range never runs out of
// targets. A plain dummy (no flag) stays down, as the timed qual run needs.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

describe('regenerating range dummies', () => {
  it('a respawning dummy comes BACK at its home after it drops', () => {
    const w = new World({ seed: 1, mode: 'range', matchMinutes: 15 });
    const d = w.addSoldier('Target', 'infantry', 1, 'bot');
    d.pos = { x: 12, y: 0, z: 3 }; d.dummy = true; d.respawns = true;
    d.dummyHome = { ...d.pos }; d.protectedUntil = 0; d.alive = true;
    w.damageSoldier(d, 999, -1, 'rifle'); // knock it down
    expect(d.alive, 'dropped').toBe(false);
    // wait past the respawn delay
    let cameBack = false;
    for (let i = 0; i < 60 * 6 && !cameBack; i++) { w.step(1 / 60, new Map()); if (d.alive) cameBack = true; }
    expect(cameBack, 'the target regenerated').toBe(true);
    expect(d.hp, 'full health again').toBe(d.maxHp);
    expect(d.pos.x, 'back at its home spot').toBe(12);
    expect(d.pos.z).toBe(3);
  });

  it('a plain dummy (no respawns flag) STAYS down — the timed run still ends', () => {
    const w = new World({ seed: 1, mode: 'range', matchMinutes: 15 });
    const d = w.addSoldier('QualTarget', 'infantry', 1, 'bot');
    d.pos = { x: 12, y: 0, z: 0 }; d.dummy = true; d.protectedUntil = 0; d.alive = true;
    w.damageSoldier(d, 999, -1, 'rifle');
    for (let i = 0; i < 60 * 8; i++) w.step(1 / 60, new Map());
    expect(d.alive, 'no flag → stays down').toBe(false);
  });
});
