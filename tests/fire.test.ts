import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { S_GRASS, S_PLATE } from '../src/sim/map';
import { tileIndex, tileToWorld } from '../src/sim/map-geometry';

// §6.1 FIELD FIRE (W7.3) — grass/wood catch from incendiary rounds, scorch who
// stands in them, spread to flammable neighbours, and burn down. Deterministic.

function fireWorld(seed = 3) {
  const w = new World({
    seed, mode: 'tdm', difficulty: 'veteran', botsPerTeam: 4, matchMinutes: 15,
    theme: 'savanna', hordeRoster: 'zombies', moraleBoost: [0, 0], lswPass: 3,
  } as never);
  return w;
}

/** Paint a 3×3 flammable (grass) patch centred on (cx,cz), the rest bare plate. */
function grassPatch(w: World, cx: number, cz: number) {
  const geo = w.map.geometry;
  w.map.surface.fill(S_PLATE); // metal deck — not flammable
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    w.map.surface[tileIndex(geo, cx + dx, cz + dz)] = S_GRASS;
  }
}

describe('field fire — ignition', () => {
  it('lights a flammable tile, refuses a bare one, and dedups', () => {
    const w = fireWorld();
    grassPatch(w, 50, 50);
    w.igniteTile(50, 50);
    expect(w.fires.length).toBe(1);
    w.igniteTile(50, 50);          // already ablaze
    expect(w.fires.length).toBe(1);
    w.igniteTile(80, 80);          // bare plate — won't catch
    expect(w.fires.length).toBe(1);
  });
});

describe('field fire — the burn', () => {
  it('scorches the living standing in it', () => {
    const w = fireWorld();
    grassPatch(w, 50, 50);
    const s = w.addSoldier('Ash', 'infantry', 0, 'bot');
    s.alive = true; s.pos = { ...tileToWorld(w.map.geometry, 50, 50) };
    const hp0 = s.hp;
    w.igniteTile(50, 50);
    for (let i = 0; i < 30; i++) w.step(1 / 30, new Map()); // 1s in the flames
    expect(s.hp).toBeLessThan(hp0);
  });

  it('spreads to flammable neighbours, once', () => {
    const w = fireWorld();
    grassPatch(w, 50, 50);
    w.igniteTile(50, 50);
    expect(w.fires.length).toBe(1);
    for (let i = 0; i < 60; i++) w.step(1 / 30, new Map()); // past the spread delay
    expect(w.fires.length).toBeGreaterThan(1);              // caught the neighbours
  });

  it('burns a corpse down to neutralized', () => {
    const w = fireWorld();
    grassPatch(w, 50, 50);
    w.corpses.push({ pos: { ...tileToWorld(w.map.geometry, 50, 50) }, reanimatesAt: 999, neutralized: false, name: 'X', classId: 'infantry' });
    w.igniteTile(50, 50);
    for (let i = 0; i < 90; i++) w.step(1 / 30, new Map());
    expect(w.corpses[0].neutralized).toBe(true);
  });

  it('burns out', () => {
    const w = fireWorld();
    grassPatch(w, 50, 50);
    w.igniteTile(50, 50);
    for (let i = 0; i < 30 * 8; i++) w.step(1 / 30, new Map()); // well past FIRE_LIFE + spread
    expect(w.fires.length).toBe(0);
  });
});

describe('field fire — determinism', () => {
  it('same seed + same ignition → identical fire count each tick', () => {
    const run = () => {
      const w = fireWorld(9); grassPatch(w, 50, 50); w.igniteTile(50, 50);
      const trace: number[] = [];
      for (let i = 0; i < 120; i++) { w.step(1 / 30, new Map()); if (i % 10 === 0) trace.push(w.fires.length); }
      return trace;
    };
    expect(run()).toEqual(run());
  });
});
