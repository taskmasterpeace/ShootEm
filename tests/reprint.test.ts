// ---------------------------------------------------------------------------
// §21 The Reprint (v1 slice): dying doesn't end you — the base prints a fresh
// sleeve and sends it back out. The word is client-side ("REPRINTED" on the
// announce overlay); the visual anchor is SIM-side and testable: exactly ONE
// clone-bay pod per team base on every standard battlefield, standing by the
// spawn ring, claiming its tile the same way every prop does — so the
// invisible-wall law (tests/walls.test.ts) keeps holding with the bay afield.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/sim/data';
import { GRID, T_COVER, TILE, WORLD, generateMap, type PropSpec } from '../src/sim/map';
import type { ThemeId } from '../src/sim/types';

const SEEDS = [1, 7, 42, 1234, 987654];
const themes = Object.keys(THEMES) as ThemeId[];

const tileIdx = (x: number, z: number) =>
  Math.floor((z + WORLD / 2) / TILE) * GRID + Math.floor((x + WORLD / 2) / TILE);

describe('§21 the reprint: clone bays', () => {
  it('every standard map stands exactly one clone bay per team base', () => {
    for (const theme of themes) {
      for (const seed of SEEDS) {
        const m = generateMap(seed, 'tdm', theme);
        const bays = m.props.filter((p) => p.type === 'clone_bay');
        expect(bays.length, `${theme} seed ${seed}: two bases, two printers`).toBe(2);
        for (const side of [0, 1] as const) {
          const near = bays.filter((b) =>
            Math.hypot(b.pos.x - m.basePos[side].x, b.pos.z - m.basePos[side].z) <= TILE * 6);
          expect(near.length, `${theme} seed ${seed}: base ${side} owns one bay`).toBe(1);
        }
      }
    }
  });

  it('the bay claims its tile — blocking geometry with a visual owner (walls law)', () => {
    for (const theme of themes) {
      for (const seed of SEEDS) {
        const m = generateMap(seed, 'tdm', theme);
        for (const bay of m.props.filter((p) => p.type === 'clone_bay')) {
          const idx = tileIdx(bay.pos.x, bay.pos.z);
          // armored glass: stops boots and bullets, not eyes — T_COVER
          expect(m.grid[idx], `${theme} seed ${seed}: bay tile must block`).toBe(T_COVER);
          expect(m.propCovered, `${theme} seed ${seed}: bay tile must be claimed`).toContain(idx);
        }
      }
    }
  });

  it('bays never stand ON a spawn point — beside the ring, not in it', () => {
    const m = generateMap(42, 'tdm', 'savanna');
    for (const bay of m.props.filter((p) => p.type === 'clone_bay')) {
      for (const side of [0, 1] as const) {
        for (const sp of m.spawns[side]) {
          expect(tileIdx(sp.x, sp.z)).not.toBe(tileIdx(bay.pos.x, bay.pos.z));
        }
      }
    }
  });

  it('clone_bay round-trips through PropSpec (the wire carries the fiction)', () => {
    const m = generateMap(7, 'tdm', 'savanna');
    const bay = m.props.find((p) => p.type === 'clone_bay');
    expect(bay).toBeTruthy();
    const rt = JSON.parse(JSON.stringify(bay)) as PropSpec;
    expect(rt.type).toBe('clone_bay');
    expect(rt.pos).toEqual(bay!.pos);
    expect(rt.scale).toBe(bay!.scale);
    expect(rt.rot).toBe(bay!.rot);
  });

  it('the safehouse neighborhood has no army printer', () => {
    const m = generateMap(42, 'safehouse');
    expect(m.props.some((p) => p.type === 'clone_bay')).toBe(false);
  });
});
