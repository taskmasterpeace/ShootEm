// ---------------------------------------------------------------------------
// INFLUENCE MAP (§AI-AUDIT theme 2/5 — the Killzone idea). Every spatial
// decision in the brain used to be "nearest": nearest cover, nearest enemy,
// straight-line retreat. Nearest is not the same as GOOD — a bot at 20% HP
// would peel to the closest crate even when that crate sat between it and the
// three men shooting it.
//
// This is a coarse per-team THREAT field, rebuilt a few times a second and read
// in O(1) by every bot. It is the shared blackboard the audit asked for: pay
// once, everyone reads. Deterministic (fixed iteration order, pure math, no
// rng, no wall clock) and cheap — 32x32 cells, not 128x128 tiles.
// ---------------------------------------------------------------------------
import { GRID, TILE, WORLD } from './map';
import type { Soldier, Team } from './types';

/** tiles per influence cell — coarse on purpose: this shapes a decision, it is
 *  not a pathfinding grid */
export const INF_CELL = 4;
export const INF_DIM = Math.ceil(GRID / INF_CELL);
/** how often the field is rebuilt (seconds) */
export const INF_REBUILD = 0.4;
/** an enemy's threat reaches this far, falling off linearly */
export const THREAT_REACH = 34;

export interface InfluenceField {
  /** threat[team] = danger to that team, radiated by the ENEMY */
  threat: [Float32Array, Float32Array];
  nextBuildAt: number;
}

export function newInfluence(): InfluenceField {
  return { threat: [new Float32Array(INF_DIM * INF_DIM), new Float32Array(INF_DIM * INF_DIM)], nextBuildAt: 0 };
}

const cellOf = (x: number, z: number) => {
  const cx = Math.floor(((x + WORLD / 2) / TILE) / INF_CELL);
  const cz = Math.floor(((z + WORLD / 2) / TILE) / INF_CELL);
  if (cx < 0 || cz < 0 || cx >= INF_DIM || cz >= INF_DIM) return -1;
  return cz * INF_DIM + cx;
};

/** Stamp every living enemy's danger into the field for each team. Called once
 *  per tick; does real work only every INF_REBUILD seconds. */
export function buildInfluence(
  field: InfluenceField, time: number,
  soldiers: Iterable<Soldier>,
): void {
  if (time < field.nextBuildAt) return;
  field.nextBuildAt = time + INF_REBUILD;
  field.threat[0].fill(0);
  field.threat[1].fill(0);
  const reachCells = Math.ceil(THREAT_REACH / TILE / INF_CELL);
  for (const s of soldiers) {
    if (!s.alive || (s.kind !== 'human' && s.kind !== 'bot')) continue;
    // a body radiates danger to the OTHER team
    const victim = (1 - s.team) as Team;
    const home = cellOf(s.pos.x, s.pos.z);
    if (home < 0) continue;
    const hx = home % INF_DIM, hz = (home / INF_DIM) | 0;
    // an LSW is worth a squad — weight the god heavier than a rifleman
    const weight = s.ascendant !== undefined ? 4 : 1;
    for (let dz = -reachCells; dz <= reachCells; dz++) {
      for (let dx = -reachCells; dx <= reachCells; dx++) {
        const cx = hx + dx, cz = hz + dz;
        if (cx < 0 || cz < 0 || cx >= INF_DIM || cz >= INF_DIM) continue;
        // linear falloff in CELL space (cheap, and the shape is all that matters)
        const dist = Math.hypot(dx, dz) * INF_CELL * TILE;
        if (dist > THREAT_REACH) continue;
        field.threat[victim][cz * INF_DIM + cx] += weight * (1 - dist / THREAT_REACH);
      }
    }
  }
}

/** How dangerous is this spot for `team`? 0 = quiet, higher = more guns on it. */
export function threatAt(field: InfluenceField, team: Team, x: number, z: number): number {
  const c = cellOf(x, z);
  return c < 0 ? 0 : field.threat[team][c];
}
