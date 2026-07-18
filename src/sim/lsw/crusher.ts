// ---------------------------------------------------------------------------
// CRUSHER — bruiser. One brain file per LSW (§5), deterministic, DOM-free.
// The CHARGE smashes THROUGH cover (DESTRUCTION does the paperwork) — but a
// structural wall stops him cold and stuns HIM (bait the charge). The HURL
// throws terrain that BECOMES cover where it lands (hop-clearable, so the
// monotonic reachability law survives: boots vault what he builds).
// ---------------------------------------------------------------------------
import { GRID, T_COVER, T_OPEN, T_RUBBLE, T_WALL, TILE, WORLD, tileAt } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** THE CHARGE: 10u straight ahead — cover in the path is smashed to rubble,
 *  soldiers are bulldozed; a STRUCTURAL WALL stops him and stuns HIM. */
function charge(w: World, s: Soldier): boolean {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  let traveled = 0;
  for (let step = 1; step <= 10; step++) {
    const x = s.pos.x + fx * step, z = s.pos.z + fz * step;
    const t = tileAt(w.map.grid, x, z);
    if (t === T_WALL) {
      // the bait: a wall wins — he eats his own momentum
      s.nextFireAt = Math.max(s.nextFireAt, w.time + 1.5);
      s.nextLswAt = Math.max(s.nextLswAt ?? 0, w.time + 2);
      w.emit({ type: 'explosion', pos: { x, y: 0, z }, weapon: 'gl' });
      break;
    }
    if (t === T_COVER || t === T_RUBBLE) {
      const tx = Math.floor((x + WORLD / 2) / TILE), tz = Math.floor((z + WORLD / 2) / TILE);
      w.damageWall(tx, tz, 99999, true); // smashed THROUGH — destruction's ladder
    }
    traveled = step;
  }
  if (!traveled) return false;
  // bulldoze whoever stood in the lane
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const ex = e.pos.x - s.pos.x, ez = e.pos.z - s.pos.z;
    const along = ex * fx + ez * fz;
    if (along < 0 || along > traveled) continue;
    if (Math.abs(ex * fz - ez * fx) > 1.6) continue;
    w.damageSoldier(e, 55, s.id, 'gl');
    e.pushX += fx * 30; e.pushZ += fz * 30;
  }
  s.pos = { x: s.pos.x + fx * traveled, y: 0, z: s.pos.z + fz * traveled };
  s.vel = { x: 0, y: 0, z: 0 };
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'crusher', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_crusher_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

/** THE HURL: terrain thrown downrange BECOMES cover where it lands — the map
 *  remodels for whoever is smart enough to use it. Hop-clearable by law. */
function hurl(w: World, s: Soldier): boolean {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  const x = s.pos.x + fx * 8, z = s.pos.z + fz * 8;
  const tx = Math.floor((x + WORLD / 2) / TILE), tz = Math.floor((z + WORLD / 2) / TILE);
  if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) return false;
  const idx = tz * GRID + tx;
  if (w.map.grid[idx] !== T_OPEN) return false; // only bare ground takes new cover
  w.map.grid[idx] = T_COVER;
  w.emit({ type: 'dig', tile: idx, pos: { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 } });
  w.emit({ type: 'explosion', pos: { x, y: 0, z }, weapon: 'gl' });
  w.emit({ type: 'vo', text: 'vo_crusher_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) {
    // charge when someone is in the lane; otherwise remodel the ground
    let ahead = false;
    const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id) continue;
      const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z;
      if (dx * fx + dz * fz > 0 && Math.hypot(dx, dz) < 11) { ahead = true; break; }
    }
    if (ahead ? charge(w, s) : hurl(w, s)) s.nextLswAt = w.time + 5;
    else s.nextLswAt = w.time + 0.6;
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: the charge when somebody's in the lane; an empty lane hurls new cover.
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  let ahead = false;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z;
    if (dx * fx + dz * fz > 0 && Math.hypot(dx, dz) < 11) { ahead = true; break; }
  }
  return ahead ? charge(w, s) : (hurl(w, s) || charge(w, s));
}
