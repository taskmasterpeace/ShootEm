// ---------------------------------------------------------------------------
// THE BLACK BOX — the crowd flight recorder (Robert: "put the tools in there
// so that next time it happens, you'll be able to diagnose it").
//
// Every authoritative sim records itself, always: a 2s-cadence time series of
// each team's spread, how many bodies are pooled around each home base, and
// how many are STUCK (commanded velocity says GO, actual displacement says
// FROZEN — the exact signature of the statue bug, wall-grinding, and milling).
// When a knot or a stuck body PERSISTS, the box files an incident with a full
// member-by-member snapshot — names, classes, goals, whether they're firing —
// so a postmortem names the mechanism instead of guessing at it.
//
// Read it any time from the console:
//   __ww.blackbox()          → { samples, incidents } (JSON-ready)
//   __ww.blackbox('report')  → compact human summary
// The client console.warns each new incident live, timestamped in sim time.
//
// Deterministic (sim time only, no wall clock), cheap (0.5 Hz, O(n²) over
// ≤~32 bodies), and silent in tests — the box only accumulates; the CLIENT
// decides what to surface.
// ---------------------------------------------------------------------------
import { isBlocked } from './map';
import type { Soldier } from './types';
import type { World } from './world';

export const BB_SAMPLE_EVERY = 2;   // seconds of sim time between samples
export const BB_MAX_SAMPLES = 600;  // ring buffer ≈ 20 minutes
export const BB_MAX_INCIDENTS = 40;
export const BB_BASE_R = 18;        // "around the home base" radius
const STUCK_SPD = 3;                // wants to move at least this fast…
const STUCK_DISP = 0.6;             // …but moved less than this in 2s
const KNOT_NN = 2;                  // a body this close to a teammate is knotted
const KNOT_MIN = 4;                 // this many knotted bodies = a knot
const PERSIST = 3;                  // consecutive samples (6s) before an incident
const KNOT_REFILE_EVERY = 30;       // a persisting knot re-files at most this often

export interface BbTeamSample {
  n: number;        // living on-foot bodies (humans + bots, gods excluded)
  avgNN: number;    // average nearest-neighbour spacing
  minNN: number;    // tightest pair
  nearBase: number; // bodies within BB_BASE_R of their OWN base
  stuck: number;    // bodies commanding speed but not moving
  blocked: number;  // bodies standing on blocked tiles (statue check)
}

export interface BbSample { t: number; teams: [BbTeamSample, BbTeamSample] }

export interface BbMember {
  name: string; cls: string; x: number; z: number;
  /** commanded ground speed this tick */
  spd: number;
  /** actual displacement over the last sample window */
  disp: number;
  blocked: boolean;
  /** fired (or tried to) within the last 3s — a proxy for "has a target" */
  firing: boolean;
  goal?: { x: number; z: number };
}

export interface BbIncident {
  t: number;
  kind: 'knot' | 'stuck';
  team: number;
  at: { x: number; z: number };
  /** which team's base the incident sits inside (BB_BASE_R), if any */
  nearBaseOf: number | null;
  members: BbMember[];
}

export interface Blackbox {
  nextAt: number;
  samples: BbSample[];
  incidents: BbIncident[];
  /** position at the previous sample, for displacement */
  prev: Map<number, { x: number; z: number }>;
  /** consecutive stuck samples per soldier id */
  stuckRuns: Map<number, number>;
  /** consecutive knotted samples per team */
  knotRuns: [number, number];
  lastKnotFiledAt: [number, number];
}

export function createBlackbox(): Blackbox {
  return {
    nextAt: BB_SAMPLE_EVERY, samples: [], incidents: [],
    prev: new Map(), stuckRuns: new Map(),
    knotRuns: [0, 0], lastKnotFiledAt: [-Infinity, -Infinity],
  };
}

/** The recorder's body filter — mirrors __ww.crowd(): on-foot mortals. */
function bodies(w: World, team: number): Soldier[] {
  const out: Soldier[] = [];
  for (const s of w.soldiers.values()) {
    if (!s.alive || s.team !== team || s.ascendant) continue;
    if (s.kind !== 'human' && s.kind !== 'bot') continue;
    if (s.vehicleId >= 0) continue;
    out.push(s);
  }
  return out;
}

function member(w: World, s: Soldier, disp: number): BbMember {
  const m: BbMember = {
    name: s.name, cls: s.classId,
    x: +s.pos.x.toFixed(1), z: +s.pos.z.toFixed(1),
    spd: +Math.hypot(s.vel.x, s.vel.z).toFixed(1),
    disp: +disp.toFixed(1),
    blocked: isBlocked(w.map.grid, s.pos.x, s.pos.z),
    firing: s.nextFireAt > w.time - 3,
  };
  if (s.botGoal) m.goal = { x: +s.botGoal.x.toFixed(0), z: +s.botGoal.z.toFixed(0) };
  return m;
}

function nearBaseOf(w: World, x: number, z: number): number | null {
  for (const team of [0, 1]) {
    const b = w.map.basePos[team];
    if (Math.hypot(b.x - x, b.z - z) <= BB_BASE_R) return team;
  }
  return null;
}

function file(bb: Blackbox, inc: BbIncident) {
  bb.incidents.push(inc);
  if (bb.incidents.length > BB_MAX_INCIDENTS) bb.incidents.shift();
}

