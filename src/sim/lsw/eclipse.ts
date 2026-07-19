// ---------------------------------------------------------------------------
// ECLIPSE — darkness controller, levitates. One brain file per LSW (§5),
// deterministic, DOM-free. The moving darkness (a smoke trail the perception
// system blinds through) + the full dome on Q.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';
import { nearestEnemy } from './kit';

/** the full dome: a ring of smoke around her that vision dies in. */
function dome(w: World, s: Soldier) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    w.spawnGadget('smoke_field', s.team, s.id, { x: s.pos.x + Math.cos(a) * 5, y: 0, z: s.pos.z + Math.sin(a) * 5 }, Infinity, 8);
  }
  w.spawnGadget('smoke_field', s.team, s.id, { ...s.pos }, Infinity, 8);
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'eclipse', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_eclipse_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  // MOVING DARKNESS: she trails a smoke dome as she drifts — vision dies
  // inside (asymmetric sight is a Notes 🔧). Both bot and pilot trail it.
  const moving = Math.hypot(s.vel.x, s.vel.z) > 1;
  if (moving && w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + 0.6;
    w.spawnGadget('smoke_field', s.team, s.id, { ...s.pos }, Infinity, 6);
  }
  // THE DOME (bot): she used to never bloom it (active-only), reduced to a
  // passive smoke-trailer. Cast it when enemies have closed — strategic, not a
  // blind cadence (uses nextLswActiveAt, the bot's second-ability slot).
  if (w.time >= (s.nextLswActiveAt ?? 0) && nearestEnemy(w, s, 22, false)) {
    dome(w, s);
    s.nextLswActiveAt = w.time + 10;
  }
}

export function active(w: World, s: Soldier): boolean {
  dome(w, s);
  return true;
}
