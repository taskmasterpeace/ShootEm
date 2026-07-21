// ---------------------------------------------------------------------------
// W2.5 THE KILL CONFIRM — reward a great kill, not just the death. Addressed
// to the KILLER alone (his HUD, his flourish — never a screen takeover while
// he's alive and fighting): the victim's name, the range, and the spice (a
// NEW LONGEST past 20u rings louder). Humans only — a bot needs no applause.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../src/sim/types';
import { World } from '../src/sim/world';

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const confirms = (evs: SimEvent[]) => evs.filter((e) => e.type === 'kill_confirm');

describe('W2.5 — the kill confirm', () => {
  it('a human kill emits the confirm — name, range, addressed to the killer', () => {
    const w = quiet();
    const k = w.addSoldier('ACE', 'infantry', 0, 'human'); k.alive = true;
    const v = w.addSoldier('MARK', 'infantry', 1, 'bot');
    v.alive = true; v.protectedUntil = 0;
    k.pos = { x: 0, y: 0, z: 0 }; v.pos = { x: 30, y: 0, z: 0 };
    w.damageSoldier(v, 999, k.id, 'rifle');
    const c = confirms(w.takeEvents());
    expect(c.length).toBe(1);
    expect(c[0].soldierId).toBe(k.id);
    expect(c[0].text).toBe('MARK');
    expect(c[0].amount).toBe(30);
    expect(c[0].big, 'first kill at 30u IS the new longest').toBe(true);
  });

  it('a shorter follow-up kill carries no NEW LONGEST spice', () => {
    const w = quiet();
    const k = w.addSoldier('ACE', 'infantry', 0, 'human'); k.alive = true;
    k.longestKill = 60; // the trophy is already long
    const v = w.addSoldier('MARK', 'infantry', 1, 'bot');
    v.alive = true; v.protectedUntil = 0;
    k.pos = { x: 0, y: 0, z: 0 }; v.pos = { x: 25, y: 0, z: 0 };
    w.damageSoldier(v, 999, k.id, 'rifle');
    const c = confirms(w.takeEvents());
    expect(c.length).toBe(1);
    expect(c[0].big).toBe(false);
  });

  it('bots get no applause, and zombie kills stay quiet', () => {
    const w = quiet();
    const bot = w.addSoldier('B', 'infantry', 0, 'bot'); bot.alive = true;
    const v1 = w.addSoldier('V1', 'infantry', 1, 'bot'); v1.alive = true; v1.protectedUntil = 0;
    w.damageSoldier(v1, 999, bot.id, 'rifle');
    expect(confirms(w.takeEvents()).length, 'bot killer: silence').toBe(0);
    const hz = new World({ seed: 42, mode: 'horde' });
    hz.outbreakEnabled = true;
    const h = hz.addSoldier('H', 'infantry', 0, 'human'); h.alive = true;
    const z = hz.addZombie('zombie', { x: 5, y: 0, z: 0 });
    z.protectedUntil = 0;
    hz.damageSoldier(z, 999, h.id, 'rifle');
    expect(confirms(hz.takeEvents()).length, 'a shambler is not a trophy').toBe(0);
  });
});
