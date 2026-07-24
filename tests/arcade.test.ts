// ───────────────────────────────────────────────────────────────────────────
// THE ARCADE — walk-up cabinets you can actually play.
//
// Robert: *"ARCADE GAMES = walk-up consoles in the world: you approach one, a
// UI pops up, and you're actually playing a video game."*
//
// The difference from THE DECK is WHERE, not what. The Deck is the handheld in
// your pack; a cabinet is a machine bolted to somebody's floor, and having to
// walk to it is the entire point. Same five games, same runtime, same scores —
// one high-score book, two doors onto it.
//
// This suite guards the SIM half: the handshake that says "this man is standing
// at that machine". The game itself is client-side by law (cartridge-games.ts:
// no rng, no tick), so a soldier playing an arcade machine can never perturb
// the war going on outside the room.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { CARTRIDGES } from '../src/client/gonet/cartridges';
import { isPlayable } from '../src/client/gonet/cartridge-games';
import { buildVanessasMap } from '../src/client/vanessas-place';
import type { PlayerCmd } from '../src/sim/types';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

function room() {
  const w = new World({ seed: 5, mode: 'tdm', botsPerTeam: 0 });
  w.map.arcades = [
    { pos: { x: 10, y: 0, z: 10 }, cart: 'orbit_run', name: 'ORBIT RUN', yaw: 0 },
    { pos: { x: 30, y: 0, z: 10 }, cart: 'siege_tower', name: 'SIEGE TOWER', yaw: 0 },
  ];
  const me = w.addSoldier('ME', 'infantry', 0, 'human');
  me.alive = true; me.pos = { x: 10, y: 0, z: 10 };
  return { w, me };
}

describe('you have to walk to it', () => {
  it('a cabinet across the room is not yours to play', () => {
    const { w, me } = room();
    me.pos = { x: 40, y: 0, z: 40 };
    expect(w.arcadeInReach(me)).toBeUndefined();
  });

  it('standing at one names that one, not the other', () => {
    const { w, me } = room();
    expect(w.arcadeInReach(me)?.name).toBe('ORBIT RUN');
    me.pos = { x: 29.6, y: 0, z: 10 };
    expect(w.arcadeInReach(me)?.name).toBe('SIEGE TOWER');
  });

  it('the reach is arm\'s length, not a room', () => {
    const { w, me } = room();
    me.pos = { x: 10 + World.ARCADE_REACH + 0.2, y: 0, z: 10 };
    expect(w.arcadeInReach(me)).toBeUndefined();
    me.pos = { x: 10 + World.ARCADE_REACH - 0.2, y: 0, z: 10 };
    expect(w.arcadeInReach(me)).toBeDefined();
  });

  it('you cannot play it from a driver\'s seat or face-down', () => {
    const { w, me } = room();
    me.vehicleId = 3;
    expect(w.arcadeInReach(me), 'not through a windscreen').toBeUndefined();
    me.vehicleId = -1; me.downed = true;
    expect(w.arcadeInReach(me), 'not while bleeding out').toBeUndefined();
    me.downed = false; me.alive = false;
    expect(w.arcadeInReach(me), 'and not while dead').toBeUndefined();
  });

  it('a map with no arcade answers nothing, and never throws', () => {
    const w = new World({ seed: 5, mode: 'tdm', botsPerTeam: 0 });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.alive = true;
    expect(w.map.arcades).toBeUndefined();
    expect(w.arcadeInReach(s)).toBeUndefined();
    expect(w.tryArcade(s)).toBe(false);
  });
});

describe('E switches the machine on', () => {
  it('and the sim says which cartridge it runs', () => {
    const { w, me } = room();
    w.events.length = 0;
    w.step(1 / 60, new Map([[me.id, cmd({ use: true })]]));
    const ev = w.events.find((e) => e.type === 'arcade');
    expect(ev, 'no handshake at all').toBeDefined();
    expect(ev!.text).toBe('orbit_run');
    expect(ev!.soldierId).toBe(me.id);
  });

  it('a bot never plays — it has nothing to play it on', () => {
    const { w } = room();
    const b = w.addSoldier('B', 'infantry', 1, 'bot');
    b.alive = true; b.pos = { x: 10, y: 0, z: 10 };
    expect(w.tryArcade(b)).toBe(false);
  });

  it('the machine outranks the floor — it does not lose E to a medkit', () => {
    const { w, me } = room();
    // drop something useful right under his boots
    const id = (w as unknown as { nextId: number }).nextId++;
    w.pickups.set(id, { id, type: 'medkit', pos: { ...me.pos }, respawnAt: 0 } as never);
    me.hp = 10;
    w.events.length = 0;
    w.step(1 / 60, new Map([[me.id, cmd({ use: true })]]));
    expect(w.events.some((e) => e.type === 'arcade'), 'you crossed a room for this').toBe(true);
    expect(me.hp, 'and the medkit is still on the floor').toBe(10);
  });

  it('playing a machine costs the sim nothing — no rng draw, no tick', () => {
    // two identical worlds; one of them plays an arcade game. They must stay
    // byte-identical, because a cabinet is a canvas and a score, not a system.
    const a = room(); const b = room();
    for (let i = 0; i < 60; i++) {
      a.w.step(1 / 60, new Map([[a.me.id, cmd({ use: i === 10 })]]));
      b.w.step(1 / 60, new Map());
    }
    // the rng stream is the sharpest tell: one extra draw and every seeded
    // outcome after it shifts. Playing a cabinet must not consume one.
    const stream = (w: World) => (w as unknown as { rng: { s: number } }).rng.s;
    expect(stream(a.w), 'the cabinet moved the rng stream').toBe(stream(b.w));
    expect(a.me.pos).toEqual(b.me.pos);
    expect(a.w.time).toBe(b.w.time);
  });
});

describe('the shop has a row of them', () => {
  it('Vanessa\'s carries real cabinets, and they run real games', () => {
    const map = buildVanessasMap();
    expect(map.arcades?.length, 'a pro shop with no machines in the corner').toBeGreaterThan(0);
    for (const c of map.arcades!) {
      expect(CARTRIDGES.some((x) => x.id === c.cart), `${c.cart} is not a cartridge`).toBe(true);
      expect(isPlayable(c.cart as never), `${c.name} is a dead machine`).toBe(true);
      expect(c.name.length).toBeGreaterThan(2);
    }
  });

  it('two machines are two machines — no cabinet stacked on another', () => {
    const map = buildVanessasMap();
    const cabs = map.arcades!;
    for (let i = 0; i < cabs.length; i++) {
      for (let j = i + 1; j < cabs.length; j++) {
        const d = Math.hypot(cabs[i].pos.x - cabs[j].pos.x, cabs[i].pos.z - cabs[j].pos.z);
        expect(d, 'you could not tell which one you were at').toBeGreaterThan(World.ARCADE_REACH);
      }
    }
  });
});
