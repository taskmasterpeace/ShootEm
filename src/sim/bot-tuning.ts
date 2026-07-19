// ---------------------------------------------------------------------------
// THE BOT DIAL-BOARD (§AI-AUDIT theme 7). Every number that shapes how a bot
// SEES, SHOOTS and MOVES used to be a bare literal buried somewhere in a
// 600-line stepBot — tuning "how twitchy are bots" meant hunting magic numbers
// across the file. They live here now, named, in one place a designer can turn.
//
// Values are exactly what was inlined before, so landing this table changed no
// behavior; only the reach of a knob.
// ---------------------------------------------------------------------------
import type { Difficulty } from './world';

export const BOT_TUNING = {
  // ---- the eyes ----
  /** acquisition never drops below this, so CQB classes stay aggressive */
  acqFloor: 42,
  /** ...and never reaches further than this, even with a rail gun */
  acqCap: 95,
  /** fraction of the weapon's range a bot will acquire out to */
  acqWeaponFrac: 0.95,
  /** floor on the weather-taxed eye — a bot still fights what's on top of it */
  weatherFloor: 16,
  /** an enemy standing in tall grass is a rumor past this... */
  grassRumor: 14,
  /** ...or past the footstep ring if they DUCK */
  grassCrouched: 9,
  /** cloaked infiltrators register only inside this (a ping overrides) */
  cloakReveal: 9,

  // ---- the trigger ----
  /** velocity-lead weight (under-lead on purpose: fast strafing beats them) */
  lead: 0.85,
  /** base aim spread, before distance/difficulty/doctrine scaling */
  aimErrBase: 0.055,
  /** spread grows as (d / this + 0.6) */
  aimErrFalloff: 18,
  /** fire inside weapon.range × this */
  fireFrac: 0.95,

  // ---- grenades ----
  nadeMin: 8,
  nadeMax: 24,
  nadeChance: 0.006,

  // ---- movement ----
  /** personal space: friendlies inside this push each other apart */
  sepRadius: 5,
  /** repath cadence = base + rng × jitter (staggered so they don't all path together) */
  repathBase: 0.9,
  repathJitter: 0.7,
  /** a bot that moved less than this in `stuckWindow` seconds re-plans */
  stuckDist: 0.8,
  stuckWindow: 2.5,
  /** how far to look for a wall to put between you and a shooter */
  coverSeek: 22,

  // ---- armor ----
  /** prefer a vehicle over a soldier target inside this */
  atEngageRange: 30,
  /** peel back from armor closer than this */
  atPeelBack: 15,
} as const;

/**
 * THE SKILL LADDER, one row per tier. Difficulty used to be a single dial
 * (aim spread) — recruit and elite perceived, reacted and turned identically
 * and only missed by different amounts. It has real depth now:
 *   aim   — × the spread (lower is tighter)
 *   react — seconds before firing on a FRESHLY acquired contact
 *   turn  — how fast the barrel can slew onto a target (radians/second)
 */
export const DIFFICULTY: Record<Difficulty, { aim: number; react: number; turn: number }> = {
  recruit: { aim: 1.9, react: 0.5, turn: 7 },
  veteran: { aim: 1, react: 0.3, turn: 10 },
  elite: { aim: 0.45, react: 0.16, turn: 15 },
};
