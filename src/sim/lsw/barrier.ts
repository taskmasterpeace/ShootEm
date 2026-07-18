// ---------------------------------------------------------------------------
// BARRIER — zoner. One brain file per LSW (§5), deterministic, DOM-free.
// The reflecting energy wall (the projectile step honors g.reflect).
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** projects an energy dome a few strides down his aim. Its first 2s REFLECT
 *  enemy fire back at the shooters (grenade-bank reversal + re-team, in the
 *  projectile step); after that it swallows like a normal dome. */
function wall(w: World, s: Soldier) {
  const dx = Math.cos(s.yaw), dz = Math.sin(s.yaw);
  const pos = { x: s.pos.x + dx * 3, y: 0, z: s.pos.z + dz * 3 };
  const g = w.spawnGadget('shield', s.team, s.id, pos, 250, 6);
  g.reflect = true;
  w.emit({ type: 'lsw_active', pos, text: 'barrier', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_barrier_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  // Bot lays a wall on a cadence; a human pilot on Q.
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) { wall(w, s); s.nextLswAt = w.time + 4; }
}

export function active(w: World, s: Soldier): boolean {
  wall(w, s);
  return true;
}
