// ───────────────────────────────────────────────────────────────────────────
// THE SEASON HAS A SHAPE.
//
// The fixture list rolled forward forever: five races from today, cycling
// sports and venues by day index, with no beginning, no end and NOTHING TO WIN.
// A league you cannot win is a queue — you turn up, you drive, the list
// advances, and the fastest man alive is exactly as decorated as the slowest.
//
// A season is DERIVED from the game-day, the same trick the one clock uses, so
// every client agrees which round it is without a server and without a store.
//
// THE BUG THIS SUITE EXISTS FOR, caught live: a record's game-day must be read
// through the SAME clock the desk reads. `gameNow()` applies the time control
// (offset, rate, freeze); dividing a raw wall-clock stamp by a day length gives
// a different number, and the title race then silently excludes every record
// ever filed. The season header read "nobody has filed a time yet" with two
// fresh records sitting on the board.
// ───────────────────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SEASON_DAYS, dayOfRecord, seasonLine, seasonOf, titleRace,
} from '../src/client/gonet/sports';
import type { TrackRecord } from '../src/client/records';

/** the clock reads localStorage for its time control */
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
});

describe('a season has a beginning and an end', () => {
  it('opens on round 1 and closes on the last', () => {
    const open = seasonOf(0);
    expect(open.number).toBe(1);
    expect(open.round).toBe(1);
    expect(open.finalRound).toBe(false);

    const close = seasonOf(SEASON_DAYS - 1);
    expect(close.number).toBe(1);
    expect(close.round).toBe(SEASON_DAYS);
    expect(close.left).toBe(0);
    expect(close.finalRound, 'the title is decided tonight').toBe(true);
  });

  it('the next day is a new season, round one', () => {
    const next = seasonOf(SEASON_DAYS);
    expect(next.number).toBe(2);
    expect(next.round).toBe(1);
    expect(next.finalRound).toBe(false);
  });

  it('the window never overlaps and never leaves a gap', () => {
    for (let n = 0; n < 5; n++) {
      const a = seasonOf(n * SEASON_DAYS);
      const b = seasonOf((n + 1) * SEASON_DAYS);
      expect(a.closesOn + 1).toBe(b.openedOn);
      expect(a.closesOn - a.openedOn).toBe(SEASON_DAYS - 1);
    }
  });

  it('rounds run 1..N and left counts down to zero', () => {
    for (let d = 0; d < SEASON_DAYS; d++) {
      const s = seasonOf(d);
      expect(s.round).toBe(d + 1);
      expect(s.round + s.left).toBe(SEASON_DAYS);
    }
  });

  it('every day of a season belongs to that season\'s window', () => {
    for (let d = 0; d < SEASON_DAYS * 3; d++) {
      const s = seasonOf(d);
      expect(d).toBeGreaterThanOrEqual(s.openedOn);
      expect(d).toBeLessThanOrEqual(s.closesOn);
    }
  });
});

describe('the title race is THIS season only', () => {
  const DAY_MS = 7_200_000;
  // A record carries a WALL-CLOCK stamp and `dayOfRecord` maps it through the
  // world clock, which has an epoch — so a fixture cannot just multiply a day
  // number by a day length. Build every stamp relative to one whose day the
  // function itself reports. (Getting this wrong is the same class of mistake
  // as the bug this file exists to guard.)
  const BASE = Date.now();
  const BASE_DAY = dayOfRecord(BASE);
  /** a wall-clock stamp that `dayOfRecord` will report as game-day `d` */
  const stampFor = (d: number) => BASE + (d - BASE_DAY) * DAY_MS;
  const rec = (holder: string, day: number, lap: number, track: string): TrackRecord => ({
    trackId: track, cls: 'board', lap, race: 0, holder, hull: 'comet', at: stampFor(day),
  });

  it('a champion has to turn up again — last season does not count', () => {
    // ANCHOR TO A SEASON, not to "today": today can be any round, so a fixture
    // built around it straddles the boundary and the test lies about which
    // season a record fell in. Open this season, run Doc in it, and put Reyes a
    // whole season later.
    const open = seasonOf(BASE_DAY).openedOn;
    const recs = [
      rec('Doc', open, 18, 'a'), rec('Doc', open + 1, 19, 'b'),
      rec('Reyes', open + SEASON_DAYS, 17, 'd'), rec('Reyes', open + SEASON_DAYS + 1, 21, 'e'),
    ];
    const s1 = titleRace(open + 1, recs);
    expect(s1.length).toBe(1);
    expect(s1[0].holder).toBe('Doc');
    expect(s1[0].records).toBe(2);

    const s2 = titleRace(open + SEASON_DAYS + 1, recs);
    expect(s2.length, 'an old season leaked into the new one').toBe(1);
    expect(s2[0].holder).toBe('Reyes');
  });

  it('a season nobody has raced has no leader, and says so', () => {
    expect(titleRace(SEASON_DAYS * 4, [])).toEqual([]);
    expect(seasonLine(SEASON_DAYS * 4, [])).toMatch(/nobody has filed/i);
  });

  it('the line names the leader and the round', () => {
    const open = seasonOf(BASE_DAY).openedOn;
    const recs = [rec('Doc', open, 18, 'a'), rec('Doc', open + 1, 19, 'b')];
    const s = seasonOf(open + 1);
    const line = seasonLine(open + 1, recs);
    expect(line).toContain(`SEASON ${s.number}`);
    expect(line).toContain(`ROUND ${s.round}`);
    expect(line).toContain('Doc');
  });

  it('the closing day says the title is decided tonight', () => {
    expect(seasonLine(SEASON_DAYS - 1, [])).toMatch(/FINAL ROUND/);
  });
});

describe('the record\'s day and the desk\'s day are ONE clock', () => {
  it('a record filed now belongs to the season the desk is showing', () => {
    // this is the bug: `Math.floor(at / GAME_DAY_MS)` and `gameNow().day` differ
    // the moment the time control is anything but neutral, and the title race
    // then excludes every record ever filed
    const now = Date.now();
    const recDay = dayOfRecord(now);
    const s = seasonOf(recDay);
    expect(recDay).toBeGreaterThanOrEqual(s.openedOn);
    expect(recDay).toBeLessThanOrEqual(s.closesOn);
  });

  it('a record filed today shows up in today\'s title race', () => {
    const now = Date.now();
    const today = dayOfRecord(now);
    const recs: TrackRecord[] = [{
      trackId: 'deadman-flyer', cls: 'board', lap: 18.9, race: 0,
      holder: 'Doc', hull: 'comet', at: now,
    }];
    const race = titleRace(today, recs);
    expect(race.length, 'a fresh record fell outside its own season').toBe(1);
    expect(race[0].holder).toBe('Doc');
  });
});
