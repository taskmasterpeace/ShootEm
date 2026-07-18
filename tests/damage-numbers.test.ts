// ---------------------------------------------------------------------------
// THE LAW: floating damage numbers show ONLY for damage the local player dealt.
// A 26-soldier field trading fire would blizzard the screen if every exchange
// popped a number — so bot-vs-bot, ally-vs-enemy, and even the hits landing on
// YOU stay silent (your health ring + the red vignette already tell you that).
// Two halves: the sim must attribute the attacker on the event, and the client
// filter must gate on it.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { shouldShowDamage } from '../src/client/damagetext';
import type { SimEvent } from '../src/sim/types';

const world = () => new World({ seed: 11, mode: 'tdm' });
const dmg = (over: Partial<SimEvent>): SimEvent =>
  ({ type: 'damage', amount: 23, ownerId: 7, soldierId: 9, pos: { x: 0, y: 0, z: 0 }, ...over }) as SimEvent;

describe('damage numbers — only YOURS show (the law)', () => {
  it('the sim attributes the attacker on every damage event', () => {
    const w = world();
    const me = w.addSoldier('Me', 'infantry', 0, 'human');
    const them = w.addSoldier('Them', 'infantry', 1, 'bot');
    w.takeEvents(); // drop spawn noise
    w.damageSoldier(them, 23, me.id, 'rifle');
    const events = w.takeEvents().filter((e) => e.type === 'damage');
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.ownerId === me.id)).toBe(true);          // attacker attributed
    expect(events.some((e) => e.amount === 23 && !e.armorHit)).toBe(true); // red flesh number
  });

  it('a number shows for damage YOU dealt', () => {
    expect(shouldShowDamage(dmg({ ownerId: 7 }), 7)).toBe(true);
  });

  it('your armor hits show too (blue), still gated to you', () => {
    expect(shouldShowDamage(dmg({ armorHit: true, ownerId: 7 }), 7)).toBe(true);
    expect(shouldShowDamage(dmg({ armorHit: true, ownerId: 3 }), 7)).toBe(false);
  });

  it('SILENT when someone else dealt it — the anti-clutter rule', () => {
    expect(shouldShowDamage(dmg({ ownerId: 3 }), 7)).toBe(false); // bot vs bot, ally vs enemy
  });

  it('SILENT for damage dealt TO you (the ring + vignette tell that, not numbers)', () => {
    expect(shouldShowDamage(dmg({ ownerId: 3, soldierId: 7 }), 7)).toBe(false);
  });

  it('SILENT for unattributed damage (fall, fire, environment: ownerId -1)', () => {
    expect(shouldShowDamage(dmg({ ownerId: -1 }), 7)).toBe(false);
  });

  it('ignores non-damage events', () => {
    expect(shouldShowDamage({ type: 'hit', ownerId: 7 } as SimEvent, 7)).toBe(false);
  });
});
