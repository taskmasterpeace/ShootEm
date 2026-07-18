// ---------------------------------------------------------------------------
// CRIMSON — attrition. One brain file per LSW (§5), deterministic, DOM-free.
// The LIFE-DRAIN leeches the nearest enemy in reach; consuming a fresh corpse
// raises ONE blood brute — unless fire has burned the pool first.
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** the drain tick: leech the nearest enemy in line — half of it comes home */
function drain(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = 14;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) { best = d; tgt = e; }
  }
  if (!tgt) return false;
  w.damageSoldier(tgt, 10, s.id, 'rg2');
  s.hp = Math.min(s.maxHp, s.hp + 5);
  w.emit({ type: 'heal', pos: { ...s.pos }, soldierId: s.id });
  w.emit({ type: 'hit', pos: { ...tgt.pos }, weapon: 'rg2', soldierId: s.id });
  return true;
}

/** consume a fresh corpse within reach and raise ONE blood brute — fire on
 *  the pool denies him (the doc's counter). Returns false with nothing to eat. */
function consume(w: World, s: Soldier): boolean {
  // only one brute walks at a time
  for (const o of w.soldiers.values()) {
    if (o.alive && o.name === 'BLOOD BRUTE' && o.team === s.team) return false;
  }
  for (const corpse of w.soldiers.values()) {
    if (corpse.alive || corpse.lswFlagA || corpse.team === s.team) continue;
    if (corpse.kind !== 'bot' && corpse.kind !== 'human') continue;
    const d = Math.hypot(corpse.pos.x - s.pos.x, corpse.pos.z - s.pos.z);
    if (d > 12) continue;
    // BURN THE POOLS: a corpse lying in fire is spent — the pool is ash
    let burned = false;
    for (const g of w.gadgets.values()) {
      if (g.type === 'fire_field' && Math.hypot(g.pos.x - corpse.pos.x, g.pos.z - corpse.pos.z) < 5) { burned = true; break; }
    }
    if (burned) continue;
    corpse.lswFlagA = true; // the pool is drunk — never twice
    const brute = w.addSoldier('BLOOD BRUTE', 'heavy', s.team, 'bot');
    brute.pos = { x: corpse.pos.x, y: 0, z: corpse.pos.z };
    brute.alive = true; brute.respawnAt = 0;
    brute.hp = 320; brute.maxHp = 320; // a brute's constitution, canon
    w.emit({ type: 'warp', pos: { ...corpse.pos } });
    w.emit({ type: 'lsw_active', pos: { ...corpse.pos }, text: 'crimson', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_crimson_ability', pos: { ...s.pos }, soldierId: s.id });
    return true;
  }
  return false;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (drain(w, s) ? 0.5 : 0.3); // the beam is a rhythm, not a burst
  }
  if (w.time >= (s.nextLswActiveAt ?? 0) && consume(w, s)) s.nextLswActiveAt = w.time + 6;
}

export function active(w: World, s: Soldier): boolean {
  // Q: drink the nearest pool and raise the brute; nothing to drink = drain
  // instead. Whiff-safe only when BOTH come up dry.
  return consume(w, s) || drain(w, s);
}
