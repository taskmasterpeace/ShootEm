// ---------------------------------------------------------------------------
// THE SOLDIER INDEX (opt #38 / S2) — the sim's first spatial structure.
//
// Every hot O(S²) scan (zombie targeting, findTarget, projectile-vs-soldier,
// melee sweeps, separation) used to walk the whole soldier Map per query.
// This is a uniform grid over the 300u world, rebuilt once at the top of
// step() — and it is PER TEAM, which is the lesson the first cut taught: a
// zombie hunting 12 humans must never wade through its own 800-body horde.
// Every consumer filters by team anyway, so the index partitions on it, and
// candidate lists stay the size of the OTHER side, not the crowd you're in.
//
// THE DETERMINISM LAW: queries return candidates sorted by ASCENDING id. The
// old full scans consumed (after their team filters) exactly the queried
// team's bodies in Map-insertion order — which IS ascending id — so float
// accumulation order, strict-< nearest ties, and first-hit breaks stay
// byte-identical. The whole 1301-test suite gates this.
//
// ALL soldiers are indexed (dead too — rescue and corpse logic look at
// bodies); every call site keeps its own alive/kind/vehicle filters.
// ---------------------------------------------------------------------------
import type { Soldier, Team } from './types';

const WORLD = 300;          // TILE 3 × GRID 100 (map.ts)
const CELL = 10;            // u per cell → 30×30 buckets
const COLS = Math.ceil(WORLD / CELL);
const HALF = WORLD / 2;
/** mid-tick drift allowance baked into every query rectangle (bodies are
 *  indexed at start-of-tick positions; call sites test live positions; a
 *  soldier walks ≤~0.5u a tick — a rare blink can out-run this, a one-tick,
 *  still-deterministic divergence the suite gates) */
const SLACK = 2;

const byId = (a: Soldier, b: Soldier) => a.id - b.id;

class TeamGrid {
  private cells: Soldier[][] = Array.from({ length: COLS * COLS }, () => []);
  private used: number[] = [];

  clear(): void {
    for (const c of this.used) this.cells[c].length = 0;
    this.used.length = 0;
  }

  add(s: Soldier): void {
    // SEAM SANITIZER (defense in depth): a non-finite position must never
    // crash the index — Math.min/max let NaN through to an undefined cell.
    // A NaN body is a bug upstream, but the spatial grid clamps it to origin
    // and stays alive (mirrors the applyCmd intent-clamp in world.ts).
    const px = Number.isFinite(s.pos.x) ? s.pos.x : 0;
    const pz = Number.isFinite(s.pos.z) ? s.pos.z : 0;
    const cx = Math.min(COLS - 1, Math.max(0, Math.floor((px + HALF) / CELL)));
    const cz = Math.min(COLS - 1, Math.max(0, Math.floor((pz + HALF) / CELL)));
    const c = cz * COLS + cx;
    if (this.cells[c].length === 0) this.used.push(c);
    this.cells[c].push(s); // push order per cell = ascending id (Map order)
  }

  collect(x: number, z: number, r: number, out: Soldier[]): void {
    const q = r + SLACK;
    const x0 = Math.min(COLS - 1, Math.max(0, Math.floor((x - q + HALF) / CELL)));
    const x1 = Math.min(COLS - 1, Math.max(0, Math.floor((x + q + HALF) / CELL)));
    const z0 = Math.min(COLS - 1, Math.max(0, Math.floor((z - q + HALF) / CELL)));
    const z1 = Math.min(COLS - 1, Math.max(0, Math.floor((z + q + HALF) / CELL)));
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[cz * COLS + cx];
        for (let i = 0; i < cell.length; i++) out.push(cell[i]);
      }
    }
  }

  /** Visit without collecting or sorting — the zero-overhead path for argmin
   *  consumers (visit order is fixed row-major × per-cell insertion, so it is
   *  deterministic; consumers needing OLD-scan tie behavior add an explicit
   *  lowest-id tie-break instead of relying on visit order). */
  forEach(x: number, z: number, r: number, cb: (s: Soldier) => void): void {
    const q = r + SLACK;
    const x0 = Math.min(COLS - 1, Math.max(0, Math.floor((x - q + HALF) / CELL)));
    const x1 = Math.min(COLS - 1, Math.max(0, Math.floor((x + q + HALF) / CELL)));
    const z0 = Math.min(COLS - 1, Math.max(0, Math.floor((z - q + HALF) / CELL)));
    const z1 = Math.min(COLS - 1, Math.max(0, Math.floor((z + q + HALF) / CELL)));
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[cz * COLS + cx];
        for (let i = 0; i < cell.length; i++) cb(cell[i]);
      }
    }
  }
}

export class SoldierIndex {
  private grids: [TeamGrid, TeamGrid] = [new TeamGrid(), new TeamGrid()];
  private rosters: [Soldier[], Soldier[]] = [[], []];

  /** O(S) refill at the top of step(). */
  rebuild(soldiers: Map<number, Soldier>): void {
    this.grids[0].clear();
    this.grids[1].clear();
    this.rosters[0].length = 0;
    this.rosters[1].length = 0;
    for (const s of soldiers.values()) this.add(s);
  }

  /** Register one body immediately — called by every add* so a soldier spawned
   *  mid-tick (mode waves) or before the first step (tests, the harness) is
   *  queryable at once. Removal waits for the next rebuild; call sites filter
   *  alive/team anyway. */
  add(s: Soldier): void {
    this.grids[s.team].add(s);
    this.rosters[s.team].push(s);
  }

  /** The whole team as a flat array in Map-insertion (ascending-id) order —
   *  the third lesson this index taught: when the TARGET SET is tiny (800
   *  zombies hunting 12 humans), a plain loop over the enemy roster beats any
   *  spatial query. No rings, no closures, exact old-scan order. */
  roster(team: Team): readonly Soldier[] {
    return this.rosters[team];
  }

  /**
   * Every TEAM-`team` soldier within `r` (plus drift slack) of (x,z), SORTED
   * BY ASCENDING id — a superset; callers keep their precise checks. `out` is
   * caller-owned scratch: reuse it at the call site, never across a nested
   * query. Returns `out`.
   */
  near(team: Team, x: number, z: number, r: number, out: Soldier[]): Soldier[] {
    out.length = 0;
    this.grids[team].collect(x, z, r, out);
    // SMALL-radius consumers only (separation ~5u, melee ~3u, projectiles
    // ~1u): lists stay dozens even inside a dense horde, so the sort is
    // pennies and buys byte-exact old-scan order for float sums and breaks.
    // Wide-radius argmin consumers must use forEach — sorting a whole horde
    // is how the first cut of this index LOST to the code it replaced.
    out.sort(byId);
    return out;
  }

  /** Visit team-`team` bodies near (x,z) with zero collect/sort overhead —
   *  the wide-radius argmin path (findTarget's 66u acquire against an
   *  800-body horde). Deterministic fixed visit order; NOT ascending id —
   *  argmin consumers add an explicit lowest-id tie-break. */
  forEach(team: Team, x: number, z: number, r: number, cb: (s: Soldier) => void): void {
    this.grids[team].forEach(x, z, r, cb);
  }

}
