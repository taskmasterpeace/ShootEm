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
import type { ModeId, ModeState, SkillId } from '../../sim/types';
import { allRecords, type RaceClass, type TrackRecord } from '../records';
import { gameNow } from '../worldclock';

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
  /** which DISCIPLINE of that mode. Circuit, the Gun Run and Freestyle all
   *  launch `race`; this is what tells them apart once the world is built. */
  raceKind?: ModeState['raceKind'];
  /** what competing in it actually trains — a sport is not idle time */
  trains: SkillId[];
  /** the class of machine it is run for */
  classes: RaceClass[];
  /** false until it is built — the fixture list says so rather than lying */
  live: boolean;
}

/**
 * THE DISCIPLINES — all five run.
 *
 * Circuit and Time Attack were first. Demolition, THE GUN RUN and FREESTYLE
 * were each the shape the existing parts already implied, and each is now
 * wired to the part that implied it: the derby to hull-damage systems, the Gun
 * Run to a fixed forward weapon on the nose, and Freestyle to the board's own
 * trick economy. Circuit, the Gun Run and Freestyle all launch the `race` mode
 * and are told apart by `raceKind`.
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
    mode: 'race', raceKind: 'circuit',
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
    mode: 'timetrial', raceKind: 'trial',
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
    mode: 'race', raceKind: 'gunrun',
    trains: ['tank_driver', 'tank_gunner'],
    classes: ['car', 'truck'],
    live: true,
  },
  {
    id: 'freestyle', name: 'FREESTYLE',
    strap: 'The board park. Land it or lose it.',
    rules: [
      'No finish line. A run is scored on what you land.',
      'Combo banks on a clean landing and is gone on a bail.',
      'Best single run of the session takes it.',
    ],
    mode: 'race', raceKind: 'freestyle',
    trains: ['navigator'],
    classes: ['board'],
    live: true,
  },
];

export const sportById = (id: SportId): Sport | undefined => SPORTS.find((s) => s.id === id);
export const liveSports = (): Sport[] => SPORTS.filter((s) => s.live);

// ── THE SEASON HAS A SHAPE ─────────────────────────────────────────────────
//
// The fixture list rolled forward forever: five races from today, cycling
// sports and venues by day index, with no beginning, no end and nothing to
// win. A league you cannot WIN is a queue — you turn up, you drive, the list
// advances, and the fastest man alive is exactly as decorated as the slowest.
//
// A season is DERIVED from the game-day, the same trick the one clock uses, so
// every client agrees about which round it is without a server and without a
// store. It closes on a fixed day; on that day somebody has led it.

/** how many game-days a season runs. 28 ≈ two and a half real days at 2h/day. */
export const SEASON_DAYS = 28;

export interface Season {
  /** 1-based season number since the war began */
  number: number;
  /** 1-based round inside it */
  round: number;
  /** rounds in a season */
  rounds: number;
  /** rounds still to run, 0 on the closing day */
  left: number;
  /** the game-day this season opened on */
  openedOn: number;
  /** …and the day it closes */
  closesOn: number;
  /** true on the last day — the title is decided tonight */
  finalRound: boolean;
}

/** Which season and round a game-day falls in. Pure; no store, no clock read. */
export function seasonOf(day: number): Season {
  const idx = Math.floor(day / SEASON_DAYS);
  const round = (day % SEASON_DAYS) + 1;
  return {
    number: idx + 1,
    round,
    rounds: SEASON_DAYS,
    left: SEASON_DAYS - round,
    openedOn: idx * SEASON_DAYS,
    closesOn: (idx + 1) * SEASON_DAYS - 1,
    finalRound: round === SEASON_DAYS,
  };
}

/**
 * The game-day a record was filed on.
 *
 * MUST go through the same clock the rest of the app reads. A record carries a
 * wall-clock stamp, but `gameNow()` applies the TIME CONTROL (offset, rate,
 * freeze) — so dividing the raw stamp by a day length gives a different number
 * from the one the sports desk is using, and the title race silently excludes
 * every record ever filed. Caught live: the season header read "nobody has
 * filed a time yet" with two fresh records sitting on the board.
 */
export const dayOfRecord = (at: number): number => gameNow(at).day;

/**
 * THE TITLE RACE — the standings for THIS season only.
 *
 * The all-time standings answer "who is the greatest"; this answers "who is
 * winning right now", which is the question a season exists to ask. Only marks
 * filed inside the season window count, so a champion has to turn up again.
 */
export function titleRace(day: number, records: TrackRecord[] = allRecords()): Standing[] {
  const s = seasonOf(day);
  return standings(records.filter((r) => {
    const d = dayOfRecord(r.at);
    return d >= s.openedOn && d <= s.closesOn;
  }));
}

