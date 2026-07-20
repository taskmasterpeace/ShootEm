// ---------------------------------------------------------------------------
// Invisible walls: never again. The generator records EXACTLY which tiles a
// prop's mesh visually stands in for (map.propCovered) and prunes any claim a
// later stamp overwrote; the renderer skips that set and nothing else. These
// tests enforce the invariant that made the bug possible to kill permanently:
//
//   every blocking tile is either instanced by the renderer (not claimed)
//   or visually owned by a real prop standing on it (claimed).
//
// If a future generator change stamps collision without a visual owner, or
// leaves a stale claim, this file fails before any player walks into air.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/sim/data';
import { GRID, T_CLIMB, T_COVER, T_DEEP, T_DOOR, T_DOOR_OPEN, T_GRASS, T_LADDER, T_METAL, T_OPEN, T_SLIT, T_WALL, T_WATER, TILE, WORLD, generateMap } from '../src/sim/map';
import type { ThemeId } from '../src/sim/types';

const SEEDS = [1, 7, 42, 1234, 987654];
const themes = Object.keys(THEMES) as ThemeId[];

const tileCenter = (idx: number) => ({
  x: ((idx % GRID) + 0.5) * TILE - WORLD / 2,
  z: (Math.floor(idx / GRID) + 0.5) * TILE - WORLD / 2,
});

/** How far from a prop's center its mesh visually reaches, per type.
 *  rock: its stamped disc (scale = r·1.6 by generator contract) plus
 *  half-tile slop; tree/crate/clone_bay: their own tile; bunker claims
 *  nothing. The clone bay (§21) stands dead-center on its one claimed tile.
 *
 *  THE FARM LANDMARKS. A barn or farmhouse straddles a 2×2 claim and is
 *  placed on the four tiles' SHARED CORNER, so it is 2.13u from each tile
 *  center — a point-sized default fails it. The reach is real, not slack:
 *  props.ts fits a barn to 6u wide and a farmhouse to 7u, so the mesh spans
 *  ±3u from that corner while the tile centers sit at ±1.5u. It covers them.
 *  The single-tile towers stand dead-center on their one claimed tile and
 *  only ever passed because 0 ≤ 0; say so out loud instead. */
const visualReach = (type: string, scale: number) =>
  type === 'rock' ? (scale / 1.6) * TILE + TILE * 0.5 :
  type === 'tree' || type === 'crate' || type === 'clone_bay' ? TILE * 0.75 :
  type === 'barn' || type === 'farmhouse' ? TILE :
  type === 'silo_farm' || type === 'windmill' || type === 'watertower' ? TILE * 0.5 : 0;

const allMaps = () => {
  const maps = [];
  for (const theme of themes)
    for (const seed of SEEDS) maps.push(generateMap(seed, 'tdm', theme));
  for (const seed of SEEDS) maps.push(generateMap(seed, 'safehouse'));
  return maps;
};

describe('invisible walls: the render-coverage invariant', () => {
  it('every settled claim sits on a live blocking tile — no stale claims', () => {
    for (const m of allMaps()) {
      for (const idx of m.propCovered) {
        const t = m.grid[idx];
        expect(t === T_WALL || t === T_COVER, `${m.theme} seed ${m.seed}: claim on non-blocking tile ${idx} (t=${t})`).toBe(true);
      }
    }
  });

  it('every claimed tile has a prop physically standing on it', () => {
    for (const m of allMaps()) {
      for (const idx of m.propCovered) {
        const c = tileCenter(idx);
        const owned = m.props.some((p) =>
          Math.hypot(p.pos.x - c.x, p.pos.z - c.z) <= visualReach(p.type, p.scale));
        expect(owned, `${m.theme} seed ${m.seed}: claimed tile ${idx} has no prop within visual reach`).toBe(true);
      }
    }
  });

  it('the grid speaks only known tile types — new types must enroll here AND in the renderer', () => {
    const known = new Set([T_OPEN, T_WALL, T_COVER, T_WATER, T_DEEP, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL, T_LADDER, T_CLIMB, T_GRASS]); // slits: stacked boxes · doors: live slabs · metal: steel instancing · ladders: rail+rung mesh (walkable ground) · climb: 2.5u barricade with grab-lip
    for (const m of allMaps()) {
      for (let i = 0; i < m.grid.length; i++) {
        if (!known.has(m.grid[i])) {
          throw new Error(`${m.theme} seed ${m.seed}: unknown tile type ${m.grid[i]} at ${i} — add a render rule (renderer falls back to a wall box, but decide on purpose)`);
        }
      }
    }
  });

  it('claims are deterministic — every client renders the same battlefield', () => {
    for (const theme of themes) {
      const a = generateMap(42, 'tdm', theme);
      const b = generateMap(42, 'tdm', theme);
      expect(a.propCovered).toEqual(b.propCovered);
    }
  });

  it('maps with props actually record claims (the pipeline is alive)', () => {
    const sav = generateMap(42, 'tdm', 'savanna');
    expect(sav.propCovered.length).toBeGreaterThan(0);
    const hood = generateMap(42, 'safehouse');
    expect(hood.props.length).toBeGreaterThan(0); // and its claims settle without error
  });
});
