// ---------------------------------------------------------------------------
// TREMOR — siege, burrow. One brain file per LSW (§5), deterministic,
// DOM-free. The earthquake stomp + the soil ripple.
// ---------------------------------------------------------------------------
import { WEAPONS } from '../data';
import type { Soldier } from '../types';
import type { World } from '../world';

/** the stomp: a slam at his feet — everyone close is hurt, thrown, and their
 *  aim rattled (a fire-rate stagger). */
function stomp(w: World, s: Soldier) {
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 7) continue;
    w.damageSoldier(e, 40 * (1 - d / 9), s.id, 'gl');
    const inv = d > 0.01 ? 1 / d : 0;
    e.pushX += dx * inv * 18; e.pushZ += dz * inv * 18;
    e.nextFireAt = Math.max(e.nextFireAt, w.time + 0.8); // the shock rattles the aim
  }
  w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'tremor', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_tremor_ability', pos: { ...s.pos }, soldierId: s.id });
}

/** the soil ripple: a slow, low, ground-hugging spike round lobbed at the
 *  nearest enemy — you can see it coming, sidestep it. */
function ripple(w: World, s: Soldier): boolean {
  let d = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dd = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (dd < d) d = dd;
  }
  if (d === Infinity || d > WEAPONS.soil_spike.range) return false;
  w.throwProjectile(s, 'soil_spike', 0.3, WEAPONS.soil_spike.speed, false, Math.max(6, d));
  w.emit({ type: 'shot', pos: { x: s.pos.x, y: 0.3, z: s.pos.z }, weapon: 'soil_spike', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_tremor_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // STOMP when a crowd is close, else a RIPPLE down the lane.
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    let near = false;
    for (const e of w.soldiers.values()) {
      if (e.alive && e.team !== s.team && e.id !== s.id && Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) < 7) { near = true; break; }
    }
    if (near) stomp(w, s); else ripple(w, s);
    s.nextLswAt = w.time + 3;
  }
}

export function active(w: World, s: Soldier): boolean {
  stomp(w, s);
  return true;
}
