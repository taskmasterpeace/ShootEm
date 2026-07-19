// ---------------------------------------------------------------------------
// DOMINATOR ⭐ — the finale, levitates. One brain file per LSW (§5),
// deterministic, DOM-free. The psychic lance + the PSYCHIC LINKS
// (damageSoldier shares 60% across a bound thread).
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';
import { enemyAhead } from './kit';

/** the lance: a piercing line down his aim (LOS per-target, the rail idiom). */
function lance(w: World, s: Soldier) {
  const dx = Math.cos(s.yaw), dz = Math.sin(s.yaw);
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const ex = e.pos.x - s.pos.x, ez = e.pos.z - s.pos.z;
    const along = ex * dx + ez * dz;
    if (along <= 0 || along > 60) continue;
    if (Math.abs(ex * dz - ez * dx) > 1.5) continue;
    if (!losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) continue;
    w.damageSoldier(e, 70, s.id, 'rg2');
  }
  w.emit({ type: 'shot', pos: { x: s.pos.x, y: 1.4, z: s.pos.z }, weapon: 'rg2', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_dominator_ability', pos: { ...s.pos }, soldierId: s.id });
}

/** the links: chain up to FOUR nearby enemies onto one thread — hurting any
 *  of them hurts all (damageSoldier). Scatter beyond thread range, or melt
 *  as a group. Returns false if there weren't at least two to bind. */
function link(w: World, s: Soldier): boolean {
  const near = [...w.soldiers.values()]
    .filter((e) => e.alive && e.team !== s.team && e.id !== s.id && e.encasedUntil === undefined
      && Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) < 18)
    .sort((a, b) => Math.hypot(a.pos.x - s.pos.x, a.pos.z - s.pos.z) - Math.hypot(b.pos.x - s.pos.x, b.pos.z - s.pos.z))
    .slice(0, 4);
  if (near.length < 2) return false;
  const group = w.id();
  for (const e of near) {
    e.psiLinkId = group; e.psiLinkUntil = w.time + 8;
    w.emit({ type: 'beacon_planted', pos: { ...e.pos }, soldierId: s.id, text: 'LINKED' });
  }
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'dominator', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_dominator_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // the LANCE on a cadence, the LINKS on a slower one (reusing
  // nextLswActiveAt on the bot). A human pilot links on Q.
  if (s.kind === 'bot') {
    // lance ONLY down a lane an enemy actually stands in — no blind piercing
    // shot into the void. Recheck fast when the lane's empty.
    if (w.time >= (s.nextLswAt ?? 0)) {
      if (enemyAhead(w, s, 60, 0.14)) { lance(w, s); s.nextLswAt = w.time + 2.5; }
      else s.nextLswAt = w.time + 0.4;
    }
    if (w.time >= (s.nextLswActiveAt ?? 0) && link(w, s)) s.nextLswActiveAt = w.time + 9;
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: link the nearest cluster; if there's no cluster to bind, lance instead.
  if (!link(w, s)) lance(w, s);
  return true;
}
