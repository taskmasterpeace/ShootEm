// ---------------------------------------------------------------------------
// FORCE FIELDS (§4.4 #2, the shared mechanic) — sustained radial pulls/pushes
// and directional currents, re-applied every tick so they survive the impulse
// decay. One system → Gravity Warden, Riptide, Oblivion's hole, Stormcaller's
// tornado. Laws: the owner's team is exempt; only CREWED hulls move (§8.1a).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

describe('force fields', () => {
  it('a radial pull drags an enemy inward; a positive radial shoves outward', () => {
    const w = quiet();
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 6, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.forceFields.push({ x: 0, z: 0, r: 14, radial: -5, team: 1, ownerId: -1, until: w.time + 10 });
    e.pushX = 0; e.pushZ = 0;
    w.step(1 / 60, new Map());
    expect(e.pushX, 'the pull must point INWARD (−x)').toBeLessThan(0);
    w.forceFields.length = 0;
    w.forceFields.push({ x: 0, z: 0, r: 14, radial: 5, team: 1, ownerId: -1, until: w.time + 10 });
    e.pushX = 0; e.pushZ = 0;
    w.step(1 / 60, new Map());
    expect(e.pushX, 'the shove must point OUTWARD (+x)').toBeGreaterThan(0);
  });

  it('a directional current shoves along its axis', () => {
    const w = quiet();
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 0, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.forceFields.push({ x: 0, z: 0, r: 14, radial: 0, fx: 4, fz: 0, team: 1, ownerId: -1, until: w.time + 10 });
    e.pushX = 0;
    w.step(1 / 60, new Map());
    expect(e.pushX, 'the current did not carry him').toBeGreaterThan(0);
  });

  it("the owner's team is exempt — your own tornado never throws you", () => {
    const w = quiet();
    const ally = w.addSoldier('A', 'infantry', 1, 'human');
    ally.pos = { x: 5, y: 0, z: 0 }; ally.alive = true;
    w.forceFields.push({ x: 0, z: 0, r: 14, radial: -5, team: 1, ownerId: -1, until: w.time + 10 });
    ally.pushX = 0;
    w.step(1 / 60, new Map());
    expect(ally.pushX, 'his own side got dragged').toBe(0);
  });

  it('crewed hulls are dragged; abandoned wrecks are not (§8.1a)', () => {
    const w = quiet();
    const crewed = w.spawnVehicle('tank', 0, { x: 6, y: 0, z: 0 });
    const driver = w.addSoldier('D', 'infantry', 0, 'bot');
    crewed.seats[0] = driver.id;
    const wreck = w.spawnVehicle('buggy', 0, { x: -6, y: 0, z: 0 }); // nobody aboard
    w.forceFields.push({ x: 0, z: 0, r: 14, radial: -5, team: 1, ownerId: -1, until: w.time + 10 });
    crewed.vel = { x: 0, y: 0, z: 0 }; wreck.vel = { x: 0, y: 0, z: 0 };
    w.step(1 / 60, new Map());
    expect(crewed.vel.x, 'the crewed hull must feel the pull').toBeLessThan(0);
    expect(wreck.vel.x, 'the wreck must sit still').toBe(0);
  });

  it('fields expire', () => {
    const w = quiet();
    w.forceFields.push({ x: 0, z: 0, r: 14, radial: -5, team: 1, ownerId: -1, until: w.time + 0.2 });
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    expect(w.forceFields.length).toBe(0);
  });
});
