// ---------------------------------------------------------------------------
// THE BLACK BOX — the crowd flight recorder must actually catch the failure
// modes it was built for (Robert: "put the tools in there so next time it
// happens, you'll be able to diagnose it"). Two rigged scenes: a body walled
// into a pocket (wants to move, can't — the stuck signature) and a fireteam
// penned shoulder-to-shoulder (the knot signature). Both must file incidents
// with named members; the samples must carry the near-base pooling count.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { BB_SAMPLE_EVERY, BB_BASE_R } from '../src/sim/blackbox';
import { GRID, T_OPEN, T_WALL, TILE, WORLD } from '../src/sim/map';
import { World } from '../src/sim/world';

const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;
const DT = 1 / 30;
const run = (w: World, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) w.step(DT, new Map());
};

/** Carve an open pocket of `half`-tile radius ringed by walls, centered on (cx, cz). */
function carvePen(w: World, cx: number, cz: number, half: number) {
  for (let dz = -half - 1; dz <= half + 1; dz++)
    for (let dx = -half - 1; dx <= half + 1; dx++) {
      const wall = Math.abs(dx) > half || Math.abs(dz) > half;
      w.map.grid[(cz + dz) * GRID + (cx + dx)] = wall ? T_WALL : T_OPEN;
    }
}

describe('the black box (crowd flight recorder)', () => {
  it('files a STUCK incident for a body that commands speed but cannot move', () => {
    const w = new World({ seed: 21, mode: 'tdm', matchMinutes: 15 });
    const s = w.addSoldier('Walled', 'infantry', 0, 'bot');
    // a 1-tile pocket: open ground under the boots, walls on every side — the
    // bot wants its objective, every step is vetoed, the legs keep pumping
    carvePen(w, 60, 40, 0);
    s.pos = { x: toWorld(60), y: 0, z: toWorld(40) };

    run(w, BB_SAMPLE_EVERY * 5 + 1); // enough samples for the persistence gate
    const stuck = w.blackbox.incidents.filter((i) => i.kind === 'stuck');
    expect(stuck.length, 'no stuck incident filed').toBeGreaterThan(0);
    expect(stuck[0].members[0].name).toBe('Walled');
    expect(stuck[0].members[0].spd).toBeGreaterThan(3);   // commanding speed
    expect(stuck[0].members[0].disp).toBeLessThan(0.6);   // going nowhere
    expect(stuck[0].members[0].blocked).toBe(false);      // pocket floor is open — not a statue
  });

  it('files a KNOT incident when a fireteam persists shoulder-to-shoulder', () => {
    const w = new World({ seed: 22, mode: 'tdm', matchMinutes: 15 });
    // five bots penned on a SINGLE open tile (3x3u): separation cannot spread
    // them past the walls, so at least four bodies stay under 2u apart
    carvePen(w, 30, 60, 0);
    for (let i = 0; i < 5; i++) {
      const b = w.addSoldier(`Pen${i}`, 'infantry', 0, 'bot');
      b.pos = { x: toWorld(30) + (i % 2) * 0.8 - 0.4, y: 0, z: toWorld(60) + Math.floor(i / 2) * 0.8 - 0.8 };
    }
    run(w, BB_SAMPLE_EVERY * 6 + 1);
    const knots = w.blackbox.incidents.filter((i) => i.kind === 'knot' && i.team === 0);
    expect(knots.length, 'no knot incident filed').toBeGreaterThan(0);
    expect(knots[0].members.length).toBeGreaterThanOrEqual(4);
    expect(knots[0].members.map((m) => m.name).join()).toContain('Pen');
  });

  it('samples the near-base pooling count Robert watches for', () => {
    const w = new World({ seed: 23, mode: 'tdm', matchMinutes: 15 });
    const base = w.map.basePos[0];
    const home = w.addSoldier('Homebody', 'infantry', 0, 'bot');
    home.dummy = true;
    home.pos = { x: base.x + 2, y: 0, z: base.z + 2 };
    const away = w.addSoldier('Roamer', 'infantry', 0, 'bot');
    away.dummy = true;
    away.pos = { x: base.x + BB_BASE_R + 30, y: 0, z: base.z };

    run(w, BB_SAMPLE_EVERY + 0.5);
    const last = w.blackbox.samples.at(-1)!;
    expect(last.teams[0].n).toBe(2);
    expect(last.teams[0].nearBase).toBe(1); // Homebody in, Roamer out
  });

  it('exposes vehicle telemetry beside crowd diagnostics', () => {
    const w = new World({ seed: 24, mode: 'tdm', matchMinutes: 15 });
    expect(w.blackbox.vehicles).toBe(w.vehicleTelemetry);
    run(w, BB_SAMPLE_EVERY + 0.5);
    expect(w.blackbox.vehicles.samples.length).toBeGreaterThan(0);
  });
});