/** One line the desk reads out about where the season stands. */
export function seasonLine(day: number, records: TrackRecord[] = allRecords()): string {
  const s = seasonOf(day);
  const lead = titleRace(day, records)[0];
  const where = s.finalRound ? 'FINAL ROUND — the title is decided tonight.'
    : s.left <= 3 ? `${s.left} round${s.left === 1 ? '' : 's'} left.`
      : `${s.left} rounds still to run.`;
  return lead
    ? `SEASON ${s.number} · ROUND ${s.round} OF ${s.rounds} — ${lead.holder} leads on ${lead.records} board${lead.records === 1 ? '' : 's'}. ${where}`
    : `SEASON ${s.number} · ROUND ${s.round} OF ${s.rounds} — nobody has filed a time yet. ${where}`;
}

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

// ── THE RECORD BOOK ─────────────────────────────────────────────────────────
//
// The standings above answer "who is the champion" — most records held, best
// single lap anywhere. But three cycles of work went into making circuits real
// PLACES: they vary, they describe themselves, they have names. A named season
// wants the other view — the RECORD BOOK, a page per circuit, so you can ask
// "who holds DEADMAN FLYER, and in what?" and the board has an answer.
//
// The venue's proper name is recovered from its id (records key off `venueId`
// now): "deadman-flyer" → "DEADMAN FLYER". Lossless, because a circuit name is
// all-caps words and its id is the same words lowercased and hyphenated — the
// bare theme fallback ("savanna-circuit") reads back cleanly too.

export interface VenueRecord {
  /** the circuit's proper name, for the page header */
  venue: string;
  /** the board key it files under */
  venueId: string;
  /** the fastest LAP anyone has set here, and who holds it */
  bestLap: number;
  holder: string;
  hull: string;
  cls: RaceClass;
  /** how many classes have a filed record at this venue */
  classesRun: number;
  /** the story of the record: who it was taken from, and how long that stood */
  takenFrom?: string;
  /** the mark that was beaten, seconds */
  beat?: number;
  /** days the beaten mark had stood (0 = it fell the same day) */
  stoodDays?: number;
}

/** A circuit id back into the name the desk shows. */
export function venueNameOf(venueId: string): string {
  return venueId.replace(/-/g, ' ').toUpperCase();
}

/**
 * THE RECORD BOOK — one row per circuit, best lap and who holds it.
 *
 * Reads straight off the same board the standings do, so a lap filed anywhere
 * shows up here the instant it lands. Sorted with the busiest circuits first —
 * a venue people actually race is a venue with a story.
 */
export function venueBoard(records: TrackRecord[] = allRecords()): VenueRecord[] {
  const by = new Map<string, VenueRecord>();
  for (const r of records) {
    if (r.lap <= 0) continue;
    const cur = by.get(r.trackId) ?? {
      venue: venueNameOf(r.trackId), venueId: r.trackId,
      bestLap: Infinity, holder: '', hull: '', cls: r.cls, classesRun: 0,
    };
    cur.classesRun++;
    if (r.lap < cur.bestLap) {
      cur.bestLap = r.lap; cur.holder = r.holder; cur.hull = r.hull; cur.cls = r.cls;
      cur.takenFrom = r.prevHolder;
      cur.beat = r.prevLap;
      cur.stoodDays = r.prevHolder && r.prevSetAt
        ? Math.max(0, Math.floor((r.at - r.prevSetAt) / 86_400_000))
        : undefined;
    }
    by.set(r.trackId, cur);
  }
  return [...by.values()].sort((a, b) => b.classesRun - a.classesRun || a.bestLap - b.bestLap);
}

/**
 * THE STORY OF A RECORD, in the board's own voice. Null when a mark has no
 * history yet — the first time anyone sets a circuit, there is nobody to have
 * taken it from, and inventing a rival would be a lie.
 */
export function recordStory(v: VenueRecord): string | null {
  if (!v.takenFrom) return null;
  const margin = v.beat && v.beat > v.bestLap ? ` by ${(v.beat - v.bestLap).toFixed(1)}s` : '';
  if (v.stoodDays === undefined) return `Taken from ${v.takenFrom}${margin}.`;
  if (v.stoodDays <= 0) return `Taken from ${v.takenFrom}${margin} — it stood less than a day.`;
  return `Taken from ${v.takenFrom}${margin} — a mark that had stood ${v.stoodDays} day${v.stoodDays === 1 ? '' : 's'}.`;
}

/** One line for the GONET desk: what the league is doing right now. */
export function leagueLine(day: number, tracks: string[]): string {
  const f = fixtures(day, tracks)[0];
  const s = sportById(f.sport)!;
  return `${s.name} at ${f.venue} — ${f.cls.toUpperCase()} class`;
}
