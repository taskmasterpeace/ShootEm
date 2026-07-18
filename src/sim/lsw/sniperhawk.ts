// ---------------------------------------------------------------------------
// SNIPERHAWK — marksman. One brain file per LSW (§5), deterministic,
// DOM-free. The piercing rail + the artillery mark (Orbital Designator).
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** the rail: a hitscan line down his aim that pierces every body it crosses
 *  (LOS is checked from HIM to each target, so soldiers never shield each
 *  other). Walls and cover stop it. Returns bodies punched through. */
function rail(w: World, s: Soldier): number {
  const RANGE = 80;
  const dx = Math.cos(s.yaw), dz = Math.sin(s.yaw);
  let hits = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const ex = e.pos.x - s.pos.x, ez = e.pos.z - s.pos.z;
    const along = ex * dx + ez * dz;
    if (along <= 0 || along > RANGE) continue;
    if (Math.abs(ex * dz - ez * dx) > 1.5) continue; // perpendicular distance to the ray
    if (!losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) continue;
    w.damageSoldier(e, 90, s.id, 'rg2');
    hits++;
  }
  const end = { x: s.pos.x + dx * RANGE, y: 1.2, z: s.pos.z + dz * RANGE };
  w.emit({ type: 'shot', pos: { ...s.pos, y: 1.2 }, weapon: 'rg2', soldierId: s.id });
  w.emit({ type: 'lsw_active', pos: end, text: 'sniperhawk', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_sniperhawk_ability', pos: { ...s.pos }, soldierId: s.id });
  return hits;
}

/** the artillery mark: paint the nearest enemy with the shipped Orbital
 *  Designator — 3s arm, then the strike erases the spot. */
function mark(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = 90;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best) { best = d; tgt = e; }
  }
  if (!tgt) return false;
  w.spawnGadget('orbital', s.team, s.id, { x: tgt.pos.x, y: 0, z: tgt.pos.z }, 60);
  w.emit({ type: 'beacon_planted', pos: { ...tgt.pos }, soldierId: s.id, text: 'MARKED' });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // A bot rails on a 2.5s cadence and marks on a slower one (reusing
  // nextLswActiveAt as the mark timer, free on a bot); a human pilot rails
  // on Q.
  if (s.kind === 'bot') {
    if (w.time >= (s.nextLswAt ?? 0)) { rail(w, s); s.nextLswAt = w.time + 2.5; }
    if (w.time >= (s.nextLswActiveAt ?? 0) && mark(w, s)) s.nextLswActiveAt = w.time + 9;
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: fire the piercing rail straight down your line.
  rail(w, s);
  return true;
}
