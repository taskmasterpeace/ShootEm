// ---------------------------------------------------------------------------
// §15 CONTROL STRUGGLE — the rear-grab contest (Robert: "more consequential
// when you grab them from behind"). A rear pin on a PERSON opens a
// best-of-three needle game instead of a mash: the Break Needle is a pure
// function of sim time, the attacker steers the Control Zone, the defender
// confirms Z inside it. Defender takes 2 → fights free with the rebound.
// Attacker takes 2 → the hold LOCKS, and only a LOCKED rear pin accepts the
// §14.2 finisher. Front pins keep the whole old law (see takedown.test.ts).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { World, ctrlNeedlePos } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

/** attacker at the victim's BACK: both face +x, attacker approaches from -x */
function rearStaged() {
  const w = new World({ seed: 1, mode: 'tdm', matchMinutes: 10 });
  const a = w.addSoldier('Att', 'infantry', 0, 'human');
  a.pos = { x: 0, y: 0, z: 0 }; a.yaw = 0; a.protectedUntil = 0;
  const v = w.addSoldier('Vic', 'infantry', 1, 'human');
  v.pos = { x: 1.4, y: 0, z: 0 }; v.yaw = 0; v.protectedUntil = 0; // facing AWAY — rear grab
  w.step(1 / 60, new Map());
  return { w, a, v };
}

describe('§15 Control Struggle — the rear-grab contest', () => {
  it('a rear pin on a person opens the contest; the needle is a pure clock function', () => {
    const { w, a, v } = rearStaged();
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    expect(v.grabbedBy).toBe(a.id);
    expect(v.ctrlStruggle, 'the contest opened').toBeTruthy();
    expect(v.ctrlStruggle!.round).toBe(1);
    // determinism: the same (anchor, time, round) always yields the same needle
    const cs = v.ctrlStruggle!;
    const n1 = ctrlNeedlePos(cs.anchor, cs.anchor + 0.7, 1);
    const n2 = ctrlNeedlePos(cs.anchor, cs.anchor + 0.7, 1);
    expect(n1).toBe(n2);
    expect(n1).toBeGreaterThanOrEqual(0);
    expect(n1).toBeLessThanOrEqual(1);
  });

  it('mash does NOT escape a rear contest, and the early finisher is refused', () => {
    const { w, a, v } = rearStaged();
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    // the victim hammers movement — the old mash — for a full second
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[v.id, cmd({ moveX: 1, jump: true })]]));
    expect(v.grabbedBy, 'the needle, not the keyboard shake, is the only door').toBe(a.id);
    // the attacker taps the finisher before control is taken — refused
    for (let i = 0; i < 34; i++) w.step(1 / 60, new Map());
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    expect(v.alive, 'no execution without the LOCK').toBe(true);
  });

  it('a defender confirm INSIDE the zone twice fights free with the rebound', () => {
    const { w, a, v } = rearStaged();
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    const cs = v.ctrlStruggle!;
    // steer time so the needle sits dead-center of the untouched zone (0.5):
    // walk frames until the pure function says we're inside, then confirm.
    const confirmInside = () => {
      for (let i = 0; i < 400; i++) {
        const n = ctrlNeedlePos(cs.anchor, w.time + 1 / 60, cs.round);
        if (Math.abs(n - cs.zoneC) <= cs.zoneW / 2 - 0.02) {
          w.step(1 / 60, new Map([[v.id, cmd({ grapple: true })]]));
          return;
        }
        w.step(1 / 60, new Map());
      }
      throw new Error('needle never entered the zone');
    };
    confirmInside();
    expect(cs.defWins).toBe(1);
    confirmInside();
    expect(v.grabbedBy, 'two clean confirms fight free').toBeUndefined();
    expect(v.grabImmuneUntil, 'the escape earns the no-re-clinch window').toBeGreaterThan(w.time);
    expect(v.ctrlStruggle, 'the contest is cleared with the hold').toBeUndefined();
  });

  it('two round timeouts LOCK the hold — and only then does the finisher land', () => {
    const { w, a, v } = rearStaged();
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    // the victim freezes (no confirm): both rounds die on the clock
    for (let i = 0; i < 60 * 6 + 30; i++) {
      w.step(1 / 60, new Map());
      if (v.ctrlStruggle?.locked) break;
    }
    expect(v.ctrlStruggle?.locked, 'best-of-three to the attacker').toBe(true);
    expect(v.grabbedBy, 'the locked hold persists').toBe(a.id);
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]])); // NOW the finisher
    expect(v.alive, 'a locked rear pin is an execution').toBe(false);
    expect(v.downed).toBe(false);
  });

  it('a FRONT pin never opens a contest (the old mash law holds there)', () => {
    const { w, a, v } = rearStaged();
    v.yaw = Math.PI; // now FACING the attacker
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    expect(v.grabbedBy).toBe(a.id);
    expect(v.ctrlStruggle, 'front grabs are the classic clinch').toBeUndefined();
    // and the mash still works exactly as shipped
    for (let i = 0; i < 80; i++) w.step(1 / 60, new Map([[v.id, cmd({ moveX: 1 })]]));
    expect(v.grabbedBy, 'mashed out the front hold').toBeUndefined();
  });
});
