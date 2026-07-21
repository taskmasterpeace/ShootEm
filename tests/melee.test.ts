import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import type { PlayerCmd, SimEvent } from '../src/sim/types';
import { MELEE_STAGGER, World } from '../src/sim/world';

// ---------------------------------------------------------------------------
// The melee feel pass: a swing is WINDUP → STRIKE → RECOVER, not a proximity
// tax. These tests pin the contract: the windup delays (and telegraphs) the
// hit, leaving the arc during the windup dodges it entirely, the strike is a
// 90° wedge that catches up to two victims, victims stagger, and the horde's
// sustained kill pace stays where the old instant-hit melee had it.
// ---------------------------------------------------------------------------

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const DT = 1 / 60;

/** Step `seconds`, draining events into `sink` so takeEvents never overflows. */
const run = (w: World, cmds: Map<number, PlayerCmd>, seconds: number, sink?: SimEvent[]) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    w.step(DT, cmds);
    if (sink) sink.push(...w.takeEvents());
  }
};

/** A team-0 human with claws instead of a rifle — a static, steerable melee rig. */
function clawHuman(w: World, x: number, z: number) {
  const a = w.addSoldier('Slasher', 'infantry', 0, 'human');
  a.pos = { x, y: 0, z };
  a.weapons = ['zombie_claw', 'pistol'];
  a.clip = [Infinity, 12];
  a.reserve = [Infinity, 96];
  return a;
}

/** A team-1 human who just stands there — the training dummy. */
function dummy(w: World, x: number, z: number, team: 0 | 1 = 1) {
  const d = w.addSoldier('Dummy', 'infantry', team, 'human');
  d.pos = { x, y: 0, z };
  return d;
}

describe('melee windup', () => {
  it('telegraphs first: no damage on the trigger tick, the claw lands after the windup', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const prey = dummy(w, 2, 0, 0);
    const z = w.addZombie('zombie', { x: 0, y: 0, z: 0 });
    w.takeEvents();

    // trigger tick: the zombie is in reach, so the swing STARTS — nothing lands
    const events: SimEvent[] = [];
    run(w, new Map(), DT, events);
    expect(events.some((e) => e.type === 'melee_windup' && e.soldierId === z.id)).toBe(true);
    expect(z.meleeStrikeAt).toBeGreaterThan(w.time);
    expect(prey.hp).toBe(prey.maxHp);

    // still inside the 0.25s windup — still untouched
    run(w, new Map(), 0.15);
    expect(prey.hp).toBe(prey.maxHp);

    // past the windup — the claw has landed exactly once
    run(w, new Map(), 0.25);
    expect(prey.hp).toBe(prey.maxHp - WEAPONS.zombie_claw.damage);
  });

  it('stepping out of the arc during the windup dodges the whole swing', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const prey = dummy(w, 2, 0, 0);
    const z = w.addZombie('zombie', { x: 0, y: 0, z: 0 });

    // let the swing start (direction locks toward +X, where the prey stands)
    run(w, new Map(), 3 * DT);
    expect(z.meleeStrikeAt).toBeGreaterThan(0);
    expect(Math.abs(z.meleeYaw)).toBeLessThan(0.1);

    // the dodge: hop behind the attacker before the strike lands
    prey.pos = { x: -3, y: 0, z: 0 };
    run(w, new Map(), 0.5);
    expect(z.meleeStrikeAt).toBe(0);        // the swing resolved…
    expect(prey.hp).toBe(prey.maxHp);       // …and caught nothing at all
  });

  it('the wedge catches both victims in front — but never a third', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = clawHuman(w, 0, 0);
    const near1 = dummy(w, 1.8, 0.5);
    const near2 = dummy(w, 1.8, -0.5);
    const third = dummy(w, 2.6, 0);        // in range, in the arc — but third in line
    const behind = dummy(w, -1.8, 0);      // in range, dead outside the 90° arc

    const cmds = new Map([[a.id, cmd({ fire: true, aimYaw: 0 })]]);
    run(w, cmds, 0.5); // one full swing (windup 0.25 + slack), second not yet due
    expect(near1.hp).toBe(near1.maxHp - WEAPONS.zombie_claw.damage);
    expect(near2.hp).toBe(near2.maxHp - WEAPONS.zombie_claw.damage);
    expect(third.hp).toBe(third.maxHp);    // capped at two victims per swing
    expect(behind.hp).toBe(behind.maxHp);  // the arc means FRONT
  });

  it('a melee hit staggers the victim: next shot delayed, shoved off their feet', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = clawHuman(w, 0, 0);
    const victim = dummy(w, 1.8, 0);
    const cmds = new Map([[a.id, cmd({ fire: true, aimYaw: 0 })]]);

    // step until the strike lands, then inspect the flinch on that exact tick
    for (let i = 0; i < 60 && victim.hp === victim.maxHp; i++) w.step(DT, cmds);
    expect(victim.hp).toBeLessThan(victim.maxHp);
    expect(victim.nextFireAt).toBeCloseTo(w.time + MELEE_STAGGER, 5); // trigger finger jarred
    expect(victim.pushX).toBeGreaterThan(0);                          // knocked away from the claw
  });

  it('the attacker lunges into the strike', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = clawHuman(w, 0, 0);
    dummy(w, 1.8, 0);
    const cmds = new Map([[a.id, cmd({ fire: true, aimYaw: 0 })]]);
    for (let i = 0; i < 60 && a.pushX === 0; i++) w.step(DT, cmds);
    expect(a.pushX).toBeGreaterThan(0); // thrown forward, along the swing
  });

  it('a horde still kills a standing soldier at the old pace (windup fits the rof budget)', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const prey = dummy(w, 0, 0, 0);
    prey.team = 0;
    w.addZombie('zombie', { x: 2, y: 0, z: 0 });
    w.addZombie('zombie', { x: -2, y: 0, z: 0 });
    w.addZombie('zombie', { x: 0, y: 0, z: 2 });

    // 100hp ÷ 14/claw = 8 hits; 3 claws at 1.2/s land batches every 0.83s.
    // Old instant melee killed at ~1.7s; the windup only delays the FIRST batch
    // (+0.25s, ~1.95s) because it's carved out of the interval, not added to it.
    let died = -1;
    for (let i = 0; i < 60 * 5; i++) {
      w.step(DT, new Map());
      if (!prey.alive) { died = w.time; break; }
    }
    expect(died).toBeGreaterThan(1.0);  // not faster than the old pace allowed
    expect(died).toBeLessThan(3.0);     // within a whisker of the old ~1.7s kill
  });
});

