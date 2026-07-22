// ---------------------------------------------------------------------------
// NEW THROWN TECH (Robert): the singularity grenade, the plasma stick, and the
// planted time bomb. Each is built on shipped substrate — force-fields, the
// pendingBlasts scheduler, projectile attach, gadgets — so it stays
// deterministic and cheap. Enemies here are HUMANS (no bot brain) so the only
// force on them is the one under test.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { isBlocked } from '../src/sim/map';
import type { Mine } from '../src/sim/types';
import { World } from '../src/sim/world';

const step = (w: World, secs: number) => {
  for (let i = 0; i < Math.round(secs * 60); i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
};

describe('grav grenade — the singularity', () => {
  it('the gravity well YANKS enemies toward the epicenter', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const t = w.addSoldier('T', 'infantry', 0, 'human'); t.pos = { x: 40, y: 0, z: 40 };
    const e1 = w.addSoldier('E1', 'infantry', 1, 'human'); e1.pos = { x: 5, y: 0, z: 0 };
    const e2 = w.addSoldier('E2', 'infantry', 1, 'human'); e2.pos = { x: -4, y: 0, z: 3 };
    const d1 = Math.hypot(e1.pos.x, e1.pos.z), d2 = Math.hypot(e2.pos.x, e2.pos.z);
    // open the well exactly as the grav payload does
    w.forceFields.push({ x: 0, z: 0, r: 6.5, radial: -16, team: 0, ownerId: t.id, until: w.time + 1.2 });
    step(w, 1.0);
    expect(Math.hypot(e1.pos.x, e1.pos.z), 'E1 dragged inward').toBeLessThan(d1 - 1);
    expect(Math.hypot(e2.pos.x, e2.pos.z), 'E2 dragged inward').toBeLessThan(d2 - 1);
  });

  it('a scheduled blast fires on its clock, not before (pendingBlasts)', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const o = w.addSoldier('O', 'infantry', 0, 'human'); o.pos = { x: 40, y: 0, z: 0 };
    const e = w.addSoldier('E', 'infantry', 1, 'human'); e.pos = { x: 0, y: 0, z: 0 }; e.armor = 0;
    const hp0 = e.hp;
    w.pendingBlasts.push({ x: 0, y: 0, z: 0, at: w.time + 1.0, weapon: 'grav_nade', ownerId: o.id, team: 0 });
    step(w, 0.5);
    expect(e.hp, 'still ticking — no boom yet').toBe(hp0);
    step(w, 0.8);
    expect(e.hp, 'the implosion collapsed on the pile').toBeLessThan(hp0);
    expect(w.pendingBlasts.length, 'the blast is spent, not re-firing').toBe(0);
  });

  it('throwing a grav_nade opens a well where it lands (payload wiring)', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const t = w.addSoldier('T', 'infantry', 0, 'human'); t.pos = { x: 0, y: 0, z: 0 }; t.yaw = 0;
    w.throwProjectile(t, 'grav_nade', 1.4, 16, true, 20, 1, true);
    let welled = false;
    for (let i = 0; i < 240 && !welled; i++) {
      w.step(1 / 60, new Map());
      for (const ev of w.takeEvents()) if (ev.type === 'grav_well') welled = true;
    }
    expect(welled, 'the singularity opened').toBe(true);
    expect(w.pendingBlasts.length, 'and armed its implosion').toBeGreaterThan(0);
  });
});

describe('time bomb — the demolition timer', () => {
  it('beeps down a fuse, gives a flee window, then LEVELS the room', () => {
    const w = new World({ seed: 4, mode: 'tdm', matchMinutes: 10 });
    const o = w.addSoldier('O', 'infantry', 0, 'human'); o.pos = { x: 40, y: 0, z: 0 };
    const e = w.addSoldier('E', 'infantry', 1, 'human'); e.pos = { x: 3, y: 0, z: 0 }; e.armor = 0;
    const g = w.spawnGadget('time_bomb', 0, o.id, { x: 0, y: 0, z: 0 }, 60, 4);
    const hp0 = e.hp;
    let beeps = 0;
    for (let i = 0; i < 60 * 3; i++) { w.step(1 / 60, new Map()); for (const ev of w.takeEvents()) if (ev.type === 'bomb_beep') beeps++; }
    expect(beeps, 'it telegraphs — the enemy is warned').toBeGreaterThan(3);
    expect(e.hp, 'the flee window: no damage while it counts down').toBe(hp0);
    for (let i = 0; i < 60 * 1.5; i++) w.step(1 / 60, new Map());
    expect(hp0 - e.hp, 'then the room comes down').toBeGreaterThan(40);
    expect(w.gadgets.has(g.id), 'the charge is spent').toBe(false);
  });

  it('shot to death, it cooks off where it stands', () => {
    const w = new World({ seed: 4, mode: 'tdm', matchMinutes: 10 });
    const o = w.addSoldier('O', 'infantry', 0, 'human'); o.pos = { x: 40, y: 0, z: 0 };
    const e = w.addSoldier('E', 'infantry', 1, 'human'); e.pos = { x: 3, y: 0, z: 0 }; e.armor = 0;
    w.spawnGadget('time_bomb', 0, o.id, { x: 0, y: 0, z: 0 }, 60, 8).hp = 0; // shot down
    const hp0 = e.hp;
    w.step(1 / 60, new Map());
    expect(e.hp, 'a struck charge cooks off early').toBeLessThan(hp0);
  });
});

