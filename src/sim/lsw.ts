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
  /** the announcer's radio net, per moment — TEXT shown map-wide while the
   *  matching ann_<id>_<moment> clip plays (tools/gen-lsw-vo.mjs) */
  lines: { inbound: string; landed: string; down: string; rampage: string };
  /** body scale — an LSW reads as bigger than a trooper at command zoom */
  scale: number;
  speed: number;
  /** signature palette (no purple — house law, test-swept) */
  color: number;
  /** the Q-key signature when a HUMAN pilots this body (§7) — the HUD hint */
  activeLabel: string;
  /** signature cooldown in seconds (charged only when the active actually fires) */
  activeCd: number;
}

/** The stable. Units land here as they ship; the roster doc is the spec. */
export const LSWS: Record<AscendantId, LswDef> = {
  firebrand: {
    id: 'firebrand', name: 'Firebrand', faction: 0, threat: 2,
    lines: {
      inbound: 'FIREBRAND INBOUND — CLEAR THE GRASS',
      landed: 'FIREBRAND ON THE FIELD — THE GROUND WILL BURN',
      down: 'FIREBRAND IS DOWN — THE FIRES GO WITH HIM',
      rampage: 'FIVE KILLS — FIREBRAND IS COOKING',
    },
    scale: 1.25, speed: 9, color: 0xff6a1a,
    activeLabel: 'CASH THE BOARD — every patch you painted erupts', activeCd: 8,
  },
  plaguebearer: {
    id: 'plaguebearer', name: 'Plaguebearer', faction: 1, threat: 2,
    lines: {
      inbound: 'PLAGUEBEARER INBOUND — SEAL YOUR MASKS',
      landed: 'PLAGUEBEARER WALKS THE FIELD — THE AIR IS NOT YOUR FRIEND',
      down: 'PLAGUEBEARER IS DOWN — VENTILATE AND ADVANCE',
      rampage: 'FIVE KILLS — THE OUTBREAK IS WINNING',
    },
    scale: 1.3, speed: 8, color: 0x7fa83c,
    activeLabel: 'QUARANTINE RING — a wall of plague around you', activeCd: 10,
  },
  frostbite: {
    id: 'frostbite', name: 'Frostbite', faction: 0, threat: 3,
    lines: {
      inbound: 'FROSTBITE INBOUND — DRESS FOR WINTER',
      landed: 'FROSTBITE DEPLOYED — THE COLD TAKES THE FIELD',
      down: 'FROSTBITE IS DOWN — THE THAW BEGINS',
      rampage: 'FIVE KILLS — FROSTBITE IS AN ICE AGE',
    },
    scale: 1.3, speed: 8.5, color: 0x8fd4e8, // pale ice blue (team 0 is amber; this is HER shade)
    activeLabel: 'THE ICE BLOCK — freeze the soldier you are aiming at', activeCd: 4,
  },
  ragebeast: {
    id: 'ragebeast', name: 'Ragebeast', faction: 1, threat: 3,
    lines: {
      inbound: 'RAGEBEAST INBOUND — DO NOT FEED IT',
      landed: 'RAGEBEAST IS LOOSE — GOOD LUCK',
      down: 'RAGEBEAST IS DOWN — STAND EASY',
      rampage: 'FIVE KILLS — STOP FEEDING THE BEAST',
    },
    scale: 1.45, speed: 8, color: 0xb23030, // blood-iron red, darkens as it rages
    activeLabel: 'GROUND SLAM — harder the more you bleed', activeCd: 6,
  },
  titan: {
    id: 'titan', name: 'Titan', faction: 0, threat: 3,
    lines: {
      inbound: 'TITAN INBOUND — MOVE THE ARMOR',
      landed: 'TITAN ON THE FIELD — NOTHING STAYS WHERE IT STANDS',
      down: 'TITAN IS DOWN — THE GROUND HOLDS STILL',
      rampage: 'FIVE KILLS — TITAN IS THROWING THE WHOLE FIELD',
    },
    scale: 1.6, speed: 6, color: 0x9a8466, // weathered stone-and-iron; the biggest, slowest silhouette
    activeLabel: 'SEISMIC HANDS — hurl what you grab; pound if empty', activeCd: 5,
  },
  voltstriker: {
    id: 'voltstriker', name: 'Volt Striker', faction: 0, threat: 1,
    lines: {
      inbound: 'VOLT STRIKER INBOUND — SPREAD OUT',
      landed: "VOLT STRIKER ON THE FIELD — DON'T BUNCH UP",
      down: 'VOLT STRIKER IS DOWN — THE AIR GOES QUIET',
      rampage: 'FIVE KILLS — VOLT STRIKER IS ARCING',
    },
    scale: 1.25, speed: 9, color: 0xf5f06a, // high-voltage yellow-white
    activeLabel: 'CHAIN LIGHTNING — arc through the crowd', activeCd: 3,
  },
  sniperhawk: {
    id: 'sniperhawk', name: 'Sniperhawk', faction: 0, threat: 1,
    lines: {
      inbound: 'SNIPERHAWK INBOUND — BREAK LINE OF SIGHT',
      landed: 'SNIPERHAWK PERCHED — WATCH THE LANES',
      down: 'SNIPERHAWK IS DOWN — THE LANES ARE YOURS',
      rampage: 'FIVE KILLS — SNIPERHAWK OWNS THE SIGHTLINES',
    },
    scale: 1.2, speed: 8, color: 0x5fb3c9, // scope steel-cyan
    activeLabel: 'PIERCING RAIL — one shot down the whole line', activeCd: 2.5,
  },
  barrier: {
    id: 'barrier', name: 'Barrier', faction: 0, threat: 1,
    lines: {
      inbound: 'BARRIER INBOUND — YOUR SHOTS MAY COME BACK',
      landed: 'BARRIER ON THE FIELD — MIND THE WALLS',
      down: 'BARRIER IS DOWN — THE LANES OPEN',
      rampage: "FIVE KILLS — BARRIER WON'T BREAK",
    },
    scale: 1.3, speed: 7, color: 0x3fd9a0, // emerald shield-energy
    activeLabel: 'ENERGY WALL — reflects fire for 2 seconds', activeCd: 5,
  },
};

