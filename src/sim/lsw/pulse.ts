// ---------------------------------------------------------------------------
// PULSE — recon. One brain file per LSW (§5), deterministic, DOM-free. The
// SONIC WAVE staggers and TAGS victims THROUGH WALLS (the shipped tag-pin —
// ears beat eyes); the DEAFENING BURST stalls vehicle controls.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** the wave: walls mean nothing to sound — everyone in radius is staggered
 *  and PINNED on every enemy screen for 5s (the tag system). */
function wave(w: World, s: Soldier): boolean {
  let hit = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.decoyOf !== undefined) continue;
    if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) > 16) continue;
    e.nextFireAt = Math.max(e.nextFireAt, w.time + 0.7); // the stagger
    w.tagged.set(e.id, w.time + 5); // pinned THROUGH the wall — ears beat eyes
    w.emit({ type: 'psi_ping', pos: { ...e.pos }, soldierId: e.id });
    hit++;
  }
  if (hit) {
    w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'pulse', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_pulse_ability', pos: { ...s.pos }, soldierId: s.id });
  }
  return hit > 0;
}

/** the deafening burst: nearby enemy hulls lose their controls */
function burst(w: World, s: Soldier): boolean {
  let hit = 0;
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team) continue;
    if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) > 18) continue;
    v.stunnedUntil = Math.max(v.stunnedUntil, w.time + 3);
    w.emit({ type: 'emp', pos: { ...v.pos } });
    hit++;
  }
  if (hit) w.emit({ type: 'vo', text: 'vo_pulse_ability', pos: { ...s.pos }, soldierId: s.id });
  return hit > 0;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) { s.nextLswAt = w.time + (wave(w, s) ? 5 : 0.6); }
  if (w.time >= (s.nextLswActiveAt ?? 0) && burst(w, s)) s.nextLswActiveAt = w.time + 9;
}

export function active(w: World, s: Soldier): boolean {
  // Q: the wave; if nothing breathes in range, try the burst on the armor.
  return wave(w, s) || burst(w, s);
}
