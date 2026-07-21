// ---------------------------------------------------------------------------
// W3.6 — CLASS CHANGE BY REQUEST: the officer rules on it. A class is a
// POSTING, not a lobby pick — the ruling weighs the line's live composition.
// Infantry is always signed; specialists cap by headcount; the reason comes
// back in the officer's voice. Deterministic: same roster, same ruling.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { ruleOnClassRequest } from '../src/sim/officer';
import { World } from '../src/sim/world';

describe('W3.6 — the officer rules on class requests', () => {
  it('infantry is ALWAYS approved — the line always needs rifles', () => {
    const r = ruleOnClassRequest({ infantry: 9, medic: 1 }, 'infantry', 10);
    expect(r.approved).toBe(true);
    expect(r.reason).toContain('rifles');
  });

  it('a five-man line gets ONE medic — the second request is denied, with a reason', () => {
    expect(ruleOnClassRequest({}, 'medic', 5).approved).toBe(true);
    const denied = ruleOnClassRequest({ medic: 1 }, 'medic', 5);
    expect(denied.approved).toBe(false);
    expect(denied.reason).toContain('DENIED');
    expect(denied.reason).toContain('medics enough');
  });

  it('a bigger line earns more medics', () => {
    expect(ruleOnClassRequest({ medic: 1 }, 'medic', 12).approved).toBe(true);
    expect(ruleOnClassRequest({ medic: 2 }, 'medic', 12).approved).toBe(false);
  });

  it('the ruling is wired into redeployAs — denial keeps your posting', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const me = w.addSoldier('ME', 'infantry', 0, 'human');
    me.alive = false; // the printer queue
    // a small line that already has its medic
    const doc = w.addSoldier('DOC', 'medic', 0, 'bot'); doc.alive = true;
    for (let i = 0; i < 3; i++) { const b = w.addSoldier(`B${i}`, 'infantry', 0, 'bot'); b.alive = true; }
    const denied = w.redeployAs(me, 'medic');
    expect(denied, 'the line has medics enough').toBe(false);
    expect(me.classId, 'the posting held').toBe('infantry');
    let heard = false;
    for (const e of w.takeEvents()) if (e.type === 'announce' && String(e.text).includes('DENIED')) heard = true;
    expect(heard, 'the officer said why').toBe(true);
    // the always-open door
    expect(w.redeployAs(me, 'heavy'), 'iron is available').toBe(true);
    expect(me.classId).toBe('heavy');
    // re-clicking your CURRENT posting is never a request
    expect(w.redeployAs(me, 'heavy')).toBe(true);
  });
});
