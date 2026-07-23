// ───────────────────────────────────────────────────────────────────────────
// MOVIES · SHOWS · NEWS — the three shelves under Video.
//
// Robert: *"we need Movies, Shows, News under video — but use what we already
// have; we don't have news yet tho."*
//
// The rule this suite defends is that a genre is a PROMISE, not a folder:
//
//   NEWS    perishable — it carries a dateline, because it expires
//   SHOWS   returning  — a strand with an episode number that comes back
//   MOVIES  singular   — one long thing about one big thing you did
//
// And the older law underneath all three, from broadcast.ts: there is no video
// file in this game. Every frame of all three shelves is generated from what
// the game already knows — filed press, board times, the licence register, the
// league fixtures — so the television can never show a war that never happened.
// ───────────────────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHANNELS, GENRES, buildSchedule, channelsIn, reelSeconds, reelsIn, reelsOn, shotAt,
  type Reel, type VideoGenre,
} from '../src/client/gonet/broadcast';

/** the modules under test read localStorage for press/records/licences */
let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
});

const AT = 1_700_000_000_000;
const schedule = (): Reel[] => buildSchedule(null, AT);

/** a filed battle, the shape the newspaper writes */
function pressIssue(over: Record<string, unknown> = {}) {
  return {
    at: AT - 3_600_000, modeName: 'TDM', frontName: 'The Port', won: true,
    myKills: 14, theirKills: 6, aceName: 'Doc', aceKills: 9, longestShot: 87,
    myCost: 1000, theirCost: 4200, underdog: true, medals: ['THE IRON STAR'],
    ...over,
  };
}

describe('the three shelves exist and are distinct', () => {
  it('there are exactly three, named as asked', () => {
    expect(GENRES.map((g) => g.id)).toEqual(['news', 'shows', 'movies']);
    expect(GENRES.map((g) => g.name)).toEqual(['NEWS', 'SHOWS', 'MOVIES']);
  });

  it('every strand lives on exactly one shelf, and no shelf is empty', () => {
    for (const g of GENRES) {
      expect(channelsIn(g.id).length, `${g.name} has no strands`).toBeGreaterThan(0);
    }
    // every channel is reachable from its own genre — no orphan strands
    for (const c of CHANNELS) {
      expect(channelsIn(c.genre).map((x) => x.id)).toContain(c.id);
    }
  });

  it('every reel the schedule builds is playable and lands on a real shelf', () => {
    store.ww_press = JSON.stringify([pressIssue()]);
    const reels = schedule();
    expect(reels.length).toBeGreaterThan(0);
    const ids = GENRES.map((g) => g.id);
    for (const r of reels) {
      expect(ids, `${r.title} is on no shelf`).toContain(r.genre);
      expect(r.shots.length, `${r.title} has no shots`).toBeGreaterThan(0);
      expect(reelSeconds(r), `${r.title} has no runtime`).toBeGreaterThan(0);
      for (const s of r.shots) {
        expect(s.hold, `${r.title} has a zero-length shot`).toBeGreaterThan(0);
        expect(s.headline.length, `${r.title} has a blank headline`).toBeGreaterThan(0);
      }
    }
  });

  it('a reel appears on its genre shelf AND its own strand', () => {
    store.ww_press = JSON.stringify([pressIssue()]);
    const reels = schedule();
    for (const r of reels) {
      expect(reelsIn(reels, r.genre)).toContain(r);
      expect(reelsOn(reels, r.channel)).toContain(r);
    }
  });

  it('all three shelves have something on them even with a blank save', () => {
    const reels = schedule();          // nothing filed, nothing raced, nothing held
    for (const g of GENRES) {
      expect(reelsIn(reels, g.id).length, `${g.name} is empty on a fresh profile`).toBeGreaterThan(0);
    }
  });
});

