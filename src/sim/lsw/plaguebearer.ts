// ---------------------------------------------------------------------------
// PLAGUEBEARER — attrition. One brain file per LSW (§5), deterministic,
// DOM-free. Both abilities live here: the walking cloud and the
// vehicle-infect (the plague wagon).
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

export function step(w: World, s: Soldier, _dt: number) {
  // PRIMARY: a contamination cloud laid on the advance — quarantine canon,
  // straight from the Outbreak's gas. Drifts where he walks.
  const moving = Math.hypot(s.vel.x, s.vel.z) > 1;
  if (moving && w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + 0.7;
    w.spawnGadget('smoke_field', s.team, s.id, { ...s.pos }, Infinity, 10);
    // the cloud bites: reuse the fire_field's tick by spawning a paired
    // damage field (acid), short and close — the poison, not just the fog
    w.spawnGadget('fire_field', s.team, s.id, { ...s.pos }, 40, 6);
  }
  // SECONDARY — VEHICLE-INFECT: the nearest crewed enemy hull in reach
  // catches the plague — while it DRIVES it trails poison, so the crew
  // chooses: abandon the tank, or spread the outbreak. An engineer's field
  // repair cleanses it.
  if (s.kind === 'bot' && w.time >= (s.nextLswActiveAt ?? 0)) {
    for (const v of w.vehicles.values()) {
      if (!v.alive || v.team === s.team || v.infectedUntil !== undefined || !v.seats.some((i) => i >= 0)) continue;
      if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) > 14) continue;
      v.infectedUntil = w.time + 14;
      v.infectedTeam = s.team;
      w.emit({ type: 'beacon_planted', pos: { ...v.pos }, soldierId: s.id, text: 'INFECTED' });
      w.emit({ type: 'vo', text: 'vo_plaguebearer_ability', pos: { ...s.pos }, soldierId: s.id });
      s.nextLswActiveAt = w.time + 10;
      break;
    }
  }
}

export function active(w: World, s: Soldier): boolean {
  // the quarantine ring: a wall of plague around you — walk the ring
  // forward and the fight moves or chokes
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = { x: s.pos.x + Math.cos(a) * 4.5, y: 0, z: s.pos.z + Math.sin(a) * 4.5 };
    w.spawnGadget('smoke_field', s.team, s.id, p, Infinity, 10);
    w.spawnGadget('fire_field', s.team, s.id, p, 40, 6);
  }
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'plaguebearer', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_plaguebearer_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}
