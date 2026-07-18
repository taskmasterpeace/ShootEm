// ---------------------------------------------------------------------------
// VENATRIX — trapper. One brain file per LSW (§5), deterministic, DOM-free.
// The snap-traps ride ENCASE (the ice block's little sister — the world's
// gadget step springs them); the HARPOON reels one enemy across the open.
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

const MAX_TRAPS = 3;

/** plant a snap-trap at her feet — jaws in the grass, one glinting tooth */
function plant(w: World, s: Soldier) {
  const mine = [...w.gadgets.values()].filter((g) => g.type === 'snap_trap' && g.ownerId === s.id);
  if (mine.length >= MAX_TRAPS) return;
  w.spawnGadget('snap_trap', s.team, s.id, { ...s.pos }, 30, 90);
  w.emit({ type: 'mine_planted', pos: { ...s.pos }, soldierId: s.id });
}

/** THE HARPOON: reel the aimed enemy to her — a hard drag across the open.
 *  Returns false on a whiff (the key stays hot). */
function harpoon(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined || e.vehicleId >= 0) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 26 || d < 2) continue;
    let ang = Math.atan2(dz, dx) - s.yaw;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (Math.abs(ang) > 0.8) continue;
    const score = d + Math.abs(ang) * 10;
    if (score < best && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) { best = score; tgt = e; }
  }
  if (!tgt) return false;
  const dx = s.pos.x - tgt.pos.x, dz = s.pos.z - tgt.pos.z, d = Math.hypot(dx, dz) || 1;
  tgt.pushX += (dx / d) * 46; // the reel — dragged across the open
  tgt.pushZ += (dz / d) * 46;
  w.damageSoldier(tgt, 15, s.id, 'rg2'); // the barb bites going in
  w.emit({ type: 'lsw_active', pos: { ...tgt.pos }, text: 'venatrix', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_venatrix_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  // the huntress keeps her ground baited, and reels a wanderer on the slow play
  if (w.time >= (s.nextLswAt ?? 0)) { plant(w, s); s.nextLswAt = w.time + 6; }
  if (w.time >= (s.nextLswActiveAt ?? 0)) {
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id) continue;
      const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
      if (d > 6 && d < 26) {
        s.yaw = Math.atan2(e.pos.z - s.pos.z, e.pos.x - s.pos.x);
        if (harpoon(w, s)) { s.nextLswActiveAt = w.time + 8; return; }
      }
    }
    s.nextLswActiveAt = w.time + 0.6;
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: the harpoon, from the crosshair. (She also lays a trap at her heel on
  // every cast — a huntress never stops baiting.)
  plant(w, s);
  return harpoon(w, s);
}
