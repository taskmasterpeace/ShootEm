// ---------------------------------------------------------------------------
// THE INTERIOR COMPLEX (Robert: "maybe the entire map is indoors — wide
// corridor fights and down long hallways"). The starship/corridors theme is a
// whole-map building interior now: a hallway spine, room bays, cross-corridors
// (src/sim/interior.ts). The laws that keep it PLAYABLE, not a sealed maze:
//   · every base reaches the map center through the corridors (no sealed hull)
//   · a live match flows — bots cross the interior, captures happen, no statues
//   · the deck grows nothing (no meadows) and jump troopers get vault routes
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_CLIMB, T_DOOR, T_DOOR_OPEN, T_GRASS, T_LADDER, T_OPEN, T_WATER, TILE, WORLD, generateMap } from '../src/sim/map';
import { World } from '../src/sim/world';

const MIX = ['infantry', 'infantry', 'heavy', 'medic', 'engineer', 'jump', 'infantry', 'infiltrator', 'infantry', 'heavy', 'medic', 'infantry'] as const;
const DT = 1 / 30;
const toTile = (v: number) => Math.floor((v + WORLD / 2) / TILE);

function reaches(grid: Uint8Array, from: [number, number], to: [number, number]): boolean {
  const open = (x: number, z: number) => {
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) return false;
    const t = grid[z * GRID + x];
    return t === T_OPEN || t === T_WATER || t === T_DOOR || t === T_DOOR_OPEN || t === T_LADDER || t === T_GRASS;
  };
  const seen = new Uint8Array(GRID * GRID);
  const q: number[] = [from[1] * GRID + from[0]];
  seen[from[1] * GRID + from[0]] = 1;
  while (q.length) {
    const cur = q.shift()!;
    const cx = cur % GRID, cz = (cur / GRID) | 0;
    if (Math.abs(cx - to[0]) <= 1 && Math.abs(cz - to[1]) <= 1) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, nz = cz + dz;
      if (open(nx, nz) && !seen[nz * GRID + nx]) { seen[nz * GRID + nx] = 1; q.push(nz * GRID + nx); }
    }
  }
  return false;
}

describe('the interior complex (starship theme)', () => {
  it('both hulls reach the map center through the corridors — no sealed base', () => {
    for (const seed of [4207, 91, 7, 777, 12345]) {
      for (const mode of ['ctf', 'tdm'] as const) {
        const m = generateMap(seed, mode, 'starship');
        for (const team of [0, 1] as const) {
          const b: [number, number] = [toTile(m.basePos[team].x), toTile(m.basePos[team].z)];
          expect(reaches(m.grid, [50, 50], b), `${mode}/${seed} hull ${team} sealed from the corridors`).toBe(true);
        }
      }
    }
  });

  it('the deck grows nothing, and jump troopers get vault routes', () => {
    const m = generateMap(4207, 'ctf', 'starship');
    let grass = 0, climb = 0;
    for (let i = 0; i < m.grid.length; i++) {
      if (m.grid[i] === T_GRASS) grass++;
      if (m.grid[i] === T_CLIMB) climb++;
    }
    expect(grass, 'the hull grew a meadow').toBe(0);
    expect(climb, 'no vault routes inside the hull').toBeGreaterThan(0);
  });

  it('a live match flows through the interior — bots cross it, and it never seizes', () => {
    const w = new World({ seed: 4207, mode: 'ctf', theme: 'starship', matchMinutes: 15 });
    w.addSoldier('Robert', 'infantry', 0, 'human');
    for (const t of [0, 1] as const) for (let i = 0; i < 12; i++) w.addSoldier(`T${t}B${i}`, MIX[i], t, 'bot');

    let crossings = 0;
    const wasHome = new Map<number, boolean>();
    for (let sec = 1; sec <= 180 && !w.mode.over; sec++) {
      for (let i = 0; i < Math.round(1 / DT); i++) w.step(DT, new Map());
      for (const s of w.humansAndBots()) {
        if (!s.alive || s.vehicleId >= 0) continue;
        const b = w.map.basePos[s.team];
        const home = Math.hypot(s.pos.x - b.x, s.pos.z - b.z) < 28;
        if (wasHome.get(s.id) === true && !home) crossings++;
        wasHome.set(s.id, home);
      }
    }
    expect(crossings, 'nobody crossed the interior — the corridors trap them').toBeGreaterThan(20);
    const ss = w.blackbox.samples.filter((s) => s.t > 30);
    const meanStuck = ss.reduce((a, s) => a + s.teams[0].stuck + s.teams[1].stuck, 0) / Math.max(1, ss.length);
    expect(meanStuck, `the hull seized up (mean stuck ${meanStuck.toFixed(2)})`).toBeLessThan(2);
  });
});
