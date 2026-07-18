// ---------------------------------------------------------------------------
// PHANTOM — infiltrator, hover, silent. One brain file per LSW (§5),
// deterministic, DOM-free. PHASES through walls and strikes out of them;
// possesses a BOT / turret / vehicle for 3s — never a human (the law).
// K9 noses smell him: a dog near the exit blows the strike (§ counter).
// ---------------------------------------------------------------------------
import { GRID, T_OPEN, T_RUBBLE, TILE, WORLD, tileAt } from '../map';
import type { Soldier, Turret, Vehicle } from '../types';
import type { World } from '../world';

/** THE PHASE: walk INTO the wall you face and out the far side (runs up to
 *  3 tiles thick), then STRIKE out of it — a blade for whoever camped the
 *  safe side. A K9 within nose range of the EXIT smells him coming: the
 *  strike is blown and so is his cover. */
function phase(w: World, s: Soldier): boolean {
  const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
  // find the wall face: first blocking tile along the aim within 5 tiles
  let inWall = -1;
  for (let step = 1; step <= 5; step++) {
    const t = tileAt(w.map.grid, s.pos.x + fx * step * TILE, s.pos.z + fz * step * TILE);
    if (t !== T_OPEN && t !== T_RUBBLE) { inWall = step; break; }
  }
  if (inWall < 0) return false; // nothing to phase through
  // emerge at the first walkable tile past the run (max 3 tiles thick)
  let exit: { x: number; z: number } | undefined;
  for (let past = inWall + 1; past <= inWall + 3; past++) {
    const x = s.pos.x + fx * past * TILE, z = s.pos.z + fz * past * TILE;
    if (x < -WORLD / 2 + TILE || x > WORLD / 2 - TILE || z < -WORLD / 2 + TILE || z > WORLD / 2 - TILE) break;
    const t = tileAt(w.map.grid, x, z);
    if (t === T_OPEN || t === T_RUBBLE) { exit = { x, z }; break; }
  }
  if (!exit) return false; // the wall is a bunker — no far side in reach
  w.emit({ type: 'blink', pos: { ...s.pos } });
  s.pos = { x: exit.x, y: 0, z: exit.z };
  s.vel = { x: 0, y: 0, z: 0 };
  w.emit({ type: 'blink', pos: { ...s.pos } });
  // K9 COUNTER (the doc's column): a nose near the exit smells the ghost —
  // no strike, and his cover is blown for everyone to see.
  for (const d of w.soldiers.values()) {
    if (!d.alive || d.kind !== 'dog' || d.team === s.team) continue;
    if (Math.hypot(d.pos.x - s.pos.x, d.pos.z - s.pos.z) < 12) {
      s.cloaked = false;
      w.emit({ type: 'psi_ping', pos: { ...s.pos } });
      w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'phantom', soldierId: s.id });
      return true; // the phase happened — the dog just made it expensive
    }
  }
  // THE STRIKE out of the wall: nearest enemy at the exit takes the blade
  let victim: Soldier | undefined, best = 4.5;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best) { best = d; victim = e; }
  }
  if (victim) w.damageSoldier(victim, 50, s.id, 'smg');
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'phantom', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_phantom_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

/** THE RIDE: the nearest enemy MACHINE — bot, turret, or vehicle — is his
 *  for 3 seconds. Never a human: the API itself refuses flesh. */
function ride(w: World, s: Soldier): boolean {
  let bot: Soldier | undefined, bbest = 14;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.kind !== 'bot' || e.possessedBy !== undefined) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < bbest) { bbest = d; bot = e; }
  }
  if (bot && w.possessBot(bot, s, 3)) {
    w.emit({ type: 'vo', text: 'vo_phantom_ability', pos: { ...s.pos }, soldierId: s.id });
    return true;
  }
  let turret: Turret | undefined, tbest = 14;
  for (const t of w.turrets.values()) {
    if (!t.alive || t.team === s.team) continue;
    const d = Math.hypot(t.pos.x - s.pos.x, t.pos.z - s.pos.z);
    if (d < tbest) { tbest = d; turret = t; }
  }
  if (turret) {
    w.possessMachine(turret, s, 3);
    w.emit({ type: 'vo', text: 'vo_phantom_ability', pos: { ...s.pos }, soldierId: s.id });
    return true;
  }
  let veh: Vehicle | undefined, vbest = 14;
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team || v.possessedBy !== undefined) continue;
    const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
    if (d < vbest) { vbest = d; veh = v; }
  }
  if (veh && w.possessVehicle(veh, s, 3)) {
    w.emit({ type: 'vo', text: 'vo_phantom_ability', pos: { ...s.pos }, soldierId: s.id });
    return true;
  }
  return false;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) {
    // steal the nearest machine when one's in reach; otherwise ghost a wall
    s.nextLswAt = w.time + (ride(w, s) ? 6 : phase(w, s) ? 4 : 0.7);
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: phase through the wall you face; no wall → take the nearest machine.
  return phase(w, s) || ride(w, s);
}
