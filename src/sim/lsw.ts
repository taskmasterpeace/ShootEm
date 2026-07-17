// ---------------------------------------------------------------------------
// LIVING SUPER WEAPONS — the entity, the threat table, and the officer's call.
//
// An LSW is a Soldier: same physics, same joints, same eight-name rig, same
// bullets kill it. What makes it an LSW is `ascendant` on the Soldier (rides
// the wire free — the snapshot spread law) plus a brain file per unit.
//
// THE LAWS (docs/ASCENDANTS.md):
//  · There are no heroes and villains. Two factions, one stable each.
//  · Threat buys HP, never immunity — every LSW dies to ordinary rifles.
//  · At most ONE LSW per faction on the field.
//  · The drop is telegraphed: the announcer calls it, then dread, then it
//    lands. Bigger threat = longer countdown.
//  · OFF in paintball / range / onboarding — the yard stays the yard.
//  · Nothing an LSW does takes control away from a human player.
// ---------------------------------------------------------------------------
import type { AscendantId, ModeId, Team } from './types';

export type ThreatLevel = 1 | 2 | 3 | 4;

/** Threat is the price, the telegraph, and the announcer's warning. HP is
 *  measured against the shipped baseline: a trooper is 100, a brute is 320,
 *  a rifleman lands ~45 dps in a real fight. See docs/ASCENDANTS.md §1.5. */
export const THREAT: Record<ThreatLevel, {
  name: string; hp: number; materiel: number; telegraph: number;
}> = {
  // HP MEASURED, not guessed (Robert: "test to determine threat level").
  // The harness probe showed a focused, self-healing 4-squad lands FAR more
  // than the paper ~180 dps — a 900-HP body died in 4-7s, which reads as a
  // fat trooper, not a STRONGPOINT. Tripled to hit the DESIGN targets the
  // doc promises: a T2 should be ~15s of a squad's honest focus, a T4 a
  // minute of the whole team. These are the corrected, live-verified numbers.
  1: { name: 'SKIRMISH', hp: 1200, materiel: 1, telegraph: 15 },
  2: { name: 'STRONGPOINT', hp: 2600, materiel: 2, telegraph: 20 },
  3: { name: 'SIEGE', hp: 5000, materiel: 4, telegraph: 30 },
  4: { name: 'EXTINCTION', hp: 9000, materiel: 7, telegraph: 40 },
};

export interface LswDef {
  id: AscendantId;
  name: string;
  /** 0 = United Front's stable, 1 = the Collective's. Not good vs evil. */
  faction: Team;
  threat: ThreatLevel;
  /** the announcer's line when the officer makes the call */
  callLine: string;
  /** body scale — an LSW reads as bigger than a trooper at command zoom */
  scale: number;
  speed: number;
  /** signature palette (no purple — house law, test-swept) */
  color: number;
}

/** The stable. Units land here as they ship; the roster doc is the spec. */
export const LSWS: Record<AscendantId, LswDef> = {
  firebrand: {
    id: 'firebrand', name: 'Firebrand', faction: 0, threat: 2,
    callLine: 'FIREBRAND IS ON THE FIELD — THE GROUND WILL BURN',
    scale: 1.25, speed: 9, color: 0xff6a1a,
  },
  plaguebearer: {
    id: 'plaguebearer', name: 'Plaguebearer', faction: 1, threat: 2,
    callLine: 'PLAGUEBEARER INBOUND — SEAL YOUR MASKS',
    scale: 1.3, speed: 8, color: 0x7fa83c,
  },
};

/** Modes where no LSW ever walks: the yard is for learning, the range is for
 *  work. (§14 — boot camp is a paintball match, not a boss fight.) */
export function lswAllowed(mode: ModeId): boolean {
  return mode !== 'paintball' && mode !== 'range';
}

/** The officer's call, mid-match, spending the stable's materiel. Returns
 *  the pending drop — announced now, landing after the telegraph. Bigger
 *  threat = longer dread. */
export interface LswDrop {
  id: AscendantId;
  team: Team;
  landsAt: number;
  pos: { x: number; y: number; z: number };
}
