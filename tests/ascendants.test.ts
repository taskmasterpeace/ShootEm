// ---------------------------------------------------------------------------
// LIVING SUPER WEAPONS (§21.6 / docs/ASCENDANTS.md) — the engine laws, and
// the proof pair: Firebrand (UF) vs Plaguebearer (Collective). Both are pure
// field plays on shipped systems; this suite is the entry path, end to end.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { LSWS, THREAT, lswAllowed } from '../src/sim/lsw';
import type { AscendantId, PlayerCmd } from '../src/sim/types';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

describe('the LSW entity', () => {
  it('threat buys HP, never immunity — a T2 is big, an ordinary rifle still bites', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const fb = w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })!;
    expect(fb.ascendant).toBe('firebrand');
    expect(fb.maxHp).toBe(THREAT[2].hp);   // 900 — measured against the baseline
    expect(fb.armor).toBe(0);              // threat is HP, not a plate wall
    const before = fb.hp;
    w.damageSoldier(fb, 50, -1, 'ar606');
    expect(fb.hp, 'ordinary rounds must always bite').toBe(before - 50);
  });

  it('at most ONE LSW per faction — the slot refuses a second', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    expect(w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })).not.toBeNull();
    expect(w.addLsw('firebrand', 0, { x: 5, y: 0, z: 0 }), 'a second UF LSW slipped through').toBeNull();
    // the enemy faction keeps its own slot
    expect(w.addLsw('plaguebearer', 1, { x: 10, y: 0, z: 0 })).not.toBeNull();
  });

  it('no LSW walks in the yard or the range — the modes forbid it', () => {
    expect(lswAllowed('paintball')).toBe(false);
    expect(lswAllowed('range')).toBe(false);
    expect(lswAllowed('ctf')).toBe(true);
    const yard = new World({ seed: 1, mode: 'paintball' });
    expect(yard.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 }), 'an LSW spawned in the yard').toBeNull();
  });

  it('every stabled LSW has a sane, no-purple def', () => {
    for (const id of Object.keys(LSWS) as AscendantId[]) {
      const d = LSWS[id];
      expect(d.threat).toBeGreaterThanOrEqual(1);
      expect(d.threat).toBeLessThanOrEqual(4);
      expect(d.scale).toBeGreaterThan(1);              // bigger than a trooper
      const r = (d.color >> 16) & 0xff, g = (d.color >> 8) & 0xff, b = d.color & 0xff;
      expect(b > 120 && g < b - 40 && r > b - 60, `${id} reads purple`).toBe(false);
    }
  });
});

describe('the officer drop', () => {
  it('the call is telegraphed — announced now, landing after the threat countdown', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    const ok = w.requestLsw('firebrand', 0);
    expect(ok).toBe(true);
    // nothing on the field yet — it's inbound
    expect([...w.soldiers.values()].some((s) => s.ascendant), 'it landed with no dread').toBe(false);
    const events = w.takeEvents();
    expect(events.some((e) => e.type === 'pod_incoming'), 'no warning went out').toBe(true);
    // run past the T2 telegraph (20s) and it arrives
    for (let i = 0; i < 60 * 21; i++) w.step(1 / 60, new Map());
    expect([...w.soldiers.values()].some((s) => s.ascendant === 'firebrand'), 'it never landed').toBe(true);
  });

  it('one inbound call holds the slot — no double-drop', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    expect(w.requestLsw('firebrand', 0)).toBe(true);
    expect(w.requestLsw('firebrand', 0), 'a second call while inbound slipped through').toBe(false);
  });
});

describe('Firebrand — the board', () => {
  it('paints a burning floor as he advances', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const fb = w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })!;
    const before = [...w.gadgets.values()].filter((g) => g.type === 'fire_field').length;
    // walk him a few strides
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map([[fb.id, cmd({ moveZ: -1 })]]));
    const after = [...w.gadgets.values()].filter((g) => g.type === 'fire_field' && g.ownerId === fb.id).length;
    expect(after, 'no floor was painted').toBeGreaterThan(before);
  });
});

describe('Plaguebearer — the cloud', () => {
  it('lays contamination as he moves', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const pb = w.addLsw('plaguebearer', 1, { x: 0, y: 0, z: 0 })!;
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map([[pb.id, cmd({ moveZ: -1 })]]));
    const clouds = [...w.gadgets.values()].filter((g) => g.type === 'smoke_field' && g.ownerId === pb.id).length;
    expect(clouds, 'no gas was laid').toBeGreaterThan(0);
  });
});
