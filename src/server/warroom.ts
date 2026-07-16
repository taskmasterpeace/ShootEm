/**
 * §11.5 The War Room — the PURE half of the operator's surface.
 *
 * Everything in this file is side-effect-free: no sockets, no fs, no timers.
 * server.ts wires these shapes to HTTP; tests exercise them against a real
 * World fixture without a server in sight. The page (src/warroom/warroom.ts)
 * imports only the TYPES, so the wire contract lives in exactly one place.
 */
import type { ModeId, ThemeId } from '../sim/types';
import type { World } from '../sim/world';
import {
  FRONTS, SEASON_FRONTS_TO_WIN, bandOf, type Band, type Campaign, type FrontDef,
} from '../client/campaign';

// ---------------------------------------------------------------------------
// The status payload — GET /warroom/status returns exactly this.
// ---------------------------------------------------------------------------

export interface WarroomRoomStatus {
  mode: ModeId;
  theme: ThemeId;
  /** which named front this room is fighting for (best guess — see frontForRoom) */
  front: string | null;
  humans: number;
  bots: number;
  /** the humans aboard, for the kick tool — bots are cattle, not citizens */
  roster: { name: string; team: number; kills: number; deaths: number }[];
  scores: [number, number];
  /** seconds on the match clock; -1 means an endless mode (survival/horde) */
  timeLeft: number;
  over: boolean;
  /** wave counter for the co-op modes, when the mode keeps one */
  wave?: number;
}

export interface WarroomFrontSummary {
  id: string;
  name: string;
  mode: ModeId;
  theme: ThemeId;
  control: number;         // −100..+100 (22B)
  band: Band;              // controlled / contested / enemy, per bandOf
  scarActive: boolean;
  scar: FrontDef['scar'];
}

export interface WarroomCampaignSummary {
  season: number;
  updatedAt: number;
  frontsToWin: number;     // the Armistice threshold (§13)
  standing: { coalition: number; contested: number; collective: number };
  fronts: WarroomFrontSummary[];
  /** the Morning Dispatch tail, newest first — OPERATOR lines included (§16) */
  dispatch: { text: string; at: number; simulated: boolean }[];
}

export interface WarroomStatus {
  at: number;              // server clock when the payload was cut
  rooms: WarroomRoomStatus[];
  campaign: WarroomCampaignSummary;
}

/** POST /warroom/cmd body — one op per request, key in the x-warroom-key header. */
export interface WarroomCmd {
  op: 'end' | 'restart' | 'announce' | 'kick' | 'nudge' | 'operation';
  /** which room (rooms are one-per-mode) for end/restart/announce/kick */
  mode?: ModeId;
  /** announce text / kick target soldier name / operation note */
  text?: string;
  name?: string;
  note?: string;
  /** nudge target + tilt */
  frontId?: string;
  delta?: number;
}

export interface WarroomCmdResult { ok: boolean; msg?: string; lines?: string[] }

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Which named front is this room fighting for? Rooms are one-per-mode with a
 * rotating theme, so an exact theme+mode match is the honest answer; a
 * mode-only match is close enough when the rotation wandered off the map.
 */
export function frontForRoom(mode: ModeId, theme: ThemeId): string | null {
  const exact = FRONTS.find((f) => f.mode === mode && f.theme === theme);
  if (exact) return exact.name;
  return FRONTS.find((f) => f.mode === mode)?.name ?? null;
}

/** One room, one line of truth: who's aboard, what the score is, how long is left. */
export function roomStatus(world: World, theme: ThemeId): WarroomRoomStatus {
  let humans = 0;
  let bots = 0;
  const roster: WarroomRoomStatus['roster'] = [];
  for (const s of world.soldiers.values()) {
    if (s.kind === 'human') {
      humans++;
      roster.push({ name: s.name, team: s.team, kills: s.kills, deaths: s.deaths });
    } else if (s.kind === 'bot') {
      bots++;
    }
  }
  const m = world.mode;
  return {
    mode: m.id,
    theme,
    front: frontForRoom(m.id, theme),
    humans,
    bots,
    roster,
    scores: [m.scores[0], m.scores[1]],
    // Infinity doesn't survive JSON — endless clocks read -1 on the wire
    timeLeft: Number.isFinite(m.timeLeft) ? Math.max(0, Math.round(m.timeLeft)) : -1,
    over: m.over,
    wave: m.wave,
  };
}

/** The Scar at a glance: every front's band, the standing, the dispatch tail. */
export function campaignSummary(c: Campaign): WarroomCampaignSummary {
  const standing = { coalition: 0, contested: 0, collective: 0 };
  const fronts = FRONTS.map((f): WarroomFrontSummary => {
    const st = c.fronts[f.id] ?? { control: 0, scarActive: false, lastBattleAt: 0 };
    const band = bandOf(st.control);
    standing[band]++;
    return {
      id: f.id, name: f.name, mode: f.mode, theme: f.theme,
      control: st.control, band, scarActive: st.scarActive, scar: f.scar,
    };
  });
  return {
    season: c.season,
    updatedAt: c.updatedAt,
    frontsToWin: SEASON_FRONTS_TO_WIN,
    standing,
    fronts,
    dispatch: c.dispatch.slice(0, 14),
  };
}

/** The shared-secret check for POST /warroom/cmd. Constant-time it is not —
 *  Stage-2 hardening (real auth, TLS, rate limits) before the war runs public. */
export function keyOk(given: unknown, expected: string): boolean {
  return typeof given === 'string' && given.length > 0 && given === expected;
}
