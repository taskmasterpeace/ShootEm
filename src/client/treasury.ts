// ═══════════════════════════════════════════════════════════════════════════
// THE TREASURY — G1 of the government program (docs/GOVERNMENT.md).
//
// Robert's money law, LOCKED: *"when you have money, you either gotta win or
// you gotta lose."* So the war chest is not a score — it is a CONSEQUENCE.
// Win and your government funds you; lose and the manifest gets lean. The
// sim already kept the other half of this book (warLedger bills every hull
// you wreck); this is the income side, and the two together are the budget
// that decides what your side can afford next time.
//
// Account-level (it survives every print, like licences and records) and
// per-FACTION, because you fight for a government, not for yourself.
// ═══════════════════════════════════════════════════════════════════════════
import type { NationFaction } from '../data/nations';

const KEY = 'ww_treasury';

export interface TreasuryRow {
  /** what the war chest holds, in requisition credits */
  balance: number;
  /** lifetime totals — the ledger the Secretary reads */
  earned: number;
  spent: number;
  /** matches that paid in, and matches that cost */
  wins: number;
  losses: number;
  /** the last movement, for the after-action line */
  lastDelta: number;
  lastReason: string;
}

export type TreasuryBook = Record<string, TreasuryRow>;

export const OPENING_BALANCE = 12_000;

/** The money law made concrete: a decisive result MOVES the chest. */
export const PAYOUTS = {
  win: 3_000,
  loss: -1_500,
  draw: 250,
  /** every hull your side wrecked comes off the top (the sim's own bill) */
  hullRate: 25,
} as const;

export const treasuryStorage = {
  get(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v: string): void { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
};

function blank(): TreasuryRow {
  return { balance: OPENING_BALANCE, earned: 0, spent: 0, wins: 0, losses: 0, lastDelta: 0, lastReason: 'Opening balance' };
}

export function loadTreasury(): TreasuryBook {
  try {
    const raw = JSON.parse(treasuryStorage.get() ?? '{}') as TreasuryBook;
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

export function treasuryFor(faction: NationFaction): TreasuryRow {
  const book = loadTreasury();
  return book[faction] ?? blank();
}

/**
 * File a match. `result` is the player's side outcome; `hullsLost` is what
 * the sim billed their army. Returns the row AFTER the movement, so the
 * after-action screen can show the number that just changed.
 */
export function settleMatch(faction: NationFaction, input: {
  result: 'win' | 'loss' | 'draw';
  hullsLost?: number;
  reason?: string;
}): TreasuryRow {
  const book = loadTreasury();
  const row = book[faction] ?? blank();
  const base = PAYOUTS[input.result];
  const bill = Math.round((input.hullsLost ?? 0) * PAYOUTS.hullRate);
  const delta = base - bill;
  row.balance = Math.max(0, row.balance + delta);
  if (delta > 0) row.earned += delta; else row.spent += -delta;
  if (input.result === 'win') row.wins++;
  else if (input.result === 'loss') row.losses++;
  row.lastDelta = delta;
  row.lastReason = input.reason
    ?? (input.result === 'win' ? 'Victory payout' : input.result === 'loss' ? 'Defeat — the ministry pays for the ground' : 'Stalemate stipend')
    + (bill ? ` · ${bill} in hulls` : '');
  book[faction] = row;
  treasuryStorage.set(JSON.stringify(book));
  return row;
}

/**
 * THE BUDGET CAP (G2's seed): what a treasury this size lets a side field.
 * A rich government opens the whole stable; a broke one sends you with what
 * is in the shed. Returns a multiplier the requisition menus can apply.
 */
export function budgetMultiplier(faction: NationFaction): number {
  const b = treasuryFor(faction).balance;
  if (b >= 20_000) return 1.25;
  if (b >= 10_000) return 1;
  if (b >= 4_000) return 0.8;
  return 0.6; // the lean manifest — you are fighting on what is left
}

/** One line for the after-action screen and the front door strip. */
export function treasuryLine(faction: NationFaction): string {
  const t = treasuryFor(faction);
  const sign = t.lastDelta > 0 ? '+' : '';
  return `WAR CHEST ${t.balance.toLocaleString()} · ${sign}${t.lastDelta.toLocaleString()} — ${t.lastReason}`;
}

export function clearTreasury(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