describe('each shelf keeps its own promise', () => {
  it('NEWS is perishable — it carries a dateline that ages', () => {
    store.ww_press = JSON.stringify([pressIssue({ at: AT - 3_600_000 })]);
    const fresh = reelsIn(schedule(), 'news').find((r) => r.channel === 'war');
    expect(fresh?.dateline).toMatch(/AGO/);

    store.ww_press = JSON.stringify([pressIssue({ at: AT - 3 * 86_400_000 })]);
    const stale = reelsIn(buildSchedule(null, AT), 'news').find((r) => r.channel === 'war');
    expect(stale?.dateline).not.toBe(fresh?.dateline);   // the same story ages
  });

  it('SHOWS return — the strand carries an episode number', () => {
    const circuit = reelsIn(schedule(), 'shows').find((r) => r.channel === 'circuit');
    expect(circuit, 'THE CIRCUIT is not on the shelf').toBeDefined();
    expect(circuit!.episode, 'a strand without an episode is not a strand')
      .toBeGreaterThanOrEqual(0);
    expect(circuit!.dateline).toMatch(/EPISODE/);
  });

  it('SHOWS keep returning on their own clock, whether or not you played', () => {
    const a = reelsIn(buildSchedule(null, AT), 'shows').find((r) => r.channel === 'circuit');
    const later = AT + 7_200_000 * 5;             // five game-days on
    const b = reelsIn(buildSchedule(null, later), 'shows').find((r) => r.channel === 'circuit');
    expect(b!.episode).not.toBe(a!.episode);
  });

  it('MOVIES are singular — one feature, not a pile', () => {
    store.ww_press = JSON.stringify([pressIssue(), pressIssue({ at: AT - 7_200_000, myKills: 2 })]);
    const movies = reelsIn(schedule(), 'movies');
    expect(movies.length, 'a shelf of features is a schedule, not a cinema').toBe(1);
  });

  it('MOVIES pick your BEST action, not your latest', () => {
    const dull = pressIssue({ at: AT - 60_000, frontName: 'Nowhere', myKills: 1, longestShot: 0, underdog: false, medals: [] });
    const great = pressIssue({ at: AT - 86_400_000, frontName: 'The Ridge', myKills: 30, longestShot: 210, underdog: true, medals: ['THE IRON STAR'] });
    store.ww_press = JSON.stringify([dull, great]);   // newest first, as filed
    const feature = reelsIn(schedule(), 'movies')[0];
    expect(feature.title, 'the cinema does not screen your dullest hour').toContain('RIDGE');
  });

  it('MOVIES say so honestly when you have not earned one', () => {
    const feature = reelsIn(schedule(), 'movies')[0];
    expect(feature.title).toBe('NOTHING SHOOTING');
    expect(reelSeconds(feature)).toBeGreaterThan(0);   // and it is still playable
  });

  it('a feature is LONGER than a bulletin — that is what makes it a feature', () => {
    store.ww_press = JSON.stringify([pressIssue()]);
    const reels = schedule();
    const movie = reelsIn(reels, 'movies')[0];
    const news = reelsIn(reels, 'news').filter((r) => r.channel === 'war');
    expect(news.length).toBeGreaterThan(0);
    const longestBulletin = Math.max(...news.map(reelSeconds));
    expect(reelSeconds(movie)).toBeGreaterThan(longestBulletin);
  });

  it('a feature is cut in ACTS — it has a shape, not just a list', () => {
    store.ww_press = JSON.stringify([pressIssue()]);
    const slugs = reelsIn(schedule(), 'movies')[0].shots.map((s) => s.slug ?? '');
    expect(slugs).toContain('GONET PICTURES');
    expect(slugs.some((s) => s.startsWith('ACT'))).toBe(true);
    expect(slugs[slugs.length - 1]).toBe('END TITLES');
  });
});

describe('the transport still works on every shelf', () => {
  it('the playhead walks the whole reel and never falls off the end', () => {
    store.ww_press = JSON.stringify([pressIssue()]);
    for (const r of schedule()) {
      const total = reelSeconds(r);
      for (const t of [0, total * 0.5, total - 0.01, total, total + 99]) {
        const { index } = shotAt(r, t);
        expect(index, `${r.title} @${t}`).toBeGreaterThanOrEqual(0);
        expect(index, `${r.title} @${t}`).toBeLessThan(r.shots.length);
      }
    }
  });

  it('the same save builds the same schedule — the desk is not random', () => {
    store.ww_press = JSON.stringify([pressIssue()]);
    const a = schedule().map((r) => `${r.genre}/${r.channel}/${r.title}/${reelSeconds(r)}`);
    const b = schedule().map((r) => `${r.genre}/${r.channel}/${r.title}/${reelSeconds(r)}`);
    expect(b).toEqual(a);
  });
});
