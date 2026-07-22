// ---------------------------------------------------------------------------
// §4.3 Down, not out — death gets a middle state. Lethal damage puts humans
// and bots on the ground with a bleed pool and a 20s clock; teammates drag
// them behind cover or channel a revive, medics lift them with one beam
// touch, finishers and the clock end it through the one true death path.
// Zombies and the scientist still die the old way.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const run = (w: World, cmds: Map<number, PlayerCmd>, seconds: number) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) w.step(1 / 60, cmds);
};

const world = () => new World({ seed: 42, mode: 'tdm' });

describe('down, not out', () => {
  it('lethal damage downs a human instead of killing him', () => {
    const w = world();
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606'); // lethal, not obliterating — overkill skips the crawl
    expect(a.alive).toBe(true);     // still counts alive for mode purposes
    expect(a.downed).toBe(true);
    expect(a.hp).toBe(25);          // the bleed pool, regardless of overkill
    expect(a.deaths).toBe(0);       // no double-death scoring
    expect(b.kills).toBe(0);        // the kill isn't banked until it's final
    const ev = w.takeEvents();
    expect(ev.some((e) => e.type === 'downed')).toBe(true);
    expect(ev.some((e) => e.type === 'death')).toBe(false);
  });

  it('bleeds out through the real death path when the clock runs dry', () => {
    const w = world();
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    b.pos = { x: 30, y: 0, z: 30 };
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606');
    expect(a.downed).toBe(true);
    run(w, new Map(), 19);          // still holding on...
    expect(a.alive).toBe(true);
    run(w, new Map(), 1.2);         // ...and the 20s clock runs out
    expect(a.alive).toBe(false);
    expect(a.downed).toBe(false);
    expect(a.deaths).toBe(1);
    expect(b.kills).toBe(1);        // whoever downed him gets the credit
    expect(w.takeEvents().some((e) => e.type === 'death')).toBe(true);
  });

  it('finisher damage chews the bleed pool and kills faster than the clock', () => {
    const w = world();
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606'); // down: 25 in the pool
    w.damageSoldier(a, 30, b.id, 'ar606');  // finisher through the pool
    expect(a.alive).toBe(false);
    expect(a.downed).toBe(false);
    expect(a.deaths).toBe(1);               // counted once, not twice
    expect(b.kills).toBe(1);
  });

  it("a medic's beam lifts a downed ally upright at 40% hp", () => {
    const w = world();
    const m = w.addSoldier('Doc', 'medic', 0, 'human');
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    m.pos = { x: 0, y: 0, z: 0 };
    a.pos = { x: 4, y: 0, z: 0 };
    b.pos = { x: 40, y: 0, z: 40 };
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606'); // lethal, not obliterating — overkill skips the crawl
    expect(a.downed).toBe(true);
    // medi-beam is slot 1: one touch on the body is a revive, not a heal tick.
    // Step only until he stands — the beam keeps healing an upright ally after.
    const cmds = new Map([[m.id, cmd({ fire: true, aimYaw: 0, weaponSlot: 1 })]]);
    for (let i = 0; i < 120 && a.downed; i++) w.step(1 / 60, cmds);
    expect(a.downed).toBe(false);
    expect(a.alive).toBe(true);
    expect(a.hp).toBe(Math.round(a.maxHp * 0.4)); // grateful, not fresh
    expect(w.takeEvents().some((e) => e.type === 'revived')).toBe(true);
  });

  it('any teammate standing still holding E for 3 seconds revives — slower, riskier', () => {
    const w = world();
    const h = w.addSoldier('H', 'infantry', 0, 'human');
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    h.pos = { x: 0, y: 0, z: 0 };
    a.pos = { x: 1, y: 0, z: 0 };
    b.pos = { x: 40, y: 0, z: 40 };
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606'); // lethal, not obliterating — overkill skips the crawl
    const cmds = new Map([[h.id, cmd({ use: true })]]); // kneel and work
    run(w, cmds, 2.5);
    expect(a.downed).toBe(true);    // 2.5s in — not there yet
    run(w, cmds, 0.7);
    expect(a.downed).toBe(false);   // the full 3s channel lands
    expect(a.hp).toBe(Math.round(a.maxHp * 0.4));
  });

  it('holding E while MOVING drags the body along, half speed, trailing behind', () => {
    const w = world();
    const h = w.addSoldier('H', 'infantry', 0, 'human');
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    h.pos = { x: 0, y: 0, z: 0 };
    a.pos = { x: 1, y: 0, z: 0 };
    b.pos = { x: 40, y: 0, z: 40 };
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606'); // lethal, not obliterating — overkill skips the crawl
    const cmds = new Map([[h.id, cmd({ use: true, moveX: 1 })]]); // haul east
    run(w, cmds, 0.5);
    const full = CLASSES.infantry.speed * 0.5; // what an unburdened jog covers
    expect(h.pos.x).toBeGreaterThan(full * 0.4);  // moving...
    expect(h.pos.x).toBeLessThan(full * 0.6);     // ...at half speed
    expect(a.pos.x).toBeGreaterThan(0.5);          // the body came along
    const gap = Math.hypot(a.pos.x - h.pos.x, a.pos.z - h.pos.z);
    expect(gap).toBeGreaterThan(1.0);              // trailing behind the heels
    expect(gap).toBeLessThan(1.4);
    expect(a.pos.x).toBeLessThan(h.pos.x);         // behind, not underfoot
  });

  it('downed soldiers crawl at quarter speed and cannot fire', () => {
    const w = world();
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    e.pos = { x: 8, y: 0, z: 0 };
    w.damageSoldier(a, a.hp + 5, e.id, 'ar606');
    const cmds = new Map([[a.id, cmd({ moveX: 1, fire: true, aimYaw: 0, grenade: true })]]);
    run(w, cmds, 1);
    const crawl = CLASSES.infantry.speed * 0.25;
    expect(a.pos.x).toBeGreaterThan(crawl * 0.8);  // crawling forward
    expect(a.pos.x).toBeLessThan(crawl * 1.2);     // but only crawling
    expect(e.hp).toBe(e.maxHp);                    // trigger and grenades dead
  });

  it('zombies never get downed — they just die', () => {
    const w = world();
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const z = w.addZombie('zombie', { x: 10, y: 0, z: 10 });
    w.damageSoldier(z, 9999, a.id, 'ar606');
    expect(z.alive).toBe(false);
    expect(z.downed).toBe(false);
    expect(a.kills).toBe(1); // paid out immediately, the old way
  });

  it('overkill skips the crawl — a tank shell leaves nothing to drag to cover', () => {
    const w = world();
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    w.damageSoldier(a, 9999, b.id, 'tank_cannon');
    expect(a.downed).toBe(false);
    expect(a.alive).toBe(false); // straight to the grave, killcam and all
    expect(b.kills).toBe(1);
  });

  it('49A: a medic bot walks his beam onto a downed ally unprompted', () => {
    const w = world();
    const m = w.addSoldier('Doc', 'medic', 0, 'bot');
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    m.pos = { x: 0, y: 0, z: 0 };
    a.pos = { x: 6, y: 0, z: 0 };
    b.pos = { x: 40, y: 0, z: 40 };
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606'); // lethal, not obliterating — overkill skips the crawl
    run(w, new Map(), 3); // no orders — doctrine does the work
    expect(a.downed).toBe(false);
    expect(a.alive).toBe(true);
  });
});

describe('#80 skip the bleed-out — hold SPACE to reprint now', () => {
  it('holding the space verb ~1s while downed gives up (dead before the clock)', () => {
    const w = world();
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606');
    expect(a.downed).toBe(true);
    run(w, new Map([[a.id, cmd({ crouch: true })]]), 1.2); // ground-class HOLD resolves to crouch
    expect(a.downed).toBe(false);
    expect(a.alive).toBe(false); // took the reprint — long before the 20s clock
  });

  it('a stray tap does NOT kill — the count resets on release', () => {
    const w = world();
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    w.damageSoldier(a, a.hp + 5, b.id, 'ar606');
    run(w, new Map([[a.id, cmd({ jump: true })]]), 0.3);  // 18 ticks — under the 48 threshold
    run(w, new Map([[a.id, cmd()]]), 0.1);                // released — counter resets
    run(w, new Map([[a.id, cmd({ jump: true })]]), 0.3);  // another sub-threshold hold
    expect(a.downed).toBe(true);
    expect(a.alive).toBe(true);   // still fighting for it
  });
});
