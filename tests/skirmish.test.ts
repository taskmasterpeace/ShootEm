// ---------------------------------------------------------------------------
// THE SKIRMISH LAWS — every biome's hunt ground answers the six front laws,
// carries its LSW DEN and two named supports, and rolls deterministically.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { generateSkirmishMap } from '../src/sim/skirmish';
import { validateDoc, type MakerDoc } from '../src/sim/mapedit';
import { GRID, T_DEEP, T_WALL, S_ICE, S_PLATE, type GameMap } from '../src/sim/map';
import { THEMES } from '../src/sim/data';
import { Rng } from '../src/sim/rng';
import type { ThemeId } from '../src/sim/types';

const THEME_IDS = Object.keys(THEMES) as ThemeId[];
const SEEDS = [7, 42, 1337, 90210];

/** a minimal doc wrapper so validateDoc can patrol a skirmish map */
const asDoc = (map: GameMap): MakerDoc => ({
  frontId: null, size: 'small', seed: map.seed, mode: 'tdm', map,
  claims: map.propCovered.map((idx) => ({ idx, t: map.grid[idx] })),
  rng: new Rng(map.seed), undoStack: [], redoStack: [],
});

describe('the skirmish builder', () => {
  it.each(THEME_IDS.flatMap((t) => SEEDS.map((s) => `${t}:${s}`)))('%s — LAWFUL ground (the six front laws)', (key) => {
    const [theme, seed] = key.split(':') as [ThemeId, string];
    const map = generateSkirmishMap(theme, Number(seed));
    const report = validateDoc(asDoc(map));
    expect(report.ok, `${key} breaks laws: ${report.issues.map((i) => `${i.law}(${i.detail})`).join(' · ')}`).toBe(true);
  });

  it.each(THEME_IDS)('%s — the hunt has its DEN and two named supports', (theme) => {
    const map = generateSkirmishMap(theme, 4207);
    // the den exists, is a building, and sits at the heart
    const den = map.houses.find((h) => Math.abs(h.tx - 46) <= 2 && Math.abs(h.tz - 46) <= 3);
    expect(den, `${theme}: the LSW den is gone`).toBeTruthy();
    // control points: LSW DEN + two supports
    expect(map.controlPoints.length).toBe(3);
    expect(map.controlPoints[0].name).toBe('LSW DEN');
    expect(map.controlPoints[0].name).not.toBe(map.controlPoints[1].name);
    // two squad bases with light kit only
    expect(map.vehiclePads.every((v) => ['bike', 'buggy', 'ambulance'].includes(v.kind))).toBe(true);
    expect(map.vehiclePads.length).toBe(6);
  });

  it.each(THEME_IDS)('%s — same seed, same ground (the roll is a promise)', (theme) => {
    const a = generateSkirmishMap(theme, 5150);
    const b = generateSkirmishMap(theme, 5150);
    expect(Buffer.from(a.grid).equals(Buffer.from(b.grid))).toBe(true);
    expect(Buffer.from(a.surface).equals(Buffer.from(b.surface))).toBe(true);
    expect(a.controlPoints.map((c) => c.name).join()).toBe(b.controlPoints.map((c) => c.name).join());
  });

  it('the biomes READ different — each theme leaves its fingerprint', () => {
    const count = (m: GameMap, t: number) => [...m.grid].filter((v) => v === t).length;
    const surfCount = (m: GameMap, s: number) => [...m.surface].filter((v) => v === s).length;
    const starship = generateSkirmishMap('starship', 4207);
    const triton = generateSkirmishMap('triton', 4207);
    const europa = generateSkirmishMap('europa', 4207);
    const asteroid = generateSkirmishMap('asteroid', 4207);
    expect(surfCount(starship, S_PLATE) / (GRID * GRID)).toBeGreaterThan(0.3);  // the deck is plate
    expect(surfCount(triton, S_ICE) / (GRID * GRID)).toBeGreaterThan(0.5);      // the floe is ice
    expect(count(europa, T_DEEP)).toBeGreaterThan(30);                          // the channel is real
    expect(count(asteroid, T_WALL) / (GRID * GRID)).toBeGreaterThan(0.55);      // carved from rock
    // and no two themes build the same ground
    expect(Buffer.from(starship.grid).equals(Buffer.from(triton.grid))).toBe(false);
  });
});
