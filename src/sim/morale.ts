// ═══════════════════════════════════════════════════════════════════════════
// MORALE — what a soldier believes about how it is going.
//
// Canon (docs/THREE-GAMES-ONE-WAR.md §"Hidden story-stats"): *"Combat
// Experience · Fear · Morale · Discipline · … — stories, not power."*
//
// Until now morale was one number that added at most three materiel at spawn
// and was never spoken of again. This is the version with teeth: it MOVES
// during a fight, it moves for reasons you can see happening in front of you,
// and it comes back out in the hands.
//
// The shape of it:
//   a friend drops beside you           it falls hard
//   you are the last one standing       it falls
//   you kill / your side takes ground   it rises
//   a leader is close                   it holds
//
// And what it buys:
//   BROKEN   hands shake, the group opens up, bots want out
//   STEADY   nothing — the honest middle
//   INSPIRED a slightly tighter group, and bots push
//
// The whole spread swing is about ±18%. Morale is a story the fight tells
// about itself, not a damage stat — the closing law again: stats help, they
// do not decide.
// ═══════════════════════════════════════════════════════════════════════════
import type { Soldier } from './types';

export const MORALE_BASE = 60;
export const MORALE_MIN = 0;
export const MORALE_MAX = 100;

export type MoraleBand = 'broken' | 'shaken' | 'steady' | 'high' | 'inspired';

/** What each event does to the man who saw it. */
export const MORALE_SHIFTS = {
  /** a friend died within earshot — the big one */
  friendDown: -14,
  /** you put someone down */
  kill: +7,
  /** your side banked something (a flag, a point, a wave) */
  sideScored: +9,
  /** the other side banked something */
  sideLost: -7,
  /** you were badly hurt (crossed half health in one blow) */
  mauled: -9,
  /** you went down and got picked back up */
  revived: +12,
  /** a decoration */
  medal: +15,
  /** nobody left alive near you */
  alone: -0.9,      // per second, applied while isolated
  /** an officer or a high rank is close by */
  ledWell: +0.7,    // per second
  /** the slow return to baseline when nothing is happening */
  settle: 0.5,      // per second, toward MORALE_BASE
} as const;

export const moraleOf = (s: Soldier): number => s.morale ?? MORALE_BASE;

export function bandOf(m: number): MoraleBand {
  if (m < 20) return 'broken';
  if (m < 40) return 'shaken';
  if (m < 68) return 'steady';
  if (m < 88) return 'high';
  return 'inspired';
}

export const BAND_LABEL: Record<MoraleBand, string> = {
  broken: 'BROKEN', shaken: 'SHAKEN', steady: 'STEADY', high: 'HIGH', inspired: 'INSPIRED',
};

/** Move a soldier's morale, clamped. Returns the new value. */
export function shiftMorale(s: Soldier, delta: number): number {
  const next = Math.max(MORALE_MIN, Math.min(MORALE_MAX, moraleOf(s) + delta));
  s.morale = next;
  return next;
}

/** Drift toward the baseline — a quiet minute puts a man back together. */
export function settleMorale(s: Soldier, dt: number): void {
  const m = moraleOf(s);
  if (Math.abs(m - MORALE_BASE) < 0.01) return;
  const step = MORALE_SHIFTS.settle * dt;
  s.morale = m > MORALE_BASE ? Math.max(MORALE_BASE, m - step) : Math.min(MORALE_BASE, m + step);
}

/**
 * THE SPREAD MULTIPLIER. Broken hands open the group by ~18%; an inspired man
 * closes it by ~7%. Steady is exactly 1 — the middle costs nothing and buys
 * nothing, which is what makes the ends mean something.
 */
export function moraleSpread(m: number): number {
  switch (bandOf(m)) {
    case 'broken': return 1.18;
    case 'shaken': return 1.08;
    case 'high': return 0.96;
    case 'inspired': return 0.93;
    default: return 1;
  }
}

/**
 * Does this bot want to be here? Below the line a bot fights defensively —
 * it takes cover sooner and pushes later. This is the behavioural half, and
 * it is the half that reads on screen.
 */
export const wantsCover = (m: number): boolean => m < 40;
export const wantsToPush = (m: number): boolean => m >= 88;

/** A one-line read for the HUD / after-action. */
export function moraleLine(m: number): string {
  switch (bandOf(m)) {
    case 'broken': return 'BROKEN — the hands are gone';
    case 'shaken': return 'SHAKEN — not steady';
    case 'steady': return 'STEADY';
    case 'high': return 'HIGH — holding well';
    default: return 'INSPIRED — nothing is going to stop this';
  }
}
