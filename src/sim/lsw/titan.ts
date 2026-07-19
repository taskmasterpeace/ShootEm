// ---------------------------------------------------------------------------
// TITAN — the colossus. One brain file per LSW (§5), deterministic, DOM-free.
// SEISMIC HANDS: grab-and-throw (vehicle or soldier), and the ground pound.
// ---------------------------------------------------------------------------
import { GRID, T_COVER, TILE, WORLD, losClear } from '../map';
import type { Soldier, Vehicle } from '../types';
import type { World } from '../world';
import { nearestEnemy } from './kit';

/** grab the topmost grabbable in his forward reach and HURL it — an enemy
 *  vehicle (crew ejected and flung, hull launched, stunned, cracked open) or
 *  the nearest enemy soldier (launched and hurt). Returns false on a whiff. */
function hurl(w: World, s: Soldier): boolean {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  const inCone = (dx: number, dz: number, cone: number) => {
    let a = Math.atan2(dz, dx) - s.yaw;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return Math.abs(a) <= cone;
  };
  // a vehicle first — the signature throw
  let veh: Vehicle | undefined, vbest = Infinity;
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team) continue;
    const dx = v.pos.x - s.pos.x, dz = v.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 10 || !inCone(dx, dz, 0.9)) continue;
    if (d < vbest) { vbest = d; veh = v; }
  }
  if (veh) {
    for (const sid of [...veh.seats]) {
      const crew = w.soldiers.get(sid);
      if (!crew) continue;
      w.exitVehicle(crew, veh);
      crew.pushX += fx * 32; crew.pushZ += fz * 32; crew.vel.y = 8;
      w.damageSoldier(crew, 45, s.id, 'gl');
    }
    veh.vel = { x: fx * 34, y: 10, z: fz * 34 };
    veh.stunnedUntil = w.time + 3;
    w.damageVehicle(veh, 260, s.id, 'gl');
    w.emit({ type: 'warp', pos: { ...veh.pos } });
    w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
    w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'titan', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_titan_ability', pos: { ...s.pos }, soldierId: s.id });
    return true;
  }
  // else the nearest enemy soldier in reach
  let vic: Soldier | undefined, best = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined || e.vehicleId >= 0) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 8 || !inCone(dx, dz, 0.9)) continue;
    if (d < best && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) { best = d; vic = e; }
  }
  if (!vic) return false;
  vic.pushX += fx * 40; vic.pushZ += fz * 40; vic.vel.y = 10;
  w.damageSoldier(vic, 70, s.id, 'gl');
  w.emit({ type: 'warp', pos: { ...vic.pos } });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'titan', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_titan_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

/** the ground pound: a slam at his feet — everyone close is hurt, THROWN, and
 *  rattled (a fire-rate stagger stands in for the movement-slow the design
 *  wants). Nearby armor is cracked open and cover tiles grind to rubble. */
function pound(w: World, s: Soldier): boolean {
  let hits = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 7) continue;
    hits++;
    w.damageSoldier(e, 45 * (1 - d / 9), s.id, 'gl');
    const inv = d > 0.01 ? 1 / d : 0;
    e.pushX += dx * inv * 22; e.pushZ += dz * inv * 22;
    e.nextFireAt = Math.max(e.nextFireAt, w.time + 0.9); // the shock rattles the aim
  }
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team) continue;
    const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
    if (d > 7) continue;
    w.damageVehicle(v, 60 * (1 - d / 9), s.id, 'gl');
    v.stunnedUntil = Math.max(v.stunnedUntil, w.time + 1.5);
  }
  // crack the cover around him to rubble — "nothing stays where it stands"
  const ptx = Math.floor((s.pos.x + WORLD / 2) / TILE), ptz = Math.floor((s.pos.z + WORLD / 2) / TILE);
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = ptx + dx, tz = ptz + dz;
      if (tx < 0 || tz < 0 || tx >= GRID || tz >= GRID) continue;
      if (w.map.grid[tz * GRID + tx] === T_COVER) w.digTile(tx, tz);
    }
  }
  w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'titan', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_titan_ability', pos: { ...s.pos }, soldierId: s.id });
  return hits > 0;
}

export function step(w: World, s: Soldier, _dt: number) {
  // Bot cadence: hurl what's in reach, pound when a crowd has closed.
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    // hurl what's in reach; if there's nothing to throw, POUND only when a body
    // is actually in the 7u shockwave — not a blind slam of the empty ground.
    if (hurl(w, s)) {
      s.nextLswAt = w.time + 4.5;
    } else if (nearestEnemy(w, s, 8, false)) {
      pound(w, s);
      s.nextLswAt = w.time + 4.5;
    } else {
      s.nextLswAt = w.time + 0.4; // nothing to hurl, no one to pound — hold
    }
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: hurl what he's aiming at; nothing to grab but a crowd close → pound.
  // A true whiff (nobody in reach at all) keeps the key hot.
  return hurl(w, s) || pound(w, s);
}
