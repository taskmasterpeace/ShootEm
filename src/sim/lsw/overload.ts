// ---------------------------------------------------------------------------
// OVERLOAD — ambusher. One brain file per LSW (§5), deterministic, DOM-free.
// Arc bursts up close; and he BECOMES CURRENT — travels the CONNECTED METAL
// (a BFS over touching T_METAL tiles) and emerges anywhere on the circuit.
// The Refinery is HIS map; fight him on dirt.
// ---------------------------------------------------------------------------
import { GRID, T_METAL, TILE, WORLD } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** the arc burst: everyone close takes the jolt */
function arcBurst(w: World, s: Soldier): boolean {
  let hit = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) > 8) continue;
    w.damageSoldier(e, 40, s.id, 'rg2');
    w.emit({ type: 'emp', pos: { ...e.pos } });
    hit++;
  }
  if (hit) {
    w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'overload', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_overload_ability', pos: { ...s.pos }, soldierId: s.id });
  }
  return hit > 0;
}

/** BECOME CURRENT: enter the nearest touching metal, ride the connected
 *  circuit (4-neighbor BFS over T_METAL), and emerge at its far end. On
 *  dirt fronts there is no circuit — and no trick. */
function rideCircuit(w: World, s: Soldier): boolean {
  const stx = Math.floor((s.pos.x + WORLD / 2) / TILE), stz = Math.floor((s.pos.z + WORLD / 2) / TILE);
  // find an entry tile within 2 tiles
  let entry = -1;
  outer: for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = stx + dx, tz = stz + dz;
      if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) continue;
      if (w.map.grid[tz * GRID + tx] === T_METAL) { entry = tz * GRID + tx; break outer; }
    }
  }
  if (entry < 0) return false; // dirt front — no circuit, no trick
  // BFS the connected component; the FARTHEST tile is the exit
  const seen = new Set<number>([entry]);
  const queue = [entry];
  let far = entry, farD = 0;
  while (queue.length) {
    const idx = queue.shift()!;
    const tx = idx % GRID, tz = (idx / GRID) | 0;
    const d = Math.hypot(tx - stx, tz - stz);
    if (d > farD) { farD = d; far = idx; }
    for (const [nx, nz] of [[tx + 1, tz], [tx - 1, tz], [tx, tz + 1], [tx, tz - 1]] as const) {
      if (nx < 1 || nz < 1 || nx >= GRID - 1 || nz >= GRID - 1) continue;
      const nidx = nz * GRID + nx;
      if (seen.has(nidx) || w.map.grid[nidx] !== T_METAL) continue;
      if (seen.size > 4000) break; // a runaway refinery is still finite
      seen.add(nidx);
      queue.push(nidx);
    }
  }
  const ftx = far % GRID, ftz = (far / GRID) | 0;
  // emerge on the walkable side of the far tile
  w.emit({ type: 'emp', pos: { ...s.pos } });
  w.emit({ type: 'blink', pos: { ...s.pos } });
  s.pos = { x: (ftx + 0.5) * TILE - WORLD / 2 + 1.2, y: 0, z: (ftz + 0.5) * TILE - WORLD / 2 + 1.2 };
  s.vel = { x: 0, y: 0, z: 0 };
  w.emit({ type: 'blink', pos: { ...s.pos } });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'overload', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_overload_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) { s.nextLswAt = w.time + (arcBurst(w, s) ? 3 : 0.5); }
  if (w.time >= (s.nextLswActiveAt ?? 0) && s.hp < s.maxHp * 0.5 && rideCircuit(w, s)) s.nextLswActiveAt = w.time + 12;
}

export function active(w: World, s: Soldier): boolean {
  // Q: ride the circuit; no metal within reach → the arc burst.
  return rideCircuit(w, s) || arcBurst(w, s);
}
