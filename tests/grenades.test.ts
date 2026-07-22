// ---------------------------------------------------------------------------
// GRENADES (Robert): banks, arcs, bounces, and THE BAG.
//   · The wheel picks the ARC (flat rope ↔ HIGH mortar rainbow) — the cursor
//     picks the TARGET. Bounces may drift the boom a little, but it must
//     stay inside the splash ring's promise (±4.5u).
//   · A hand frag is TIMED and it BOUNCES — off walls mid-flight, off the
//     ground on arrival. It never explodes just because it landed.
//   · X cycles the bag: class kit → smoke → fire, skipping empty pouches.
//   · Smoke AFFECTS VISIBILITY — eyes, bots, everyone.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_WALL, TILE, WORLD } from '../src/sim/map';
import { smokeBlocks } from '../src/sim/perception';
import type { PlayerCmd, SimEvent } from '../src/sim/types';
import { HAND_FRAG_REACH, World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

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
  it('every loft BOOMS inside the splash ring of the cursor — bounces drift, the promise holds', () => {
    for (const loft of [0, 0.5, 1]) {
      const { w, s } = range();
      w.throwProjectile(s, 'gl', 1.4, 16, true, 18, loft, true);
      const { boom } = runToBoom(w);
      expect(boom, `loft ${loft} never landed`).toBeTruthy();
      const d = Math.hypot(boom!.pos!.x - s.pos.x, boom!.pos!.z - s.pos.z);
      expect(Math.abs(d - 18), `loft ${loft}: boomed at ${d.toFixed(1)}, wanted ~18`).toBeLessThan(4.5);
    }
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

  it('the mortar ceiling is RAISED: max loft flies 1.3× the classic ballistic vy (Robert: "a higher arc")', () => {
    const { w, s } = range();
    w.throwProjectile(s, 'gl', 1.4, 16, true, 18); // legacy call = full loft
    const p = [...w.projectiles.values()][0];
    const gArc = w.gravity * 0.7, t0 = 18 / 16;
    const vyClassic = Math.max(2, 0.5 * gArc * t0 - 1.4 / t0);
    expect(Math.abs(p.vel.y - vyClassic * 1.3), 'max loft should be the raised rainbow').toBeLessThan(0.01);
    expect(p.bounce).toBeUndefined(); // launcher shells still bought no bank license
  });

  it('the hand toss reaches a LITTLE further now — 26u, still nowhere near the GL-40', () => {
    expect(HAND_FRAG_REACH).toBe(26);
  });
});

describe('the ground bounce (Robert: "I don\'t like that it doesn\'t bounce")', () => {
  it('a mortar frag KICKS back off the dirt — a real bounce, then the bang', () => {
    const { w, s } = range();
    w.throwProjectile(s, 'gl', 1.4, 16, true, 14, 1, true);
    const id = [...w.projectiles.keys()][0];
    let kicked = false, bounceTick = false;
    for (let i = 0; i < 60 * 6 && w.projectiles.has(id); i++) {
      w.step(1 / 60, new Map());
      const p = w.projectiles.get(id);
      if (p && p.vel.y > 0.5 && w.time - p.bornAt > 0.8) kicked = true; // climbing again after the fall
      for (const e of w.takeEvents()) if (e.type === 'nade_bounce') bounceTick = true;
    }
    expect(kicked, 'the grenade never came back off the ground').toBe(true);
    expect(bounceTick, 'the bounce never ticked').toBe(true);
  });

  it('the frag is TIMED — it rests on the ground first, then explodes; it never sinks', () => {
    const { w, s } = range();
    w.throwProjectile(s, 'gl', 1.4, 16, true, 14, 1, true);
    const id = [...w.projectiles.keys()][0];
    let restedTicks = 0, minY = Infinity, boomAt = -1;
    const born = w.time;
    for (let i = 0; i < 60 * 6 && boomAt < 0; i++) {
      w.step(1 / 60, new Map());
      const p = w.projectiles.get(id);
      if (p) {
        minY = Math.min(minY, p.pos.y);
        if (p.pos.y <= 0.2 && Math.abs(p.vel.y) < 0.01) restedTicks++;
      }
      for (const e of w.takeEvents()) if (e.type === 'explosion') boomAt = w.time;
    }
    expect(minY, 'the grenade sank under the map').toBeGreaterThanOrEqual(0);
    expect(restedTicks, 'it never lay on the ground cooking').toBeGreaterThan(10);
    expect(boomAt - born, 'the fuse ran shorter than the flight').toBeGreaterThan(1.2);
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

describe('the grenade bag (X cycles, G throws)', () => {
  it('X rotates frag → smoke → fire → conc → singularity → plasma → back, empty pouches skipped', () => {
    const { w, s } = range();
    w.spawn(s); // stock the bag (infantry: frag / smoke / fire / conc / singularity / plasma)
    s.pos = { x: 0, y: 0, z: 0 };
    expect(s.nadeSel ?? 0).toBe(0);
    const X = () => w.step(1 / 60, new Map([[s.id, cmd({ nadeCycle: true })]]));
    X(); expect(s.nadeSel, 'X1 → smoke').toBe(1);
    X(); expect(s.nadeSel, 'X2 → fire').toBe(2);
    X(); expect(s.nadeSel, 'X3 → concussion').toBe(3);
    X(); expect(s.nadeSel, 'X4 → the singularity (grav)').toBe(4);
    X(); expect(s.nadeSel, 'X5 → the plasma stick').toBe(5);
    X(); expect(s.nadeSel, 'X6 skips the empty time-bomb pouch — back to the class kit').toBe(0);
    // a medic carries no firebombs — X skips the empty pouch, lands on concussion
    const m = w.addSoldier('M', 'medic', 0, 'human');
    w.spawn(m);
    expect(m.firebombs ?? 0).toBe(0);
    w.step(1 / 60, new Map([[m.id, cmd({ nadeCycle: true })]]));
    expect(m.nadeSel).toBe(1);
    w.step(1 / 60, new Map([[m.id, cmd({ nadeCycle: true })]]));
    expect(m.nadeSel, 'the empty fire pouch is skipped — concussion is next').toBe(3);
    w.step(1 / 60, new Map([[m.id, cmd({ nadeCycle: true })]]));
    expect(m.nadeSel, 'and back to the class kit').toBe(0);
  });

  it('with smoke in hand, G throws a canister that POPS a standing cloud', () => {
    const { w, s } = range();
    w.spawn(s);
    s.pos = { x: 0, y: 0, z: 0 }; s.yaw = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ nadeCycle: true })]])); // smoke in hand
    const before = s.smokes ?? 0;
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimDist: 14 })]]));
    expect(s.smokes, 'the pouch did not pay').toBe(before - 1);
    for (let i = 0; i < 60 * 5; i++) w.step(1 / 60, new Map());
    const cloud = [...w.gadgets.values()].find((g) => g.type === 'smoke_field' && g.ownerId === s.id);
    expect(cloud, 'no cloud stood up').toBeTruthy();
    expect(Math.hypot(cloud!.pos.x, cloud!.pos.z), 'the cloud missed the cursor badly').toBeLessThan(19);
  });

  it('with fire in hand, G lays a burning patch', () => {
    const { w, s } = range();
    w.spawn(s);
    s.pos = { x: 0, y: 0, z: 0 }; s.yaw = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ nadeCycle: true })]]));
    w.step(1 / 60, new Map([[s.id, cmd({ nadeCycle: true })]])); // fire in hand
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimDist: 12 })]]));
    for (let i = 0; i < 60 * 5; i++) w.step(1 / 60, new Map());
    expect([...w.gadgets.values()].some((g) => g.type === 'fire_field' && g.ownerId === s.id),
      'no fire took').toBe(true);
  });
});

