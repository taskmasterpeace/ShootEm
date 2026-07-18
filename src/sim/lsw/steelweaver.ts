// ---------------------------------------------------------------------------
// STEEL WEAVER — tank. One brain file per LSW (§5), deterministic, DOM-free.
// RIPS a T_METAL panel out of the map (the wall is GONE — his defense costs
// the team the terrain) and wears it as plate; the EXOSUIT stacks panels
// into armor and force.
// ---------------------------------------------------------------------------
import { GRID, T_METAL, T_OPEN, TILE, WORLD } from '../map';
import type { Soldier } from '../types';
import type { World } from '../world';

/** RIP THE PANEL: the nearest metal wall tile within reach leaves the map
 *  (rides the dug wire) and becomes HIS plate. The map loses the wall. */
function ripPanel(w: World, s: Soldier): boolean {
  const stx = Math.floor((s.pos.x + WORLD / 2) / TILE), stz = Math.floor((s.pos.z + WORLD / 2) / TILE);
  let best: { tx: number; tz: number } | undefined, bd = Infinity;
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = stx + dx, tz = stz + dz;
      if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) continue;
      if (w.map.grid[tz * GRID + tx] !== T_METAL) continue;
      const d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = { tx, tz }; }
    }
  }
  if (!best) return false;
  const idx = best.tz * GRID + best.tx;
  w.map.grid[idx] = T_OPEN; // the wall is GONE — the exception METAL always feared
  w.dug.push(idx);
  const pos = { x: (best.tx + 0.5) * TILE - WORLD / 2, y: 0, z: (best.tz + 0.5) * TILE - WORLD / 2 };
  w.emit({ type: 'dig', tile: idx, pos });
  s.maxArmor = Math.max(s.maxArmor, 160);
  s.armor = Math.min(s.maxArmor, s.armor + 80); // the panel, worn
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'steelweaver', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_steelweaver_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

/** THE EXOSUIT: panels assembled — heavy plate and heavier blows. */
function exosuit(w: World, s: Soldier): boolean {
  if (s.armor < 80) return false; // no panels, no suit
  s.maxArmor = Math.max(s.maxArmor, 200);
  s.armor = Math.min(s.maxArmor, s.armor + 120);
  s.rageMul = 1.25; // the suit swings harder (the shipped damage channel)
  s.overchargeUntil = w.time + 10; // and hands the borrowed force back on time
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'steelweaver', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_steelweaver_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) { s.nextLswAt = w.time + (ripPanel(w, s) ? 6 : 0.8); }
  if (w.time >= (s.nextLswActiveAt ?? 0) && exosuit(w, s)) s.nextLswActiveAt = w.time + 14;
}

export function active(w: World, s: Soldier): boolean {
  // Q: rip a panel; already carrying plate and no metal near → the suit.
  return ripPanel(w, s) || exosuit(w, s);
}
