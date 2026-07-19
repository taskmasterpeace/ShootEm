// ---------------------------------------------------------------------------
// LSW BRAIN KIT — shared target-sense for the bot pilots so their signatures
// fire STRATEGICALLY (when there's actually something to hit) instead of on a
// blind timer into empty air. A blind cast wastes the ability AND cries wolf:
// the telegraph + VO fire at nobody, so "the telegraph IS the counterplay"
// stops meaning anything. These gates turn a metronome into a marksman.
// Deterministic + DOM-free like every brain (no rng, no wall clock).
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** Nearest living enemy soldier within `range` (LOS required unless told not to)
 *  — the gate for a SELF-CENTRED blast (nova/pulse/pound): don't detonate an
 *  empty circle. */
export function nearestEnemy(w: World, s: Soldier, range: number, needLos = true): Soldier | null {
  let best: Soldier | null = null, bestD = range;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d >= bestD) continue;
    if (needLos && !losClear(w.map.grid, { x: s.pos.x, y: 1.4, z: s.pos.z }, { x: e.pos.x, y: 1.4, z: e.pos.z })) continue;
    best = e; bestD = d;
  }
  return best;
}

/** Would a straight-line signature down `s.yaw` connect? True when a live enemy
 *  sits within `range`, within `cone` radians of the aim, with a clear shot —
 *  the gate for a DIRECTIONAL cast (rail/lance): don't fire down an empty lane. */
export function enemyAhead(w: World, s: Soldier, range: number, cone = 0.32): boolean {
  const dx = Math.cos(s.yaw), dz = Math.sin(s.yaw), minCos = Math.cos(cone);
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const ex = e.pos.x - s.pos.x, ez = e.pos.z - s.pos.z;
    const d = Math.hypot(ex, ez);
    if (d < 1 || d > range) continue;
    if ((ex * dx + ez * dz) / d < minCos) continue; // outside the aim cone
    if (!losClear(w.map.grid, { x: s.pos.x, y: 1.4, z: s.pos.z }, { x: e.pos.x, y: 1.4, z: e.pos.z })) continue;
    return true;
  }
  return false;
}
