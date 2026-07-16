// ---------------------------------------------------------------------------
// Dynamic interiors: three house types GROWN from the seed — rooms, interior
// doors, windows, furniture — emitted as stencils so the whole proven
// pipeline (stamp, mirror, doors, drills, zeds) applies unchanged.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  generateHouse, isLegalStencilChar, mirrorDef, stampBuilding, stencilConnected,
  type DynHouseType, type StampCtx,
} from '../src/sim/buildings';
import { GRID, T_DOOR, T_WALL, TILE, WORLD, generateMap } from '../src/sim/map';
import { Rng } from '../src/sim/rng';
import { World } from '../src/sim/world';

const TYPES: DynHouseType[] = ['manor', 'bungalow', 'hall_house'];
const count = (def: { rows: string[] }, ch: string) =>
  def.rows.reduce((n, r) => n + r.split('').filter((c) => c === ch).length, 0);

describe('the dynamic house generator', () => {
  it('every layout is legal, roomy, windowed, furnished — across 30 seeds x 3 types', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const type of TYPES) {
        const def = generateHouse(new Rng(seed * 7 + TYPES.indexOf(type)), type);
        for (const row of def.rows) for (const ch of row) {
          expect(isLegalStencilChar(ch), `${type} seed ${seed}: illegal '${ch}'`).toBe(true);
        }
        // rooms mean interior doors: beyond the double front door
        expect(count(def, 'D'), `${type} seed ${seed} needs interior doors`).toBeGreaterThanOrEqual(3);
        expect(count(def, 'S'), `${type} seed ${seed} needs windows`).toBeGreaterThanOrEqual(3);
        expect(count(def, 'C') + count(def, 'P'), `${type} seed ${seed}: the indoors has stuff`).toBeGreaterThanOrEqual(1);
        // THE contract: no sealed rooms, every floor cell reachable from the door
        expect(stencilConnected(def), `${type} seed ${seed} has a sealed room:\n${def.rows.join('\n')}`).toBe(true);
        // and the mirrored twin is just as sound
        expect(stencilConnected(mirrorDef(def)), `${type} seed ${seed} mirror broke`).toBe(true);
      }
    }
  });

  it('deterministic: the same seed grows the same house on every client', () => {
    for (const type of TYPES) {
      const a = generateHouse(new Rng(99), type);
      const b = generateHouse(new Rng(99), type);
      expect(a.rows).toEqual(b.rows);
    }
  });

  it('a manor is a real multi-room floor plan (interior walls exist)', () => {
    const def = generateHouse(new Rng(4), 'manor');
    let interiorWalls = 0;
    for (let z = 1; z < def.rows.length - 1; z++)
      for (let x = 1; x < def.rows[z].length - 1; x++)
        if (def.rows[z][x] === '#') interiorWalls++;
    expect(interiorWalls).toBeGreaterThanOrEqual(6);
  });

  it('a bot chains doors through a manor to a goal in a back room', () => {
    const w = new World({ seed: 21, mode: 'koth' });
    const def = generateHouse(new Rng(21), 'manor');
    const hw = Math.max(...def.rows.map((r) => r.length)), hh = def.rows.length;
    const tx = Math.floor(GRID / 2) - Math.floor(hw / 2), tz = Math.floor(GRID / 2) - Math.floor(hh / 2);
    // level the neighborhood, then plant the manor
    for (let z = tz - 6; z < tz + hh + 6; z++)
      for (let x = tx - 6; x < tx + hw + 6; x++) w.map.grid[z * GRID + x] = 0;
    const ctx: StampCtx = { grid: w.map.grid, props: [], pickups: [], houses: [], claims: [], rng: new Rng(1) };
    expect(stampBuilding(ctx, def, tx, tz)).toBe(true);
    // the hill goes in the FARTHEST room cell from the front door (BFS depth
    // through the stencil — the bot must open at least front + interior doors)
    let fd: [number, number] | null = null;
    for (let x = 0; x < hw && !fd; x++) if (def.rows[hh - 1][x] === 'D') fd = [x, hh - 1];
    const dist = new Map<number, number>([[fd![1] * hw + fd![0], 0]]);
    const q: [number, number][] = [fd!];
    let far: [number, number] = fd!;
    while (q.length) {
      const [x, z] = q.shift()!;
      const d = dist.get(z * hw + x)!;
      if (d > (dist.get(far[1] * hw + far[0]) ?? 0)) far = [x, z];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz;
        const ch = (def.rows[nz] ?? '')[nx] ?? ' ';
        if ((ch === '.' || ch === 'D' || ch === 'P') && !dist.has(nz * hw + nx)) {
          dist.set(nz * hw + nx, d + 1);
          q.push([nx, nz]);
        }
      }
    }
    const hill = { x: (tx + far[0] + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + far[1] + 0.5) * TILE - WORLD / 2 };
    (w.mode as { hillPos?: typeof hill }).hillPos = hill;
    w.map.hillPos = hill;
    const b = w.addSoldier('Clearer', 'infantry', 0, 'bot');
    b.pos = { x: (tx + Math.floor(hw / 2)) * TILE - WORLD / 2, y: 0, z: (tz + hh + 3) * TILE - WORLD / 2 };
    let arrived = false;
    for (let i = 0; i < 60 * 40 && !arrived; i++) {
      w.step(1 / 60, new Map());
      w.takeEvents();
      arrived = Math.hypot(b.pos.x - hill.x, b.pos.z - hill.z) < 2.5;
    }
    expect(arrived, 'bot never reached the back room').toBe(true);
  });

  it('the safehouse neighborhood is built on the system: real doors, real rooms', () => {
    const m = generateMap(9, 'safehouse');
    expect(m.houses.length).toBeGreaterThanOrEqual(10);
    const doorTiles = m.grid.reduce((n, v) => n + (v === T_DOOR ? 1 : 0), 0);
    expect(doorTiles).toBeGreaterThanOrEqual(m.houses.length * 2); // double front doors
    // interior structure: walls strictly INSIDE house rects
    let interiorWalls = 0;
    for (const h of m.houses) {
      for (let z = h.tz + 1; z < h.tz + h.th - 1; z++)
        for (let x = h.tx + 1; x < h.tx + h.tw - 1; x++)
          if (m.grid[z * GRID + x] === T_WALL) interiorWalls++;
    }
    expect(interiorWalls).toBeGreaterThan(m.houses.length); // rooms, not shells
  });
});