describe('smoke affects VISIBILITY (Robert) — eyes, bots, everyone', () => {
  it('a sight line through the cloud is blocked; around it is clear', () => {
    const blob = [{ x: 10, z: 0, r: 5 }];
    expect(smokeBlocks(0, 0, 20, 0, blob), 'saw straight through the cloud').toBe(true);
    expect(smokeBlocks(0, 8, 20, 8, blob), 'the cloud blocked a line it never touched').toBe(false);
  });

  it('an enemy behind smoke drops OFF the wire — and bots lose the track too', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = w.addSoldier('EYE', 'infantry', 0, 'human');
    a.pos = { x: 0, y: 0, z: 0 }; a.yaw = 0;
    const b = w.addSoldier('TGT', 'infantry', 1, 'human');
    b.pos = { x: 18, y: 0, z: 0 };
    // clear the sight lane between them — the region grammar may grow a tree or
    // a CLIMB barricade across open ground, and this test is about SMOKE, not
    // terrain (worlds are ~tile 50 = world 0; carve tiles 46..60 × 47..53)
    for (let tx = 46; tx <= 60; tx++) for (let tz = 47; tz <= 53; tz++) w.map.grid[tz * 100 + tx] = 0;
    // clear ground truth first
    w.step(1 / 60, new Map());
    expect(w.lastSeen[0].has(b.id), 'open ground, dead ahead — must be seen').toBe(true);
    expect(w.sightClear(a.pos, b.pos)).toBe(true);
    // now the cloud lands between them
    w.spawnGadget('smoke_field', 0, a.id, { x: 9, y: 0, z: 0 }, Infinity, 10);
    const seenAt = w.lastSeen[0].get(b.id)!.t;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    expect(w.lastSeen[0].get(b.id)?.t ?? -1, 'the wire kept tracking THROUGH smoke').toBe(seenAt);
    expect(w.sightClear(a.pos, b.pos), 'bots would still see through the cloud').toBe(false);
  });
});
