// ---------------------------------------------------------------------------
// RACING TIES INTO THE NEWS (Robert: "improve racing… also tie it into the
// news"). A finished race is a press event: it files an issue, the paper runs
// a sports headline, and the GONET broadcast cuts a sports reel — the circuit
// lives in the same paper the war does.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { raceHeadline, type PressIssue, type RacePressData } from '../src/client/newspaper';
import { buildSchedule } from '../src/client/gonet/broadcast';

// in-memory localStorage so buildSchedule can read filed press
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const raceIssue = (race: Partial<RacePressData>): PressIssue => ({
  at: 1_700_000_000_000, season: 0, won: !!race.recordTaken, modeName: 'CIRCUIT RACING',
  aceName: race.winner ?? 'Doc', aceKills: 0, longestShot: 0,
  myCost: 0, theirCost: 0, underdog: false, myKills: 0, theirKills: 0, medals: [],
  race: {
    discipline: 'CIRCUIT RACING', venue: 'savanna-circuit', cls: 'CAR',
    winner: 'Doc', lap: 22.8, field: 8, recordTaken: false, ...race,
  },
});

describe('the sports page', () => {
  it('runs a win as a race headline, not a battle one', () => {
    const h = raceHeadline(raceIssue({ winner: 'Bolt', recordTaken: false }));
    expect(h).toMatch(/BOLT/);
    expect(h).toMatch(/CAR/);
    expect(h).not.toMatch(/LINE|FRONT|BATTLE/); // not a war headline
  });

  it('a broken record reads as a record, and differs from a plain win', () => {
    const win = raceHeadline(raceIssue({ winner: 'Bolt', recordTaken: false }));
    const rec = raceHeadline(raceIssue({ winner: 'Bolt', recordTaken: true, previousHolder: 'Doc' }));
    expect(rec).toMatch(/RECORD|SHATTER|REWRITE|BOOK/i);
    expect(rec).not.toBe(win);
    // across its variants, at least one names who lost it (2 of 3 do)
    const anyNamesLoser = [1_700_000_001_000, 1_700_000_002_000, 1_700_000_003_000]
      .map((at) => raceHeadline({ ...raceIssue({ winner: 'Bolt', recordTaken: true, previousHolder: 'Doc' }), at }))
      .some((h) => /DOC/.test(h));
    expect(anyNamesLoser).toBe(true);
  });

  it('the first-ever mark reads as a first, not a theft', () => {
    const first = raceHeadline(raceIssue({ winner: 'Bolt', recordTaken: true, previousHolder: undefined }));
    expect(first).toMatch(/FIRST|SETS|STAMP/i);
  });
});

describe('the broadcast sports desk', () => {
  it('cuts a SPORTS reel from a race issue, not a war reel', () => {
    store.clear();
    localStorage.setItem('ww_press', JSON.stringify([raceIssue({ winner: 'Bolt', recordTaken: true, previousHolder: 'Doc' })]));
    const reels = buildSchedule(null, 1_700_000_100_000);
    const race = reels.find((r) => r.title.includes('Bolt'));
    expect(race, 'no race reel cut').toBeTruthy();
    const slugs = race!.shots.map((s) => s.slug);
    expect(slugs).toContain('SPORTS DESK');
    expect(slugs).toContain('THE BOARD'); // the record shot
    // the winning time is on screen
    expect(race!.shots.some((s) => s.figure === '22.8s')).toBe(true);
  });

  it('an ordinary win has no record shot', () => {
    store.clear();
    localStorage.setItem('ww_press', JSON.stringify([raceIssue({ winner: 'Doc', recordTaken: false })]));
    const reels = buildSchedule(null, 1_700_000_100_000);
    const race = reels.find((r) => r.title.includes('Doc'));
    expect(race).toBeTruthy();
    expect(race!.shots.some((s) => s.slug === 'THE BOARD')).toBe(false);
  });
});
