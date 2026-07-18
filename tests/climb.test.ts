// ---------------------------------------------------------------------------
// §8.7 the CLIMB tier — obstacles as verbs. A T_CLIMB barricade is a 2.5u
// container wall: boots bounce off it, a running hop (apex ~1.1) bounces off
// it, but a jump trooper's jet carries OVER it. Shots follow the same law
// (blocked below the lip, clear above), the breacher eats it like any other
// structure, and the generator sprinkles a handful of climbable runs per
// battlefield — without ever going soft on a base perimeter.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/sim/data';
import {
  CLIMB_H, DRILL_EATS, GRID, T_CLIMB, T_METAL, T_OPEN, TILE, WORLD,
  blocksShot, generateMap, isBlocked, losClear,
} from '../src/sim/map';
import type { PlayerCmd, ThemeId } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;

function paint(w: World, cx: number, cz: number, r: number, tile: number) {
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) w.map.grid[(cz + dz) * GRID + cx + dx] = tile;
}

/** An open lane with a CLIMB barricade wall across it, and a soldier facing it. */
function barricadeLane(classId: 'infantry' | 'jump') {
  const w = new World({ seed: 3, mode: 'tdm' }); // savanna: honest 22 u/s² gravity
  const cx = Math.floor(GRID / 2) + 10, cz = Math.floor(GRID / 2);
  paint(w, cx, cz, 6, T_OPEN);
  for (let dz = -6; dz <= 6; dz++) w.map.grid[(cz + dz) * GRID + cx + 2] = T_CLIMB;
  const s = w.addSoldier('C', classId, 0, 'human');
  s.pos = { x: toWorld(cx), y: 0, z: toWorld(cz) };
  return { w, s, wallX: toWorld(cx + 2), farX: toWorld(cx + 3) };
}

describe('§8.7 CLIMB — movement: the lip decides who crosses', () => {
  it('blocks a grounded soldier dead', () => {
    const { w, s, wallX } = barricadeLane('infantry');
    for (let i = 0; i < 90; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
    expect(s.pos.x).toBeLessThan(wallX - 1); // parked at the face, not inside it
    expect(s.pos.y).toBe(0);
  });

  it('a regular soldier\'s hop does NOT clear it (apex ~1.1 < 2.5)', () => {
    const { w, s, wallX } = barricadeLane('infantry');
    let apex = 0;
    for (let i = 0; i < 150; i++) {
      w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1, jump: true })]]));
      apex = Math.max(apex, s.pos.y);
    }
    expect(apex).toBeGreaterThan(0.9);        // it DID hop (HOP tier is alive)
    expect(apex).toBeLessThan(CLIMB_H);       // but never reached the lip
    expect(s.pos.x).toBeLessThan(wallX - 1);  // and never crossed
  });

  it('a jump trooper mid-jetpack crosses it', () => {
    const { w, s, farX } = barricadeLane('jump');
    for (let i = 0; i < 120; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1, jump: true })]]));
    expect(s.pos.x).toBeGreaterThan(farX);    // over the barricade and past it
  });

  it('isBlocked treats a barricade as a wall on the ground — hover included', () => {
    const g = new Uint8Array(GRID * GRID);
    g[50 * GRID + 50] = T_CLIMB;
    expect(isBlocked(g, toWorld(50), toWorld(50))).toBe(true);
    expect(isBlocked(g, toWorld(50), toWorld(50), true)).toBe(true); // a skiff skims at boot height
  });
});

describe('§8.7 CLIMB — fire: blocked below the lip, clear above', () => {
  const g = new Uint8Array(GRID * GRID);
  g[50 * GRID + 50] = T_CLIMB;
  const x = toWorld(50), z = toWorld(50);

  it('shots at 1.4 (muzzle height) are blocked; shots at 3.0 pass', () => {
    expect(blocksShot(g, x, z, 1.4)).toBe(true);
    expect(blocksShot(g, x, z, 3.0)).toBe(false);
    expect(blocksShot(g, x, z, CLIMB_H)).toBe(false); // the lip itself is the line
  });

  it('eye-height line of sight breaks on a barricade — it is honest hard cover', () => {
    const a = { x: toWorld(47), y: 0, z };
    const b = { x: toWorld(53), y: 0, z };
    expect(losClear(g, a, b)).toBe(false);       // standing eyes: blind
    expect(losClear(g, a, b, 3.2)).toBe(true);   // a rooftop watcher sees over
  });
});

describe('§8.7 CLIMB — the breacher: barricades are dinner, metal still is not', () => {
  it('DRILL_EATS lists the barricade', () => {
    expect(DRILL_EATS.has(T_CLIMB)).toBe(true);
    expect(DRILL_EATS.has(T_METAL)).toBe(false);
  });

  it('digTile grinds a barricade to open ground and replicates via dug', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const tx = 50, tz = 55;
    w.map.grid[tz * GRID + tx] = T_CLIMB;
    w.digTile(tx, tz);
    expect(w.map.grid[tz * GRID + tx]).toBe(T_OPEN);
    expect(w.dug).toContain(tz * GRID + tx);
    // and the drill still sparks off metal: no grind, no dig record
    w.map.grid[tz * GRID + tx] = T_METAL;
    w.digTile(tx, tz);
    expect(w.map.grid[tz * GRID + tx]).toBe(T_METAL);
  });
});

describe('§8.7 CLIMB — generation: flank routes exist, perimeters hold', () => {
  const SEEDS = [1, 7, 42, 1234, 987654];
  const themes = Object.keys(THEMES) as ThemeId[];

  it('every theme deals a handful of climbable runs (and never a flood)', () => {
    for (const theme of themes) {
      let total = 0;
      for (const seed of SEEDS) {
        const m = generateMap(seed, 'tdm', theme);
        let n = 0;
        for (let i = 0; i < m.grid.length; i++) if (m.grid[i] === T_CLIMB) n++;
        expect(n, `${theme} seed ${seed}: climb tiles should stay a seasoning, not a diet`).toBeLessThan(400);
        total += n;
      }
      expect(total, `${theme}: no climbable runs across ${SEEDS.length} seeds`).toBeGreaterThan(0);
    }
  });

  it('base compounds never go soft — no barricade inside either base box', () => {
    const half = GRID / 2;
    const baseT: [number, number][] = [[10, half], [GRID - 11, half]];
    for (const theme of themes) {
      for (const seed of SEEDS) {
        const m = generateMap(seed, 'tdm', theme);
        for (const [btx, btz] of baseT) {
          for (let dz = -7; dz <= 7; dz++) {
            for (let dx = -7; dx <= 7; dx++) {
              const t = m.grid[(btz + dz) * GRID + btx + dx];
              expect(t === T_CLIMB, `${theme} seed ${seed}: T_CLIMB inside base at ${btx + dx},${btz + dz}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('climb layout is deterministic — every client builds the same barricades', () => {
    const a = generateMap(42, 'tdm', 'savanna');
    const b = generateMap(42, 'tdm', 'savanna');
    expect(a.grid).toEqual(b.grid);
  });
});
