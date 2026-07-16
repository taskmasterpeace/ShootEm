// ---------------------------------------------------------------------------
// §5.3 Military working dogs — the K9 handler pairing. Heel, takedown, THE
// NOSE (cloak fools optics, not a dog), and the hold when the handler drops.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { DOG_STATS, WEAPONS } from '../src/sim/data';
import type { Soldier } from '../src/sim/types';
import { World } from '../src/sim/world';

const run = (w: World, seconds: number) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) w.step(1 / 60, new Map());
};

const dist = (a: Soldier, b: Soldier) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);

/** A world with a handler parked on the open ground near the map center. */
const kennel = () => {
  const w = new World({ seed: 42, mode: 'tdm' });
  const handler = w.addSoldier('Handler', 'infantry', 0, 'human');
  handler.pos = { x: 0, y: 0, z: 0 };
  const dog = w.addDog(handler);
  dog.pos = { x: 2, y: 0, z: 0 };
  return { w, handler, dog };
};

describe('military working dogs', () => {
  it('issues a real bite and exactly one dog per team', () => {
    const bite = WEAPONS.dog_bite;
    expect(bite.damage).toBe(16);
    expect(bite.range).toBe(2.0);
    expect(bite.sound).toBe('claw');
    expect(bite.icon).toBe('🐕');

    const { w, handler, dog } = kennel();
    expect(dog.kind).toBe('dog');
    expect(dog.ownerId).toBe(handler.id);
    expect(dog.maxHp).toBe(DOG_STATS.hp);
    expect(dog.weapons).toEqual(['dog_bite']);
    // the kennel issues one per side — a second requisition returns the same dog
    const second = w.addSoldier('H2', 'engineer', 0, 'human');
    expect(w.addDog(second)).toBe(dog);
  });

  it('follows its handler to heel', () => {
    const { w, handler, dog } = kennel();
    dog.pos = { x: 14, y: 0, z: 0 }; // left behind — catch up
    run(w, 3);
    const d = dist(dog, handler);
    expect(d).toBeLessThanOrEqual(DOG_STATS.heelDist + 1);
    expect(d).toBeGreaterThan(0.5); // heels beside the boots, not inside them
  });

  it('attacks an enemy near the handler, then returns to heel after the kill', () => {
    const { w, handler, dog } = kennel();
    const foe = w.addSoldier('Foe', 'infantry', 1, 'human');
    foe.pos = { x: 10, y: 0, z: 0 }; // inside the guard radius
    run(w, 3);
    expect(foe.hp).toBeLessThan(foe.maxHp); // the dog got its teeth in
    run(w, 4); // foe drops (or flees on respawn far away) — the dog falls back in
    expect(dist(dog, handler)).toBeLessThanOrEqual(DOG_STATS.heelDist + 1.5);
  });

  it('THE NOSE: auto-pings a cloaked enemy inside 10u without breaking the cloak', () => {
    const { w, dog } = kennel();
    const spook = w.addSoldier('Spook', 'infiltrator', 1, 'human');
    spook.pos = { x: dog.pos.x + 6, y: 0, z: 0 }; // well inside the nose radius
    spook.cloaked = true;
    w.step(1 / 60, new Map());
    expect(w.pinged.has(spook.id)).toBe(true);
    expect(spook.cloaked).toBe(true); // marked by scent, not by damage
    // and it keeps marking, tick after tick, while the spook lingers
    run(w, 0.5);
    expect(w.pinged.has(spook.id)).toBe(true);
  });

  it('holds position when the handler dies, and rejoins when they return', () => {
    const { w, handler, dog } = kennel();
    const foe = w.addSoldier('Foe', 'infantry', 1, 'human');
    foe.pos = { x: 45, y: 0, z: 0 }; // far outside the guard radius — not the dog's problem
    w.damageSoldier(handler, 9999, foe.id, 'ar606');
    expect(handler.alive).toBe(false);
    const before = { x: dog.pos.x, z: dog.pos.z };
    run(w, 2);
    expect(Math.hypot(dog.pos.x - before.x, dog.pos.z - before.z)).toBeLessThan(1); // good dogs don't wander
    // the handler comes back — the dog closes the gap and falls in
    w.spawn(handler);
    handler.pos = { x: 12, y: 0, z: 0 };
    run(w, 2);
    expect(dist(dog, handler)).toBeLessThanOrEqual(DOG_STATS.heelDist + 1.5);
  });

  it('respawns at the handler\'s side, and never before the handler is back up', () => {
    const { w, handler, dog } = kennel();
    // dog alone goes down: back in 4s, redeployed beside the handler
    w.damageSoldier(dog, 9999, -1, 'ar606');
    expect(dog.alive).toBe(false);
    run(w, 5);
    expect(dog.alive).toBe(true);
    expect(dist(dog, handler)).toBeLessThan(8);
    // both go down: the dog waits out the handler's respawn, then both are up
    w.damageSoldier(handler, 9999, -1, 'ar606');
    w.damageSoldier(dog, 9999, -1, 'ar606');
    run(w, 2);
    expect(dog.alive).toBe(false); // still waiting on the handler
    run(w, 3);
    expect(handler.alive).toBe(true);
    expect(dog.alive).toBe(true);
  });
});
