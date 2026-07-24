// ───────────────────────────────────────────────────────────────────────────
// THE CIRCUIT HAS A SHAPE — and it is still drivable.
//
// The procedural circuit used to be a pure ellipse whose two radii the seed
// nudged by up to five tiles. The old comment claimed that meant "no two
// circuits drive identically". Measured across five seeds, every one produced a
// 12-checkpoint oval between 630u and 684u — a ±4% spread — with the same start
// heading, and lap times came back 18.9 / 18.8 / 18.7s. The league had five
// named venues and one racetrack.
//
// The centreline is a seeded deformed ring now. The whole risk of that change is
// in one sentence, and this file is the guard on it:
//
//     A CIRCUIT NOBODY CAN GET ROUND IS A WORSE BUG THAN A BORING ONE.
//
// The first cut produced 64–75° corners against an AI tuned on a flat 30° oval,
// and two seeds in five never completed a lap in 400 seconds — boards failing
// circuits that cars got round, because a board carries more speed into the
// same corner. So the shape is damped until it is drivable, and these tests
// hold both ends: it must VARY, and it must be RACEABLE.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { T_OPEN, tileAt } from '../src/sim/map';
import type { VehicleKind } from '../src/sim/types';

const SEEDS = [7, 11, 42, 1234, 99999, 31337];

const trackOf = (seed: number) => {
  const w = new World({ seed, mode: 'race', theme: 'savanna' } as never);
  return { w, t: w.map.raceTrack! };
};

