// ---------------------------------------------------------------------------
// CHRONOS — controller. One brain file per LSW (§5), deterministic, DOM-free.
// The slow-time bubble rides the shared TIME FIELDS; the TEMPORAL ECHO lives
// in damageSoldier (a lethal hit snaps him to his 3s-old breadcrumb, once) —
// this file records the breadcrumbs and casts the bubble.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** THE TIME BUBBLE: a zone where the world crawls (movement AND rounds at
 *  0.35x) — and he walks through it untouched (the owner exemption). */
function bubble(w: World, s: Soldier) {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  w.timeFields.push({ x: s.pos.x + fx * 6, z: s.pos.z + fz * 6, r: 9, mul: 0.35, ownerId: s.id, until: w.time + 4 });
  w.emit({ type: 'gravlift', pos: { x: s.pos.x + fx * 6, y: 0, z: s.pos.z + fz * 6 } }); // the shimmer — the telegraph
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'chronos', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_chronos_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  // THE BREADCRUMBS: every quarter-second, remember where he stood. The
  // oldest crumb (~3s back) is the ECHO POINT the glow advertises — and the
  // spot damageSoldier snaps him to on a lethal hit, once per fight.
  if (w.time >= (s.nextWarpAt ?? 0)) {
    s.nextWarpAt = w.time + 0.25;
    s.lswTrail = s.lswTrail ?? [];
    s.lswTrail.push({ x: s.pos.x, z: s.pos.z });
    if (s.lswTrail.length > 12) s.lswTrail.shift(); // ~3s of history
  }
  // the bot casts the bubble over whatever cluster he faces
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id) continue;
      const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
      if (d < 18) {
        s.yaw = Math.atan2(e.pos.z - s.pos.z, e.pos.x - s.pos.x);
        bubble(w, s);
        s.nextLswAt = w.time + 9;
        return;
      }
    }
    s.nextLswAt = w.time + 0.5;
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: the bubble, down your aim. The echo is passive — it saves you once.
  bubble(w, s);
  return true;
}
