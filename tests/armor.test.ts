// ---------------------------------------------------------------------------
// The armor pool — issued plate absorbs damage before flesh, never heals
// back, and is reissued on respawn. Total effective pool matches the old
// maxHp-bonus numbers, so balance is unchanged; only the presentation splits.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/sim/data';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import { World } from '../src/sim/world';

const world = () => new World({ seed: 11, mode: 'tdm' });

describe('the armor pool', () => {
  it('plate takes the hit first; flesh only bleeds once it breaks', () => {
    const w = world();
    const s = w.addSoldier('V', 'infantry', 0, 'human', { equipment: ['armor_vest'] });
    expect(s.armor).toBe(25);
    w.damageSoldier(s, 10, -1, 'rifle');
    expect(s.armor).toBe(15);
    expect(s.hp).toBe(CLASSES.infantry.hp); // the plate held
    w.damageSoldier(s, 40, -1, 'rifle'); // 15 breaks the plate, 25 punches through
    expect(s.armor).toBe(0);
    expect(s.hp).toBe(CLASSES.infantry.hp - 25);
  });

  it('medics fix flesh, not ceramic — heals cap at maxHp and armor stays broken', () => {
    const w = world();
    const s = w.addSoldier('V', 'infantry', 0, 'human', { equipment: ['armor_vest'] });
    w.damageSoldier(s, 60, -1, 'rifle'); // armor gone, hp down 35
    s.hp = Math.min(s.maxHp, s.hp + 45); // what every heal path does
    expect(s.hp).toBe(CLASSES.infantry.hp);
    expect(s.armor).toBe(0); // still broken until respawn
  });

  it('respawn reissues the plate', () => {
    const w = world();
    const s = w.addSoldier('V', 'infantry', 0, 'human', { equipment: ['power_armor'] });
    w.damageSoldier(s, 999, -1, 'rifle');
    expect(s.alive).toBe(false);
    w.spawn(s);
    expect(s.armor).toBe(60);
    expect(s.hp).toBe(CLASSES.infantry.hp);
  });

  it('the pool rides the wire', () => {
    const w = world();
    const s = w.addSoldier('V', 'infantry', 0, 'human', { equipment: ['armor_vest'] });
    w.damageSoldier(s, 10, -1, 'rifle');
    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));
    const w2 = world();
    w2.puppet = true;
    applySnapshot(w2, snap);
    expect(w2.soldiers.get(s.id)!.armor).toBe(15);
    expect(w2.soldiers.get(s.id)!.maxArmor).toBe(25);
  });
});
