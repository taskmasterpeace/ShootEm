// ---------------------------------------------------------------------------
// NIGHTMARE — disruptor. One brain file per LSW (§5), deterministic,
// DOM-free. The FEAR PULSE litters every enemy minimap with FALSE contacts;
// the BLIND puts one target's eyes out for 2s — ears still work.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** the fear pulse: false red pings bloom around every nearby enemy — which
 *  contact is real? (the psi_ping event is the HUD's contact flash) */
function fear(w: World, s: Soldier): boolean {
  let hit = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.decoyOf !== undefined) continue;
    if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) > 18) continue;
    // three LIES per victim — plausible contacts that never existed
    for (let i = 0; i < 3; i++) {
      w.emit({
        type: 'psi_ping',
        pos: { x: e.pos.x + w.rng.range(-14, 14), y: 0, z: e.pos.z + w.rng.range(-14, 14) },
      });
    }
    hit++;
  }
  if (hit) {
    w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'nightmare', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_nightmare_ability', pos: { ...s.pos }, soldierId: s.id });
  }
  return hit > 0;
}

/** THE BLIND: one target's eyes go out for 2s — ears still work (§19.2
 *  trained you for this). A blinded bot cannot acquire targets. */
function blind(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = 20;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.decoyOf !== undefined) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best) { best = d; tgt = e; }
  }
  if (!tgt) return false;
  tgt.blindUntil = w.time + 2;
  w.emit({ type: 'psi_ping', pos: { ...tgt.pos }, soldierId: tgt.id });
  w.emit({ type: 'lsw_active', pos: { ...tgt.pos }, text: 'nightmare', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_nightmare_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) { s.nextLswAt = w.time + (fear(w, s) ? 6 : 0.6); }
  if (w.time >= (s.nextLswActiveAt ?? 0) && blind(w, s)) s.nextLswActiveAt = w.time + 8;
}

export function active(w: World, s: Soldier): boolean {
  // Q: blind the nearest set of eyes; nobody close → the fear pulse.
  return blind(w, s) || fear(w, s);
}
