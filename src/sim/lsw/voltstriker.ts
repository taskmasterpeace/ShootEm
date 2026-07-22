// ---------------------------------------------------------------------------
// VOLT STRIKER — anti-cluster. One brain file per LSW (§5), deterministic,
// DOM-free. Chain lightning (arcs to 3) + the 2s-fuse-or-bail overload.
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier, Vehicle } from '../types';
import type { World } from '../world';

/** the chain: a bolt finds the nearest enemy, then leaps to the next-nearest
 *  within arc range, up to three — clusters die together. The nearest enemy
 *  hull gets the OVERLOAD: seized, and a 2s fuse that detonates unless every
 *  crew member bails. Returns false if nothing was in reach (whiff-safe). */
function chain(w: World, s: Soldier): boolean {
  const RANGE = 22, ARC = 9;
  const hit = new Set<number>();
  const links: Soldier[] = [];
  let from = { x: s.pos.x, z: s.pos.z };
  for (let link = 0; link < 3; link++) {
    let best: Soldier | undefined, bestScore = Infinity;
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id || hit.has(e.id) || e.encasedUntil !== undefined) continue;
      const dx = e.pos.x - from.x, dz = e.pos.z - from.z, d = Math.hypot(dx, dz);
      if (d > (link === 0 ? RANGE : ARC)) continue;
      let score = d;
      if (link === 0 && s.kind === 'human') {
        // the first bolt goes where the crosshair points
        let ang = Math.atan2(e.pos.z - s.pos.z, e.pos.x - s.pos.x) - s.yaw;
        while (ang > Math.PI) ang -= 2 * Math.PI;
        while (ang < -Math.PI) ang += 2 * Math.PI;
        if (Math.abs(ang) > 1.0) continue;
        score = d + Math.abs(ang) * 10;
      }
      if (score < bestScore && losClear(w.map.grid, { x: from.x, y: 1.4, z: from.z }, { ...e.pos, y: 1.4 })) { bestScore = score; best = e; }
    }
    if (!best) break;
    hit.add(best.id); links.push(best);
    from = { x: best.pos.x, z: best.pos.z };
  }
  // the nearest enemy hull in reach gets the fuse
  let veh: Vehicle | undefined, vd = 14;
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team) continue;
    const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
    if (d < vd) { vd = d; veh = v; }
  }
  if (links.length === 0 && !veh) return false;
  // MEASURED (threat rig): [70,48,32] on a 1.6s bot cadence WIPED his own
  // designated answer — a T1 that beats a 4-squad is mislabeled. Trimmed to
  // keep him a glass cannon that punishes clustering without owning the ring.
  const dmg = [55, 38, 26];
  links.forEach((e, i) => {
    w.damageSoldier(e, dmg[i] ?? 30, s.id, 'rg2');
    w.emit({ type: 'emp', pos: { ...e.pos } });
  });
  if (veh && veh.overloadAt === undefined) {
    // THE FULL OVERLOAD (the doc's exact gamble): the hull seizes and a 2s
    // fuse starts — it DETONATES unless every crew member bails. Exiting is
    // never blocked by the stun; the stun only kills the escape-by-driving.
    veh.stunnedUntil = Math.max(veh.stunnedUntil, w.time + 2.2);
    veh.overloadAt = w.time + 2;
    w.overloadCount++; // opt #27: the fuse scan wakes
    veh.overloadBy = s.id;
    veh.overloadTeam = s.team;
    w.emit({ type: 'emp', pos: { ...veh.pos } });
    w.emit({ type: 'beacon_planted', pos: { ...veh.pos }, soldierId: s.id, text: 'OVERLOADED — BAIL OUT' });
  }
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'voltstriker', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_voltstriker_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // 2.6s bot cadence (measured: 1.6s left the answering squad no windows)
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (chain(w, s) ? 2.6 : 0.5);
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: chain lightning from the crosshair; a true whiff keeps the key hot.
  return chain(w, s);
}
