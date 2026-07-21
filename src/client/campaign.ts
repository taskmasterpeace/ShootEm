import type { ModeId, ThemeId } from '../sim/types';
import { scienceReward } from '../sim/science';
import type { ScienceMissionResult } from '../sim/science-runtime';

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
  // titan, not starship: the fort is a hilltop colony strongpoint now that
  // its ground is authored (§8.2) — trench rings on deck plate read as a bug
  { id: 'fort_raven', name: 'Fort Raven', theme: 'titan', mode: 'koth', importance: 1.1, scar: 'rubble' },
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

export interface FrontState {
  control: number; scarActive: boolean; lastBattleAt: number;
  /** W3.3 CLONES ARE THE CURRENCY: the front's reprint reserve. Your side's
   *  deaths in a battle here SPEND it; a win convoys some back; at ZERO the
   *  front is LOST outright — no bodies left to hold the line. */
  clones: number;
  /** W3.4 PASS ESCALATION: how deep the war has dug in here. P1 = no gods,
   *  P2 = the enemy stable wakes, P3 = both stables loose. Advances one
   *  pass per battle fought on the front; the armistice resets it. */
  pass: 1 | 2 | 3;
  /** Two science sorties are available for each escalation pass. */
  scienceWindows: number;
  scienceWindowPass: 1 | 2 | 3;
  /** Reward counters with direct campaign meaning, displayed in the Scar UI. */
  enemyClonePressure: number;
  cloneInsurance: number;
}

/** W3.3: a front's starting reserve scales with its importance. */
export const CLONE_SEED = 400;
export const cloneSeedFor = (f: FrontDef) => Math.round(CLONE_SEED * f.importance);
/** a won battle convoys replacements in (never past the seed) */
export const CLONE_RECOVER = 60;
export const SCIENCE_WINDOWS_PER_PASS = 2;
export const GHOST_CLONE_BONUS = 10;
export type ScienceCloneLossPolicy = 'spent-permanent' | 'retry-next-window';
export const DEFAULT_SCIENCE_CLONE_LOSS_POLICY: ScienceCloneLossPolicy = 'spent-permanent';

export interface ScienceBonuses {
  theaterClones: number;
  morale: number;
  openingMateriel: number;
  requisitionDiscounts: number;
  enemyReinforcementCuts: number;
  weatherPicks: number;
  rosterIntel: number;
  lswAssignments: number;
}

const freshScienceBonuses = (): ScienceBonuses => ({
  theaterClones: 0,
  morale: 0,
  openingMateriel: 0,
  requisitionDiscounts: 0,
  enemyReinforcementCuts: 0,
  weatherPicks: 0,
  rosterIntel: 0,
  lswAssignments: 0,
});

export interface Campaign {
  v: 1;
  season: number;
  updatedAt: number;
  fronts: Record<string, FrontState>;
  /** the Morning Dispatch: latest campaign lines, newest first */
  dispatch: { text: string; at: number; simulated: boolean }[];
  scienceBonuses: ScienceBonuses;
  /** Idempotency ledger: a browser retry may report the same sortie once. */
  appliedScienceMissionIds: string[];
}

const LS_KEY = 'ww_campaign';

export function freshCampaign(now = Date.now()): Campaign {
  const fronts: Record<string, FrontState> = {};
  for (const f of FRONTS) fronts[f.id] = {
    control: 0, scarActive: false, lastBattleAt: 0, clones: cloneSeedFor(f), pass: 1,
    scienceWindows: SCIENCE_WINDOWS_PER_PASS, scienceWindowPass: 1,
    enemyClonePressure: 0, cloneInsurance: 0,
  };
  return {
    v: 1, season: 1, updatedAt: now, fronts, dispatch: [],
    scienceBonuses: freshScienceBonuses(), appliedScienceMissionIds: [],
  };
}

