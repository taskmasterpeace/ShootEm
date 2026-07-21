// ---------------------------------------------------------------------------
// §14.2 THE OUTCOME MENU — a LOCKED rear hold offers more than the kill.
// Z stays the takedown (ctrlstruggle.test.ts); F DISARMS — the held gun is
// ripped to the dirt as real loot and the body shoved clear; E CHOKES — a
// silent capture that puts the body DOWN (bleed clock, medic-liftable),
// never a kill. Pain interrupts the squeeze. All of it gated on the LOCK —
// an unresolved contest offers nothing.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

/** a rear pin, contest already LOCKED (unit staging — the road there is
 *  pinned by ctrlstruggle.test.ts; here we test what the lock UNLOCKS). */
function lockedStaged() {
  const w = new World({ seed: 1, mode: 'tdm', matchMinutes: 10 });
  const a = w.addSoldier('Att', 'infantry', 0, 'human');
  a.pos = { x: 0, y: 0, z: 0 }; a.yaw = 0; a.protectedUntil = 0;
  const v = w.addSoldier('Vic', 'infantry', 1, 'human');
  v.pos = { x: 1.4, y: 0, z: 0 }; v.yaw = 0; v.protectedUntil = 0; // facing away — rear
  w.step(1 / 60, new Map());
  w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
  expect(v.ctrlStruggle).toBeTruthy();
  v.ctrlStruggle!.locked = true;
  v.grabbedUntil = w.time + 1.6;
  return { w, a, v };
}

