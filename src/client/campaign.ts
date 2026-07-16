import type { ModeId, ThemeId } from '../sim/types';

// ---------------------------------------------------------------------------
// The Living Campaign v1 (DD §8.5) — the Scar goes live. Ten named fronts,
// each mapped to an EXISTING generator recipe; a local campaign file whose
// control values move with match results (22B: banded, mode- and importance-
// weighted); scars as match modifiers; and the 27B honest offline time-skip.
// ---------------------------------------------------------------------------

export interface FrontDef {
  id: string;
  name: string;
  theme: ThemeId;
  mode: ModeId;
  /** how hard a result here moves the war (22B weight) */
  importance: number;
  /** the front's signature scar, active while a faction holds it DEEP */
  scar: 'fire' | 'rubble' | 'frozen' | 'flooded' | 'blocked';
}

/** The ten fronts of DD §8.2, on recipes that exist today (§8.5 v1 table). */
export const FRONTS: FrontDef[] = [
  { id: 'bridge_delta', name: 'Bridge Delta', theme: 'savanna', mode: 'ctf', importance: 1.2, scar: 'flooded' },
  { id: 'fort_raven', name: 'Fort Raven', theme: 'starship', mode: 'koth', importance: 1.1, scar: 'rubble' },
  { id: 'eastern_plains', name: 'Eastern Plains', theme: 'savanna', mode: 'conquest', importance: 1.0, scar: 'fire' },
  { id: 'the_city', name: 'The City', theme: 'savanna', mode: 'tdm', importance: 1.0, scar: 'rubble' },
  { id: 'highland_pass', name: 'Highland Pass', theme: 'asteroid', mode: 'ctf', importance: 0.9, scar: 'blocked' },
  { id: 'blacksite', name: 'Blacksite', theme: 'triton', mode: 'tdm', importance: 0.9, scar: 'frozen' },
  { id: 'refinery', name: 'Refinery', theme: 'starship', mode: 'conquest', importance: 1.1, scar: 'fire' },
  { id: 'the_port', name: 'The Port', theme: 'europa', mode: 'ctf', importance: 1.0, scar: 'flooded' },
  { id: 'airbase', name: 'Airbase', theme: 'savanna', mode: 'conquest', importance: 1.3, scar: 'blocked' },
  { id: 'the_mine', name: 'The Mine', theme: 'asteroid', mode: 'tdm', importance: 0.9, scar: 'rubble' },
];

/** 22B mode weights: objective wins move the war harder than skirmishes. */
const MODE_WEIGHT: Partial<Record<ModeId, number>> = { conquest: 1.25, ctf: 1.1, koth: 1.0, tdm: 0.8 };
const BASE_SHIFT = 8;
/** 22B bands on −100..+100: |control| < 34 is contested ground. */
export const BAND_EDGE = 34;
/** holding DEEP (|control| ≥ 67) is what scars a front */
export const SCAR_EDGE = 67;

export type Band = 'coalition' | 'contested' | 'collective';
export const bandOf = (control: number): Band =>
  control >= BAND_EDGE ? 'coalition' : control <= -BAND_EDGE ? 'collective' : 'contested';

export interface FrontState { control: number; scarActive: boolean; lastBattleAt: number }
export interface Campaign {
  v: 1;
  season: number;
  updatedAt: number;
  fronts: Record<string, FrontState>;
  /** the Morning Dispatch: latest campaign lines, newest first */
  dispatch: { text: string; at: number; simulated: boolean }[];
}

const LS_KEY = 'ww_campaign';

export function freshCampaign(now = Date.now()): Campaign {
  const fronts: Record<string, FrontState> = {};
  for (const f of FRONTS) fronts[f.id] = { control: 0, scarActive: false, lastBattleAt: 0 };
  return { v: 1, season: 1, updatedAt: now, fronts, dispatch: [] };
}

export function loadCampaign(now = Date.now()): Campaign {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw) as Campaign;
      if (c.v === 1) {
        for (const f of FRONTS) c.fronts[f.id] ??= { control: 0, scarActive: false, lastBattleAt: 0 };
        return c;
      }
    }
  } catch { /* fresh theatre */ }
  return freshCampaign(now);
}

export function saveCampaign(c: Campaign) {
  c.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch { /* storage full — the war plays on */ }
}

