// ---------------------------------------------------------------------------
// COLLAPSE STYLE (STATUS §2 — Robert: "deaths differ by weapon in the animation:
// fire collapse, laser drop-straight, melee spin"). The renderer's ragdoll knows
// the killing weapon (Soldier.lastKillWeapon); this maps it to how the body
// goes down. Kept here, free of THREE, so the mapping is unit-tested on its own.
// ---------------------------------------------------------------------------
export type CollapseStyle = 'default' | 'straight' | 'writhe' | 'spin';

/** How the body falls, from the killing weapon's shape. A clean energy hit
 *  (beam/rail) drops you straight; fire makes you writhe; a melee blow (short
 *  reach) spins you down; everything else topples the default way. */
export function collapseStyleFor(def: { tracer?: string; range: number } | undefined): CollapseStyle {
  if (!def) return 'default';
  if (def.tracer === 'beam' || def.tracer === 'rail') return 'straight';
  if (def.tracer === 'flame') return 'writhe';
  if (def.range <= 2.5) return 'spin'; // melee reach — knocked spinning
  return 'default';
}
