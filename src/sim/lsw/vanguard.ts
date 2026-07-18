// ---------------------------------------------------------------------------
// VANGUARD — breacher. One brain file per LSW (§5), deterministic, DOM-free.
// SHIELD BASH: a short charge that stuns and shoves the front. BARRICADES:
// shield domes that block BOTH sides' fire — placement is the skill.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** SHIELD BASH: a burst of forward momentum, and everyone in the front cone
 *  is stunned (guns locked) and SHOVED. Returns false on an empty front. */
function bash(w: World, s: Soldier): boolean {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  s.pushX += fx * 22; s.pushZ += fz * 22; // the charge itself
  let hit = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 7) continue;
    let ang = Math.atan2(dz, dx) - s.yaw;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (Math.abs(ang) > 0.9) continue;
    w.damageSoldier(e, 35, s.id, 'gl');
    e.pushX += fx * 30; e.pushZ += fz * 30;
    e.nextFireAt = Math.max(e.nextFireAt, w.time + 1.2); // the stun — guns locked
    hit++;
  }
  if (hit) {
    w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'vanguard', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_vanguard_ability', pos: { ...s.pos }, soldierId: s.id });
  }
  return hit > 0;
}

/** BARRICADE: a shield dome that blocks BOTH sides' fire — his own wall can
 *  cage his own team. Placement is the whole skill. */
function barricade(w: World, s: Soldier) {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  const pos = { x: s.pos.x + fx * 3, y: 0, z: s.pos.z + fz * 3 };
  const g = w.spawnGadget('shield', s.team, s.id, pos, 300, 25);
  g.bothSides = true; // the projectile step swallows EVERYONE'S rounds
  w.emit({ type: 'turret_built', pos, soldierId: s.id, team: s.team });
  w.emit({ type: 'vo', text: 'vo_vanguard_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  // bash whatever crowds his shield; wall a lane on the slow play
  if (w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (bash(w, s) ? 4 : 0.6);
  }
  if (w.time >= (s.nextLswActiveAt ?? 0)) { barricade(w, s); s.nextLswActiveAt = w.time + 12; }
}

export function active(w: World, s: Soldier): boolean {
  // Q: the bash. A whiffed charge still moves him — but the key stays hot
  // only when the shield actually MET someone.
  return bash(w, s);
}