export function loadCampaign(now = Date.now()): Campaign {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw) as Campaign;
      if (c.v === 1) {
        for (const f of FRONTS) {
          c.fronts[f.id] ??= {
            control: 0, scarActive: false, lastBattleAt: 0, clones: cloneSeedFor(f), pass: 1,
            scienceWindows: SCIENCE_WINDOWS_PER_PASS, scienceWindowPass: 1,
            enemyClonePressure: 0, cloneInsurance: 0,
          };
          c.fronts[f.id].clones ??= cloneSeedFor(f); // W3.3 migration: old saves get full reserves
          c.fronts[f.id].pass ??= 1;                 // W3.4 migration: the war starts at pass one
          c.fronts[f.id].scienceWindows ??= SCIENCE_WINDOWS_PER_PASS;
          c.fronts[f.id].scienceWindowPass ??= c.fronts[f.id].pass;
          c.fronts[f.id].enemyClonePressure ??= 0;
          c.fronts[f.id].cloneInsurance ??= 0;
        }
        c.scienceBonuses = { ...freshScienceBonuses(), ...(c.scienceBonuses ?? {}) };
        c.appliedScienceMissionIds ??= [];
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

function refreshScienceWindows(state: FrontState, pass: 1 | 2 | 3): void {
  if (state.scienceWindowPass === pass) return;
  state.scienceWindowPass = pass;
  state.scienceWindows = SCIENCE_WINDOWS_PER_PASS;
}

export function scienceWindowsFor(campaign: Campaign, frontId: string, pass?: 1 | 2 | 3): number {
  const state = campaign.fronts[frontId];
  if (!state) return 0;
  refreshScienceWindows(state, pass ?? state.pass);
  return state.scienceWindows;
}

/** Reserve one sortie window. Launch flow calls this before constructing World. */
export function spendScienceWindow(campaign: Campaign, frontId: string, pass?: 1 | 2 | 3): boolean {
  const state = campaign.fronts[frontId];
  if (!state) return false;
  const activePass = pass ?? state.pass;
  refreshScienceWindows(state, activePass);
  if (state.scienceWindows <= 0) return false;
  state.scienceWindows--;
  return true;
}

/** Fold a science sortie into the same numbers the Scar and battle setup read. */
export function applyScienceResult(
  campaign: Campaign,
  frontId: string,
  result: ScienceMissionResult,
  now = Date.now(),
  cloneLossPolicy: ScienceCloneLossPolicy = DEFAULT_SCIENCE_CLONE_LOSS_POLICY,
): boolean {
  const state = campaign.fronts[frontId];
  const front = FRONTS.find((candidate) => candidate.id === frontId);
  if (!state || !front || campaign.appliedScienceMissionIds.includes(result.id)) return false;
  campaign.appliedScienceMissionIds.unshift(result.id);
  if (campaign.appliedScienceMissionIds.length > 80) campaign.appliedScienceMissionIds.length = 80;

  const clonesBefore = state.clones;
  const burnsFailedSquad = result.won || cloneLossPolicy === 'spent-permanent';
  if (burnsFailedSquad) state.clones = Math.max(0, state.clones - Math.max(0, Math.floor(result.clonesSpent)));
  const lines = [`SCIENCE ${result.id}: ${result.won ? 'operation complete' : 'operation failed'} at ${front.name}; ${result.clonesSpent} clone${result.clonesSpent === 1 ? '' : 's'} spent.`];
  if (!result.won && cloneLossPolicy === 'retry-next-window') {
    lines.push(`SCIENCE ${result.id}: failed squad allocation restored; the sortie window remains spent.`);
  }
  if (result.ghost) {
    state.clones = Math.min(cloneSeedFor(front) + 80, state.clones + GHOST_CLONE_BONUS);
    lines.push(`SCIENCE ${result.id}: GHOST EXTRACTION — ${GHOST_CLONE_BONUS} clean sleeves recovered.`);
  }

  if (result.won) {
    switch (result.reward) {
      case 'front-reinforcement':
        state.clones = Math.min(cloneSeedFor(front) + 80, state.clones + 40);
        break;
      case 'theater-reinforcement': campaign.scienceBonuses.theaterClones += 25; break;
      case 'enemy-clone-drain': state.enemyClonePressure += 30; break;
      case 'clone-insurance': state.cloneInsurance += 1; break;
      case 'front-breakthrough': state.control = Math.min(100, state.control + 6); break;
      case 'morale-cache': campaign.scienceBonuses.morale += 1; break;
      case 'opening-materiel': campaign.scienceBonuses.openingMateriel += 2; break;
      case 'requisition-discount': campaign.scienceBonuses.requisitionDiscounts += 1; break;
      case 'deny-reinforcements': campaign.scienceBonuses.enemyReinforcementCuts += 1; break;
      case 'weather-pick': campaign.scienceBonuses.weatherPicks += 1; break;
      case 'roster-intel': campaign.scienceBonuses.rosterIntel += 1; break;
      case 'lsw-assignment': campaign.scienceBonuses.lswAssignments += 1; break;
    }
    lines.push(`SCIENCE ${result.id}: reward secured — ${scienceReward(result.reward).label}.`);
  }
  if (state.clones === 0 && clonesBefore > 0) {
    state.control = -100;
    lines.push(`SCIENCE ${result.id}: ${front.name} ran DRY during the operation — the front is lost.`);
  }
  state.lastBattleAt = now;
  for (const text of lines) campaign.dispatch.unshift({ text, at: now, simulated: false });
  if (campaign.dispatch.length > 60) campaign.dispatch.length = 60;
  return true;
}

/** Fold one battle into the war (22B). `deaths` is YOUR side's body count —
 *  W3.3 spends it from the front's clone reserve. Returns the dispatch lines. */
export function applyResult(c: Campaign, frontId: string, won: boolean | null, now = Date.now(), deaths = 0): string[] {
  const def = FRONTS.find((f) => f.id === frontId);
  const st = c.fronts[frontId];
  if (!def || !st || won === null) return [];
  const before = bandOf(st.control);
  const shift = BASE_SHIFT * (MODE_WEIGHT[def.mode] ?? 1) * def.importance * (won ? 1 : -1);
  st.control = Math.max(-100, Math.min(100, Math.round((st.control + shift) * 10) / 10));
  st.lastBattleAt = now;
  const lines: string[] = [];
  // W3.3 CLONES ARE THE CURRENCY: every one of your dead was a reprint the
  // front paid for. A win convoys some replacements in; an empty vat is an
  // empty line — the front falls outright, whatever the scoreboard said.
  const seed = cloneSeedFor(def);
  const clonesBefore = st.clones ?? seed;
  st.clones = Math.max(0, clonesBefore - deaths);
  if (won && st.clones > 0) st.clones = Math.min(seed, st.clones + CLONE_RECOVER);
  if (st.clones === 0 && clonesBefore > 0) {
    st.control = -100; // no bodies to hold it — the Collective walks in
    lines.push(`${def.name} has run DRY of clones — the front is LOST. The vats stand empty.`);
  } else if (st.clones > 0 && st.clones <= seed * 0.25 && clonesBefore > seed * 0.25) {
    lines.push(`${def.name} reserves CRITICAL: ${Math.round(st.clones)} clones left in the vats.`);
  }
  // W3.4: every battle digs the front one PASS deeper — the stables wake
  const prevPass = st.pass ?? 1;
  st.pass = Math.min(3, prevPass + 1) as 1 | 2 | 3;
  if (st.pass !== prevPass) {
    lines.push(st.pass === 2
      ? `${def.name} escalates — PASS 2: their stable is awake.`
      : `${def.name} escalates — PASS 3: both stables are loose.`);
  }
  const after = bandOf(st.control);
  if (after !== before) {
    lines.push(after === 'contested'
      ? `${def.name} has fallen CONTESTED — the line is moving.`
      : `${def.name} is now ${after === 'coalition' ? 'United Front' : 'Collective'} ground.`);
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
  const name = winner === 'coalition' ? 'The United Front' : 'The Collective';
  c.dispatch.unshift(
    { text: `ARMISTICE — Season ${season} is over. ${name} takes the war, holding ${held[winner]} of ten fronts. The theatre resets; the record remains.`, at: now, simulated: false },
  );
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  for (const f of FRONTS) c.fronts[f.id] = {
    control: 0, scarActive: false, lastBattleAt: 0, clones: cloneSeedFor(f), pass: 1,
    scienceWindows: SCIENCE_WINDOWS_PER_PASS, scienceWindowPass: 1,
    enemyClonePressure: 0, cloneInsurance: 0,
  }; // the armistice refills the vats and calms the war
  c.season = season + 1;
  return { winner, season, frontsHeld: held[winner] };
}

// ---------------------------------------------------------------------------
// §11.5 NUDGE — the operator's hand on the map. Pure helpers (no DOM, no
// storage) so the War Room server can drive the SAME math a real result uses.
// §16's audit rule applies to admins too: every line below is loud about who
// moved the map — the journal never launders a decree into a battle.
// ---------------------------------------------------------------------------

/** the operator's thumb has a weight limit: one nudge tips a front ±10 at most */
export const NUDGE_LIMIT = 10;

/**
 * Tip a front by decree. Same rails, same band math, same scar logic as
 * applyResult — but every dispatch line is prefixed OPERATOR, and a nudge
 * never touches lastBattleAt or ends a season (the Armistice is a rite for
 * real battles; checkSeasonEnd is deliberately NOT called here).
 * Returns the dispatch lines written ([] for an unknown front or zero delta).
 */
export function applyNudge(c: Campaign, frontId: string, delta: number, now = Date.now()): string[] {
  const def = FRONTS.find((f) => f.id === frontId);
  const st = c.fronts[frontId];
  const d = Math.max(-NUDGE_LIMIT, Math.min(NUDGE_LIMIT, delta));
  if (!def || !st || !d) return [];
  const before = bandOf(st.control);
  st.control = Math.max(-100, Math.min(100, Math.round((st.control + d) * 10) / 10));
  const after = bandOf(st.control);
  const lines: string[] = [
    `OPERATOR: command tipped ${def.name} ${d > 0 ? '+' : ''}${d} — the map moved by decree.`,
  ];
  if (after !== before) {
    lines.push(after === 'contested'
      ? `OPERATOR: ${def.name} has fallen CONTESTED — by order, not by battle.`
      : `OPERATOR: ${def.name} is now ${after === 'coalition' ? 'United Front' : 'Collective'} ground — so says command.`);
  }
  const deep = Math.abs(st.control) >= SCAR_EDGE;
  if (deep && !st.scarActive) {
    st.scarActive = true;
    lines.push(`OPERATOR: ${def.name} carries a scar now: ${SCAR_TEXT[def.scar]}.`);
  } else if (!deep && st.scarActive && after === 'contested') {
    st.scarActive = false;
    lines.push(`OPERATOR: the decree churned ${def.name} back to raw ground — its scar fades.`);
  }
  for (const text of lines) c.dispatch.unshift({ text, at: now, simulated: false });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return lines;
}

/**
 * §11.5 — stage and name an operation: a line of operator intent in the
 * Journal. It moves no control; it tells the theatre what command is
 * planning, signed OPERATOR like every other act of the admin's hand.
 */
export function stageOperation(c: Campaign, name: string, note = '', now = Date.now()): string {
  const codename = (name.trim().toUpperCase().slice(0, 24) || 'UNNAMED').replace(/\s+/g, ' ');
  const text = `OPERATOR: Operation ${codename} is staged${note.trim() ? ` — ${note.trim().slice(0, 120)}` : ''}.`;
  c.dispatch.unshift({ text, at: now, simulated: false });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return text;
}

export const SCAR_TEXT: Record<FrontDef['scar'], string> = {
  fire: 'persistent fires burn the middle ground',
  rubble: 'collapsed cover litters the field',
  frozen: 'the ground has frozen slick',
  flooded: 'low ground is under water',
  blocked: 'a main route is blocked',
};

/**
 * W3.1 — THE WAR ONLY MOVES WHILE YOU PLAY. Robert killed the time-skip
 * (27B's simulated overnight): an offline war fighting itself made the
 * theater read as weather, not a war he was IN. Coming back after an
 * absence now writes ONE honest line — the fronts held, because nobody
 * fought — and touches no front. Your last map is exactly the map.
 */
export function holdTheLine(c: Campaign, now = Date.now()): string[] {
  const HOUR = 3600_000;
  if (now - c.updatedAt < HOUR) return [];
  const line = 'While you were away: the fronts HELD. The war only moves while you fight.';
  c.dispatch.unshift({ text: line, at: now, simulated: false });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return [line];
}