describe('§14.2 the outcome menu (locked rear hold)', () => {
  it('F DISARMS: the held gun hits the dirt as loot, the body is shoved clear', () => {
    const { w, a, v } = lockedStaged();
    const guns0 = v.weapons.length;
    const held = v.weapons[v.weaponIdx];
    for (let i = 0; i < 32; i++) w.step(1 / 60, new Map()); // past the grab recover
    w.step(1 / 60, new Map([[a.id, cmd({ melee: true })]]));
    expect(v.weapons.length, 'one gun fewer').toBe(guns0 - 1);
    expect(v.weapons).not.toContain(held);
    expect(v.alive, 'a disarm is a mercy, not a kill').toBe(true);
    expect(v.grabbedBy, 'the shove releases the hold').toBeUndefined();
    expect(v.grabImmuneUntil, 'no instant re-clinch').toBeGreaterThan(w.time);
    expect(v.pushX, 'shoved away from the attacker (+x)').toBeGreaterThan(0);
    // the gun is real loot on the deck (ar606 is loot-excluded; class primaries aren't guaranteed
    // either way — assert only when the ripped gun is a dropping kind)
    const dropped = [...w.pickups.values()].some((p) => p.type === 'weapon' && p.weaponId === held);
    if (held !== 'ar606') expect(dropped, `the ripped ${held} lies where he stood`).toBe(true);
  });

  it('E CHOKES: the silent capture puts him DOWN, never dead — and pain breaks it', () => {
    const { w, a, v } = lockedStaged();
    for (let i = 0; i < 32; i++) w.step(1 / 60, new Map());
    w.step(1 / 60, new Map([[a.id, cmd({ use: true })]]));
    expect(a.chokingId, 'the squeeze began').toBe(v.id);
    // half the channel, then the attacker takes a round — the squeeze breaks
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map());
    expect(v.chokeProgress ?? 0).toBeGreaterThan(0.2);
    w.damageSoldier(a, 10, -1, 'ar606');
    expect(a.chokingId, 'pain broke the squeeze').toBeUndefined();
    expect(v.chokeProgress, 'progress died with it').toBeUndefined();
    expect(v.downed, 'no capture happened').toBe(false);
    // start again, undisturbed — the full channel downs him
    w.step(1 / 60, new Map([[a.id, cmd({ use: true })]]));
    for (let i = 0; i < 60 * 3 + 10 && !v.downed; i++) w.step(1 / 60, new Map());
    expect(v.downed, 'choked out — DOWN with the bleed clock').toBe(true);
    expect(v.alive, 'a capture, not a kill').toBe(true);
    expect(v.grabbedBy, 'the hold ends with the capture').toBeUndefined();
    expect(a.grabbingId).toBeUndefined();
  });

  it('SPACE THROWS: the body is heaved along the facing, ragdolling — a positional verb', () => {
    const { w, a, v } = lockedStaged();
    const guns0 = v.weapons.length;
    for (let i = 0; i < 32; i++) w.step(1 / 60, new Map());
    w.step(1 / 60, new Map([[a.id, cmd({ jump: true })]]));
    expect(v.pushX, 'hurled along the attacker facing (+x)').toBeGreaterThan(8);
    expect(v.vel.y, 'ballistic — the heave has an arc').toBeGreaterThan(2);
    expect(v.ragdollUntil ?? 0, 'luggage until the get-up').toBeGreaterThan(w.time);
    expect(v.alive, 'no damage — placement IS the payoff').toBe(true);
    expect(v.weapons.length, 'nothing stripped').toBe(guns0);
    expect(v.grabbedBy, 'the hold ends with the heave').toBeUndefined();
    expect(v.grabImmuneUntil).toBeGreaterThan(w.time);
    expect(a.grabbingId).toBeUndefined();
  });

  it('HUMAN SHIELD: a locked hold with no verb welds the captive to your front and eats frontal fire', () => {
    const { w, a, v } = lockedStaged();
    for (let i = 0; i < 6; i++) w.step(1 / 60, new Map([[a.id, cmd()]])); // hold, press nothing
    expect(v.humanShield, 'no verb → the captive is your cover').toBe(true);
    // welded to the holder's front (a faces +x, so v sits ~1u east of a)
    expect(v.pos.x - a.pos.x).toBeGreaterThan(0.7);
    // an attacker IN FRONT shoots the holder — the shield takes it
    const foe = w.addSoldier('Foe', 'infantry', 1, 'human');
    foe.pos = { x: 10, y: 0, z: 0 }; foe.protectedUntil = 0; // downrange, in front of a
    const aHp0 = a.hp, vHp0 = v.hp;
    w.step(1 / 60, new Map([[a.id, cmd()]]));
    w.damageSoldier(a, 40, foe.id, 'ar606');
    expect(a.hp, 'the holder is covered').toBe(aHp0);
    expect(v.hp, 'the captive ate the round').toBeLessThan(vHp0);
  });

  it('HUMAN SHIELD: a shot from BEHIND slips past the shield onto the holder', () => {
    const { w, a, v } = lockedStaged();
    for (let i = 0; i < 6; i++) w.step(1 / 60, new Map([[a.id, cmd()]]));
    expect(v.humanShield).toBe(true);
    const backFoe = w.addSoldier('Back', 'infantry', 1, 'human');
    backFoe.pos = { x: -10, y: 0, z: 0 }; backFoe.protectedUntil = 0; // behind a (who faces +x)
    const aHp0 = a.hp;
    w.damageSoldier(a, 40, backFoe.id, 'ar606');
    expect(a.hp, 'no cover from the rear — the holder bleeds').toBeLessThan(aHp0);
  });

  it('HUMAN SHIELD ends when you pick a verb — throwing the shield clears the flag', () => {
    const { w, a, v } = lockedStaged();
    for (let i = 0; i < 6; i++) w.step(1 / 60, new Map([[a.id, cmd()]]));
    expect(v.humanShield).toBe(true);
    for (let i = 0; i < 32; i++) w.step(1 / 60, new Map());
    w.step(1 / 60, new Map([[a.id, cmd({ jump: true })]])); // THROW
    expect(v.humanShield, 'the heave clears the shield state').toBeFalsy();
    expect(v.grabbedBy).toBeUndefined();
  });

  it('a FRONT clinch offers no rear-control menu: F swings no rip, E opens no squeeze', () => {
    const w = new World({ seed: 1, mode: 'tdm', matchMinutes: 10 });
    const a = w.addSoldier('Att', 'infantry', 0, 'human');
    a.pos = { x: 0, y: 0, z: 0 }; a.yaw = 0; a.protectedUntil = 0;
    const v = w.addSoldier('Vic', 'infantry', 1, 'human');
    v.pos = { x: 1.4, y: 0, z: 0 }; v.yaw = Math.PI; v.protectedUntil = 0; // FACING the attacker → front clinch
    w.step(1 / 60, new Map());
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    expect(v.grabbedBy).toBe(a.id);
    expect(v.ctrlStruggle, 'a front clinch has no rear control at all').toBeUndefined();
    const guns0 = v.weapons.length;
    for (let i = 0; i < 32; i++) w.step(1 / 60, new Map());
    w.step(1 / 60, new Map([[a.id, cmd({ melee: true, use: true })]]));
    expect(v.weapons.length, 'no rip without rear control').toBe(guns0);
    expect(a.chokingId, 'no squeeze without rear control').toBeUndefined();
  });
});
