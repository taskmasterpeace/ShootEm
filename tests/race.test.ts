import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { fmtLap } from '../src/sim/modes';
import { VEHICLES } from '../src/sim/data';
import { RACEBOARD_KINDS, type VehicleKind } from '../src/sim/types';

// THE MOTOR TRIALS — hoverboard racing. These lock the track, the lap engine,
// and the racing AI so a refactor can't quietly stop the boards from finishing.

function raceWorld(seed = 7) {
  return new World({
    seed, mode: 'race', difficulty: 'veteran', botsPerTeam: 8, matchMinutes: 15,
    theme: 'savanna', hordeRoster: 'zombies', moraleBoost: [0, 0], lswPass: 3,
  } as never);
}

/** Seat the player + n AI racers on boards at the grid, as main.ts does. */
function fillGrid(w: World, n: number) {
  const track = w.map.raceTrack!;
  const boards: VehicleKind[] = ['comet', 'vector', 'sprite'];
  const me = w.addSoldier('You', 'infantry', 0, 'human');
  const mb = w.spawnVehicle('vector', 0, track.grid[0]);
  mb.yaw = track.startYaw; me.pos = { ...track.grid[0] }; w.forceBoard(me, mb);
  for (let i = 1; i <= n; i++) {
    const b = w.addSoldier('R' + i, 'infantry', 1, 'bot');
    const v = w.spawnVehicle(boards[i % 3], 1, track.grid[i]);
    v.yaw = track.startYaw; b.pos = { ...track.grid[i] }; w.forceBoard(b, v);
  }
}

describe('the raceboards', () => {
  it('are a real speed/grip trade — Comet fastest, Sprite grippiest', () => {
    for (const k of RACEBOARD_KINDS) expect(VEHICLES[k]).toBeTruthy();
    expect(VEHICLES.comet.speed).toBeGreaterThan(VEHICLES.sprite.speed);   // Comet has the legs
    expect(VEHICLES.sprite.turnRate).toBeGreaterThan(VEHICLES.comet.turnRate); // Sprite bites
    expect(VEHICLES.comet.slip!).toBeGreaterThan(VEHICLES.sprite.slip!);   // Comet drifts wide
  });
});

describe('the circuit', () => {
  it('carves a closed ring of ordered checkpoints with a start grid', () => {
    const w = raceWorld();
    const t = w.map.raceTrack!;
    expect(t.checkpoints.length).toBeGreaterThanOrEqual(8);
    expect(t.grid.length).toBeGreaterThanOrEqual(8); // room for the pack
    for (const cp of t.checkpoints) expect(cp.radius).toBeGreaterThan(0);
  });
});

describe('the race engine + AI', () => {
  it('drives the pack round the loop, banks laps, and flags a winner', () => {
    const w = raceWorld();
    fillGrid(w, 7);
    const cmds = new Map();
    for (let i = 0; i < 200 * 30 && !w.mode.over; i++) w.step(1 / 30, cmds);
    const racers = w.mode.racers!;
    expect(racers.length).toBe(8);
    // the AI actually completed laps (the player sits still with no input)
    const bots = racers.filter((r) => w.soldiers.get(r.id)?.kind === 'bot');
    expect(Math.max(...bots.map((r) => r.lap))).toBeGreaterThanOrEqual(3);
    // someone took the flag and the race is over with a real winner
    expect(w.mode.over).toBe(true);
    expect(racers.some((r) => r.finished)).toBe(true);
    // placement is a permutation 1..N
    const places = racers.map((r) => r.place).sort((a, b) => a - b);
    expect(places).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is deterministic — same seed, same finishing order', () => {
    const run = () => {
      const w = raceWorld(11); fillGrid(w, 5);
      const cmds = new Map();
      for (let i = 0; i < 200 * 30 && !w.mode.over; i++) w.step(1 / 30, cmds);
      return w.mode.racers!.slice().sort((a, b) => a.place - b.place).map((r) => r.id);
    };
    expect(run()).toEqual(run());
  });
});

describe('fmtLap', () => {
  it('reads as a lap time', () => {
    expect(fmtLap(23.4)).toBe('23.4s');
    expect(fmtLap(67.5)).toBe('1:07.5');
    expect(fmtLap(0)).toBe('—');
  });
});
