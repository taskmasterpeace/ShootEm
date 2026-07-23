// ---------------------------------------------------------------------------
// THE BUILT CIRCUIT — a track laid in the Track Builder must become a real,
// raceable map. This locks the bridge (`buildTrackMap`) that was missing: a
// finished editor that produced tracks nobody could drive is not track
// creation. The exam: a built track carves a closed, on-map, drivable corridor
// whose checkpoints and start grid the race mode can actually read.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, TILE, WORLD, T_OPEN, buildTrackMap } from '../src/sim/map';
import { starterOval, walkTrack, type BuiltTrack, type PieceKind, DEFAULT_PIECE } from '../src/sim/tracks';

const tileAt = (map: { grid: Uint8Array }, x: number, z: number): number => {
  const tx = Math.round((x + WORLD / 2) / TILE - 0.5);
  const tz = Math.round((z + WORLD / 2) / TILE - 0.5);
  if (tx < 0 || tx >= GRID || tz < 0 || tz >= GRID) return 1; // out of bounds = wall
  return map.grid[tz * GRID + tx];
};

const ramped = (): BuiltTrack => {
  const P = (kind: PieceKind, over = {}) => ({ ...DEFAULT_PIECE, kind, ...over });
  return {
    id: 'ramped', name: 'Ramp Test', author: 'TEST', version: 1,
    start: { x: -60, y: 0, z: -40 }, startYaw: 0,
    // a loop with a climb: two ramps up, run, then back down — a real gradient
    pieces: [
      P('straight'), P('ramp_up'), P('ramp_up'), P('curve_r'),
      P('straight'), P('ramp_down'), P('curve_r'), P('straight'),
      P('curve_r'), P('straight'), P('curve_r'),
    ],
  };
};

describe('the built circuit becomes a raceable map', () => {
  it('carves a raceTrack with one checkpoint per piece and a full start grid', () => {
    const track = starterOval();
    const map = buildTrackMap(track);
    expect(map.raceTrack, 'no raceTrack carved').toBeTruthy();
    expect(map.raceTrack!.checkpoints.length).toBe(track.pieces.length);
    // the race spawns up to 8 racers on the grid — it needs at least that many
    expect(map.raceTrack!.grid.length).toBeGreaterThanOrEqual(8);
    expect(map.raceTrack!.startYaw).toBe(track.startYaw);
  });

  it('every checkpoint sits on carved (drivable) ground, not in a wall', () => {
    const map = buildTrackMap(starterOval());
    for (const cp of map.raceTrack!.checkpoints) {
      expect(tileAt(map, cp.pos.x, cp.pos.z), `checkpoint in a wall at ${cp.pos.x},${cp.pos.z}`).toBe(T_OPEN);
    }
  });

  it('every start slot sits on open ground (no car spawns in a wall)', () => {
    const map = buildTrackMap(starterOval());
    for (const slot of map.raceTrack!.grid) {
      expect(tileAt(map, slot.x, slot.z), `grid slot in a wall at ${slot.x},${slot.z}`).toBe(T_OPEN);
    }
  });

  it('checkpoint 0 is the start/finish, at the track start', () => {
    const track = starterOval();
    const map = buildTrackMap(track);
    const cp0 = map.raceTrack!.checkpoints[0];
    expect(Math.hypot(cp0.pos.x - track.start.x, cp0.pos.z - track.start.z)).toBeLessThan(1);
  });

  it('a flat track stays flat — no terrain height attached', () => {
    const map = buildTrackMap(starterOval());
    expect(map.height, 'a flat oval should carry no height layer').toBeUndefined();
    expect(map.ramp).toBeUndefined();
  });

  it('a track with ramps authors real terrain height and graded-ramp flags', () => {
    const map = buildTrackMap(ramped());
    expect(map.height, 'ramp pieces should author height').toBeTruthy();
    expect(map.ramp, 'ramp pieces should mark graded tiles').toBeTruthy();
    // some tile is raised above ground level…
    expect(map.height!.some((h) => h > 0), 'no raised tile found').toBe(true);
    // …and some tile is a drivable graded ramp (not a cliff)
    expect(map.ramp!.some((r) => r === 1), 'no graded ramp tile found').toBe(true);
  });

  it('is deterministic — the same track builds a byte-identical map', () => {
    const a = buildTrackMap(starterOval());
    const b = buildTrackMap(starterOval());
    expect(a.grid).toEqual(b.grid);
    expect(a.surface).toEqual(b.surface);
    expect(a.seed).toBe(b.seed);
    expect(a.raceTrack!.grid).toEqual(b.raceTrack!.grid);
  });

  it('per-piece pavement reaches the surface (a dirt piece paves dirt)', () => {
    const P = (kind: PieceKind, over = {}) => ({ ...DEFAULT_PIECE, kind, ...over });
    const track: BuiltTrack = {
      id: 'mixed', name: 'Mixed', author: 'TEST', version: 1,
      start: { x: -50, y: 0, z: -50 }, startYaw: 0,
      pieces: [P('straight', { surface: 'dirt' }), P('curve_r'), P('curve_r'), P('curve_r'), P('curve_r')],
    };
    const map = buildTrackMap(track);
    // the first piece is dirt (S_DIRT = 0); its entry node should read dirt
    const n0 = walkTrack(track)[0];
    // sample a tile a little into the first straight so it's inside the corridor
    const sx = n0.pos.x + Math.cos(n0.yaw) * 6, sz = n0.pos.z + Math.sin(n0.yaw) * 6;
    const tx = Math.round((sx + WORLD / 2) / TILE - 0.5);
    const tz = Math.round((sz + WORLD / 2) / TILE - 0.5);
    expect(map.surface[tz * GRID + tx]).toBe(0); // S_DIRT
  });
});
