// ---------------------------------------------------------------------------
// PERCEPTION — one set of eyes for the whole game. The wire culler (68A),
// the minimap, and the renderer's roof cutaway must all agree on what a team
// can see, or the screen lies: the wire says "enemy at the window" while the
// roof hides him, and the player swears the house was empty. These rules ARE
// the agreement, imported by both sides.
//
// §19.1 THE CONE, THE RING, AND THE DARK (decided, v1 = the LIGHT cone):
// each friendly eye sees a ~130° cone in its facing out to the vision budget,
// plus a short all-around ring — footsteps-close presence. Beyond both, an
// enemy simply isn't on your wire. No wall-shadow pass: losClear keeps
// governing what it already governs. Flanking, ambush, and checking corners
// all come back the moment sight has a shape.
// ---------------------------------------------------------------------------
import { T_GRASS, losClear, tileAt } from './map';
import type { Soldier, Team } from './types';

/** How far friendly eyes reach (mirrors the minimap; §8.8 weather taxes it). */
export const PERCEIVE_RANGE = 65;

/** The ~130° cone: half-angle in radians around the eye's facing. */
export const CONE_HALF = 1.15;

/** The ring: footsteps-close presence all around, cone or no cone. */
export const RING = 9;

/** Once seen, an enemy stays on your screen this long after line of sight
 *  breaks — the "he just ducked behind the wall" trail. Decided (§19):
 *  base 1.5s; tracking gear extends it, hard-capped at 3s. */
export const SEEN_LINGER = 1.5;
export const SEEN_LINGER_GEARED = 3;

/** §11 row 6 (Robert): "when you look away they should fade over 5s;
 *  different classes see longer; the MAX is 5." The linger is per-VIEWER:
 *  recon classes hold a lost contact longest, tracking optics buys more,
 *  and nothing ever exceeds MAX_LINGER. The renderer dissolves the ghost
 *  across this window instead of popping it. */
export const MAX_LINGER = 5;
const CLASS_LINGER: Record<string, number> = { ghost: 5, infiltrator: 4, pathfinder: 3.5 };
export function classLinger(classId: string, hasOptics: boolean): number {
  const base = CLASS_LINGER[classId] ?? 2.5;
  return Math.min(MAX_LINGER, base + (hasOptics ? 1.5 : 0));
}

/** One team's memory of one enemy: when last perceived, and WHERE — the
 *  ghost freezes at the spot you lost them, never trailing their live path. */
export interface SeenMark { t: number; x: number; z: number }

/** Can this single eye see the point? Ring first (the 360 sensor helmet
 *  doubles it — the paranoid pick, §19.2), then the facing cone. */
function eyeSees(e: Soldier, x: number, z: number, range: number): boolean {
  const d = Math.hypot(x - e.pos.x, z - e.pos.z);
  if (d < (e.equipment.includes('sensor_360') ? RING * 2 : RING)) return true;
  if (d >= range) return false;
  let diff = Math.abs(Math.atan2(z - e.pos.z, x - e.pos.x) - e.yaw) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff <= CONE_HALF;
}

/** A standing smoke cloud, as the eyes care about it: center + radius. */
export interface SmokeBlob { x: number; z: number; r: number }

/** Does the sight line from A to B pass through any smoke? Segment-vs-circle
 *  in 2D. Endpoints INSIDE a cloud count — smoke you're standing in blinds
 *  you both ways (CS law: the cloud is the wall). */
export function smokeBlocks(ax: number, az: number, bx: number, bz: number, smokes: SmokeBlob[]): boolean {
  for (const c of smokes) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / len2)) : 0;
    const px = ax + dx * t, pz = az + dz * t;
    if (Math.hypot(c.x - px, c.z - pz) < c.r) return true;
  }
  return false;
}

/** Can this set of friendly eyes perceive enemy soldier `s` RIGHT NOW?
 *  `range` is the live vision budget — weather (§8.8) taxes it. `smokes`
 *  are the standing clouds: they block the cone and the ring alike (a
 *  grenade that "affects visibility" — Robert — or it's just décor). Pings
 *  are electronic and the flag is public intel; smoke fools eyes, not radios. */
export function perceivesNow(grid: Uint8Array, eyes: Soldier[], pinged: Set<number>, s: Soldier, range = PERCEIVE_RANGE, smokes: SmokeBlob[] = [], revealed?: Set<number>): boolean {
  if (s.cloaked && !pinged.has(s.id)) return false;   // cloak is TRUE
  if (s.carryingFlag !== -1) return true;             // objective intel is public
  if (pinged.has(s.id)) return true;
  // the SKYLINE rule (§8.4): above the ground walls you're against the sky —
  // a silhouette registers even in your periphery, so no cone check here.
  // (Above ~3u you're also above the smoke banks, so no smoke test.)
  if (s.pos.y > 3 && eyes.some((e) => Math.hypot(s.pos.x - e.pos.x, s.pos.z - e.pos.z) < range)) return true;
  // TALL GRASS (finish-list 18): standing in the long grass you are a RUMOR --
  // the cone loses you beyond 14u, and beyond the footstep RING itself if you
  // DUCK. The truth-tellers: your own muzzle flash (revealed), a ping, the
  // flag in your hands (public, above) -- and an LSW never fits in the grass.
  if (s.ascendant === undefined && !revealed?.has(s.id) && tileAt(grid, s.pos.x, s.pos.z) === T_GRASS) {
    range = Math.min(range, s.crouching ? RING : 14);
  }
  // cone + ring, then the window truth: losClear marches at eye height 1.4 —
  // inside the T_SLIT firing band — so a defender framed in glass is SEEN,
  // and a stalker behind your back past the ring is NOT
  return eyes.some((e) =>
    eyeSees(e, s.pos.x, s.pos.z, range) &&
    // an LSW is TOO BIG FOR SMOKE — the silhouette looms through the fog
    // (walls still hide it; an unanswerable boss is a griefer we wrote)
    (s.ascendant !== undefined || !smokeBlocks(e.pos.x, e.pos.z, s.pos.x, s.pos.z, smokes)) &&
    losClear(grid, { x: e.pos.x, y: 1.4, z: e.pos.z }, { x: s.pos.x, y: 1.4, z: s.pos.z }));
}

/** Is `s` on `team`'s screen — seen now, or within the linger window?
 *  Reads the per-tick trail World.updateLastSeen stamps. Cloak engaging
 *  mid-linger cuts the trail instantly (cloak stays TRUE). `linger` is
 *  per-viewer: tracking gear buys SEEN_LINGER_GEARED (§19.2). */
export function seenRecently(
  lastSeen: [Map<number, SeenMark>, Map<number, SeenMark>],
  pinged: Set<number>, team: Team, s: Soldier, now: number, linger = SEEN_LINGER,
): boolean {
  if (s.cloaked && !pinged.has(s.id)) return false;
  const m = lastSeen[team].get(s.id);
  return m !== undefined && now - m.t <= linger;
}
