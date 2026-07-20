// ---------------------------------------------------------------------------
// V5 ARMOR COUNTRY (Robert: "certain maps should have a lot of tanks, because
// our vehicle combat is very good"). A map shaped so armour and aircraft can
// MANOEUVRE — long lanes, few walls, no interiors to get wedged in.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/sim/data';
import { GRID, T_WALL, generateMap, isBlocked } from '../src/sim/map';

const hardpan = (seed = 42) => generateMap(seed, 'tdm', 'hardpan');

describe('V5 — the Hardpan', () => {
  it('it is its own theme with its own generator', () => {
    expect(THEMES.hardpan.gen).toBe('armor');
  });

  it('OPEN GROUND: markedly fewer walls than the standard field', () => {
    const wallsIn = (m: { grid: Uint8Array }) => {
      let n = 0;
      for (let i = 0; i < m.grid.length; i++) if (m.grid[i] === T_WALL) n++;
      return n;
    };
    const armor = wallsIn(hardpan());
    const field = wallsIn(generateMap(42, 'tdm', 'savanna'));
    expect(armor, 'armour country must be more open than the savanna').toBeLessThan(field);
  });

  it('LONG FIRE LANES: you can see a long way across it', () => {
    // walk the centre line and measure the longest unbroken open run
    const m = hardpan();
    const z = Math.floor(GRID / 2);
    let best = 0, run = 0;
    for (let x = 2; x < GRID - 2; x++) {
      const blocked = m.grid[z * GRID + x] === T_WALL;
      run = blocked ? 0 : run + 1;
      best = Math.max(best, run);
    }
    expect(best, 'no lane worth driving down').toBeGreaterThan(GRID * 0.35);
  });

  it('THE HEAVY POOL: more tanks and more AA than a normal map', () => {
    const m = hardpan();
    const std = generateMap(42, 'tdm', 'savanna');
    const count = (map: typeof m, kind: string, team: number) =>
      map.vehiclePads.filter((p) => p.kind === kind && p.team === team).length;
    for (const team of [0, 1]) {
      expect(count(m, 'tank', team), 'armour country runs extra tanks')
        .toBeGreaterThan(count(std, 'tank', team));
      expect(count(m, 'aatrack', team), 'and extra answers above them')
        .toBeGreaterThan(count(std, 'aatrack', team));
    }
  });

  it('every pad — including the surge armour — sits on open ground', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const m = hardpan(seed);
      const bad = m.vehiclePads.filter((p) => isBlocked(m.grid, p.pos.x, p.pos.z));
      expect(bad.map((p) => p.kind), `seed ${seed}`).toEqual([]);
    }
  });

  it('the whole air program can actually field here', () => {
    const m = hardpan();
    for (const kind of ['strikejet', 'interceptor', 'bomber', 'aatrack'] as const) {
      expect(m.vehiclePads.some((p) => p.kind === kind), `no ${kind} pad`).toBe(true);
    }
  });
});
