// ───────────────────────────────────────────────────────────────────────────
// A CITY HAS AN ARCADE.
//
// Cabinets became usable two cycles ago and visible one cycle ago — but they
// existed in exactly one place, Vanessa's pro shop, so you could play a whole
// campaign without ever meeting one. A walk-up console you never walk up to is
// a feature nobody has.
//
// They belong where people are. The city grows shops; a shop in this war puts a
// machine in the corner.
//
// Two things went wrong on the way here and both are worth keeping written
// down, because both failed SILENTLY:
//
//   · The first placement guessed a single tile (`lot.z + 1`) and that tile is
//     the shopfront WALL every time — buildings are stamped with their walls on
//     the lot boundary. Zero cabinets, no error.
//   · Rolling 34% for every shop put one in roughly every other city (measured
//     rolls: 0.427 / 0.975 / 0.371). Still nearly nothing, still no error.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { generateFront } from '../src/sim/fronts';
import { T_OPEN, tileAt } from '../src/sim/map';
import { CARTRIDGES } from '../src/client/gonet/cartridges';
import { isPlayable } from '../src/client/gonet/cartridge-games';
import { World } from '../src/sim/world';

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const cities = () => SEEDS.map((s) => generateFront('the_city', s)!).filter(Boolean);

describe('the city puts machines in its shops', () => {
  it('every city has at least one — not every OTHER city', () => {
    for (const m of cities()) {
      expect(m.arcades?.length ?? 0, 'a city with nowhere to play').toBeGreaterThan(0);
    }
  });

  it('a big city can have a row', () => {
    const counts = cities().map((m) => m.arcades!.length);
    expect(Math.max(...counts), 'every city has exactly one machine').toBeGreaterThan(1);
  });

  it('every cabinet stands on ground a man can stand on', () => {
    // the silent failure this replaces: a single guessed tile landed in the
    // shopfront masonry every time, and nothing anywhere said so
    for (const m of cities()) {
      for (const c of m.arcades!) {
        expect(tileAt(m.grid, c.pos.x, c.pos.z, m.geometry), `${c.name} is inside a wall`).toBe(T_OPEN);
      }
    }
  });

  it('two machines in one city are two machines you can tell apart', () => {
    for (const m of cities()) {
      const a = m.arcades!;
      for (let i = 0; i < a.length; i++) {
        for (let j = i + 1; j < a.length; j++) {
          const d = Math.hypot(a[i].pos.x - a[j].pos.x, a[i].pos.z - a[j].pos.z);
          expect(d, 'you could not tell which one you were at').toBeGreaterThan(World.ARCADE_REACH);
        }
      }
    }
  });

  it('every machine runs a cartridge that actually exists and actually plays', () => {
    for (const m of cities()) {
      for (const c of m.arcades!) {
        expect(CARTRIDGES.some((x) => x.id === c.cart), `${c.cart} is not a cartridge`).toBe(true);
        expect(isPlayable(c.cart as never), `${c.name} is a dead machine`).toBe(true);
        expect(c.name.length).toBeGreaterThan(2);
      }
    }
  });

  it('the city puts more than one TITLE about — not the same game everywhere', () => {
    const titles = new Set(cities().flatMap((m) => m.arcades!.map((c) => c.cart)));
    expect(titles.size).toBeGreaterThan(1);
  });
});

describe('a city is the same city every time', () => {
  it('same seed, same machines in the same corners', () => {
    for (const seed of [1, 5, 9]) {
      const a = generateFront('the_city', seed)!.arcades!;
      const b = generateFront('the_city', seed)!.arcades!;
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
  });
});

describe('a front with no shops is simply a front with no arcade', () => {
  it('the other grounds carry the field, not a crash', () => {
    for (const id of ['bridge_delta', 'highland_pass', 'the_mine']) {
      const m = generateFront(id, 3);
      expect(m, `${id} failed to generate`).toBeTruthy();
      // no shops out here — the field must simply have nothing, never break
      expect(Array.isArray(m!.arcades)).toBe(true);
    }
  });
});
