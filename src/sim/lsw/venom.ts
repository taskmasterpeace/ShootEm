// ---------------------------------------------------------------------------
// VENOM — attrition. One brain file per LSW (§5), deterministic, DOM-free.
// The poison volley lays contamination zones and the POISONED LEAK A VISIBLE
// TRAIL (the tag-pin); the acid glob STRIPS the armor plate whole.
// ---------------------------------------------------------------------------
import { losClear } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** the volley: contamination lobbed at the nearest knot of enemies */
function volley(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = 40;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best) { best = d; tgt = e; }
  }
  if (!tgt) return false;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p = { x: tgt.pos.x + Math.cos(a) * 2.5, y: 0, z: tgt.pos.z + Math.sin(a) * 2.5 };
    w.spawnGadget('smoke_field', s.team, s.id, p, Infinity, 8);
    w.spawnGadget('fire_field', s.team, s.id, p, 40, 6); // the bite in the fog
  }
  w.emit({ type: 'lsw_active', pos: { ...tgt.pos }, text: 'venom', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_venom_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

/** THE ACID GLOB: the aimed enemy's plate dissolves WHOLE — flesh is next */
function acid(w: World, s: Soldier): boolean {
  let tgt: Soldier | undefined, best = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, d = Math.hypot(dx, dz);
    if (d > 22) continue;
    let ang = Math.atan2(dz, dx) - s.yaw;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (s.kind === 'human' && Math.abs(ang) > 0.9) continue;
    const score = d + Math.abs(ang) * 8;
    if (score < best && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) { best = score; tgt = e; }
  }
  if (!tgt) return false;
  tgt.armor = 0; // the plate dissolves whole
  w.damageSoldier(tgt, 20, s.id, 'rg2');
  w.emit({ type: 'hit', pos: { ...tgt.pos }, weapon: 'rg2', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_venom_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // THE LEAK (passive): anyone standing in HIS contamination is TAGGED — the
  // poisoned leak a visible trail on every enemy screen.
  if (w.tick % 15 === 0) {
    for (const g of w.gadgets.values()) {
      if (g.type !== 'smoke_field' || g.ownerId !== s.id) continue;
      for (const e of w.soldiers.values()) {
        if (!e.alive || e.team === s.team) continue;
        if (Math.hypot(e.pos.x - g.pos.x, e.pos.z - g.pos.z) < 5) w.tagged.set(e.id, w.time + 3);
      }
    }
  }
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) { s.nextLswAt = w.time + (volley(w, s) ? 6 : 0.6); }
  if (w.time >= (s.nextLswActiveAt ?? 0) && acid(w, s)) s.nextLswActiveAt = w.time + 7;
}

export function active(w: World, s: Soldier): boolean {
  // Q: the acid glob from the crosshair; nothing in the cone → the volley.
  return acid(w, s) || volley(w, s);
}
