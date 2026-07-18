// ---------------------------------------------------------------------------
// LEVIATHAN — boss, massive. One brain file per LSW (§5), deterministic,
// DOM-free. Terrain-flattening SWEEPS (DESTRUCTION does the paperwork) and
// the BELLY FLOP: a map-scale leap whose landing is SHADOW-TELEGRAPHED for
// a second and a half — scatter from the shadow, the RIM eats the shockwave.
// And he's SOFT MID-AIR: the flop is the AA window (damage lands 1.6x).
// ---------------------------------------------------------------------------
import { T_COVER, T_RUBBLE, TILE, WORLD, tileAt } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** THE SWEEP: everything in the forward arc is flattened — cover included */
function sweep(w: World, s: Soldier): boolean {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  let hit = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 6 || dx * fx + dz * fz < 0) continue;
    w.damageSoldier(e, 45, s.id, 'gl');
    const inv = dd > 0.01 ? 1 / dd : 0;
    e.pushX += dx * inv * 26; e.pushZ += dz * inv * 26;
    hit++;
  }
  // the arc flattens TERRAIN too — cover in front of him stops existing
  for (let step = 1; step <= 2; step++) {
    for (let side = -1; side <= 1; side++) {
      const x = s.pos.x + fx * step * TILE + fz * side * TILE;
      const z = s.pos.z + fz * step * TILE - fx * side * TILE;
      const t = tileAt(w.map.grid, x, z);
      if (t === T_COVER || t === T_RUBBLE) {
        const tx = Math.floor((x + WORLD / 2) / TILE), tz = Math.floor((z + WORLD / 2) / TILE);
        w.damageWall(tx, tz, 99999, true);
        hit++;
      }
    }
  }
  if (hit) w.emit({ type: 'explosion', pos: { x: s.pos.x + fx * 3, y: 0, z: s.pos.z + fz * 3 }, weapon: 'gl' });
  return hit > 0;
}

/** THE BELLY FLOP: leap at the far cluster — the SHADOW marks the landing
 *  for 1.5s (scatter!), the rim eats the shockwave, and mid-air he's SOFT. */
function bellyFlop(w: World, s: Soldier): boolean {
  if (s.diveAt !== undefined) return false; // already airborne
  let victim: Soldier | undefined, best = 60;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d >= 8 && d < best) { best = d; victim = e; } // a flop needs distance
  }
  if (!victim) return false;
  s.diveAt = w.time + 1.5; // the shadow's warning — the whole point
  s.diveX = victim.pos.x; s.diveZ = victim.pos.z;
  s.pos = { x: s.pos.x, y: 2.2, z: s.pos.z }; // up he goes — chest in AA reach, SOFT
  w.emit({ type: 'lsw_active', pos: { x: s.diveX, y: 0, z: s.diveZ }, text: 'leviathan', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_leviathan_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, dt: number) {
  // mid-flop (any kind): glide toward the shadow, land ON it, rim shockwave
  if (s.diveAt !== undefined && s.diveX !== undefined && s.diveZ !== undefined) {
    const left = s.diveAt - w.time;
    if (left > 0) {
      // the glide — a mountain crossing the sky at knee height of the sky
      const k = Math.min(1, dt / Math.max(left, dt));
      s.pos = { x: s.pos.x + (s.diveX - s.pos.x) * k, y: 2.2, z: s.pos.z + (s.diveZ - s.pos.z) * k };
      s.vel = { x: 0, y: 0, z: 0 };
    } else {
      s.pos = { x: s.diveX, y: 0, z: s.diveZ };
      s.vel = { x: 0, y: 0, z: 0 };
      // THE RIM SHOCKWAVE: the ring eats it — dead center was never the danger
      for (const e of w.soldiers.values()) {
        if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
        const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, dd = Math.hypot(dx, dz);
        if (dd > 9) continue; // scattered clear — the shadow gave you the time
        w.damageSoldier(e, dd < 3 ? 70 : 55, s.id, 'gl');
        const inv = dd > 0.01 ? 1 / dd : 0;
        e.pushX += dx * inv * 34; e.pushZ += dz * inv * 34;
      }
      w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
      w.emit({ type: 'explosion', pos: { x: s.pos.x + 4, y: 0, z: s.pos.z }, weapon: 'gl' });
      w.emit({ type: 'explosion', pos: { x: s.pos.x - 4, y: 0, z: s.pos.z }, weapon: 'gl' });
      s.diveAt = undefined; s.diveX = undefined; s.diveZ = undefined;
    }
  }
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (sweep(w, s) ? 3 : 0.8);
  }
  if (w.time >= (s.nextLswActiveAt ?? 0) && bellyFlop(w, s)) s.nextLswActiveAt = w.time + 12;
}

export function active(w: World, s: Soldier): boolean {
  // Q: the belly flop; nobody far enough to flop on → the sweep.
  return bellyFlop(w, s) || sweep(w, s);
}
