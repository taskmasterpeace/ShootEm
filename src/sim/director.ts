// ---------------------------------------------------------------------------
// THE DIRECTOR (§AI-AUDIT theme 7 / the L4D idea). Difficulty used to be a
// single frozen tier picked at Match Setup: a stomped player kept getting
// stomped, and a player walking through the roster never felt the sky tighten.
// This is a match-level meta-brain that reads the SCOREBOARD and the human's
// own fortunes every few seconds and nudges one number — `pressure` — that
// scales bot aim and reaction on top of the chosen tier.
//
// TWO HARD RULES:
//  1. DETERMINISTIC. It reads sim state and sim time only — never a wall clock,
//     never Math.random. A replay reproduces the same adaptation.
//  2. NEUTRAL WITHOUT A HUMAN. With nobody human on the field the pressure
//     stays pinned at 1, so bot-vs-bot matches (and the entire test suite)
//     behave exactly as they did before this existed.
//
// It is a BAND, not a rubber band: the clamp is deliberately narrow so the
// sky can lean on you or give you air without ever reading as cheating.
// ---------------------------------------------------------------------------
import type { World } from './world';

/** seconds between evaluations — pacing, not twitch */
export const DIRECTOR_EVAL = 6;
/** how far the sky may lean. Narrow on purpose: past this it reads as cheating. */
export const PRESSURE_MIN = 0.78;
export const PRESSURE_MAX = 1.3;

export interface DirectorState {
  /** ×competence applied to bot aim + reaction. 1 = the tier you picked. */
  pressure: number;
  /** next sim time the band is re-evaluated */
  nextEvalAt: number;
  /** the human's deaths at the last evaluation — the "am I getting mauled?" read */
  lastDeaths: number;
}

export function newDirector(): DirectorState {
  return { pressure: 1, nextEvalAt: DIRECTOR_EVAL, lastDeaths: 0 };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Re-read the match and drift the pressure band. Called once per tick; does
 *  real work only every DIRECTOR_EVAL seconds. */
export function stepDirector(w: World, d: DirectorState): void {
  if (w.time < d.nextEvalAt) return;
  d.nextEvalAt = w.time + DIRECTOR_EVAL;

  // whose side are the players on? (first human wins; none = stay neutral)
  let humanTeam = -1;
  let deaths = 0;
  for (const s of w.soldiers.values()) {
    if (s.kind !== 'human') continue;
    if (humanTeam < 0) humanTeam = s.team;
    if (s.team === humanTeam) deaths += s.deaths;
  }
  if (humanTeam < 0) { d.pressure = 1; d.lastDeaths = 0; return; }

  const scores = w.mode.scores ?? [];
  const mine = scores[humanTeam] ?? 0;
  const theirs = scores[1 - humanTeam] ?? 0;

  // TWO SIGNALS, both in-sim so a replay reproduces them:
  //  · the scoreboard lead (are the players winning the match?)
  //  · deaths taken since the last look (are they getting mauled right now?)
  // A lead presses; a beating gives air. Deaths weigh heavier than score —
  // the scoreboard is slow, dying is how "this is too hard" actually feels.
  const lead = mine - theirs;
  const freshDeaths = Math.max(0, deaths - d.lastDeaths);
  d.lastDeaths = deaths;
  const target = 1 + clamp(lead * 0.06, -0.2, 0.3) - clamp(freshDeaths * 0.07, 0, 0.28);

  // drift toward it — a band that eases, never a snap the player can feel
  d.pressure = clamp(d.pressure + (target - d.pressure) * 0.34, PRESSURE_MIN, PRESSURE_MAX);
}
