// ---------------------------------------------------------------------------
// PYROCLASM — zoner. One brain file per LSW (§5), deterministic, DOM-free.
// Molten rocks (arc rounds with the shipped fire payload) leave long-lived
// lava pools; at 25% HP he ERUPTS — the room's DPS check made flesh.
// ---------------------------------------------------------------------------
import { WEAPONS } from '../data';
import type { Soldier } from '../types';
import type { World } from '../world';

/** hurl a molten rock at the nearest enemy — the pool it leaves is the point */
function magma(w: World, s: Soldier): boolean {
  let d = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dd = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (dd < d) d = dd;
  }
  if (d === Infinity || d > WEAPONS.magma_rock.range) return false;
  w.throwProjectile(s, 'magma_rock', 1.6, WEAPONS.magma_rock.speed, true, Math.max(6, d));
  w.emit({ type: 'shot', pos: { x: s.pos.x, y: 1.4, z: s.pos.z }, weapon: 'magma_rock', soldierId: s.id });
  return true;
}

/** THE ERUPTION — fires ONCE, the moment he crosses a quarter HP. Burst the
 *  threshold or poke and pray: the room decides. */
function erupt(w: World, s: Soldier) {
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 12) continue;
    w.damageSoldier(e, 70 * (1 - dd / 14), s.id, 'gl');
    const inv = dd > 0.01 ? 1 / dd : 0;
    e.pushX += dx * inv * 28; e.pushZ += dz * inv * 28;
  }
  // the lava field the eruption leaves — the room is HIS now
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    w.spawnGadget('fire_field', s.team, s.id, { x: s.pos.x + Math.cos(a) * 4, y: 0, z: s.pos.z + Math.sin(a) * 4 }, Infinity, 20);
  }
  w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'pyroclasm', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_pyroclasm_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  // THE THRESHOLD (passive, bot and pilot alike): crossing 25% detonates the
  // eruption exactly once — range the threshold, or burst through it.
  if (!s.lswFlagA && s.hp <= s.maxHp * 0.25) {
    s.lswFlagA = true;
    erupt(w, s);
  }
  if (s.kind === 'bot' && w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (magma(w, s) ? 2.2 : 0.5);
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: a three-rock volley down the lane — the pools are the argument
  let threw = false;
  for (let i = 0; i < 3; i++) threw = magma(w, s) || threw;
  if (threw) w.emit({ type: 'vo', text: 'vo_pyroclasm_ability', pos: { ...s.pos }, soldierId: s.id });
  return threw;
}
