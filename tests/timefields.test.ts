// ---------------------------------------------------------------------------
// TIME FIELDS (§4.4 #3, the shared mechanic → Chronos) — zone speed
// multipliers for movement and rounds. NEVER clock manipulation: the sim
// stays deterministic 30Hz; only position advance scales. The field's owner
// walks through his own frozen bullet-wall.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

describe('time fields', () => {
  it('movement drags inside a hostile bubble', () => {
    const w = quiet();
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.pos = { x: 0, y: 0, z: 0 }; s.alive = true;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    const freeDist = s.pos.x;
    s.pos = { x: 0, y: 0, z: 0 }; s.vel = { x: 0, y: 0, z: 0 };
    w.timeFields.push({ x: 0, z: 0, r: 40, mul: 0.35, ownerId: -1, until: w.time + 60 });
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    expect(s.pos.x, 'the bubble did not drag the boots').toBeLessThan(freeDist * 0.6);
  });

  it("the field's OWNER walks free — his own bubble never slows him", () => {
    const w = quiet();
    const owner = w.addSoldier('O', 'infantry', 1, 'human');
    owner.pos = { x: 0, y: 0, z: 0 }; owner.alive = true;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[owner.id, cmd({ moveX: 1 })]]));
    const freeDist = owner.pos.x;
    owner.pos = { x: 0, y: 0, z: 0 }; owner.vel = { x: 0, y: 0, z: 0 };
    w.timeFields.push({ x: 0, z: 0, r: 40, mul: 0.35, ownerId: owner.id, until: w.time + 60 });
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[owner.id, cmd({ moveX: 1 })]]));
    expect(owner.pos.x, 'his own bubble slowed him').toBeGreaterThan(freeDist * 0.9);
  });

  it('rounds crawl inside — and their fuse clock stretches to match', () => {
    const w = quiet();
    w.timeFields.push({ x: 0, z: 0, r: 20, mul: 0.3, ownerId: -1, until: w.time + 60 });
    const born = w.time;
    w.projectiles.set(4401, {
      id: 4401, weapon: 'ar606', ownerId: 900, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 60, y: 0, z: 0 }, bornAt: born, ttl: 3, arc: false,
    });
    w.step(1 / 60, new Map());
    const p = w.projectiles.get(4401)!;
    // one free tick would advance 1u; inside the bubble it must crawl ~0.3u
    expect(p.pos.x, 'the round did not crawl').toBeLessThan(0.5);
    expect(p.bornAt, 'the fuse clock must stretch inside the bubble').toBeGreaterThan(born);
  });

  it('bubbles expire and the world resumes full speed', () => {
    const w = quiet();
    w.timeFields.push({ x: 0, z: 0, r: 20, mul: 0.3, ownerId: -1, until: w.time + 0.5 });
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map());
    expect(w.timeFields.length, 'the expired bubble never popped').toBe(0);
    expect(w.timeMulAt(0, 0)).toBe(1);
  });
});
