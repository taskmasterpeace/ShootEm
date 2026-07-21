// ---------------------------------------------------------------------------
// REAR TAKEDOWN (OUTBREAK-SPEC §14.2). Once you have rear control (a landed
// GRAPPLE pin), a SECOND grapple commits the finisher — a heavy, armour-piercing
// blow the pinned body can't block. Gods are too big to take down this way.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

function staged() {
  const w = new World({ seed: 1, mode: 'tdm', matchMinutes: 10 });
  const a = w.addSoldier('Att', 'infantry', 0, 'human');
  a.pos = { x: 0, y: 0, z: 0 }; a.yaw = 0; a.protectedUntil = 0; // facing +x
  const v = w.addSoldier('Vic', 'infantry', 1, 'human');
  v.pos = { x: 1.4, y: 0, z: 0 }; v.protectedUntil = 0;    // right in front, in reach; no spawn shield
  // FACING the attacker — a FRONT pin, which keeps the classic recover-gated
  // finisher. (A REAR pin now runs the §15 Control Struggle first — that law
  // lives in tests/ctrlstruggle.test.ts.)
  v.yaw = Math.PI;
  w.step(1 / 60, new Map());                              // warm the spatial index
  return { w, a, v };
}

describe('§14.2 rear takedown', () => {
  it('grab, then a second grapple executes a heavy AP finisher', () => {
    const { w, a, v } = staged();
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));  // land the pin
    expect(v.grabbedBy).toBe(a.id);
    expect(a.grabbingId).toBe(v.id);
    // recover past GRAB_RECOVER while the victim stays idle (the pin holds — the
    // recover delay IS the struggle window)
    for (let i = 0; i < 34; i++) w.step(1 / 60, new Map());
    expect(v.alive).toBe(true);
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));  // the finisher
    expect(v.alive).toBe(false);           // an execution — overkill drops the body for good
    expect(v.downed).toBe(false);          // no crawl: a takedown is final
    expect(a.grabbingId).toBeUndefined();  // the hold is spent
  });

  it('a god cannot be taken down — the finisher is refused', () => {
    const { w, a, v } = staged();
    (v as unknown as { ascendant: string }).ascendant = 'tremor'; // make the victim a god
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    const hp0 = v.hp;
    for (let i = 0; i < 34; i++) w.step(1 / 60, new Map());
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));  // no takedown lands
    expect(v.hp).toBe(hp0);
    expect(v.alive).toBe(true);
  });
});
