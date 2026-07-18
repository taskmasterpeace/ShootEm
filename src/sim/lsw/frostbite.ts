// ---------------------------------------------------------------------------
// FROSTBITE ⭐ — controller. One brain file per LSW (§5), deterministic,
// DOM-free. THE ICE BLOCK is the shared encase system (world.encaseSoldier);
// this file is the targeting — the bot's cadence freeze and the pilot's
// aimed freeze.
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

export function step(w: World, s: Soldier, _dt: number) {
  // THE ICE BLOCK (§21.6 flagship): freeze the nearest enemy in reach on a
  // cadence. One at a time, close — the block is the threat, not DPS.
  // BOT-ONLY: a human pilot aims the freeze on Q; auto-freezing under a
  // player's feet would steal the one decision that makes him fun.
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    let victim: Soldier | undefined, best = 16;
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.encasedUntil !== undefined || e.vehicleId >= 0) continue;
      const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
      if (d < best && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) { best = d; victim = e; }
    }
    if (victim && w.encaseSoldier(victim)) {
      s.nextLswAt = w.time + 4;
      w.emit({ type: 'vo', text: 'vo_frostbite_ability', pos: { ...s.pos }, soldierId: s.id });
    }
  }
}

export function active(w: World, s: Soldier): boolean {
  // freeze the soldier you're AIMING at: nearest enemy in a ~40° cone, 20u,
  // LOS — angular miss weighs heavier than distance so the ice goes where
  // the crosshair says, not where the crowd is.
  let victim: Soldier | undefined, best = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.encasedUntil !== undefined || e.vehicleId >= 0) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 20) continue;
    let ang = Math.atan2(dz, dx) - s.yaw;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (Math.abs(ang) > 0.7) continue;
    const score = d + Math.abs(ang) * 12;
    if (score < best && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) { best = score; victim = e; }
  }
  if (victim && w.encaseSoldier(victim)) {
    w.emit({ type: 'lsw_active', pos: { ...victim.pos }, text: 'frostbite', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_frostbite_ability', pos: { ...s.pos }, soldierId: s.id });
    return true;
  }
  return false;
}
