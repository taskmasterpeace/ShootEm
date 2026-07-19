// ---------------------------------------------------------------------------
// MAGNETAR — anti-ranged. One brain file per LSW (§5), deterministic,
// DOM-free. The bullet-eating HALO is passive (the projectile step scans for
// living magnetars); this file is the MAGNETIC PULSE.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';
import { nearestEnemy } from './kit';

/** the pulse: nearby enemy guns JAM (fire-rate lock + stuck reloads) and
 *  metal vehicles STALL — all within reach. */
function pulse(w: World, s: Soldier) {
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) > 12) continue;
    e.nextFireAt = Math.max(e.nextFireAt, w.time + 1.5); // guns jam
    if (e.reloadUntil > w.time) e.reloadUntil = w.time + 2.5; // stuck mid-reload
    w.emit({ type: 'emp', pos: { ...e.pos } });
  }
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team) continue;
    if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) > 12) continue;
    v.stunnedUntil = Math.max(v.stunnedUntil, w.time + 2.5); // metal stalls
    w.emit({ type: 'emp', pos: { ...v.pos } });
  }
  w.emit({ type: 'emp', pos: { ...s.pos } });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'magnetar', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_magnetar_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  // the HALO is passive (projectile step). The bot fires the PULSE on a
  // cadence; a human pilot on Q.
  // PULSE only when a soldier OR a vehicle is inside the 12u EMP — an EMP into
  // an empty field jams nobody. Recheck fast when it's clear.
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    const veh = [...w.vehicles.values()].some((v) => v.alive && v.team !== s.team && Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < 12);
    if (nearestEnemy(w, s, 12, false) || veh) { pulse(w, s); s.nextLswAt = w.time + 6; }
    else s.nextLswAt = w.time + 0.5;
  }
}

export function active(w: World, s: Soldier): boolean {
  pulse(w, s);
  return true;
}
