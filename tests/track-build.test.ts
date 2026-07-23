// ---------------------------------------------------------------------------
// THE BUILT CIRCUIT — a track laid in the Track Builder must become a real,
// raceable map. This locks the bridge (`buildTrackMap`) that was missing: a
// finished editor that produced tracks nobody could drive is not track
// creation. The exam: a built track carves a closed, on-map, drivable corridor
// whose checkpoints and start grid the race mode can actually read.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, TILE, WORLD, T_OPEN, buildTrackMap, generateRaceTrack } from '../src/sim/map';
import { starterOval, validateTrack, walkTrack, type BuiltTrack, type PieceKind, DEFAULT_PIECE } from '../src/sim/tracks';
import { World } from '../src/sim/world';
import type { VehicleKind } from '../src/sim/types';

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
    // THE FIELD FACES THE WAY IT IS TRAVELLING, which is the heading the
    // circuit ARRIVES at the line on — not the heading the first piece leaves
    // on. On the starter oval those differ by 90°, and facing the first piece
    // pointed the whole grid at a wall.
    expect(Number.isFinite(map.raceTrack!.startYaw)).toBe(true);
    const approach = Math.atan2(
      track.start.z - walkTrack(track)[track.pieces.length - 1].pos.z,
      track.start.x - walkTrack(track)[track.pieces.length - 1].pos.x,
    );
    expect(Math.abs(Math.sin(map.raceTrack!.startYaw - approach)),
      'the grid does not face the way the circuit runs').toBeLessThan(0.2);
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

  // THE FIELD MUST ACTUALLY RACE. A built track used to strand three-quarters
  // of the grid: the start slots were laid backwards off `startYaw` (wrong
  // whenever the circuit closes through a corner) so the whole field spawned in
  // one pile, and every polyline corner carved a square wall that cars and
  // trucks drove straight into. Boards threaded it and everything heavier did
  // not. This drives a full grid of each class and demands they all finish laps.
  describe('a full grid actually races on a built track', () => {
    const CLASSES: Record<string, VehicleKind[]> = {
      cars: ['musclecar', 'roadster', 'hotrod', 'sportscar', 'policecruiser'],
      trucks: ['rallytruck', 'racetruck', 'pickup', 'movingtruck'],
      boards: ['comet', 'vector', 'sprite'],
      bikes: ['bike', 'scooter', 'atv'],
    };
    for (const [name, kinds] of Object.entries(CLASSES)) {
      it(`${name}: nobody is left on the grid`, () => {
        const world = new World({
          seed: 7, mode: 'race', difficulty: 'veteran', botsPerTeam: 8, matchMinutes: 15,
          theme: 'savanna', hordeRoster: 'zombies', moraleBoost: [0, 0], lswPass: 3,
          map: buildTrackMap(starterOval()),
        } as never);
        const t = world.map.raceTrack!;
        for (let i = 0; i < 8; i++) {
          const s = world.addSoldier(`R${i}`, 'infantry', 1, 'bot');
          const v = world.spawnVehicle(kinds[i % kinds.length], s.team, t.grid[i]);
          v.yaw = t.startYaw; s.pos = { ...t.grid[i] }; world.forceBoard(s, v);
        }
        const cmds = new Map();
        for (let i = 0; i < 120 * 30 && !world.mode.over; i++) world.step(1 / 30, cmds);
        const laps = (world.mode.racers ?? []).map((r) => r.lap);
        expect(laps.length, 'the grid was not collected as racers').toBe(8);
        expect(laps.filter((l) => l === 0).length,
          `${name} stranded on the grid: [${laps.join(',')}]`).toBe(0);
      });
    }

    it('NO SLOT IS CLOSER THAN A CAR IS LONG — the flag drops on a race, not a shove', () => {
      // 3.76u apart on the procedural grid meant hulls spawned inside each other
      const worst = (slots: { x: number; z: number }[]): number => {
        let w = Infinity;
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            w = Math.min(w, Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z));
          }
        }
        return w;
      };
      expect(worst(buildTrackMap(starterOval()).raceTrack!.grid),
        'built-track grid slots overlap').toBeGreaterThan(5);
      expect(worst(generateRaceTrack(7).raceTrack!.grid),
        'procedural grid slots overlap').toBeGreaterThan(5);
    });

    it('the start slots are distinct and on the road, not one pile', () => {
      const map = buildTrackMap(starterOval());
      const slots = map.raceTrack!.grid;
      const distinct = new Set(slots.map((g) => `${g.x.toFixed(0)},${g.z.toFixed(0)}`));
      expect(distinct.size, 'grid slots collapsed onto each other').toBe(slots.length);
      // and they must be spread back down the road, not bunched in a box
      const spread = Math.max(...slots.map((g) => Math.hypot(g.x - slots[0].x, g.z - slots[0].z)));
      expect(spread, 'the whole grid is stacked on the start line').toBeGreaterThan(14);
    });
  });

  it('warns when a road is too narrow for a car to corner on', () => {
    const tight = starterOval();
    for (const p of tight.pieces) p.width = 12;
    const problems = validateTrack(tight);
    expect(problems.some((p) => p.kind === 'narrow'), 'no narrow warning on a 12u road').toBe(true);
    // …and the default the builder hands you is NOT a car-trap
    expect(validateTrack(starterOval()).some((p) => p.kind === 'narrow')).toBe(false);
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