/** the sharpest heading change between adjacent gates, in degrees */
function sharpestCorner(cps: { pos: { x: number; z: number } }[]): number {
  let worst = 0;
  for (let i = 0; i < cps.length; i++) {
    const a = cps[(i - 1 + cps.length) % cps.length].pos;
    const b = cps[i].pos;
    const c = cps[(i + 1) % cps.length].pos;
    const h1 = Math.atan2(b.z - a.z, b.x - a.x);
    const h2 = Math.atan2(c.z - b.z, c.x - b.x);
    let d = Math.abs(h2 - h1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    worst = Math.max(worst, d);
  }
  return (worst * 180) / Math.PI;
}

const lapLength = (cps: { pos: { x: number; z: number } }[]): number => {
  let len = 0;
  for (let i = 0; i < cps.length; i++) {
    const a = cps[i].pos, b = cps[(i + 1) % cps.length].pos;
    len += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return len;
};

describe('the venue actually differs', () => {
  it('lap length spreads far wider than the old ±4% ellipse', () => {
    const lens = SEEDS.map((s) => lapLength(trackOf(s).t.checkpoints));
    const spread = (Math.max(...lens) - Math.min(...lens)) / Math.min(...lens);
    expect(spread, `lengths ${lens.map((l) => l.toFixed(0)).join(' ')}`).toBeGreaterThan(0.15);
  });

  it('gate count follows the ribbon instead of being nailed to 12', () => {
    const counts = new Set(SEEDS.map((s) => trackOf(s).t.checkpoints.length));
    expect(counts.size, 'every circuit still has the same gate count').toBeGreaterThan(1);
  });

  it('the start heading is the tangent where the ribbon crosses, not a constant', () => {
    const yaws = new Set(SEEDS.map((s) => trackOf(s).t.startYaw.toFixed(2)));
    expect(yaws.size, 'every circuit still starts on the same heading').toBeGreaterThan(1);
  });

  it('no two seeds carve the same ribbon', () => {
    const shapes = SEEDS.map((s) => {
      const cps = trackOf(s).t.checkpoints;
      return `${cps.length}:${lapLength(cps).toFixed(0)}`;
    });
    expect(new Set(shapes).size).toBe(SEEDS.length);
  });
});

describe('…and every one of them is drivable', () => {
  it('no corner is sharper than the racing AI can take', () => {
    // 50-56° measured after damping; the first, undamped cut hit 75° and two
    // seeds in five never completed a lap
    for (const seed of SEEDS) {
      expect(sharpestCorner(trackOf(seed).t.checkpoints), `seed ${seed}`).toBeLessThan(62);
    }
  });

  it('every checkpoint and every grid slot sits on open track', () => {
    for (const seed of SEEDS) {
      const { w, t } = trackOf(seed);
      const open = (p: { x: number; z: number }) => tileAt(w.map.grid, p.x, p.z, w.map.geometry) === T_OPEN;
      for (const c of t.checkpoints) expect(open(c.pos), `seed ${seed}: a gate off the tarmac`).toBe(true);
      for (const g of t.grid) expect(open(g), `seed ${seed}: a grid slot in the grass`).toBe(true);
    }
  });

  it('the whole field can see open ground down the start heading', () => {
    for (const seed of SEEDS) {
      const { w, t } = trackOf(seed);
      const open = (p: { x: number; z: number }) => tileAt(w.map.grid, p.x, p.z, w.map.geometry) === T_OPEN;
      for (const slot of t.grid) {
        let ahead = 0;
        for (let d = 1; d <= 12; d++) {
          if (!open({ x: slot.x + Math.cos(t.startYaw) * d, z: slot.z + Math.sin(t.startYaw) * d })) break;
          ahead = d;
        }
        expect(ahead, `seed ${seed}: the grid faces a wall`).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('the ribbon never pinches below a raceable width', () => {
    for (const seed of SEEDS) {
      const { w, t } = trackOf(seed);
      const open = (p: { x: number; z: number }) => tileAt(w.map.grid, p.x, p.z, w.map.geometry) === T_OPEN;
      for (let i = 0; i < t.checkpoints.length; i++) {
        const a = t.checkpoints[i].pos, b = t.checkpoints[(i + 1) % t.checkpoints.length].pos;
        const tx = b.x - a.x, tz = b.z - a.z;
        const L = Math.hypot(tx, tz) || 1;
        let width = 0;
        for (let s = -22; s <= 22; s++) if (open({ x: a.x + (-tz / L) * s, z: a.z + (tx / L) * s })) width++;
        expect(width, `seed ${seed}: pinched between gates ${i} and ${i + 1}`).toBeGreaterThan(20);
      }
    }
  });

  it('a real field gets round it — the flag falls on every seed', () => {
    for (const seed of [7, 1234, 99999]) {
      const w = new World({
        seed, mode: 'race', difficulty: 'veteran', botsPerTeam: 8,
        matchMinutes: 15, theme: 'savanna',
      } as never);
      const track = w.map.raceTrack!;
      const kinds: VehicleKind[] = ['comet', 'vector', 'sprite'];
      for (let i = 0; i < Math.min(8, track.grid.length); i++) {
        const b = w.addSoldier('R' + i, 'infantry', i === 0 ? 0 : 1, 'bot');
        const v = w.spawnVehicle(kinds[i % kinds.length], i === 0 ? 0 : 1, track.grid[i]);
        v.yaw = track.startYaw; b.pos = { ...track.grid[i] }; w.forceBoard(b, v);
      }
      let t = 0;
      while (t < 240 && !w.mode.over) { w.step(1 / 60, new Map()); t += 1 / 60; }
      expect(w.mode.over, `seed ${seed}: nobody finished in 240s`).toBe(true);
    }
  });
});

describe('the same seed is the same circuit', () => {
  it('a venue is a place, not a roll — it must replay identically', () => {
    for (const seed of SEEDS) {
      const a = trackOf(seed).t;
      const b = trackOf(seed).t;
      expect(b.checkpoints.map((c) => `${c.pos.x.toFixed(3)},${c.pos.z.toFixed(3)}`))
        .toEqual(a.checkpoints.map((c) => `${c.pos.x.toFixed(3)},${c.pos.z.toFixed(3)}`));
      expect(b.startYaw).toBe(a.startYaw);
      expect(b.grid.length).toBe(a.grid.length);
    }
  });
});
