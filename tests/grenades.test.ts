// ---------------------------------------------------------------------------
// GRENADES (Robert): banks and arcs.
//   · The wheel picks the ARC (flat rope ↔ mortar lob) — the cursor picks the
//     LANDING SPOT, and the landing spot never moves with the arc.
//   · A hand frag BANKS off walls — the wall redirects it, the fuse keeps
//     burning. A GL-40 launcher shell still detonates on the bricks.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_WALL, TILE, WORLD } from '../src/sim/map';
import type { SimEvent } from '../src/sim/types';
import { World } from '../src/sim/world';

/** a thrower alone on open ground at the map center */
function range() {
  const w = new World({ seed: 42, mode: 'tdm' });
  const s = w.addSoldier('T', 'infantry', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 };
  s.yaw = 0; // throwing +x
  // flatten the neighborhood so nothing but OUR wall is in play
  const half = GRID / 2;
  for (let z = half - 8; z <= half + 8; z++)
    for (let x = half - 4; x < GRID - 1; x++) w.map.grid[z * GRID + x] = 0;
  return { w, s };
}

/** step until the first explosion; returns its position and all events */
function runToBoom(w: World, seconds = 6) {
  const events: SimEvent[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    w.step(1 / 60, new Map());
    events.push(...w.takeEvents());
    const boom = events.find((e) => e.type === 'explosion');
    if (boom) return { boom, events };
  }
  return { boom: undefined, events };
}

describe('the arc dial', () => {
  it('flat rope and mortar lob LAND ON THE SAME SPOT — loft picks the road, not the destination', () => {
    const targets: number[] = [];
    for (const loft of [0, 0.5, 1]) {
      const { w, s } = range();
      w.throwProjectile(s, 'gl', 1.4, 16, true, 18, loft, true);
      const { boom } = runToBoom(w);
      expect(boom, `loft ${loft} never landed`).toBeTruthy();
      targets.push(Math.hypot(boom!.pos!.x - s.pos.x, boom!.pos!.z - s.pos.z));
    }
    for (const d of targets) expect(Math.abs(d - 18), `landed at ${d}, wanted 18`).toBeLessThan(1.5);
  });

  it('flat flies FAST and low; the lob hangs high — same destination, different roads', () => {
    const { w: wF, s: sF } = range();
    wF.throwProjectile(sF, 'gl', 1.4, 16, true, 18, 0, true);
    const flat = [...wF.projectiles.values()][0];
    const { w: wL, s: sL } = range();
    wL.throwProjectile(sL, 'gl', 1.4, 16, true, 18, 1, true);
    const lob = [...wL.projectiles.values()][0];
    expect(flat.vel.y).toBeLessThan(lob.vel.y);
    expect(Math.hypot(flat.vel.x, flat.vel.z)).toBeGreaterThan(Math.hypot(lob.vel.x, lob.vel.z));
  });

  it('no loft given = the classic lob, bit for bit (bots never change)', () => {
    const { w, s } = range();
    w.throwProjectile(s, 'gl', 1.4, 16, true, 18); // legacy call shape
    const p = [...w.projectiles.values()][0];
    const gArc = w.gravity * 0.7, t0 = 18 / 16;
    const vyClassic = Math.max(2, 0.5 * gArc * t0 - 1.4 / t0);
    expect(Math.abs(p.vel.y - vyClassic)).toBeLessThan(0.01);
    expect(p.bounce).toBeUndefined(); // and no bank license either
  });
});

describe('the bank shot', () => {
  /** a wall across the lane at +9u — flat throws must bank off it */
  function walledRange() {
    const { w, s } = range();
    const half = GRID / 2;
    const wallTx = half + 3; // tile boundary ≈ +9u east of the thrower
    for (let z = half - 6; z <= half + 6; z++) w.map.grid[z * GRID + wallTx] = T_WALL;
    const wallX = (wallTx) * TILE - WORLD / 2; // the wall's west face
    return { w, s, wallX };
  }

  it('a flat frag BANKS off the wall and explodes on the thrower\'s side', () => {
    const { w, s, wallX } = walledRange();
    w.throwProjectile(s, 'gl', 1.4, 16, true, 18, 0, true); // flat rope, straight at the wall
    const { boom, events } = runToBoom(w);
    expect(boom, 'the frag vanished').toBeTruthy();
    expect(boom!.pos!.x, 'exploded past the wall — it went THROUGH').toBeLessThan(wallX + 0.5);
    // the bank itself ticks: a hit event with the owner, mid-flight
    expect(events.some((e) => e.type === 'hit' && e.weapon === 'gl' && e.ownerId === s.id)).toBe(true);
  });

  it('a GL-40 shell still detonates ON the wall — launchers bought no license', () => {
    const { w, s, wallX } = walledRange();
    w.throwProjectile(s, 'gl', 1.4, 16, true, 18, 0, false); // same throw, no bounce flag
    const { boom } = runToBoom(w);
    expect(boom).toBeTruthy();
    expect(Math.abs(boom!.pos!.x - wallX), 'should die at the bricks').toBeLessThan(2.5);
  });

  it('the fuse survives the bank — a banked frag still explodes', () => {
    const { w, s } = walledRange();
    w.throwProjectile(s, 'gl', 1.4, 16, true, 18, 0, true);
    const { boom } = runToBoom(w, 8);
    expect(boom, 'banked frags must still go off').toBeTruthy();
  });
});
