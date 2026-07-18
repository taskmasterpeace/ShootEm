// ---------------------------------------------------------------------------
// STORMCALLER — zoner, TRUE FLIGHT. One brain file per LSW (§5),
// deterministic, DOM-free. Seeds a ROAMING TORNADO (a moving force field
// that flings soldiers skyward) and calls an 8s LIGHTNING STORM that both
// sides eat — her own team included. Eaves shelter: hug a wall and the
// bolts can't find you (the doc's "roofs block bolts"). Casting is a swoop:
// she comes down into gun height to shape the weather.
// ---------------------------------------------------------------------------
import { GRID, T_METAL, T_WALL, TILE, WORLD } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

const CRUISE = 5.2;

/** under an eave? wall-adjacent tiles have no open sky — bolts can't land */
function sheltered(w: World, x: number, z: number): boolean {
  const tx = Math.floor((x + WORLD / 2) / TILE), tz = Math.floor((z + WORLD / 2) / TILE);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = tx + dx, nz = tz + dz;
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      const t = w.map.grid[nz * GRID + nx];
      if (t === T_WALL || t === T_METAL) return true;
    }
  }
  return false;
}

/** SEED THE TORNADO: a roaming suction field downrange — it drifts, it
 *  drags, and anyone pulled into the core is FLUNG SKYWARD. */
function tornado(w: World, s: Soldier): boolean {
  // one twister at a time — hers is the one she owns
  if (w.forceFields.some((f) => f.ownerId === s.id && w.time < f.until)) return false;
  const x = s.pos.x + Math.cos(s.yaw) * 10, z = s.pos.z + Math.sin(s.yaw) * 10;
  w.forceFields.push({ x, z, r: 7, radial: -26, team: s.team, ownerId: s.id, until: w.time + 9 });
  s.flightAlt = 0.9; s.diveAt = w.time + 2.5; // the casting swoop — shoot her
  w.emit({ type: 'explosion', pos: { x, y: 0, z }, weapon: 'gl' });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'stormcaller', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_stormcaller_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

/** CALL THE STORM: 8 seconds of bolts over an area — BOTH SIDES BEWARE. */
function callStorm(w: World, s: Soldier): boolean {
  let target: Soldier | undefined, best = 40;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < best) { best = d; target = e; }
  }
  if (!target) return false;
  s.stormX = target.pos.x; s.stormZ = target.pos.z;
  s.stormUntil = w.time + 8;
  s.nextBoltAt = w.time + 0.5;
  // CONDUCTING IS WORK: she stays low the whole 8s the storm rains — the
  // threat rig proved a 2s swoop bought immunity, and immunity is banned
  s.flightAlt = 0.9; s.diveAt = s.stormUntil;
  w.emit({ type: 'lsw_active', pos: { x: s.stormX, y: 0, z: s.stormZ }, text: 'stormcaller', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_stormcaller_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, dt: number) {
  // the tornado ROAMS (any kind): her field drifts and FLINGS
  for (const f of w.forceFields) {
    if (f.ownerId !== s.id || w.time >= f.until) continue;
    const a = Math.sin(w.time * 0.37 + s.id) * Math.PI * 2; // deterministic wander
    f.x += Math.cos(a) * 3.2 * dt;
    f.z += Math.sin(a) * 3.2 * dt;
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.encasedUntil !== undefined || e.liftedUntil !== undefined) continue;
      if (Math.hypot(e.pos.x - f.x, e.pos.z - f.z) > 2.5) continue;
      e.liftedUntil = w.time + 1.2; // FLUNG SKYWARD
      w.damageSoldier(e, 12, s.id, 'gl');
    }
  }
  // the storm rains on schedule — on EVERYONE under the open sky but her
  if (s.stormUntil !== undefined && w.time < s.stormUntil && w.time >= (s.nextBoltAt ?? 0)) {
    s.nextBoltAt = w.time + 0.8;
    const under: Soldier[] = [];
    for (const e of w.soldiers.values()) {
      if (!e.alive || e.id === s.id || e.encasedUntil !== undefined) continue;
      if (Math.hypot(e.pos.x - (s.stormX ?? 0), e.pos.z - (s.stormZ ?? 0)) > 14) continue;
      if (sheltered(w, e.pos.x, e.pos.z)) continue; // eaves block bolts
      under.push(e);
    }
    if (under.length) {
      const hit = under[w.rng.int(0, under.length - 1)];
      w.damageSoldier(hit, 45, s.id, 'rg2');
      w.emit({ type: 'emp', pos: { ...hit.pos } });
      w.emit({ type: 'explosion', pos: { ...hit.pos }, weapon: 'rg2' });
    }
  }
  // flight duty cycle
  s.flightAlt = (s.diveAt ?? 0) > w.time ? 0.9 : CRUISE;
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (tornado(w, s) ? 10 : 1.2);
  }
  if (w.time >= (s.nextLswActiveAt ?? 0) && callStorm(w, s)) s.nextLswActiveAt = w.time + 16;
}

export function active(w: World, s: Soldier): boolean {
  // Q: seed the tornado; with a twister already turning, call the storm.
  return tornado(w, s) || callStorm(w, s);
}
