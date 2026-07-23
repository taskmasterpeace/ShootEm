// ═══════════════════════════════════════════════════════════════════════════
// SPORTS — the games inside the war.
//
// Robert: *"we wanna have an actual driving game as a SPORT within the game,
// because clearly this game is gonna have different sports. That's gonna be a
// big part of this game — different sports that you get updated on, that you
// can participate in. Games inside the game."*
//
// The distinction that matters, and it is his:
//
//     A SPORT makes you better at the war.      (it trains a real skill)
//     A CARTRIDGE does not.                     (see cartridges.ts)
//
// Racing is the first sport and the one with the most already built: nine
// track pieces, a builder, lap records per class, ghosts, droppables, and a
// drivetrain with weight and traction. This file is the LEAGUE around it —
// the disciplines, the fixture list, the standings and the season — so the
// circuit stops being a game mode and becomes an institution the world talks
// about.
//
// Pure: no DOM. The laptop renders it; records.ts owns the times.
// ═══════════════════════════════════════════════════════════════════════════
import type { ModeId, SkillId } from '../../sim/types';
import { allRecords, type RaceClass, type TrackRecord } from '../records';

export type SportId = 'circuit' | 'demolition' | 'gunrun' | 'timeattack' | 'freestyle';

export interface Sport {
  id: SportId;
  name: string;
  /** the one line that says what it is */
  strap: string;
  /** the rules, in the league's own voice */
  rules: string[];
  /** what mode it launches */
  mode: ModeId;
  /** what competing in it actually trains — a sport is not idle time */
  trains: SkillId[];
  /** the class of machine it is run for */
  classes: RaceClass[];
  /** false until it is built — the fixture list says so rather than lying */
  live: boolean;
}

/**
 * THE DISCIPLINES.
 *
 * Circuit and Time Attack run today. Demolition, the Gun Run and Freestyle are
 * the shapes the existing parts already imply — droppables, hull damage
 * systems, and the board's trick economy — and the board says PLANNED rather
 * than pretending.
 */
export const SPORTS: Sport[] = [
  {
    id: 'circuit', name: 'CIRCUIT RACING',
    strap: 'Wheel to wheel, laps banked, the board keeps every time.',
    rules: [
      'Full grid. First across the line after the last lap.',
      'Contact is legal. Damage is not repaired mid-race.',
      'Droppables permitted — mines and oil off the back.',
      'Every lap is filed to the board whether you finish or not.',
    ],
    mode: 'race',
    trains: ['tank_driver', 'mechanic'],
    classes: ['bike', 'car', 'truck', 'board'],
    live: true,
  },
  {
    id: 'timeattack', name: 'TIME ATTACK',
    strap: 'You, the clock, and your own ghost.',
    rules: [
      'One machine on the circuit. No contact, no excuses.',
      'Your best lap runs beside you as a ghost.',
      'A new best is filed the moment it happens.',
    ],
    mode: 'timetrial',
    trains: ['tank_driver'],
    classes: ['bike', 'car', 'truck', 'board'],
    live: true,
  },
  {
    id: 'demolition', name: 'DEMOLITION',
    strap: 'Last machine still running takes it.',
    rules: [
      'No laps. No line. An arena and a field of hulls.',
      'Systems damage decides it — an engine hit means you limp.',
      'The last hull with a live engine wins.',
    ],
    mode: 'derby',
    trains: ['mechanic'],
    classes: ['car', 'truck'],
    live: true,
  },
  {
    id: 'gunrun', name: 'THE GUN RUN',
    strap: 'Guns bolted to the nose. Race it anyway.',
    rules: [
      'Fixed forward armament — what is on the car is what you have.',
      'Droppables off the back stay legal.',
      'Laps still count. Being fastest and being alive are different problems.',
    ],
    mode: 'race',
    trains: ['tank_driver', 'tank_gunner'],
    classes: ['car', 'truck'],
    live: false,
  },
  {
    id: 'freestyle', name: 'FREESTYLE',
    strap: 'The board park. Land it or lose it.',
    rules: [
      'No finish line. A run is scored on what you land.',
      'Combo banks on a clean landing and is gone on a bail.',
      'Best single run of the session takes it.',
    ],
    mode: 'race',
    trains: ['navigator'],
    classes: ['board'],
    live: false,
  },
];

export const sportById = (id: SportId): Sport | undefined => SPORTS.find((s) => s.id === id);
export const liveSports = (): Sport[] => SPORTS.filter((s) => s.live);

// ── THE SEASON ─────────────────────────────────────────────────────────────

export interface Fixture {
  sport: SportId;
  /** which circuit — a built track id, or a named venue for the rest */
  venue: string;
  /** game-days from now; 0 = today */
  inDays: number;
  cls: RaceClass;
}

/**
 * The fixture list. Deterministic from the game day, so every client agrees
 * about what is on this week without a server — the same trick the one clock
 * uses (src/client/worldclock.ts).
 */
export function fixtures(day: number, tracks: string[]): Fixture[] {
  const venues = tracks.length ? tracks : ['THE OVAL'];
  const live = liveSports();
  const out: Fixture[] = [];
  for (let i = 0; i < 5; i++) {
    const s = live[(day + i) % live.length];
    const cls = s.classes[(day + i * 3) % s.classes.length];
    out.push({ sport: s.id, venue: venues[(day + i) % venues.length], inDays: i, cls });
  }
  return out;
}

// ── THE STANDINGS ──────────────────────────────────────────────────────────

export interface Standing {
  holder: string;
  /** boards held — the only currency a league needs */
  records: number;
  /** their best single lap anywhere */
  best: number;
  bestTrack: string;
}

/** Who holds what, read straight off the record board. */
export function standings(records: TrackRecord[] = allRecords()): Standing[] {
  const by = new Map<string, Standing>();
  for (const r of records) {
    if (r.lap <= 0) continue;
    const cur = by.get(r.holder) ?? { holder: r.holder, records: 0, best: Infinity, bestTrack: '' };
    cur.records++;
    if (r.lap < cur.best) { cur.best = r.lap; cur.bestTrack = r.trackId; }
    by.set(r.holder, cur);
  }
  return [...by.values()].sort((a, b) => b.records - a.records || a.best - b.best);
}

/** One line for the GONET desk: what the league is doing right now. */
export function leagueLine(day: number, tracks: string[]): string {
  const f = fixtures(day, tracks)[0];
  const s = sportById(f.sport)!;
  return `${s.name} at ${f.venue} — ${f.cls.toUpperCase()} class`;
}
