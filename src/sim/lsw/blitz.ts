// ---------------------------------------------------------------------------
// BLITZ — momentum. One brain file per LSW (§5), deterministic, DOM-free.
// DASH-STRIKE: a burst of speed into a cut; a KILL refunds the dash. The
// AFTERIMAGES replay his last two dash paths as damaging lines — the
// recorder, weaponized. He's paper between dashes.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** DASH-STRIKE toward the aimed enemy: momentum + a cut on arrival. A kill
 *  inside the strike refunds the cooldown (the caller checks the refund). */
function dash(w: World, s: Soldier): { hit: boolean; killed: boolean } {
  let tgt: Soldier | undefined, best = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 16 || d < 1) continue;
    let ang = Math.atan2(dz, dx) - s.yaw;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (s.kind === 'human' && Math.abs(ang) > 1.0) continue;
    const score = d + Math.abs(ang) * 6;
    if (score < best) { best = score; tgt = e; }
  }
  if (!tgt) return { hit: false, killed: false };
  // record the dash path — the afterimage will walk it again
  s.lswTrail = s.lswTrail ?? [];
  s.lswTrail.push({ x: s.pos.x, z: s.pos.z }, { x: tgt.pos.x, z: tgt.pos.z });
  if (s.lswTrail.length > 4) s.lswTrail.splice(0, s.lswTrail.length - 4); // the last TWO paths
  const ang2 = Math.atan2(tgt.pos.z - s.pos.z, tgt.pos.x - s.pos.x);
  w.emit({ type: 'blink', pos: { ...s.pos } });
  s.pos = { x: tgt.pos.x - Math.cos(ang2) * 1.0, y: 0, z: tgt.pos.z - Math.sin(ang2) * 1.0 };
  s.vel = { x: 0, y: 0, z: 0 };
  w.damageSoldier(tgt, 60, s.id, 'rg2');
  const killed = !tgt.alive;
  w.emit({ type: 'lsw_active', pos: { ...tgt.pos }, text: 'blitz', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_blitz_ability', pos: { ...s.pos }, soldierId: s.id });
  return { hit: true, killed };
}

/** THE AFTERIMAGES: his last two dash paths replay as damaging lines — the
 *  ground he already crossed becomes a weapon. */
function afterimages(w: World, s: Soldier): boolean {
  const t = s.lswTrail ?? [];
  if (t.length < 2) return false;
  let hit = 0;
  for (let seg = 0; seg + 1 < t.length; seg += 2) {
    const a = t[seg], b = t[seg + 1];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
      const ex = e.pos.x - a.x, ez = e.pos.z - a.z;
      const along = ex * ux + ez * uz;
      if (along < 0 || along > len) continue;
      if (Math.abs(ex * uz - ez * ux) > 1.5) continue;
      w.damageSoldier(e, 35, s.id, 'rg2');
      hit++;
    }
    w.emit({ type: 'blink', pos: { x: a.x, y: 0.5, z: a.z } });
    w.emit({ type: 'blink', pos: { x: b.x, y: 0.5, z: b.z } });
  }
  if (hit) w.emit({ type: 'vo', text: 'vo_blitz_ability', pos: { ...s.pos }, soldierId: s.id });
  return hit > 0;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) {
    const r = dash(w, s);
    // a kill inside the strike refunds the dash — the chain is the character
    s.nextLswAt = w.time + (r.hit ? (r.killed ? 0.2 : 4) : 0.5);
  }
  if (w.time >= (s.nextLswActiveAt ?? 0) && afterimages(w, s)) s.nextLswActiveAt = w.time + 8;
}

export function active(w: World, s: Soldier): boolean {
  // Q: the dash-strike. A kill refunds it on the spot.
  const r = dash(w, s);
  if (r.killed) { s.nextLswActiveAt = 0; return false; } // refunded — the key stays hot
  return r.hit;
}
