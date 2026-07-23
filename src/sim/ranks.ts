// ═══════════════════════════════════════════════════════════════════════════
// THE PROMOTION BOARD — rank as earned responsibility.
//
// Robert's closing law (docs/THREE-GAMES-ONE-WAR.md): *"Don't make the RPG
// stats the main progression. Knowledge, certifications, rank, relationships,
// and reputation ARE the progression… the most powerful feeling is earned
// responsibility: being trusted to fly the bomber, command the platoon, lead
// the science op, turn a front."*
//
// The GONET desk has said `Promotion Board — Eligible` since the day it was
// built, with nothing behind it. This is the something.
//
// Rank is not a level and it is not bought. It is read off SERVICE — what you
// actually did, in the account's own record — and what it grants is
// AUTHORITY, never numbers:
//
//   LIEUTENANT   may call the stable (spend the war's materiel on a god)
//   CAPTAIN      may take the command seat and set the doctrine
//   every rank   steadies the men around it a little more
//
// Pure. The world reads `mayCallStable()`; the GONET reads the board.
// ═══════════════════════════════════════════════════════════════════════════

export interface RankDef {
  id: number;
  name: string;
  /** service required to be eligible */
  at: number;
  /** What this rank is TRUSTED with — the whole point of holding it. */
  grants: string;
}

/** The ladder. Ten rungs; the last one runs a war. */
export const RANKS: RankDef[] = [
  { id: 0, name: 'Recruit', at: 0, grants: 'Nothing yet. Everybody starts here.' },
  { id: 1, name: 'Private', at: 25, grants: 'Your name on the manifest.' },
  { id: 2, name: 'Corporal', at: 70, grants: 'A fire team looks to you — men near you steady.' },
  { id: 3, name: 'Sergeant', at: 160, grants: 'A squad. The steadying reaches further.' },
  { id: 4, name: 'Staff Sergeant', at: 300, grants: 'A heavier opening manifest.' },
  { id: 5, name: 'Lieutenant', at: 520, grants: 'THE STABLE — you may spend the war\'s materiel and call a god down.' },
  { id: 6, name: 'Captain', at: 820, grants: 'The command seat and the doctrine package.' },
  { id: 7, name: 'Major', at: 1220, grants: 'A full manifest and the long calls.' },
  { id: 8, name: 'Colonel', at: 1750, grants: 'A front of your own.' },
  { id: 9, name: 'General', at: 2500, grants: 'The war.' },
];

/** What service is made of. Doing beats grinding: a certification is worth more
 *  than thirty kills, because the canon says knowledge is the progression. */
export const SERVICE_POINTS = {
  matchFought: 5,
  matchWon: 15,
  kill: 1,
  medal: 25,
  certification: 30,
  trackRecord: 10,
  /** a full skill band, any skill */
  skillBand: 8,
} as const;

export interface ServiceRecord {
  matches: number;
  wins: number;
  kills: number;
  medals: number;
  certifications: number;
  trackRecords: number;
  skillBands: number;
}

export const blankService = (): ServiceRecord => ({
  matches: 0, wins: 0, kills: 0, medals: 0, certifications: 0, trackRecords: 0, skillBands: 0,
});

/** Add up a record into one number. */
export function serviceScore(r: ServiceRecord): number {
  return r.matches * SERVICE_POINTS.matchFought
    + r.wins * SERVICE_POINTS.matchWon
    + r.kills * SERVICE_POINTS.kill
    + r.medals * SERVICE_POINTS.medal
    + r.certifications * SERVICE_POINTS.certification
    + r.trackRecords * SERVICE_POINTS.trackRecord
    + r.skillBands * SERVICE_POINTS.skillBand;
}

/** The rank a score earns. */
export function rankFor(score: number): RankDef {
  let best = RANKS[0];
  for (const r of RANKS) if (score >= r.at) best = r;
  return best;
}

/** The next rung, and how far off it is. Undefined at the top. */
export function nextRank(score: number): { rank: RankDef; need: number; progress: number } | undefined {
  const cur = rankFor(score);
  const next = RANKS[cur.id + 1];
  if (!next) return undefined;
  const span = next.at - cur.at;
  return { rank: next, need: next.at - score, progress: Math.max(0, Math.min(1, (score - cur.at) / span)) };
}

// ── THE AUTHORITIES ────────────────────────────────────────────────────────

/** THE STABLE: a god costs the war's materiel, so it takes a commission. */
export const MAY_CALL_STABLE = 5;   // Lieutenant
export const MAY_COMMAND = 6;       // Captain

export const mayCallStable = (rankId: number): boolean => rankId >= MAY_CALL_STABLE;
export const mayCommand = (rankId: number): boolean => rankId >= MAY_COMMAND;

/**
 * LEADERSHIP REACH, in world units. Men inside it hold their morale — the
 * `ledWell` shift. A corporal steadies the man beside him; a colonel steadies
 * a position. Below Corporal there is no reach: you are one of the men.
 */
export function leadershipRadius(rankId: number): number {
  if (rankId < 2) return 0;
  return 10 + (rankId - 2) * 4; // Corporal 10 → General 38
}

/** A modest opening-manifest bonus. Rank is trust, not a damage stat. */
export const materielBonus = (rankId: number): number => (rankId >= 7 ? 2 : rankId >= 4 ? 1 : 0);

/** The board's verdict, in the GONET's voice. */
export function boardVerdict(score: number): string {
  const next = nextRank(score);
  if (!next) return 'At the top of the ladder. There is nothing left to promote you to.';
  return `Eligible for ${next.rank.name} in ${Math.ceil(next.need)} more service.`;
}
