// ---------------------------------------------------------------------------
// HULL TO HULL (#137). Robert: *"we need hull-to-hull collision for a race car
// game… I know it's a lot of calculations."*
//
// The laws:
//   1. MACHINES DO NOT PASS THROUGH EACH OTHER.
//   2. MASS DECIDES WHO MOVES — a tanker shoves a hatchback, not the reverse.
//   3. SEPARATING HULLS ARE LEFT ALONE — no impulse on the way out, or two
//      cars that touched once would jitter against each other forever.
//   4. A TAP IS FREE. Only a real closing speed costs paint.
//   5. Soldiers are deliberately exempt (the expensive one, Robert's call).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  CRASH_SPEED, MIN_RADIUS, crashDamage, resolveHulls, type Hull,
} from '../src/sim/hullcollide';
import { World } from '../src/sim/world';

const hull = (id: number, x: number, z: number, mass = 1.6, radius = 1.5, vx = 0, vz = 0): Hull =>
  ({ id, pos: { x, y: 0, z }, vel: { x: vx, y: 0, z: vz }, mass, radius });

describe('hulls stop passing through each other', () => {
  it('pushes overlapping machines apart', () => {
    const a = hull(1, 0, 0);
    const b = hull(2, 1, 0); // deep overlap: radii sum to 3
    const before = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    resolveHulls([a, b], 1 / 60);
    expect(Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z)).toBeGreaterThan(before);
  });

  it('leaves machines that are not touching completely alone', () => {
    const a = hull(1, 0, 0);
    const b = hull(2, 40, 0);
    const pa = { ...a.pos }, pb = { ...b.pos };
    expect(resolveHulls([a, b], 1 / 60)).toHaveLength(0);
    expect(a.pos).toEqual(pa);
    expect(b.pos).toEqual(pb);
  });

  it('MASS DECIDES WHO MOVES — the tanker barely notices the hatchback', () => {
    const tanker = hull(1, 0, 0, 20, 2.4);
    const car = hull(2, 2, 0, 1.4, 1.4);
    const t0 = { ...tanker.pos }, c0 = { ...car.pos };
    resolveHulls([tanker, car], 1 / 60);
    const tankerMoved = Math.hypot(tanker.pos.x - t0.x, tanker.pos.z - t0.z);
    const carMoved = Math.hypot(car.pos.x - c0.x, car.pos.z - c0.z);
    expect(carMoved).toBeGreaterThan(tankerMoved * 5);
  });

  it('SEPARATING HULLS GET NO IMPULSE — otherwise they jitter forever', () => {
    // overlapping but already flying apart
    const a = hull(1, 0, 0, 1.6, 1.5, -5, 0);
    const b = hull(2, 2, 0, 1.6, 1.5, +5, 0);
    const va = a.vel.x, vb = b.vel.x;
    const impacts = resolveHulls([a, b], 1 / 60);
    expect(impacts).toHaveLength(0);
    expect(a.vel.x).toBe(va);
    expect(b.vel.x).toBe(vb);
  });

  it('a closing pair really does bleed speed into each other', () => {
    const a = hull(1, 0, 0, 1.6, 1.5, +12, 0);
    const b = hull(2, 2.5, 0, 1.6, 1.5, 0, 0);
    resolveHulls([a, b], 1 / 60);
    expect(a.vel.x).toBeLessThan(12);  // the runner slowed
    expect(b.vel.x).toBeGreaterThan(0); // the struck one was shoved along
  });

  it('A TAP IS FREE; a real crash is not', () => {
    expect(crashDamage(0)).toBe(0);
    expect(crashDamage(10)).toBe(0);
    expect(crashDamage(200)).toBeGreaterThan(0);
    expect(crashDamage(99999)).toBeLessThanOrEqual(140); // never a one-hit write-off
  });

  it('only a real closing speed files an impact at all', () => {
    const slow = resolveHulls([hull(1, 0, 0, 1.6, 1.5, 1, 0), hull(2, 2.5, 0)], 1 / 60);
    expect(slow).toHaveLength(0);
    const fast = resolveHulls([hull(1, 0, 0, 1.6, 1.5, CRASH_SPEED + 6, 0), hull(2, 2.5, 0)], 1 / 60);
    expect(fast).toHaveLength(1);
    expect(fast[0].speed).toBeGreaterThanOrEqual(CRASH_SPEED);
  });

  it('two hulls at dead centre separate instead of dividing by zero', () => {
    const a = hull(1, 5, 5);
    const b = hull(2, 5, 5);
    resolveHulls([a, b], 1 / 60);
    expect(Number.isFinite(a.pos.x)).toBe(true);
    expect(Number.isFinite(b.pos.x)).toBe(true);
    expect(a.pos.x).not.toBe(b.pos.x);
  });

  it('even a bicycle has a body', () => {
    const a = hull(1, 0, 0, 0.1, 0);
    const b = hull(2, 0.5, 0, 0.1, 0);
    resolveHulls([a, b], 1 / 60);
    expect(Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z))
      .toBeGreaterThan(0.5); // MIN_RADIUS gave them one
    expect(MIN_RADIUS).toBeGreaterThan(0);
  });
});

describe('in a real world', () => {
  it('two parked hulls in the same spot shove each other clear', () => {
    const w = new World({ seed: 5, mode: 'tdm', botsPerTeam: 0 });
    const a = w.spawnVehicle('sedan', 0, { x: 0, y: 0, z: 0 });
    const b = w.spawnVehicle('sedan', 0, { x: 0.5, y: 0, z: 0 });
    a.alive = true; b.alive = true;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map());
    expect(Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z)).toBeGreaterThan(1.5);
  });

  it('SOLDIERS ARE EXEMPT — the expensive one stays unbuilt on purpose', () => {
    const w = new World({ seed: 5, mode: 'tdm', botsPerTeam: 0 });
    const a = w.addSoldier('A', 'infantry', 0, 'bot');
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    a.pos = { x: 0, y: 0, z: 0 };
    b.pos = { x: 0.2, y: 0, z: 0 };
    const gap = () => Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    const before = gap();
    w.step(1 / 60, new Map());
    // whatever the bots do, the HULL pass must not have touched them
    expect(Math.abs(gap() - before)).toBeLessThan(2);
  });

  it('a flying hull is not shoved by the ground traffic below it', () => {
    const w = new World({ seed: 5, mode: 'tdm', botsPerTeam: 0 });
    const jet = w.spawnVehicle('strikejet', 0, { x: 0, y: 0, z: 0 });
    const car = w.spawnVehicle('sedan', 0, { x: 0.3, y: 0, z: 0 });
    jet.alive = true; car.alive = true;
    const jetAt = { ...jet.pos };
    w.step(1 / 60, new Map());
    expect(Math.hypot(jet.pos.x - jetAt.x, jet.pos.z - jetAt.z)).toBeLessThan(2);
  });
});
