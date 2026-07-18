// ---------------------------------------------------------------------------
// WRAITH — machine thief, levitates. One brain file per LSW (§5),
// deterministic, DOM-free. POSSESS rides the shared timed-possession system
// (§4.4 #4): expiry hands machines home, EMP evicts instantly.
// ---------------------------------------------------------------------------
import type { Soldier, Turret, Vehicle } from '../types';
import type { World } from '../world';

/** SEIZE the nearest enemy sentry (a 12s timed possession) and STALL the
 *  nearest enemy vehicle (EMP), draining a heal from each take. Returns
 *  false if there was nothing to take. */
function possess(w: World, s: Soldier): boolean {
  let did = false;
  let turret: Turret | undefined, tbest = 16;
  for (const t of w.turrets.values()) {
    if (!t.alive || t.team === s.team) continue;
    const d = Math.hypot(t.pos.x - s.pos.x, t.pos.z - s.pos.z);
    if (d < tbest) { tbest = d; turret = t; }
  }
  if (turret) {
    w.possessMachine(turret, s, 12);
    s.hp = Math.min(s.maxHp, s.hp + 80); // drains the take
    did = true;
  }
  let veh: Vehicle | undefined, vbest = 16;
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team) continue;
    const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
    if (d < vbest) { vbest = d; veh = v; }
  }
  if (veh) {
    veh.stunnedUntil = Math.max(veh.stunnedUntil, w.time + 3);
    w.emit({ type: 'emp', pos: { ...veh.pos } });
    s.hp = Math.min(s.maxHp, s.hp + 40);
    did = true;
  }
  if (did) {
    w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'wraith', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_wraith_ability', pos: { ...s.pos }, soldierId: s.id });
  }
  return did;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (possess(w, s) ? 5 : 1.5);
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: possess the nearest machine; a true whiff (nothing to take) stays hot.
  return possess(w, s);
}
