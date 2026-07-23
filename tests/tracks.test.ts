// ---------------------------------------------------------------------------
// THE TRACK BUILDER (docs/RACING.md — Robert: "you can build tracks…
// creating the track is just for me, the creator"). RDS laid track from a
// box of pieces, each with its own HEIGHT, WIDTH and PAVEMENT. The laws: a
// walk is deterministic (a lap record means nothing otherwise), a circuit
// must CLOSE, it must fit the world, and a hand-edited file can never load
// something the game cannot drive.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIECE, PIECE_SHAPE, checkpointsFor, exportTrack, importTrack,
  starterOval, trackCloses, trackFits, validateTrack, walkTrack,
  type BuiltTrack, type PieceKind,
} from '../src/sim/tracks';

const P = (kind: PieceKind) => ({ ...DEFAULT_PIECE, kind });
const track = (kinds: PieceKind[]): BuiltTrack => ({
  id: 't', name: 'Test', author: 'ME', version: 1,
  start: { x: -60, y: 0, z: -60 }, startYaw: 0, pieces: kinds.map(P),
});

describe('the parts box', () => {
  it('every piece declares how far it runs and how much it turns', () => {
    for (const kind of Object.keys(PIECE_SHAPE) as PieceKind[]) {
      expect(PIECE_SHAPE[kind].run, `${kind} goes nowhere`).toBeGreaterThan(0);
    }
  });

  it('a walk is deterministic — the same track is the same track', () => {
    const t = starterOval();
    expect(walkTrack(t)).toEqual(walkTrack(t));
  });

  it('four right-hand curves come back to the grid — a circuit CLOSES', () => {
    expect(trackCloses(starterOval())).toBe(true);
  });

  it('a route that only goes straight never closes, and the editor says so', () => {
    const open = track(['straight', 'straight', 'straight', 'straight']);
    expect(trackCloses(open)).toBe(false);
    expect(validateTrack(open).some((p) => p.kind === 'open')).toBe(true);
  });

  it('a route that leaves the world is caught', () => {
    const long = track(new Array(20).fill('straight') as PieceKind[]);
    expect(trackFits(long)).toBe(false);
    expect(validateTrack(long).some((p) => p.kind === 'offmap')).toBe(true);
  });

  it('the starter oval is drivable out of the box — no complaints', () => {
    expect(validateTrack(starterOval())).toEqual([]);
  });

  it('ramps carry real height — elevation is the point', () => {
    const hilly = track(['ramp_up', 'ramp_up', 'straight']);
    const nodes = walkTrack(hilly);
    expect(nodes[2].pos.y, 'the route never climbed').toBeGreaterThan(0);
  });

  it('a built track hands the race one checkpoint per piece', () => {
    const t = starterOval();
    const cps = checkpointsFor(t);
    expect(cps.length).toBe(t.pieces.length);
    for (const c of cps) expect(c.radius).toBeGreaterThan(5);
  });

  it('a track survives a round trip through the file', () => {
    const t = starterOval('ROBERT');
    const back = importTrack(exportTrack(t))!;
    expect(back.pieces.length).toBe(t.pieces.length);
    expect(back.author).toBe('ROBERT');
    expect(walkTrack(back)).toEqual(walkTrack(t));
  });

  it('a hand-edited file can never load something undrivable', () => {
    const junk = importTrack(JSON.stringify({
      id: 'x', name: 'Junk', author: 'X', start: { x: 0, z: 0 }, startYaw: 0, version: 1,
      pieces: [{ kind: 'not_a_piece' }, { kind: 'straight', width: 9999, height: 77, surface: 'lava' }],
    }))!;
    expect(junk.pieces.length, 'the bogus piece survived').toBe(1);
    expect(junk.pieces[0].width).toBeLessThanOrEqual(30);
    expect(junk.pieces[0].height).toBeLessThanOrEqual(2);
    expect(junk.pieces[0].surface).toBe('paved');
    expect(importTrack('{ not json')).toBeNull();
  });
});
