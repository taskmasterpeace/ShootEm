// ---------------------------------------------------------------------------
// SHADOWSTEP — assassin, blink. One brain file per LSW (§5), deterministic,
// DOM-free. Blink behind, stab — and the DEPARTURE point holds a live MINE:
// chasing him IS the trap ("blows on touch", the shipped mine system).
// ---------------------------------------------------------------------------
import type { Mine, Soldier } from '../types';
import type { World } from '../world';

function blinkStab(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 22 || d < 1.5) continue;
    let ang = Math.atan2(dz, dx) - s.yaw;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (s.kind === 'human' && Math.abs(ang) > 1.0) continue;
    const score = d + Math.abs(ang) * 6;
    if (score < best) { best = score; tgt = e; }
  }
  if (!tgt) return false;
  // the DEPARTURE DECOY: a live mine where he stood — blows on touch
  const m: Mine = { id: w.id(), team: s.team, ownerId: s.id, pos: { x: s.pos.x, y: 0, z: s.pos.z }, armedAt: w.time + 0.4 };
  w.mines.set(m.id, m);
  w.emit({ type: 'mine_planted', pos: m.pos, soldierId: s.id });
  w.emit({ type: 'blink', pos: { ...s.pos } });
  // arrive BEHIND the mark
  const ang2 = Math.atan2(tgt.pos.z - s.pos.z, tgt.pos.x - s.pos.x);
  s.pos = { x: tgt.pos.x + Math.cos(ang2) * 1.1, y: 0, z: tgt.pos.z + Math.sin(ang2) * 1.1 };
  s.vel = { x: 0, y: 0, z: 0 };
  w.emit({ type: 'blink', pos: { ...s.pos } });
  w.damageSoldier(tgt, 50, s.id, 'rg2'); // the stab
  w.emit({ type: 'lsw_active', pos: { ...tgt.pos }, text: 'shadowstep', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_shadowstep_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (blinkStab(w, s) ? 4 : 0.5);
  }
}

export function active(w: World, s: Soldier): boolean {
  return blinkStab(w, s);
}
