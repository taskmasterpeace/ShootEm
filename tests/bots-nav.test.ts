// ---------------------------------------------------------------------------
// THE AI AUDIT (Robert): respawn dogpiles, per-life variety, ride appetite,
// and drivers who navigate instead of compass-charging walls.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { objectiveFor } from '../src/sim/bots';
import { GRID, T_WALL } from '../src/sim/map';
import { World } from '../src/sim/world';

describe('the respawn wave (Robert: "they get stuck over each other")', () => {
  it('a wave that dies together does NOT stand in one pile a second after landing', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const squad = Array.from({ length: 8 }, (_, i) => w.addSoldier('B' + i, 'infantry', 1, 'bot'));
    for (const b of squad) w.spawn(b);
    for (const b of squad) { b.protectedUntil = 0; w.damageSoldier(b, 99999, -1, 'ar606'); }
    // run until they're all back, plus one second of walking
    for (let i = 0; i < 60 * 9; i++) {
      w.step(1 / 60, new Map());
      w.takeEvents();
      if (squad.every((b) => b.alive) ) break;
    }
    for (let i = 0; i < 60; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    let stacked = 0;
    for (let a = 0; a < squad.length; a++) {
      for (let b = a + 1; b < squad.length; b++) {
        const d = Math.hypot(squad[a].pos.x - squad[b].pos.x, squad[a].pos.z - squad[b].pos.z);
        if (d < 1.0) stacked++;
      }
    }
    expect(stacked, 'bodies standing inside each other after the wave landed').toBe(0);
  });

  it('perfectly stacked bots still push apart — the zero-distance blind spot is gone', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    const bots = Array.from({ length: 3 }, (_, i) => w.addSoldier('P' + i, 'infantry', 0, 'bot'));
    for (const b of bots) w.spawn(b);
    for (const b of bots) { b.pos = { x: 10, y: 0, z: 10 }; b.alive = true; } // the impossible pile
    for (let i = 0; i < 60 * 2; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    let minD = Infinity;
    for (let a = 0; a < bots.length; a++) {
      for (let b = a + 1; b < bots.length; b++) {
        minD = Math.min(minD, Math.hypot(bots[a].pos.x - bots[b].pos.x, bots[a].pos.z - bots[b].pos.z));
      }
    }
    expect(minD, 'the pile never broke').toBeGreaterThan(1.0);
  });

  it('death wipes the nav scratch and rolls a fresh personality', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    b.botGoal = { x: 50, y: 0, z: 50 };
    b.botStuckAt = 12;
    w.spawn(b);
    expect(b.botGoal, 'the old lane survived the grave').toBeNull();
    expect(b.botStuckAt).toBeUndefined();
    expect([-1, 0, 1]).toContain(b.botLifeSeed);
    expect(b.botFreshUntil ?? 0, 'no fresh-life window opened').toBeGreaterThan(w.time);
  });
});

describe('ride appetite (Robert: "when they respawn… grab a vehicle if it\'s there")', () => {
  it('a fresh spawn with a long walk aims for the free bike, not the old jog', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    w.spawn(b);
    b.pos = { x: -60, y: 0, z: 0 };
    b.botLifeSeed = 1; // a shopping life
    b.botFreshUntil = w.time + 8;
    b.botGoal = null; b.botRepathAt = 0;
    // a free fast ride 12u away, roughly toward nothing in particular
    const bike = w.spawnVehicle('bike', 0, { x: -48, y: 0, z: 6 });
    bike.alive = true;
    // clear other soldiers so no target interferes
    for (const s of [...w.soldiers.values()]) if (s.id !== b.id) { s.alive = false; s.respawnAt = w.time + 999; }
    for (let i = 0; i < 30; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    // read through the map — the `= null` above narrows the local forever
    const g = w.soldiers.get(b.id)!.botGoal;
    expect(g, 'never repathed').toBeTruthy();
    const dToBike = Math.hypot(g!.x - bike.pos.x, g!.z - bike.pos.z);
    const dToGoal = Math.hypot(g!.x - objectiveFor(w, b).x, g!.z - objectiveFor(w, b).z);
    expect(dToBike, 'the fresh life ignored the free ride').toBeLessThan(dToGoal);
  });
});

describe('the driver gets a map (Robert: "go fast and just run into a wall")', () => {
  it('a walled-off driver routes AROUND — net progress instead of a wall kiss', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    // flatten a big arena, then build a wall segment between rider and goal
    const half = GRID / 2;
    for (let z = 2; z < GRID - 2; z++) for (let x = 2; x < GRID - 2; x++) w.map.grid[z * GRID + x] = 0;
    for (let z = half - 8; z <= half + 8; z++) w.map.grid[z * GRID + (half + 6)] = T_WALL;
    const b = w.addSoldier('D', 'infantry', 0, 'bot');
    for (const s of [...w.soldiers.values()]) if (s.id !== b.id) { s.alive = false; s.respawnAt = w.time + 999; }
    b.alive = true; b.pos = { x: 0, y: 0, z: 0 };
    const buggy = w.spawnVehicle('buggy', 0, { x: 0, y: 0, z: 0 });
    buggy.alive = true;
    // put the bot in the driver's seat directly
    buggy.seats[0] = b.id;
    b.vehicleId = buggy.id;
    b.seat = 0;
    b.enteredVehicleAt = w.time;
    b.botGoal = null; b.botRepathAt = 0;
    for (let i = 0; i < 60 * 10; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    // the old compass driver parked on the wall at x ≈ half+6 tiles ≈ +18 and
    // sat there; a navigating driver has cleared the wall line OR moved well
    // around it (net displacement says it never just idled against bricks)
    const moved = Math.hypot(buggy.pos.x, buggy.pos.z);
    expect(moved, 'the buggy never really went anywhere').toBeGreaterThan(14);
    const wallX = (half + 6) * 3 - 150; // tile → world (TILE=3, WORLD=300)
    const pinned = Math.abs(buggy.pos.x - wallX) < 2.5 && Math.abs(buggy.vel?.x ?? 0) < 0.5;
    expect(pinned, `parked against the wall at x=${buggy.pos.x.toFixed(1)}`).toBe(false);
  });
});

describe('room duty (Robert: "they should be able to sweep rooms inside")', () => {
  it('a guard life with the indoor salt posts INSIDE the house by the flag', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    const guard = w.addSoldier('G', 'heavy', 0, 'bot');
    guard.alive = true;
    guard.botLifeSeed = 1;
    const flag = w.mode.flags![0];
    // put a known house right by the flag — the branch must choose its heart
    w.map.houses.push({
      id: 999, center: { x: flag.pos.x + 8, y: 0, z: flag.pos.z + 4 },
      door: { x: flag.pos.x + 6, y: 0, z: flag.pos.z + 4 },
      tx: 0, tz: 0, tw: 4, th: 4,
    });
    const post = objectiveFor(w, guard);
    expect(Math.hypot(post.x - (flag.pos.x + 8), post.z - (flag.pos.z + 4)),
      'the guard ignored the room').toBeLessThan(0.5);
    // and a straight-salt life keeps the yard orbit — variety, not a rule
    guard.botLifeSeed = 0;
    const yard = objectiveFor(w, guard);
    expect(Math.hypot(yard.x - flag.pos.x, yard.z - flag.pos.z)).toBeLessThan(9);
  });
});
