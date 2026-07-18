// ---------------------------------------------------------------------------
// VOIDWALKER — assassin, blink. One brain file per LSW (§5), deterministic,
// DOM-free. Teleport strikes; every blink leaves a 1s-fuse shadow at the
// DEPARTURE point (the burst timer the black hole already taught the world).
// Chasing him IS walking a cluster bomb.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** BLINK-STRIKE: vanish, reappear beside the aimed target, strike — and the
 *  spot he LEFT holds a 1s-fuse shadow. Returns false with nobody in reach. */
function blinkStrike(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 24 || d < 1.5) continue;
    let ang = Math.atan2(dz, dx) - s.yaw;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (s.kind === 'human' && Math.abs(ang) > 1.0) continue; // the pilot blinks where he looks
    const score = d + Math.abs(ang) * 6;
    if (score < best) { best = score; tgt = e; }
  }
  if (!tgt) return false;
  // the shadow stays where he STOOD — a 1s fuse on the shared burst timer
  w.blackHoles.push({ x: s.pos.x, z: s.pos.z, team: s.team, ownerId: s.id, burstAt: w.time + 1 });
  w.emit({ type: 'blink', pos: { ...s.pos } });
  // arrive at arm's length behind the mark
  const ang2 = Math.atan2(tgt.pos.z - s.pos.z, tgt.pos.x - s.pos.x);
  s.pos = { x: tgt.pos.x + Math.cos(ang2) * 1.2, y: 0, z: tgt.pos.z + Math.sin(ang2) * 1.2 };
  s.vel = { x: 0, y: 0, z: 0 };
  w.emit({ type: 'blink', pos: { ...s.pos } });
  w.damageSoldier(tgt, 55, s.id, 'rg2'); // the strike out of nowhere
  w.emit({ type: 'lsw_active', pos: { ...tgt.pos }, text: 'voidwalker', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_voidwalker_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (blinkStrike(w, s) ? 3.5 : 0.5);
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: blink-strike the one you're looking at. Whiff-safe.
  return blinkStrike(w, s);
}
