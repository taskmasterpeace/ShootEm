// ---------------------------------------------------------------------------
// GARGOYLE — skirmisher, TRUE FLIGHT. One brain file per LSW (§5),
// deterministic, DOM-free. The SCREAMING DIVE: the shriek IS the telegraph —
// 0.8s of warning, then the slam lands on the marked point. Hurt, he PERCHES
// on masonry as a stone turret: half damage while the perch stands — and
// DESTRUCTION is the counter: collapse the tile and he falls, stunned.
// ---------------------------------------------------------------------------
import { GRID, T_COVER, T_METAL, T_WALL, TILE, WORLD } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

const CRUISE = 5.2;
const PERCH_ALT = 1.8; // clinging to the parapet — in reach of rifles, half of them shrugged off

/** THE SHRIEK: mark the slam point and scream — everyone under it gets 0.8s */
function shriek(w: World, s: Soldier): boolean {
  if (s.diveAt !== undefined) return false; // one scream at a time
  let victim: Soldier | undefined, best = 26;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best) { best = d; victim = e; }
  }
  if (!victim) return false;
  s.diveAt = w.time + 0.8; // the telegraph — the whole point
  s.diveX = victim.pos.x; s.diveZ = victim.pos.z;
  s.perchTile = undefined; // off the perch the moment he screams
  w.emit({ type: 'lsw_active', pos: { x: s.diveX, y: 0, z: s.diveZ }, text: 'gargoyle', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_gargoyle_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

/** THE PERCH: cling to the nearest masonry and turn stone — half damage
 *  until somebody collapses the tile under his claws. */
function perch(w: World, s: Soldier): boolean {
  if (s.perchTile !== undefined) return false;
  const stx = Math.floor((s.pos.x + WORLD / 2) / TILE), stz = Math.floor((s.pos.z + WORLD / 2) / TILE);
  let best = -1, bd = Infinity;
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = stx + dx, tz = stz + dz;
      if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) continue;
      const t = w.map.grid[tz * GRID + tx];
      if (t !== T_WALL && t !== T_METAL && t !== T_COVER) continue;
      const d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = tz * GRID + tx; }
    }
  }
  if (best < 0) return false; // no masonry — no perch
  s.perchTile = best;
  const tx = best % GRID, tz = (best / GRID) | 0;
  s.pos = { x: (tx + 0.5) * TILE - WORLD / 2, y: s.pos.y, z: (tz + 0.5) * TILE - WORLD / 2 };
  s.vel = { x: 0, y: 0, z: 0 };
  s.flightAlt = PERCH_ALT;
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'gargoyle', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_gargoyle_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // the slam resolves (any kind): the scream promised, the stone delivers
  if (s.diveAt !== undefined && w.time >= s.diveAt && s.diveX !== undefined && s.diveZ !== undefined) {
    s.pos = { x: s.diveX, y: 0, z: s.diveZ };
    s.vel = { x: 0, y: 0, z: 0 };
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
      const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, dd = Math.hypot(dx, dz);
      if (dd > 4.5) continue;
      w.damageSoldier(e, 55 * (1 - dd / 6), s.id, 'gl');
      const inv = dd > 0.01 ? 1 / dd : 0;
      e.pushX += dx * inv * 22; e.pushZ += dz * inv * 22;
      e.nextFireAt = Math.max(e.nextFireAt, w.time + 0.8); // rattled
    }
    w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
    s.diveAt = undefined; s.diveX = undefined; s.diveZ = undefined;
    s.flightAlt = 0; // grounded in his own crater — the exposure
    s.nextWarpAt = w.time + 2; // borrowed stamp: grounded until then
  }
  // the perch watch (any kind): DESTRUCTION is the counter — tile gone, bird down
  if (s.perchTile !== undefined) {
    const t = w.map.grid[s.perchTile];
    if (t !== T_WALL && t !== T_METAL && t !== T_COVER) {
      // the perch collapsed under him — he falls, stunned, half-damage GONE
      s.perchTile = undefined;
      s.flightAlt = 0;
      s.nextFireAt = Math.max(s.nextFireAt, w.time + 1.5);
      s.nextLswAt = Math.max(s.nextLswAt ?? 0, w.time + 2);
      w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
    } else {
      s.vel = { x: 0, y: 0, z: 0 }; // stone doesn't pace
      s.flightAlt = PERCH_ALT;
    }
  } else if (s.diveAt === undefined && w.time >= (s.nextWarpAt ?? 0)) {
    s.flightAlt = CRUISE; // back to the sky
  }
  if (s.kind !== 'bot') return;
  // hurt and unperched → turn stone; otherwise scream and fall on someone
  if (s.perchTile === undefined && s.hp < s.maxHp * 0.55 && w.time >= (s.nextLswActiveAt ?? 0)) {
    if (perch(w, s)) s.nextLswActiveAt = w.time + 12;
  }
  if (w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (shriek(w, s) ? 8 : 1);
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: the screaming dive; nothing to fall on → turn stone on the nearest wall.
  return shriek(w, s) || perch(w, s);
}