/** Fold one battle into the war (22B). Returns the dispatch lines it wrote. */
export function applyResult(c: Campaign, frontId: string, won: boolean | null, now = Date.now()): string[] {
  const def = FRONTS.find((f) => f.id === frontId);
  const st = c.fronts[frontId];
  if (!def || !st || won === null) return [];
  const before = bandOf(st.control);
  const shift = BASE_SHIFT * (MODE_WEIGHT[def.mode] ?? 1) * def.importance * (won ? 1 : -1);
  st.control = Math.max(-100, Math.min(100, Math.round((st.control + shift) * 10) / 10));
  st.lastBattleAt = now;
  const lines: string[] = [];
  const after = bandOf(st.control);
  if (after !== before) {
    lines.push(after === 'contested'
      ? `${def.name} has fallen CONTESTED — the line is moving.`
      : `${def.name} is now ${after === 'coalition' ? 'Coalition' : 'Collective'} ground.`);
  }
  const deep = Math.abs(st.control) >= SCAR_EDGE;
  if (deep && !st.scarActive) {
    st.scarActive = true;
    lines.push(`${def.name} carries a scar now: ${SCAR_TEXT[def.scar]}.`);
  } else if (!deep && st.scarActive && after === 'contested') {
    st.scarActive = false;
    lines.push(`The fighting has churned ${def.name} back to raw ground — its scar fades.`);
  }
  for (const text of lines) c.dispatch.unshift({ text, at: now, simulated: false });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return lines;
}

/** Season victory (§13, decided: points threshold): hold this many of the
 *  ten fronts in your band and the war is yours. */
export const SEASON_FRONTS_TO_WIN = 6;

export interface Armistice { winner: Exclude<Band, 'contested'>; season: number; frontsHeld: number }

/**
 * The Armistice check — run after REAL battles only (a simulated overnight
 * never ends a war; finales belong to the player). If a faction holds
 * SEASON_FRONTS_TO_WIN fronts, the season closes: dispatch written, theatre
 * reset, season number advanced. The dossier persists; the war resets (§13).
 */
export function checkSeasonEnd(c: Campaign, now = Date.now()): Armistice | null {
  const held = { coalition: 0, collective: 0 };
  for (const f of FRONTS) {
    const b = bandOf(c.fronts[f.id].control);
    if (b !== 'contested') held[b]++;
  }
  const winner = held.coalition >= SEASON_FRONTS_TO_WIN ? 'coalition'
    : held.collective >= SEASON_FRONTS_TO_WIN ? 'collective' : null;
  if (!winner) return null;
  const season = c.season;
  const name = winner === 'coalition' ? 'the Titan Coalition' : 'The Collective';
  c.dispatch.unshift(
    { text: `ARMISTICE — Season ${season} is over. ${name} takes the war, holding ${held[winner]} of ten fronts. The theatre resets; the record remains.`, at: now, simulated: false },
  );
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  for (const f of FRONTS) c.fronts[f.id] = { control: 0, scarActive: false, lastBattleAt: 0 };
  c.season = season + 1;
  return { winner, season, frontsHeld: held[winner] };
}

export const SCAR_TEXT: Record<FrontDef['scar'], string> = {
  fire: 'persistent fires burn the middle ground',
  rubble: 'collapsed cover litters the field',
  frozen: 'the ground has frozen slick',
  flooded: 'low ground is under water',
  blocked: 'a main route is blocked',
};

/**
 * 27B — the HONEST offline overnight. A local game cannot fight while the
 * program is closed, so on launch we run a capped, DETERMINISTIC time-skip
 * (seeded by the elapsed calendar blocks) and label every outcome simulated.
 */
export function simulateTimeSkip(c: Campaign, now = Date.now()): string[] {
  const HOUR = 3600_000;
  const elapsed = now - c.updatedAt;
  if (elapsed < HOUR) return [];
  // one block per 6h away, capped at 4 (a week away ≠ a lost war)
  const blocks = Math.min(4, Math.floor(elapsed / (6 * HOUR)) || 1);
  const lines: string[] = [];
  for (let b = 0; b < blocks; b++) {
    // deterministic: seed from the absolute 6h block index — replaying the
    // same launch after the same absence writes the same history
    const blockIdx = Math.floor(c.updatedAt / (6 * HOUR)) + b + 1;
    for (let fi = 0; fi < FRONTS.length; fi++) {
      const f = FRONTS[fi];
      const st = c.fronts[f.id];
      // xorshift-ish hash of (block, front) — stable, no Math.random
      let h = (blockIdx * 2654435761 ^ (fi + 1) * 40503) >>> 0;
      h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0;
      const drift = ((h % 9) - 4) * f.importance; // −4..+4, weighted
      if (drift === 0) continue;
      const before = bandOf(st.control);
      st.control = Math.max(-100, Math.min(100, Math.round((st.control + drift) * 10) / 10));
      const after = bandOf(st.control);
      if (after !== before) {
        lines.push(`While you were gone (simulated): ${f.name} ${after === 'contested' ? 'fell contested' : `went ${after === 'coalition' ? 'Coalition' : 'Collective'}`}.`);
      }
    }
  }
  if (lines.length === 0 && blocks > 0) lines.push('While you were gone (simulated): the fronts held. Quiet night.');
  const at = now;
  for (const text of lines) c.dispatch.unshift({ text, at, simulated: true });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return lines;
}
