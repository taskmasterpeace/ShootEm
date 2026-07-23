// ---------------------------------------------------------------------------
// LOOT (STATUS short-list: "dropped weapons you can pick up off the dead").
// The revenge loop: kill the heavy, take the autocannon. A fallen human/bot
// drops its PRIMARY (the issue rifle is beneath scavenging); the gun lies
// there for LOOT_DESPAWN, walk-over grants it into the special slot (or
// refills a matching carried gun); humans only for now — bots dropping but
// not scavenging keeps the threat-measure bands untouched.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { CLASSES, WEAPONS } from '../src/sim/data';
import type { PlayerCmd, Pickup } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const drops = (w: World): Pickup[] => [...w.pickups.values()].filter((p) => p.type === 'weapon');

/** put a soldier down for good — overkill skips the crawl (§4.3) */
const executed = (w: World, s: ReturnType<World['addSoldier']>) => {
  s.protectedUntil = 0;
  w.damageSoldier(s, 999, -1, 'rifle');
};

describe('LOOT — dropped weapons off the dead', () => {
  it('a dead heavy leaves his autocannon in the dirt (expiring)', () => {
    const w = quiet();
    const h = w.addSoldier('H', 'heavy', 1, 'bot');
    h.pos = { x: 10, y: 0, z: 10 }; h.alive = true;
    executed(w, h);
    const d = drops(w);
    expect(d.length).toBe(1);
    expect(d[0].weaponId).toBe(CLASSES.heavy.primary);
    expect(d[0].expiresAt).toBeGreaterThan(w.time);
    expect(Math.hypot(d[0].pos.x - 10, d[0].pos.z - 10)).toBeLessThan(1.5); // beside the body
  });

  it('the issue rifle is beneath scavenging — infantry drops nothing', () => {
    const w = quiet();
    const i = w.addSoldier('I', 'infantry', 1, 'bot');
    i.pos = { x: 10, y: 0, z: 10 }; i.alive = true;
    executed(w, i);
    expect(drops(w).length).toBe(0);
  });

  it('walk-over LOADS the special slot; the pickup is consumed', () => {
    const w = quiet();
    const h = w.addSoldier('H', 'heavy', 1, 'bot');
    h.pos = { x: 10, y: 0, z: 10 }; h.alive = true;
    executed(w, h);
    const pk = drops(w)[0];
    const p = w.addSoldier('P', 'infantry', 0, 'human');
    p.alive = true; p.pos = { x: pk.pos.x, y: 0, z: pk.pos.z };
    // standing on it is NOT taking it any more — Robert: "press E for pickup"
    w.step(1 / 60, new Map([[p.id, cmd()]]));
    expect(p.weapons.includes(CLASSES.heavy.primary), 'walking over leaves it lying').toBe(false);
    w.step(1 / 60, new Map([[p.id, cmd({ use: true })]]));
    expect(p.weapons.includes(CLASSES.heavy.primary), 'the gun is his now').toBe(true);
    const i = p.weapons.indexOf(CLASSES.heavy.primary);
    expect(p.clip[i], 'and it came loaded').toBe(WEAPONS[CLASSES.heavy.primary].clip);
    expect(drops(w).length, 'one gun, one owner').toBe(0);
  });

  it('a matching carried gun makes it an AMMO run instead', () => {
    const w = quiet();
    const h = w.addSoldier('H', 'heavy', 1, 'bot');
    h.pos = { x: 10, y: 0, z: 10 }; h.alive = true;
    executed(w, h);
    const pk = drops(w)[0];
    const p = w.addSoldier('P', 'heavy', 0, 'human'); // same kit
    p.alive = true; p.pos = { x: pk.pos.x, y: 0, z: pk.pos.z };
    p.clip[0] = 1; p.reserve[0] = 0; // ran dry
    w.step(1 / 60, new Map([[p.id, cmd({ use: true })]]));
    expect(p.clip[0], 'took the dead man\'s mags').toBe(WEAPONS[CLASSES.heavy.primary].clip);
    expect(p.weapons.length, 'no duplicate gun').toBe(2);
    expect(drops(w).length).toBe(0);
  });

  it('a dropped gun EVAPORATES after its time', () => {
    const w = quiet();
    const h = w.addSoldier('H', 'heavy', 1, 'bot');
    h.pos = { x: 10, y: 0, z: 10 }; h.alive = true;
    executed(w, h);
    expect(drops(w).length).toBe(1);
    for (let i = 0; i < 60 * 21; i++) w.step(1 / 60, new Map()); // LOOT_DESPAWN 20s
    expect(drops(w).length, 'the field tidied itself').toBe(0);
  });

  it('bots never scavenge — the threat-measure guard', () => {
    const w = quiet();
    const h = w.addSoldier('H', 'heavy', 1, 'bot');
    h.pos = { x: 10, y: 0, z: 10 }; h.alive = true;
    executed(w, h);
    const pk = drops(w)[0];
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    b.alive = true; b.pos = { x: pk.pos.x, y: 0, z: pk.pos.z };
    w.step(1 / 60, new Map([[b.id, cmd()]]));
    expect(b.weapons.includes(CLASSES.heavy.primary)).toBe(false);
    expect(drops(w).length, 'still lying there').toBe(1);
  });
});
