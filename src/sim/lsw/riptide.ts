// ---------------------------------------------------------------------------
// RIPTIDE — counter-pick, water-strong. One brain file per LSW (§5),
// deterministic, DOM-free. BOTH abilities ride the shared FORCE FIELDS
// (§4.4 #2): the traveling wave is a directional current + a fire purge, the
// whirlpool is a radial pull that DOUBLES on real water.
// ---------------------------------------------------------------------------
import { T_DEEP, T_WATER, tileAt } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** THE WAVE: a wall of water down his aim — everyone in the corridor is
 *  shoved back along it, and EVERY FLAME in its path is extinguished (the
 *  answer to every fire character). */
function wave(w: World, s: Soldier) {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  // a short-lived directional current sweeping the corridor ahead
  w.forceFields.push({
    x: s.pos.x + fx * 9, z: s.pos.z + fz * 9, r: 10,
    radial: 0, fx: fx * 9, fz: fz * 9,
    team: s.team, ownerId: s.id, until: w.time + 0.8,
  });
  // the douse: every fire field inside the corridor dies with a hiss
  for (const [gid, g] of w.gadgets) {
    if (g.type !== 'fire_field') continue;
    const dx = g.pos.x - s.pos.x, dz = g.pos.z - s.pos.z;
    const along = dx * fx + dz * fz;
    if (along < 0 || along > 18) continue;
    if (Math.abs(dx * fz - dz * fx) > 6) continue;
    w.gadgets.delete(gid);
    w.emit({ type: 'gadget_destroyed', pos: { ...g.pos } });
  }
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'riptide', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_riptide_ability', pos: { ...s.pos }, soldierId: s.id });
}

/** THE WHIRLPOOL: a pull painted a few strides down his aim — leave the
 *  circle early or be dragged to its eye. DOUBLED on real water. */
function whirlpool(w: World, s: Soldier) {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  const x = s.pos.x + fx * 10, z = s.pos.z + fz * 10;
  const onWater = (() => { const t = tileAt(w.map.grid, x, z); return t === T_WATER || t === T_DEEP; })();
  w.forceFields.push({ x, z, r: 9, radial: onWater ? -8 : -4, team: s.team, ownerId: s.id, until: w.time + 3 });
  w.emit({ type: 'gravlift', pos: { x, y: 0, z } }); // the painted circle — the telegraph
  w.emit({ type: 'vo', text: 'vo_riptide_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  // the WAVE when enemies (or enemy fire) crowd his front; the WHIRLPOOL on
  // a slower cadence at whatever cluster he faces
  if (w.time >= (s.nextLswAt ?? 0)) {
    let ahead = false;
    const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id) continue;
      const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z;
      if (dx * fx + dz * fz > 0 && Math.hypot(dx, dz) < 16) { ahead = true; break; }
    }
    if (!ahead) {
      for (const g of w.gadgets.values()) {
        if (g.type !== 'fire_field' || g.team === s.team) continue;
        const dx = g.pos.x - s.pos.x, dz = g.pos.z - s.pos.z;
        if (dx * fx + dz * fz > 0 && Math.hypot(dx, dz) < 16) { ahead = true; break; }
      }
    }
    if (ahead) { wave(w, s); s.nextLswAt = w.time + 4; }
  }
  if (w.time >= (s.nextLswActiveAt ?? 0)) {
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id) continue;
      if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) < 20) {
        s.yaw = Math.atan2(e.pos.z - s.pos.z, e.pos.x - s.pos.x);
        whirlpool(w, s);
        s.nextLswActiveAt = w.time + 9;
        break;
      }
    }
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: THE WAVE — his signature; the whirlpool stays the bot's slow play
  wave(w, s);
  return true;
}
