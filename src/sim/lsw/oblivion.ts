// ---------------------------------------------------------------------------
// OBLIVION — zoner, levitates. One brain file per LSW (§5), deterministic,
// DOM-free. Void bolts (arcing splash) + the black hole (a shared force
// field on a burst timer — world.stepBlackHoles owns the collapse).
// ---------------------------------------------------------------------------
import { WEAPONS } from '../data';
import type { Soldier } from '../types';
import type { World } from '../world';

/** an arcing energy round that lobs OVER cover and bursts with splash where
 *  it lands — fired at the nearest enemy in range. False if nothing to lob at. */
function bolt(w: World, s: Soldier): boolean {
  let d = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dd = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (dd < d) d = dd;
  }
  if (d === Infinity || d > WEAPONS.void_bolt.range) return false;
  w.throwProjectile(s, 'void_bolt', 1.6, WEAPONS.void_bolt.speed, true, Math.max(6, d));
  w.emit({ type: 'shot', pos: { x: s.pos.x, y: 1.4, z: s.pos.z }, weapon: 'void_bolt', soldierId: s.id });
  return true;
}

/**
 * THE OVERDRAW (M4, Robert: "the guy who can pull people in — he should have
 * the ability to be MORE POWERFUL with it, use more of his power").
 *
 * The hole is free at its floor and monstrous at his ceiling. Opening it
 * DRAINS the tank, and everything the well is scales with what he poured in:
 * reach, pull strength, how long it holds people, and the collapse at the
 * end. A drained Oblivion still fights — he just opens puddles until the
 * meter climbs back (and his meter climbs faster than anyone's, §M4).
 *
 * charge 0 (empty tank)  → r14, pull -5, a frag-grade pop
 * charge 1 (full tank)   → r20, pull -11, and a collapse that RAGDOLLS
 * (the 1.5s fuse never changes — see burstAt)
 */
function voidHole(w: World, s: Soldier) {
  const spend = Math.min(100, s.energy);
  const charge = spend / 100;
  s.energy -= spend; // the whole tank goes in — this is a commitment, not a tap
  const dx = Math.cos(s.yaw), dz = Math.sin(s.yaw);
  const x = s.pos.x + dx * 8, z = s.pos.z + dz * 8;
  // THE FUSE IS A PROMISE, NOT A DIAL. The telegraph stays 1.5s at every
  // charge: §counterplay documents "you have a second and a half to leave"
  // and two shipped tests pin it. Scaling the fuse with power would have
  // handed the STRONGEST holes the LONGEST escape window — backwards, and a
  // silent break of a published contract. The overdraw buys reach, pull, and
  // the collapse; the way out is always the same size.
  const burstAt = w.time + 1.5;
  const r = 14 + charge * 6;
  const pull = -(5 + charge * 6);
  w.blackHoles.push({ x, z, team: s.team, ownerId: s.id, burstAt, charge });
  w.forceFields.push({ x, z, r, radial: pull, team: s.team, ownerId: s.id, until: burstAt });
  w.emit({ type: 'gravlift', pos: { x, y: 0, z } }); // the telegraph
  w.emit({ type: 'lsw_active', pos: { x, y: 0, z }, text: 'oblivion', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_oblivion_ability', pos: { ...s.pos }, soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  // VOID BOLTS lobbed at range, and a BLACK HOLE dropped on a slower cadence
  // (reusing nextLswActiveAt on the bot). A human pilot opens the hole on Q.
  if (s.kind === 'bot') {
    if (w.time >= (s.nextLswAt ?? 0)) { bolt(w, s); s.nextLswAt = w.time + 1.4; }
    // the bot LEARNS THE OVERDRAW: it waits for a tank worth spending rather
    // than opening a puddle the instant the cooldown lifts (below 55 it keeps
    // lobbing bolts — and its meter is refilling the whole time)
    if (w.time >= (s.nextLswActiveAt ?? 0) && s.energy >= 55) {
      voidHole(w, s);
      s.nextLswActiveAt = w.time + 8;
    }
  }
}

export function active(w: World, s: Soldier): boolean {
  voidHole(w, s);
  return true;
}
