// ---------------------------------------------------------------------------
// REAPER — duelist. One brain file per LSW (§5), deterministic, DOM-free.
// The CHAIN grabs the FIRST body on the line and reels it into the scythe;
// the MARK doubles HIS damage to one hunted target — and the victim knows.
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** the chain: the FIRST body along his aim is dragged to the scythe — tanks
 *  can eat the pull for the squad (the chain never skips a body). */
function chain(w: World, s: Soldier): boolean {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  let first: Soldier | undefined, firstAlong = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const ex = e.pos.x - s.pos.x, ez = e.pos.z - s.pos.z;
    const along = ex * fx + ez * fz;
    if (along <= 1.5 || along > 24) continue;
    if (Math.abs(ex * fz - ez * fx) > 1.5) continue;
    if (along < firstAlong && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) { firstAlong = along; first = e; }
  }
  if (!first) return false;
  const dx = s.pos.x - first.pos.x, dz = s.pos.z - first.pos.z, d = Math.hypot(dx, dz) || 1;
  first.pushX += (dx / d) * 44; // reeled into the scythe...
  first.pushZ += (dz / d) * 44;
  w.damageSoldier(first, 45, s.id, 'rg2'); // ...which is already swinging
  w.emit({ type: 'lsw_active', pos: { ...first.pos }, text: 'reaper', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_reaper_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

/** THE MARK: one target is HUNTED — the Reaper's own blows land double on
 *  them for 8s, and the victim's HUD says so (the tag makes them public). */
function mark(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = 40;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.decoyOf !== undefined) continue;
    if ((e.markedUntil ?? 0) > w.time) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best) { best = d; tgt = e; }
  }
  if (!tgt) return false;
  tgt.markedBy = s.id;
  tgt.markedUntil = w.time + 8;
  w.tagged.set(tgt.id, w.time + 8); // the hunted are public — you KNOW
  w.emit({ type: 'psi_ping', pos: { ...tgt.pos }, soldierId: tgt.id });
  w.emit({ type: 'vo', text: 'vo_reaper_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) { s.nextLswAt = w.time + (chain(w, s) ? 4 : 0.5); }
  if (w.time >= (s.nextLswActiveAt ?? 0) && mark(w, s)) s.nextLswActiveAt = w.time + 10;
}

export function active(w: World, s: Soldier): boolean {
  // Q: the chain from the crosshair; nobody on the line → mark the hunt.
  return chain(w, s) || mark(w, s);
}
