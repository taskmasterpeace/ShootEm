// ---------------------------------------------------------------------------
// REACTOR — support. One brain file per LSW (§5), deterministic, DOM-free.
// The charged nova + the ally OVERCHARGE (the shipped rageMul channel).
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** the nova: a charged burst around him — everyone close is hurt and thrown.
 *  His offensive option when there's no ally to feed. */
function nova(w: World, s: Soldier) {
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 8) continue;
    w.damageSoldier(e, 60 * (1 - d / 10), s.id, 'gl');
    const inv = d > 0.01 ? 1 / d : 0;
    e.pushX += dx * inv * 20; e.pushZ += dz * inv * 20;
  }
  w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'reactor', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_reactor_ability', pos: { ...s.pos }, soldierId: s.id });
}

/** the overcharge: pour power into the nearest ally — their outgoing damage
 *  (and step) run hot for 6s on the shipped rageMul channel, handed back when
 *  overchargeUntil expires. Returns false if no ally is near. */
function overcharge(w: World, s: Soldier): boolean {
  let ally: Soldier | undefined, best = 20;
  for (const a of w.soldiers.values()) {
    if (!a.alive || a.team !== s.team || a.id === s.id || a.ascendant || a.encasedUntil !== undefined) continue;
    const d = Math.hypot(a.pos.x - s.pos.x, a.pos.z - s.pos.z);
    if (d < best) { best = d; ally = a; }
  }
  if (!ally) return false;
  ally.rageMul = 1.7;
  ally.overchargeUntil = w.time + 6;
  w.emit({ type: 'heal', pos: { ...ally.pos }, soldierId: ally.id });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'reactor', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_reactor_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // NOVA on a cadence, OVERCHARGE the nearest ally on a slower one (reusing
  // nextLswActiveAt as the bot's overcharge timer).
  if (s.kind === 'bot') {
    if (w.time >= (s.nextLswAt ?? 0)) { nova(w, s); s.nextLswAt = w.time + 4; }
    if (w.time >= (s.nextLswActiveAt ?? 0) && overcharge(w, s)) s.nextLswActiveAt = w.time + 7;
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: feed the nearest ally; if you're alone, nova instead.
  if (!overcharge(w, s)) nova(w, s);
  return true;
}
