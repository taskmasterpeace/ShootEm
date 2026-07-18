// ---------------------------------------------------------------------------
// INFERNO — skirmisher, TRUE FLIGHT. One brain file per LSW (§5),
// deterministic, DOM-free. Dive-bombing fireballs; a burning aura that cooks
// anyone within 6u OF HIM — measured in THREE dimensions, so altitude is
// safety for them and descent is exposure for him. Flight is his power AND
// his exposure: SAMs lock him aloft, small arms own him low.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

const CRUISE = 5.2; // over the 4u walls, under nothing

/** THE DIVE-BOMB: plunge on the nearest enemy and detonate — fire stays in
 *  the crater, and so does he for a moment (the exposure that pays for it) */
function diveBomb(w: World, s: Soldier): boolean {
  let victim: Soldier | undefined, best = 26;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best) { best = d; victim = e; }
  }
  if (!victim) return false;
  // the plunge: most of the gap closes NOW, and the sky is given up
  s.pos = {
    x: s.pos.x + (victim.pos.x - s.pos.x) * 0.8,
    y: Math.min(s.pos.y, 1.0),
    z: s.pos.z + (victim.pos.z - s.pos.z) * 0.8,
  };
  s.flightAlt = 0.8;
  s.diveAt = w.time + 2.4; // committed low until then — shoot him
  // the fireball
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const dd = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (dd > 5.5) continue;
    w.damageSoldier(e, 55 * (1 - dd / 7), s.id, 'flamer');
  }
  // fire stays in the crater
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    w.spawnGadget('fire_field', s.team, s.id, { x: s.pos.x + Math.cos(a) * 2, y: 0, z: s.pos.z + Math.sin(a) * 2 }, Infinity, 12);
  }
  w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'inferno', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_inferno_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // THE BURNING AURA (any kind): anyone within 6u of HIM cooks — a 3D six,
  // so his cruise keeps them safe and his dives put everyone in the oven.
  if (w.time >= (s.nextBoltAt ?? 0)) {
    s.nextBoltAt = w.time + 0.6;
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
      const dd = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z, e.pos.y - s.pos.y);
      if (dd > 6) continue;
      w.damageSoldier(e, 9, s.id, 'flamer');
      w.emit({ type: 'hit', pos: { ...e.pos }, weapon: 'flamer', soldierId: e.id });
    }
  }
  // flight duty cycle: cruise above the walls, unless a dive committed him low
  s.flightAlt = (s.diveAt ?? 0) > w.time ? 0.8 : CRUISE;
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (diveBomb(w, s) ? 7 : 1);
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: the dive-bomb (D3 keeps human hands off him — bots and the harness
  // drive this same signature through the same gate).
  return diveBomb(w, s);
}
