// ───────────────────────────────────────────────────────────────────────────
// THE RECORD BOOK — a page per circuit.
//
// Three cycles made circuits into real PLACES: they vary, they describe
// themselves, they have names, and (last cycle) the board finally keys records
// off the named venue instead of the bare theme. But the standings only ever
// answered "who is the champion" — most records held, best lap anywhere. A
// named season wants the OTHER view: who holds DEADMAN FLYER, and in what.
//
// The record book is that view. It reads off the same board the standings do,
// and it recovers each circuit's proper name from its id — "deadman-flyer" →
// "DEADMAN FLYER" — which is lossless because a name is all-caps words and its
// id is those words lowercased and hyphenated.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { venueBoard, venueNameOf } from '../src/client/gonet/sports';
import { circuitName } from '../src/sim/tracks';
import type { TrackRecord } from '../src/client/records';

const rec = (over: Partial<TrackRecord>): TrackRecord => ({
  trackId: 'deadman-flyer', cls: 'board', lap: 18.9, race: 0,
  holder: 'Doc', hull: 'comet', at: 1, ...over,
});

describe('the name comes back from the id, cleanly', () => {
  it('recovers a two-word circuit name', () => {
    expect(venueNameOf('deadman-flyer')).toBe('DEADMAN FLYER');
    expect(venueNameOf('hollow-run-twist')).toBe('HOLLOW RUN TWIST');
  });

  it('the bare theme fallback reads back too — never a broken row', () => {
    expect(venueNameOf('savanna-circuit')).toBe('SAVANNA CIRCUIT');
  });

  it('round-trips every generated name: name → id → name', () => {
    for (const seed of [7, 42, 99999, 1234, 5150, 88, 314]) {
      for (const c of ['sweeper', 'technical', 'balanced'] as const) {
        const n = circuitName(seed, c);
        expect(venueNameOf(n.id), `${n.name}`).toBe(n.name);
      }
    }
  });
});

describe('a page per circuit', () => {
  it('one row per venue, not one per record', () => {
    const board = venueBoard([
      rec({ trackId: 'deadman-flyer', cls: 'board', lap: 18.9 }),
      rec({ trackId: 'deadman-flyer', cls: 'car', lap: 22.1, holder: 'Reyes' }),
      rec({ trackId: 'hollow-run-twist', cls: 'board', lap: 15.4, holder: 'Vance' }),
    ]);
    expect(board.length).toBe(2);
  });

  it('the row holds the FASTEST lap at that circuit, and who set it', () => {
    const board = venueBoard([
      rec({ trackId: 'deadman-flyer', cls: 'car', lap: 22.1, holder: 'Reyes', hull: 'buggy' }),
      rec({ trackId: 'deadman-flyer', cls: 'board', lap: 18.9, holder: 'Doc', hull: 'comet' }),
    ]);
    const dead = board.find((v) => v.venueId === 'deadman-flyer')!;
    expect(dead.bestLap).toBe(18.9);
    expect(dead.holder).toBe('Doc');
    expect(dead.hull).toBe('comet');
    expect(dead.cls).toBe('board');           // the class that HOLDS the record
    expect(dead.classesRun).toBe(2);          // …but both classes have raced here
  });

  it('the busiest circuits lead — a raced venue is a venue with a story', () => {
    const board = venueBoard([
      rec({ trackId: 'quiet-loop', cls: 'car', lap: 30 }),
      rec({ trackId: 'busy-sweep', cls: 'car', lap: 20 }),
      rec({ trackId: 'busy-sweep', cls: 'board', lap: 18 }),
      rec({ trackId: 'busy-sweep', cls: 'truck', lap: 40 }),
    ]);
    expect(board[0].venueId).toBe('busy-sweep');
    expect(board[0].classesRun).toBe(3);
  });

  it('an unset lap never makes the book', () => {
    const board = venueBoard([rec({ lap: 0 }), rec({ trackId: 'real', lap: 12 })]);
    expect(board.length).toBe(1);
    expect(board[0].venueId).toBe('real');
  });

  it('an empty board is empty, not a crash', () => {
    expect(venueBoard([])).toEqual([]);
  });

  it('the display name on the row matches the recovered id name', () => {
    const board = venueBoard([rec({ trackId: 'the-basin-sweep' })]);
    expect(board[0].venue).toBe('THE BASIN SWEEP');
    expect(board[0].venue).toBe(venueNameOf(board[0].venueId));
  });
});
