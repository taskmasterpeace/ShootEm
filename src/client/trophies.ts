// ---------------------------------------------------------------------------
// THE HONORS (docs/COMPETITIVE-ARC.md §3) — circulating trophies. Each honor
// is ONE artifact with ONE holder and an append-only lineage:
//
//   THE YARD CUP     — the series honor. Beat the holder in a yard series and
//                      it changes hands at the whistle. Vacant until the
//                      first series is won.
//   THE LONGBALL BELT — the distance honor. Beat the standing longest-splat
//                      record (any yard, any round) and the Belt transfers on
//                      the spot, mid-match.
//
// LAWS (write once, keep forever — they matter at military expansion time):
//   1. One artifact = one ledger = one holder. No duplicates, no resets.
//   2. Ledgers only append. History is sacred; display can truncate.
//   3. Every transfer records a played match. No admin handoffs.
//   4. The player never loses an honor off-screen. There is no off-screen
//      simulation anywhere in this game (Robert's rule) — an honor leaves
//      the player only in a match they actually played and lost.
// ---------------------------------------------------------------------------
import type { World } from '../sim/world';

export interface TrophyReign {
  holder: string;
  takenFrom: string | null;   // null = the inaugural claim
  at: number;                 // real time
  field: string;
  score: string;              // "3–2" for the Cup; "41.2u" for the Belt
  kind: 'series' | 'gauntlet' | 'record';
}

export interface TrophyLedger {
  v: 1;
  trophy: 'yard_cup' | 'longball_belt';
  reigns: TrophyReign[];
}

interface TrophyStore {
  cup: TrophyLedger;
  belt: TrophyLedger;
  /** THE HOUSE SCORE — the Gallery's standing record (COMPETITIVE-ARC §6) */
  gallery?: { holder: string; score: number; at: number };
}

const KEY = 'ww_trophies';
/** the Belt's opening bar: the first claim must be a genuinely LONG ball —
 *  a point-blank splat never starts a distance lineage */
export const BELT_FLOOR = 25;

const fresh = (): TrophyStore => ({
  cup: { v: 1, trophy: 'yard_cup', reigns: [] },
  belt: { v: 1, trophy: 'longball_belt', reigns: [] },
});

export function loadTrophies(): TrophyStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = JSON.parse(raw) as TrophyStore;
      if (st?.cup?.v === 1 && Array.isArray(st.cup.reigns) && st?.belt?.v === 1) return st;
    }
  } catch { /* fresh shelf */ }
  return fresh();
}

export function saveTrophies(st: TrophyStore) {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ }
}

export function holderOf(l: TrophyLedger): string | null {
  return l.reigns.length ? l.reigns[l.reigns.length - 1].holder : null;
}

/** the Belt's standing number — the distance to beat */
export function beltRecord(l: TrophyLedger): number {
  const last = l.reigns[l.reigns.length - 1];
  return last ? parseFloat(last.score) || BELT_FLOOR : BELT_FLOOR;
}

/** days a holder has worn an honor (display sugar for cards + the paper) */
export function reignDays(l: TrophyLedger): number {
  const last = l.reigns[l.reigns.length - 1];
  return last ? Math.floor((Date.now() - last.at) / 86400000) : 0;
}

/** A splat just landed at `dist`. If it beats the standing record, the BELT
 *  transfers immediately. Returns the announce line, or null. */
export function checkBelt(st: TrophyStore, shooter: string, dist: number, field: string): string | null {
  const record = beltRecord(st.belt);
  if (dist <= record) return null;
  const prev = holderOf(st.belt);
  st.belt.reigns.push({
    holder: shooter, takenFrom: prev, at: Date.now(),
    field, score: `${dist.toFixed(1)}u`, kind: 'record',
  });
  saveTrophies(st);
  return prev && prev !== shooter
    ? `THE LONGBALL BELT MOVES — ${shooter.toUpperCase()} · ${dist.toFixed(1)}u ON ${field.toUpperCase()} (from ${prev})`
    : `THE LONGBALL BELT — ${shooter.toUpperCase()} SETS THE MARK: ${dist.toFixed(1)}u ON ${field.toUpperCase()}`;
}

/** A Gallery run just banked `score`. If it beats the HOUSE SCORE, the house
 *  changes hands. Returns the announce line, or null. */
export function checkGalleryRecord(st: TrophyStore, who: string, score: number): string | null {
  if (score <= 0) return null;
  const g = st.gallery;
  if (g && score <= g.score) return null;
  st.gallery = { holder: who, score, at: Date.now() };
  saveTrophies(st);
  return g
    ? `THE HOUSE SCORE FALLS — ${who.toUpperCase()}: ${score} (was ${g.holder} · ${g.score})`
    : `THE HOUSE SCORE IS SET — ${who.toUpperCase()}: ${score}`;
}

/** A yard series just ended. Settle the CUP. Returns the announce, or null.
 *
 *  V1 holder model (personas arrive in Wave 3): the player and named bots
 *  share the ledger. A vacant Cup goes to the winning side's champion. The
 *  player takes it by beating whoever holds it (any ranked series counts —
 *  the named holder needn't be present, the FIELD defends in their name);
 *  the player LOSES it only in a series they played (law 4 holds trivially —
 *  every series in the ledger is one the player was in). */
export function settleCup(
  st: TrophyStore, w: World, meId: number, field: string, gauntlet: boolean,
): string | null {
  const me = w.soldiers.get(meId);
  if (!me || w.mode.winner === undefined || w.mode.winner === -1) return null;
  const wins = w.mode.roundWins ?? [0, 0];
  const score = `${Math.max(wins[0], wins[1])}–${Math.min(wins[0], wins[1])}`;
  const kind = gauntlet ? 'gauntlet' as const : 'series' as const;
  const playerWon = w.mode.winner === me.team;
  const holder = holderOf(st.cup);

  if (playerWon) {
    if (holder === me.name) return null; // defended — the reign continues
    st.cup.reigns.push({ holder: me.name, takenFrom: holder, at: Date.now(), field, score, kind });
    saveTrophies(st);
    return holder
      ? `THE CUP CHANGES HANDS — ${me.name.toUpperCase()} TAKES IT FROM ${holder.toUpperCase()} (${score})`
      : `FIRST BLOOD ON THE SHELF — ${me.name.toUpperCase()} CLAIMS THE YARD CUP (${score})`;
  }
  // the player lost — the Cup only moves if THEY were wearing it
  if (holder !== me.name) return null;
  // the enemy champion takes it: their top splatter, by name
  let champ = 'THE PACK', best = -1;
  for (const s of w.soldiers.values()) {
    if (s.team === me.team || (s.kind !== 'human' && s.kind !== 'bot')) continue;
    if (s.kills > best) { best = s.kills; champ = s.name; }
  }
  st.cup.reigns.push({ holder: champ, takenFrom: me.name, at: Date.now(), field, score, kind });
  saveTrophies(st);
  return `THE CUP IS LOST — ${champ.toUpperCase()} TAKES IT FROM ${me.name.toUpperCase()} (${score})`;
}