describe('plasma grenade — the stick', () => {
  it('adheres to the body it grazes, rides it, then bursts on the fuse', () => {
    const w = new World({ seed: 6, mode: 'tdm', matchMinutes: 10 });
    const t = w.addSoldier('T', 'infantry', 0, 'human'); t.pos = { x: 0, y: 0, z: 0 }; t.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 1, 'human'); e.pos = { x: 6, y: 0, z: 0 }; e.armor = 0;
    // a flat throw straight down the barrel (the stick is proximity, not arc)
    w.throwProjectile(t, 'plasma_nade', 1.2, 22, false, 14, 1, false);
    let stuck = false;
    for (let i = 0; i < 60 && !stuck; i++) { w.step(1 / 60, new Map()); for (const ev of w.takeEvents()) if (ev.type === 'plasma_stick') stuck = true; }
    expect(stuck, 'it latched onto the body it grazed').toBe(true);
    const p = [...w.projectiles.values()].find((x) => x.stuckTo === e.id);
    expect(p, 'the charge is riding him, not detonated in flight').toBeTruthy();
    const hp0 = e.hp;
    for (let i = 0; i < 100; i++) w.step(1 / 60, new Map()); // let the ~1.3s fuse burn
    expect(hp0 - e.hp, 'the burst took the host it rode').toBeGreaterThan(0);
    expect([...w.projectiles.values()].some((x) => x.stuckTo === e.id), 'the charge is spent').toBe(false);
  });

  it('sticks where it LANDS on the ground — no bounce, no roll (Robert)', () => {
    const w = new World({ seed: 6, mode: 'tdm', matchMinutes: 10 });
    const t = w.addSoldier('T', 'infantry', 0, 'human'); t.pos = { x: 0, y: 0, z: 0 }; t.yaw = 0;
    w.throwProjectile(t, 'plasma_nade', 1.4, 18, true, 16, 1, false); // nobody in the way
    let p: { stuckPos?: { x: number; z: number } } | undefined;
    for (let i = 0; i < 240; i++) {
      w.step(1 / 60, new Map()); w.takeEvents();
      p = [...w.projectiles.values()][0];
      if (p?.stuckPos) break;
    }
    expect(p?.stuckPos, 'it clung to the ground where it landed').toBeTruthy();
    const lx = p!.stuckPos!.x, lz = p!.stuckPos!.z;
    for (let i = 0; i < 4; i++) w.step(1 / 60, new Map()); // it must NOT roll
    const still = [...w.projectiles.values()][0];
    expect(still && Math.hypot(still.pos.x - lx, still.pos.z - lz), 'stuck fast — no roll').toBeLessThan(0.2);
  });

  it('sticks to a WALL it flies into (no bounce)', () => {
    const w = new World({ seed: 6, mode: 'tdm', matchMinutes: 10 });
    // find an open spot with a wall a few units to its east (+x)
    let spot: { x: number; z: number } | undefined;
    for (let x = -120; x <= 116 && !spot; x += 2) {
      for (let z = -120; z <= 120; z += 2) {
        if (!isBlocked(w.map.grid, x, z) && !isBlocked(w.map.grid, x + 1, z) && isBlocked(w.map.grid, x + 4, z)) {
          spot = { x, z }; break;
        }
      }
    }
    expect(spot, 'the map has a wall to test against').toBeTruthy();
    const t = w.addSoldier('T', 'infantry', 0, 'human'); t.pos = { x: spot!.x, y: 0, z: spot!.z }; t.yaw = 0;
    w.throwProjectile(t, 'plasma_nade', 1.4, 22, false, 10, 1, false); // flat, straight at the wall
    let p: { stuckPos?: { x: number; z: number } } | undefined;
    for (let i = 0; i < 90; i++) {
      w.step(1 / 60, new Map()); w.takeEvents();
      p = [...w.projectiles.values()][0];
      if (p?.stuckPos) break;
    }
    expect(p?.stuckPos, 'it clung to the wall it met').toBeTruthy();
    // it stuck AT the wall (didn't pass through), on the near side
    expect(p!.stuckPos!.x, 'stopped at the wall face, not inside it').toBeLessThan(spot!.x + 4);
  });
});

describe('spider mine — the vulture', () => {
  it('lies dormant, wakes on approach, then skitters the enemy down', () => {
    const w = new World({ seed: 5, mode: 'tdm', matchMinutes: 10 });
    const o = w.addSoldier('O', 'engineer', 0, 'human'); o.pos = { x: 60, y: 0, z: 60 };
    const e = w.addSoldier('E', 'infantry', 1, 'human'); e.pos = { x: 20, y: 0, z: 0 }; e.armor = 0;
    const m: Mine = { id: 999001, team: 0, ownerId: o.id, pos: { x: 0, y: 0, z: 0 }, armedAt: 0, spider: true };
    w.mines.set(m.id, m);
    // enemy is FAR (20u > 11u wake) — the mine sleeps and does not move
    step(w, 0.5);
    expect(m.awake, 'far away: it sleeps').toBeFalsy();
    expect(m.pos.x, 'and does not budge').toBe(0);
    // prey strays into the wake radius
    e.pos = { x: 8, y: 0, z: 0 };
    let woke = false;
    for (let i = 0; i < 30 && !woke; i++) { w.step(1 / 60, new Map()); for (const ev of w.takeEvents()) if (ev.type === 'mine_wake') woke = true; }
    expect(woke, 'prey in range: it POPS').toBe(true);
    // it chases and detonates on the (stationary) enemy
    const hp0 = e.hp;
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map());
    expect(hp0 - e.hp, 'the vulture ran him down').toBeGreaterThan(0);
    expect(w.mines.has(m.id), 'the mine is spent on the kill').toBe(false);
  });
});
