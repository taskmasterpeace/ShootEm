// ---------------------------------------------------------------------------
// M3 THE REPLACEMENT (Robert: "I don't think we need to add weapons, I think
// we need to REPLACE weapons… we can have concussion grenades, with no fire,
// just concussed, and with maximum knockback").
//
// The jump trooper's GL-40 frag launcher is gone; the CL-40 Concussor holds
// the slot. Same handling, opposite philosophy: it barely scratches paint and
// it throws people — hard enough to cross the M1 ragdoll threshold.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { CLASSES, WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

describe('M3 — the concussion replacement', () => {
  it('REPLACED, not added: the jump trooper carries the CL-40, and nobody carries the GL-40 frag', () => {
    expect(CLASSES.jump.secondary).toBe('cl40');
    const carriers = Object.values(CLASSES).filter((c) => c.primary === 'gl' || c.secondary === 'gl');
    expect(carriers, 'the frag launcher left the roster — this was a swap').toHaveLength(0);
  });

  it('no fire, just concussed: it barely damages and it MAXES knockback', () => {
    const cl = WEAPONS.cl40;
    expect(cl.payload, 'pure concussion — no frag, no fire').toBe('concussion');
    expect(cl.damage, 'the round itself does nothing on contact').toBe(0);
    expect(cl.splashDamage, 'a slap, not a kill').toBeLessThanOrEqual(15);
    // the strongest shove of any shoulder weapon in the game
    const shoulder = ['gl', 'mml', 'impulse', 'conc_nade'] as const;
    for (const id of shoulder) {
      expect(cl.knockback, `CL-40 out-shoves ${id}`).toBeGreaterThan(WEAPONS[id].knockback);
    }
  });

  it('a CL-40 round RAGDOLLS what it hits — the whole point of the swap', () => {
    const w = quiet();
    const s = w.addSoldier('T', 'infantry', 1, 'human');
    s.pos = { x: 2, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.cl40, -1, 0);
    expect(s.ragdollUntil, 'flipped').toBeDefined();
    expect(s.hp, 'and barely scratched').toBeGreaterThan(80);
  });

  it('the CARRIER owns the blast: a CL-40 shoves harder than the hand C-9', () => {
    const mk = (weapon: 'cl40' | 'conc_nade') => {
      const w = quiet();
      const s = w.addSoldier('T', 'infantry', 1, 'human');
      s.pos = { x: 2, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
      w.explode({ x: 0, y: 0, z: 0 }, WEAPONS[weapon], -1, 0);
      return s.pushX;
    };
    // hardcoding conc_nade in the payload branch capped every concussion
    // weapon at the hand grenade's numbers — this is that bug, pinned
    expect(mk('cl40')).toBeGreaterThan(mk('conc_nade'));
  });
});
