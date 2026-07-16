// ---------------------------------------------------------------------------
// Killcam duel framing — every death answers "where did that come from?"
// The sim stamps lastKillerId on the victim; the client frames victim+killer.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import { World } from '../src/sim/world';

const world = () => new World({ seed: 7, mode: 'tdm' });

describe('killcam duel framing', () => {
  it('a kill stamps the killer on the victim', () => {
    const w = world();
    const shooter = w.addSoldier('Shooter', 'infantry', 0, 'human');
    const victim = w.addSoldier('Victim', 'infantry', 1, 'human');
    expect(victim.lastKillerId).toBe(-1);
    w.damageSoldier(victim, 999, shooter.id, 'rifle');
    expect(victim.alive).toBe(false);
    expect(victim.lastKillerId).toBe(shooter.id);
  });

  it('self- and environment kills stamp nobody — the camera stays on the corpse', () => {
    const w = world();
    const s = w.addSoldier('Oops', 'infantry', 0, 'human');
    w.damageSoldier(s, 999, s.id, 'gl'); // cooked his own frag
    expect(s.lastKillerId).toBe(-1);

    const e = w.addSoldier('Unlucky', 'infantry', 0, 'human');
    w.damageSoldier(e, 999, -1, 'gl'); // no attacker at all
    expect(e.lastKillerId).toBe(-1);
  });

  it('the stamp rides the wire — a puppet world sees who did it', () => {
    const w = world();
    const shooter = w.addSoldier('Shooter', 'infantry', 0, 'human');
    const victim = w.addSoldier('Victim', 'infantry', 1, 'human');
    w.damageSoldier(victim, 999, shooter.id, 'rifle');

    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));
    const w2 = world();
    w2.puppet = true;
    applySnapshot(w2, snap);
    expect(w2.soldiers.get(victim.id)!.lastKillerId).toBe(shooter.id);
  });
});
