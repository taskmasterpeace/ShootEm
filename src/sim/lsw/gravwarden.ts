// ---------------------------------------------------------------------------
// GRAVITY WARDEN — controller, levitates. One brain file per LSW (§5),
// deterministic, DOM-free. The pull-then-slam rides the shared FORCE FIELDS;
// REVERSE GRAVITY rides the lift state (soldier physics owns the float).
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** PULL-THEN-SLAM: a 1.2s radial pull drags everyone near him inward, and
 *  the slam cashes it — damage + a hard shove for whoever arrived. */
function pullSlam(w: World, s: Soldier) {
  w.forceFields.push({ x: s.pos.x, z: s.pos.z, r: 12, radial: -6, team: s.team, ownerId: s.id, until: w.time + 1.2 });
  w.emit({ type: 'gravlift', pos: { ...s.pos } }); // the telegraph — you feel the tug
  s.nextLswAt = w.time + 1.2; // the slam lands when the pull closes (step watches)
  s.lswFlagA = true; // the slam is armed
  w.emit({ type: 'vo', text: 'vo_gravwarden_ability', pos: { ...s.pos }, soldierId: s.id });
}

function slam(w: World, s: Soldier) {
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 7) continue;
    w.damageSoldier(e, 50 * (1 - d / 9), s.id, 'gl');
    const inv = d > 0.01 ? 1 / d : 0;
    e.pushX += dx * inv * 24; e.pushZ += dz * inv * 24;
  }
  w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'gravwarden', soldierId: s.id });
}

/** REVERSE GRAVITY: enemies near him FLOAT for 2.5s — drifting, still able to
 *  shoot — then drop staggered. Returns false if nobody was in reach. */
function reverseGravity(w: World, s: Soldier): boolean {
  let lifted = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined || e.vehicleId >= 0) continue;
    if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) > 10) continue;
    e.liftedUntil = w.time + 2.5;
    w.emit({ type: 'gravlift', pos: { ...e.pos } });
    lifted++;
  }
  if (!lifted) return false;
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'gravwarden', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_gravwarden_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // an armed slam cashes when the pull closes — bot and pilot alike
  if (s.lswFlagA && w.time >= (s.nextLswAt ?? 0)) {
    s.lswFlagA = false;
    slam(w, s);
    s.nextLswAt = w.time + 5;
  }
  if (s.kind !== 'bot') return;
  // the bot: pull-slam when a crowd is near; reverse gravity on the slow play
  if (!s.lswFlagA && w.time >= (s.nextLswAt ?? 0)) {
    let near = 0;
    for (const e of w.soldiers.values()) {
      if (e.alive && e.team !== s.team && e.id !== s.id && Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) < 12) near++;
    }
    if (near >= 1) pullSlam(w, s); else s.nextLswAt = w.time + 0.5;
  }
  if (w.time >= (s.nextLswActiveAt ?? 0) && reverseGravity(w, s)) s.nextLswActiveAt = w.time + 11;
}

export function active(w: World, s: Soldier): boolean {
  // Q: REVERSE GRAVITY — float them, then drop them staggered. Whiff-safe.
  return reverseGravity(w, s);
}