// ---------------------------------------------------------------------------
// THE MELEE TRIANGLE (OUTBREAK-SPEC §12), slice 1 — THE STRIKE. Every upright
// soldier carries a universal knife on F: no ammo, shambler on you, you still
// have an answer. It reuses the horde's exact windup→arc→stagger swing, so a
// player's STRIKE and a claw read identically to everything downstream.
// ---------------------------------------------------------------------------
describe('the universal knife STRIKE (§12)', () => {
  /** A default team-0 human — rifle on the rig, no axe, so F is the knife. */
  function knifer(w: World, x: number, z: number) {
    const a = w.addSoldier('Blade', 'infantry', 0, 'human');
    a.pos = { x, y: 0, z };
    return a;
  }

  it('drops a shambler standing in the front arc', () => {
    const w = new World({ seed: 21, mode: 'horde' });
    w.outbreakEnabled = true;
    const man = knifer(w, 0, 0);
    const zed = w.addZombie('zombie', { x: 1.6, y: 0, z: 0 }); // dead ahead, in reach
    const hp0 = zed.hp;
    run(w, new Map([[man.id, cmd({ melee: true, aimYaw: 0 })]]), 0.5);
    expect(zed.hp).toBeLessThan(hp0); // the knife bit
  });

  it('whiffs on a target dead behind (the arc means FRONT)', () => {
    const w = new World({ seed: 22, mode: 'tdm' });
    const man = knifer(w, 0, 0);
    const behind = dummy(w, -1.8, 0); // a stationary body directly behind the swing
    const hp0 = behind.hp;
    run(w, new Map([[man.id, cmd({ melee: true, aimYaw: 0 })]]), 0.4); // aim +X, away from it
    expect(behind.hp).toBe(hp0); // nothing in the wedge
  });

  it('shares the fire clock — you cannot knife and shoot in one beat', () => {
    const w = new World({ seed: 23, mode: 'horde' });
    w.outbreakEnabled = true;
    const man = knifer(w, 0, 0);
    w.addZombie('zombie', { x: 1.6, y: 0, z: 0 });
    w.step(DT, new Map([[man.id, cmd({ melee: true, aimYaw: 0 })]]));
    expect(man.nextFireAt).toBeGreaterThan(w.time); // the swing occupies the trigger
  });

  it('an empty-mag soldier can still fight with the blade', () => {
    const w = new World({ seed: 24, mode: 'horde' });
    w.outbreakEnabled = true;
    const man = knifer(w, 0, 0);
    man.clip[man.weaponIdx] = 0;    // dry gun
    man.reserve[man.weaponIdx] = 0; // and no reload to be had
    const zed = w.addZombie('zombie', { x: 1.6, y: 0, z: 0 });
    const hp0 = zed.hp;
    run(w, new Map([[man.id, cmd({ melee: true, aimYaw: 0 })]]), 0.5);
    expect(zed.hp).toBeLessThan(hp0); // the blade doesn't care about the empty mag
  });
});