/** THE SPOKEN SCRIPT — subtitle text per voice slot, tag-stripped mirrors of
 *  tools/lsw-vo-script.mjs (the recording script with direction). Positional:
 *  the HUD shows a line only when the local player is inside the voice's
 *  earshot — you read what you could hear. */
export type VoMoment = 'arrive' | 'kill3' | 'ability' | 'low' | 'death';
export const VO_LINES: Record<string, { who: AscendantId; line: string }> = {
  vo_firebrand_arrive: { who: 'firebrand', line: 'Somebody call for a light?' },
  vo_firebrand_kill3: { who: 'firebrand', line: "Three! The fire's just getting to know everybody." },
  vo_firebrand_ability: { who: 'firebrand', line: 'All that paint I put down? It was a promise.' },
  vo_firebrand_low: { who: 'firebrand', line: 'Burning low... burning MEAN.' },
  vo_firebrand_death: { who: 'firebrand', line: 'Huh. Finally... some shade.' },
  vo_plaguebearer_arrive: { who: 'plaguebearer', line: 'Deep breath, everyone.' },
  vo_plaguebearer_kill3: { who: 'plaguebearer', line: 'Three subjects. The data is... agreeable.' },
  vo_plaguebearer_ability: { who: 'plaguebearer', line: 'The ring is for your protection.' },
  vo_plaguebearer_low: { who: 'plaguebearer', line: 'Fascinating. It spreads to me too.' },
  vo_plaguebearer_death: { who: 'plaguebearer', line: 'I was... already gone.' },
  vo_frostbite_arrive: { who: 'frostbite', line: "Winter's here." },
  vo_frostbite_kill3: { who: 'frostbite', line: 'Three. Cold count.' },
  vo_frostbite_ability: { who: 'frostbite', line: 'Hold still.' },
  vo_frostbite_low: { who: 'frostbite', line: 'Cracks... in the ice.' },
  vo_frostbite_death: { who: 'frostbite', line: 'Thaw me... never.' },
  vo_ragebeast_arrive: { who: 'ragebeast', line: 'OUT. FINALLY OUT.' },
  vo_ragebeast_kill3: { who: 'ragebeast', line: 'THREE MORE. WHO ELSE.' },
  vo_ragebeast_ability: { who: 'ragebeast', line: 'GROUND. BREAKS.' },
  vo_ragebeast_low: { who: 'ragebeast', line: 'HURT ME. GOOD. MORE.' },
  vo_ragebeast_death: { who: 'ragebeast', line: 'Still... hungry...' },
  vo_titan_arrive: { who: 'titan', line: "Ground's mine now." },
  vo_titan_kill3: { who: 'titan', line: 'Three. Small ones.' },
  vo_titan_ability: { who: 'titan', line: 'Up you go.' },
  vo_titan_low: { who: 'titan', line: 'Chipping... at a mountain.' },
  vo_titan_death: { who: 'titan', line: 'Back... to stone.' },
  vo_voltstriker_arrive: { who: 'voltstriker', line: "Everybody's grounded now." },
  vo_voltstriker_kill3: { who: 'voltstriker', line: 'Three on one arc. Tidy.' },
  vo_voltstriker_ability: { who: 'voltstriker', line: 'Hold hands!' },
  vo_voltstriker_low: { who: 'voltstriker', line: 'Losing... current.' },
  vo_voltstriker_death: { who: 'voltstriker', line: 'Ground... fault.' },
  vo_sniperhawk_arrive: { who: 'sniperhawk', line: 'Found my perch.' },
  vo_sniperhawk_kill3: { who: 'sniperhawk', line: 'Three. All center mass.' },
  vo_sniperhawk_ability: { who: 'sniperhawk', line: "Line 'em up." },
  vo_sniperhawk_low: { who: 'sniperhawk', line: 'Position... compromised.' },
  vo_sniperhawk_death: { who: 'sniperhawk', line: "Should've... moved." },
  vo_barrier_arrive: { who: 'barrier', line: 'This far. No further.' },
  vo_barrier_kill3: { who: 'barrier', line: 'Three broke on the wall.' },
  vo_barrier_ability: { who: 'barrier', line: 'Send it back.' },
  vo_barrier_low: { who: 'barrier', line: 'The wall... is cracking.' },
  vo_barrier_death: { who: 'barrier', line: 'Line... held.' },
};
export const voSlot = (id: AscendantId, moment: VoMoment) => `vo_${id}_${moment}`;
export const annSlot = (id: AscendantId, moment: 'inbound' | 'landed' | 'down' | 'rampage') => `ann_${id}_${moment}`;

/** A faction's stable, in call order (V picks [0], ⇧V picks [1]). */
export function lswsForTeam(team: Team): AscendantId[] {
  return (Object.values(LSWS) as LswDef[]).filter((d) => d.faction === team).map((d) => d.id);
}

/** THE ICE BLOCK constants (§21.6). Encase forms over ~0.4s; the ice fully
 *  holds `ICE_HOLD` seconds; holding still drains slowly, struggling breaks
 *  out in ~STRUGGLE_SECS but costs STRUGGLE_HP. Shared by Frostbite (and
 *  Venatrix when she ships). */
export const ICE_HOLD = 5;          // seconds the block stands if nobody frees you
export const ICE_HOLD_DRAIN = 2.5;  // hp/s while you HOLD STILL — slow; you can outlast it
export const STRUGGLE_SECS = 4;     // mashing input this long shatters the ice yourself
export const STRUGGLE_HP = 45;      // …but you crawl out this hurt (die slow if already weak)

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
