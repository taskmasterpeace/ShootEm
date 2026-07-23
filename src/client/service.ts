// ---------------------------------------------------------------------------
// YOUR SERVICE — the account's record, and the rank it earns.
//
// The GONET desk has printed `Promotion Board — Eligible` since the day it was
// built, over an empty room. This is the room: a record of what the account
// actually did, assembled from the stores that already own each fact, plus the
// running tally (matches, kills) that nothing owned until now.
//
// Rank is READ from this, never stored — so it can never drift out of step
// with the service behind it.
// ---------------------------------------------------------------------------
import {
  RANKS, blankService, boardVerdict, mayCallStable, mayCommand, nextRank, rankFor,
  serviceScore, type ServiceRecord,
} from '../sim/ranks';
import { COURSES } from '../sim/courses';
import type { LicenceId } from '../sim/licenses';
import { loadLicences } from './licences';
import { allRecords } from './records';
import { treasuryFor } from './treasury';
import { loadIdentity } from './identity';

const KEY = 'ww.service.v1';

/** The half nothing else counts: matches fought, and men put down. */
interface Tally { matches: number; kills: number; medals: number; skillBands: number; }

function loadTally(): Tally {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Tally>;
      return {
        matches: p.matches ?? 0, kills: p.kills ?? 0,
        medals: p.medals ?? 0, skillBands: p.skillBands ?? 0,
      };
    }
  } catch { /* private mode */ }
  return { matches: 0, kills: 0, medals: 0, skillBands: 0 };
}

function saveTally(t: Tally): void {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* private mode */ }
}

/** File one match into the record. Called once when a match ends. */
export function fileService(input: { won: boolean; kills: number; medals?: number; skillBands?: number }): void {
  const t = loadTally();
  t.matches += 1;
  t.kills += Math.max(0, Math.round(input.kills));
  t.medals += Math.max(0, input.medals ?? 0);
  t.skillBands += Math.max(0, input.skillBands ?? 0);
  saveTally(t);
}

/** The whole record, drawn from every store that owns a piece of it. */
export function serviceRecord(): ServiceRecord {
  const t = loadTally();
  const lic = loadLicences();
  const all = Object.keys(COURSES) as LicenceId[];
  const id = loadIdentity();
  const chest = id ? treasuryFor(id.faction) : undefined;
  return {
    ...blankService(),
    matches: t.matches,
    wins: chest?.wins ?? 0,
    kills: t.kills,
    medals: t.medals,
    certifications: all.filter((l) => lic.held.includes(l)).length,
    trackRecords: allRecords().length,
    skillBands: t.skillBands,
  };
}

export const serviceTotal = (): number => serviceScore(serviceRecord());

/** The rank the account currently holds. */
export const currentRank = () => rankFor(serviceTotal());

/** Everything the promotion board needs to say. */
export function board() {
  const score = serviceTotal();
  const rank = rankFor(score);
  const next = nextRank(score);
  return {
    record: serviceRecord(),
    score,
    rank,
    next,
    verdict: boardVerdict(score),
    mayCallStable: mayCallStable(rank.id),
    mayCommand: mayCommand(rank.id),
    ladder: RANKS,
  };
}

export function clearService(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
