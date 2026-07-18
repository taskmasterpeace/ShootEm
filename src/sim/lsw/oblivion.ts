// ---------------------------------------------------------------------------
// OBLIVION — zoner, levitates. One brain file per LSW (§5), deterministic,
// DOM-free. Void bolts (arcing splash) + the black hole (a shared force
// field on a burst timer — world.stepBlackHoles owns the collapse).
// ---------------------------------------------------------------------------
import { WEAPONS } from '../data';
import type { Soldier } from '../types';
import type { World } from '../world';

/** an arcing energy round that lobs OVER cover and bursts with splash where
 *  it lands — fired at the nearest enemy in range. False if nothing to lob at. */
function bolt(w: World, s: Soldier): boolean {
  let d = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dd = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (dd < d) d = dd;
  }
  if (d === Infinity || d > WEAPONS.void_bolt.range) return false;
  w.throwProjectile(s, 'void_bolt', 1.6, WEAPONS.void_bolt.speed, true, Math.max(6, d));
  w.emit({ type: 'shot', pos: { x: s.pos.x, y: 1.4, z: s.pos.z }, weapon: 'void_bolt', soldierId: s.id });
  return true;
}

/** the black hole: opens a collapse point a few strides down his aim. The
 *  pull rides the SHARED force-field system; the burst is world's timer. */
function voidHole(w: World, s: Soldier) {
  const dx = Math.cos(s.yaw), dz = Math.sin(s.yaw);
  const x = s.pos.x + dx * 8, z = s.pos.z + dz * 8;
  const burstAt = w.time + 1.5;
  w.blackHoles.push({ x, z, team: s.team, ownerId: s.id, burstAt });
  w.forceFields.push({ x, z, r: 14, radial: -5, team: s.team, ownerId: s.id, until: burstAt });
  w.emit({ type: 'gravlift', pos: { x, y: 0, z } }); // the telegraph
  w.emit({ type: 'lsw_active', pos: { x, y: 0, z }, text: 'oblivion', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_oblivion_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  // VOID BOLTS lobbed at range, and a BLACK HOLE dropped on a slower cadence
  // (reusing nextLswActiveAt on the bot). A human pilot opens the hole on Q.
  if (s.kind === 'bot') {
    if (w.time >= (s.nextLswAt ?? 0)) { bolt(w, s); s.nextLswAt = w.time + 1.4; }
    if (w.time >= (s.nextLswActiveAt ?? 0)) { voidHole(w, s); s.nextLswActiveAt = w.time + 8; }
  }
}

export function active(w: World, s: Soldier): boolean {
  voidHole(w, s);
  return true;
}
