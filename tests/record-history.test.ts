// ───────────────────────────────────────────────────────────────────────────
// THE RECORD REMEMBERS WHO IT BEAT.
//
// `fileRun` always KNEW the mark it was replacing — it returns `previous` — but
// it overwrote the row, so the instant a record fell the old holder was gone
// forever. The board could say who holds DEADMAN FLYER and nothing about how it
// got there. A board with no history is a high-score list; a board that can say
// "taken from Reyes, a mark that had stood nine days" is a sport.
//
// The trap this suite exists for: BEATING YOUR OWN RECORD IS NOT TAKING ONE.
// The naive version writes `prevHolder = previous.holder` on every fall, so a
// player improving his own time gets "taken from Doc" — by Doc. That reads like
// a bug because it is one.
// ───────────────────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it } from 'vitest';
import { recordStory, venueBoard } from '../src/client/gonet/sports';
import type { TrackRecord } from '../src/client/records';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

/** records.ts talks to localStorage; give it one that lives for this test */
let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
});

/** the one row on the board, whatever it currently says */
async function row() {
  const { loadRecords } = await import('../src/client/records');
  return Object.values(loadRecords())[0];
}

describe('a record keeps the mark it beat', () => {
  it('the first mark on a circuit has nobody to have taken it from', async () => {
    const { fileRun } = await import('../src/client/records');
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Reyes', lap: 21.4, at: NOW });
    const r = await row();
    expect(r.holder).toBe('Reyes');
    expect(r.prevHolder, 'invented a rival out of nothing').toBeUndefined();
  });

  it('taking a record records who lost it, and what they had', async () => {
    const { fileRun } = await import('../src/client/records');
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Reyes', lap: 21.4, at: NOW - 9 * DAY });
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Doc', lap: 18.9, at: NOW });
    const r = await row();
    expect(r.holder).toBe('Doc');
    expect(r.prevHolder).toBe('Reyes');
    expect(r.prevLap).toBe(21.4);
    expect(r.prevSetAt).toBe(NOW - 9 * DAY);
  });

  it('BEATING YOUR OWN MARK IS NOT TAKING ONE — the story stands', async () => {
    const { fileRun } = await import('../src/client/records');
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Reyes', lap: 21.4, at: NOW - 9 * DAY });
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Doc', lap: 18.9, at: NOW });
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Doc', lap: 17.2, at: NOW });
    const r = await row();
    expect(r.lap, 'the improvement still lands').toBe(17.2);
    expect(r.prevHolder, 'Doc did not take it from Doc').toBe('Reyes');
    expect(r.prevLap).toBe(21.4);
  });

  it('the story moves on when somebody else takes it', async () => {
    const { fileRun } = await import('../src/client/records');
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Doc', lap: 17.2, at: NOW });
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Vance', lap: 16.0, at: NOW });
    const r = await row();
    expect(r.holder).toBe('Vance');
    expect(r.prevHolder).toBe('Doc');
    expect(r.prevLap).toBe(17.2);
  });

  it('a lap that does not beat the mark changes nothing at all', async () => {
    const { fileRun } = await import('../src/client/records');
    fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Doc', lap: 17.2, at: NOW });
    const res = fileRun({ trackId: 'deadman-flyer', hull: 'comet', holder: 'Slow', lap: 30, at: NOW });
    expect(res.tookLap).toBe(false);
    const r = await row();
    expect(r.holder).toBe('Doc');
    expect(r.prevHolder).toBeUndefined();
  });
});

describe('the board tells the story', () => {
  const rec = (over: Partial<TrackRecord>): TrackRecord => ({
    trackId: 'deadman-flyer', cls: 'board', lap: 18.9, race: 0,
    holder: 'Doc', hull: 'comet', at: NOW, ...over,
  });

  it('names who it was taken from, the margin, and how long it stood', () => {
    const [v] = venueBoard([rec({ prevHolder: 'Reyes', prevLap: 21.4, prevSetAt: NOW - 9 * DAY })]);
    const story = recordStory(v)!;
    expect(story).toContain('Reyes');
    expect(story).toContain('2.5s');       // 21.4 − 18.9
    expect(story).toContain('9 days');
  });

  it('a mark that fell the same day says so', () => {
    const [v] = venueBoard([rec({ prevHolder: 'Reyes', prevLap: 19.0, prevSetAt: NOW - 3600_000 })]);
    expect(recordStory(v)).toMatch(/less than a day/);
  });

  it('one day is a day, not "1 days"', () => {
    const [v] = venueBoard([rec({ prevHolder: 'Reyes', prevLap: 19.0, prevSetAt: NOW - DAY })]);
    expect(recordStory(v)).toContain('1 day.');
  });

  it('a virgin record has no story, and does not invent one', () => {
    const [v] = venueBoard([rec({})]);
    expect(recordStory(v)).toBeNull();
  });

  it('an old record filed before any of this loads clean', () => {
    // every history field is optional — a pre-existing board must not break
    const [v] = venueBoard([rec({ prevHolder: undefined, prevLap: undefined, prevSetAt: undefined })]);
    expect(v.holder).toBe('Doc');
    expect(recordStory(v)).toBeNull();
  });
});
