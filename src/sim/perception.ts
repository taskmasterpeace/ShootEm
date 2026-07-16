// ---------------------------------------------------------------------------
// PERCEPTION — one set of eyes for the whole game. The wire culler (68A),
// the minimap, and the renderer's roof cutaway must all agree on what a team
// can see, or the screen lies: the wire says "enemy at the window" while the
// roof hides him, and the player swears the house was empty. These rules ARE
// the agreement, imported by both sides.
// ---------------------------------------------------------------------------
import { losClear } from './map';
import type { Soldier, Team } from './types';

/** How far friendly eyes reach (mirrors the minimap; becomes §19's cone). */
export const PERCEIVE_RANGE = 65;

/** Once seen, an enemy stays on your screen this long after line of sight
 *  breaks — the "he just ducked behind the wall" trail. Decided (§19):
 *  base 1.5s; tracking gear extends it, hard-capped at 3s. */
export const SEEN_LINGER = 1.5;
export const SEEN_LINGER_GEARED = 3;

/** Can this set of friendly eyes perceive enemy soldier `s` RIGHT NOW?
 *  `range` is the live vision budget — weather (§8.8) taxes it. */
export function perceivesNow(grid: Uint8Array, eyes: Soldier[], pinged: Set<number>, s: Soldier, range = PERCEIVE_RANGE): boolean {
  if (s.cloaked && !pinged.has(s.id)) return false;   // cloak is TRUE
  if (s.carryingFlag !== -1) return true;             // objective intel is public
  // the SKYLINE rule (§8.4): above the ground walls you're against the sky
  if (s.pos.y > 3 && eyes.some((e) => Math.hypot(s.pos.x - e.pos.x, s.pos.z - e.pos.z) < range)) return true;
  if (pinged.has(s.id)) return true;
  // window truth: losClear marches at eye height 1.4 — inside the T_SLIT
  // firing band — so a defender framed in an open window is genuinely seen
  return eyes.some((e) =>
    Math.hypot(s.pos.x - e.pos.x, s.pos.z - e.pos.z) < range &&
    losClear(grid, { x: e.pos.x, y: 1.4, z: e.pos.z }, { x: s.pos.x, y: 1.4, z: s.pos.z }));
}

/** Is `s` on `team`'s screen — seen now, or within the linger window?
 *  Reads the per-tick trail World.updateLastSeen stamps. Cloak engaging
 *  mid-linger cuts the trail instantly (cloak stays TRUE). `linger` is
 *  per-viewer: tracking gear buys SEEN_LINGER_GEARED (§19.2). */
export function seenRecently(
  lastSeen: [Map<number, number>, Map<number, number>],
  pinged: Set<number>, team: Team, s: Soldier, now: number, linger = SEEN_LINGER,
): boolean {
  if (s.cloaked && !pinged.has(s.id)) return false;
  const t = lastSeen[team].get(s.id);
  return t !== undefined && now - t <= linger;
}