/** Called by World.step (authoritative sims only). Samples on its own clock. */
export function stepBlackbox(w: World) {
  const bb = w.blackbox;
  if (w.time < bb.nextAt) return;
  bb.nextAt += BB_SAMPLE_EVERY;

  const teams: BbTeamSample[] = [];
  const nextPrev = new Map<number, { x: number; z: number }>();

  for (const team of [0, 1] as const) {
    const b = bodies(w, team);
    const base = w.map.basePos[team];
    let sumNN = 0, minNN = Infinity, nearBase = 0, stuck = 0, blocked = 0;
    const knotted: Soldier[] = [];
    const disps = new Map<number, number>();

    for (const s of b) {
      // nearest neighbour
      let nn = Infinity;
      for (const o of b) {
        if (o.id === s.id) continue;
        const d = Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z);
        if (d < nn) nn = d;
      }
      if (nn !== Infinity) { sumNN += nn; if (nn < minNN) minNN = nn; if (nn < KNOT_NN) knotted.push(s); }
      // pooling around the home base — Robert's headline symptom
      if (Math.hypot(base.x - s.pos.x, base.z - s.pos.z) <= BB_BASE_R) nearBase++;
      // stuck: the legs command GO, the world says FROZEN
      const p = bb.prev.get(s.id);
      const disp = p ? Math.hypot(s.pos.x - p.x, s.pos.z - p.z) : Infinity;
      disps.set(s.id, disp === Infinity ? 99 : disp);
      const isStuck = disp < STUCK_DISP && Math.hypot(s.vel.x, s.vel.z) > STUCK_SPD;
      if (isStuck) stuck++;
      if (isBlocked(w.map.grid, s.pos.x, s.pos.z)) blocked++;
      nextPrev.set(s.id, { x: s.pos.x, z: s.pos.z });

      // stuck incident: fires once when a body crosses PERSIST samples
      const run = isStuck ? (bb.stuckRuns.get(s.id) ?? 0) + 1 : 0;
      bb.stuckRuns.set(s.id, run);
      if (run === PERSIST) {
        file(bb, {
          t: +w.time.toFixed(1), kind: 'stuck', team,
          at: { x: +s.pos.x.toFixed(1), z: +s.pos.z.toFixed(1) },
          nearBaseOf: nearBaseOf(w, s.pos.x, s.pos.z),
          members: [member(w, s, disps.get(s.id) ?? 0)],
        });
      }
    }

    // knot incident: KNOT_MIN+ bodies under KNOT_NN spacing, persisting
    if (knotted.length >= KNOT_MIN) {
      bb.knotRuns[team]++;
      if (bb.knotRuns[team] >= PERSIST && w.time - bb.lastKnotFiledAt[team] >= KNOT_REFILE_EVERY) {
        bb.lastKnotFiledAt[team] = w.time;
        const cx = knotted.reduce((a, s) => a + s.pos.x, 0) / knotted.length;
        const cz = knotted.reduce((a, s) => a + s.pos.z, 0) / knotted.length;
        file(bb, {
          t: +w.time.toFixed(1), kind: 'knot', team,
          at: { x: +cx.toFixed(1), z: +cz.toFixed(1) },
          nearBaseOf: nearBaseOf(w, cx, cz),
          members: knotted.map((s) => member(w, s, disps.get(s.id) ?? 0)),
        });
      }
    } else {
      bb.knotRuns[team] = 0;
    }

    teams.push({
      n: b.length,
      avgNN: b.length > 1 ? +(sumNN / b.length).toFixed(1) : 0,
      minNN: minNN === Infinity ? 0 : +minNN.toFixed(1),
      nearBase, stuck, blocked,
    });
  }

  bb.prev = nextPrev;
  bb.samples.push({ t: +w.time.toFixed(1), teams: teams as [BbTeamSample, BbTeamSample] });
  if (bb.samples.length > BB_MAX_SAMPLES) bb.samples.shift();
}

/** Compact human summary — what __ww.blackbox('report') prints. */
export function blackboxReport(bb: Blackbox): string {
  const lines: string[] = [];
  const tail = bb.samples.slice(-10);
  lines.push('t     | T0 n/avg/min nearBase stuck blk | T1 n/avg/min nearBase stuck blk');
  for (const s of tail) {
    const f = (t: BbTeamSample) =>
      `${String(t.n).padStart(2)}/${String(t.avgNN).padStart(5)}/${String(t.minNN).padStart(4)}  nb=${String(t.nearBase).padStart(2)} st=${t.stuck} bl=${t.blocked}`;
    lines.push(`${String(s.t).padStart(5)} | ${f(s.teams[0])} | ${f(s.teams[1])}`);
  }
  if (!bb.incidents.length) {
    lines.push('incidents: none');
  } else {
    lines.push(`incidents (${bb.incidents.length}):`);
    for (const i of bb.incidents.slice(-12)) {
      const where = i.nearBaseOf === null ? 'open field' : `NEAR TEAM ${i.nearBaseOf} BASE`;
      lines.push(`  t=${i.t}s ${i.kind.toUpperCase()} team ${i.team} at (${i.at.x},${i.at.z}) [${where}] — ${i.members.map((m) => `${m.name}(${m.cls} spd=${m.spd} disp=${m.disp}${m.blocked ? ' BLOCKED' : ''}${m.firing ? ' firing' : ''})`).join(', ')}`);
    }
  }
  return lines.join('\n');
}
