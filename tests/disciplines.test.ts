// ---------------------------------------------------------------------------
// THE FIVE DISCIPLINES — and the RDS toybox they run on.
//
// Robert: *"complete gun run and freestyle… have racing cameras at start and a
// random place… when building tracks we should be able to select this… also do
// they have jumps and what about the oil slick and other things like mines —
// think Racing Destruction Set."*
//
// THE GUN RUN and FREESTYLE were `live:false` shells for months. They are real
// modes now, and these pin the parts that make them real: the discipline rides
// in on `raceKind`, a jump is a LIP you fly off, a run banks and a bail takes
// it, and every circuit carries trackside cameras.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { buildTrackMap, generateRaceTrack, WORLD } from '../src/sim/map';
import { DEFAULT_PIECE, camerasFor, starterOval, type BuiltTrack, type PieceKind } from '../src/sim/tracks';
import { land, newTrickState } from '../src/sim/boardtricks';
import { SPORTS } from '../src/client/gonet/sports';
import type { VehicleKind } from '../src/sim/types';
import { VEHICLES } from '../src/sim/data';

const P = (kind: PieceKind) => ({ ...DEFAULT_PIECE, kind });
/** a circuit with real jumps in it — the board park */
const park = (): BuiltTrack => ({
  id: 'park', name: 'The Park', author: 'TEST', version: 1,
  start: { x: -70, y: 0, z: -60 }, startYaw: 0,
  pieces: [P('straight'), P('jump'), P('curve_r'), P('straight'), P('curve_r'),
    P('jump'), P('straight'), P('curve_r'), P('straight'), P('curve_r')],
});

const raceWorld = (raceKind: string, map?: unknown) => new World({
  seed: 7, mode: raceKind === 'trial' ? 'timetrial' : 'race', raceKind,
  difficulty: 'veteran', botsPerTeam: 8, matchMinutes: 15, theme: 'savanna',
  hordeRoster: 'zombies', moraleBoost: [0, 0], lswPass: 3, ...(map ? { map } : {}),
} as never);

describe('the league fields five disciplines', () => {
  it('every discipline is LIVE — no shells left on the board', () => {
    expect(SPORTS.length).toBe(5);
    for (const s of SPORTS) expect(s.live, `${s.name} is still a shell`).toBe(true);
  });

  it('the three that share the race mode are told apart by raceKind', () => {
    const byId = Object.fromEntries(SPORTS.map((s) => [s.id, s]));
    expect(byId.circuit.raceKind).toBe('circuit');
    expect(byId.gunrun.raceKind).toBe('gunrun');
    expect(byId.freestyle.raceKind).toBe('freestyle');
    // …and they really do all launch the same mode
    expect(new Set([byId.circuit.mode, byId.gunrun.mode, byId.freestyle.mode]).size).toBe(1);
  });

  it('the discipline survives the trip into the world', () => {
    expect(raceWorld('gunrun').mode.raceKind).toBe('gunrun');
    expect(raceWorld('freestyle').mode.raceKind).toBe('freestyle');
    expect(raceWorld('circuit').mode.raceKind).toBe('circuit');
  });

  it('FREESTYLE has no finish line — a circuit does', () => {
    expect(raceWorld('freestyle').mode.raceLaps).toBe(0);
    expect(raceWorld('circuit').mode.raceLaps).toBeGreaterThan(0);
  });

  it('DEMOLITION gets a grid to spawn on (it used to get none and die in 5s)', () => {
    const w = new World({
      seed: 7, mode: 'derby', difficulty: 'veteran', botsPerTeam: 8, matchMinutes: 15,
      theme: 'savanna', hordeRoster: 'zombies', moraleBoost: [0, 0], lswPass: 3,
    } as never);
    expect(w.map.raceTrack, 'a derby deploy has nowhere to put the hulls').toBeTruthy();
    expect(w.map.raceTrack!.grid.length).toBeGreaterThanOrEqual(8);
  });
});

describe('THE GUN RUN', () => {
  it('is a circuit with the guns live — laps still decide it', () => {
    const w = raceWorld('gunrun');
    const t = w.map.raceTrack!;
    const cars: VehicleKind[] = ['musclecar', 'roadster', 'hotrod'];
    for (let i = 0; i < 8; i++) {
      const s = w.addSoldier(`R${i}`, 'infantry', 1, 'bot');
      const v = w.spawnVehicle(cars[i % cars.length], s.team, t.grid[i]);
      // the nose gun the discipline is named for. Spread the REAL def — an
      // empty spread strips the hull's speed and traction and it cannot drive.
      v.fittedDef = { ...(v.fittedDef ?? VEHICLES[v.kind]), weapon: 'bike_mg' } as never;
      v.yaw = t.startYaw; s.pos = { ...t.grid[i] }; w.forceBoard(s, v);
    }
    const cmds = new Map();
    for (let i = 0; i < 120 * 30 && !w.mode.over; i++) w.step(1 / 30, cmds);
    const laps = (w.mode.racers ?? []).map((r) => r.lap);
    expect(laps.length).toBe(8);
    expect(Math.max(...laps), 'nobody completed a lap in the Gun Run').toBeGreaterThan(0);
  });
});

describe('FREESTYLE', () => {
  it('a clean landing banks the run; a bail takes all of it', () => {
    const t = newTrickState();
    t.combo = 400; t.multiplier = 2;
    land(t, 1, 0);                       // stuck it
    expect(t.runScore).toBeGreaterThan(0);
    const banked = t.runScore;
    t.combo = 300;
    land(t, 0, 1);                       // ate it
    expect(t.runScore, 'a bail must cost you the whole run').toBe(0);
    expect(banked).toBeGreaterThan(0);
  });

  it('scores a real session on a park with jumps', () => {
    const w = raceWorld('freestyle', buildTrackMap(park()));
    const t = w.map.raceTrack!;
    const s = w.addSoldier('Rider', 'infantry', 0, 'human');
    const v = w.spawnVehicle('vector', 0, t.grid[0]);
    v.yaw = t.startYaw; s.pos = { ...t.grid[0] }; w.forceBoard(s, v);
    const cmds = new Map();
    let airborne = 0;
    for (let i = 0; i < 90 * 30 && !w.mode.over; i++) {
      cmds.set(s.id, {
        moveX: Math.sin(i / 22) * 0.8, moveZ: -1, aimYaw: v.yaw,
        fire: false, jump: i % 90 === 0, use: false,
      } as never);
      w.step(1 / 30, cmds);
      if (v.pos.y > 0.2) airborne++;
    }
    expect(airborne, 'the board never left the ground — are the jumps flat?').toBeGreaterThan(0);
    const r = w.mode.racers?.[0];
    expect(r?.bestRun, 'a session on a park scored nothing').toBeGreaterThan(0);
    expect(r?.place).toBe(1);
  });

  it('THE RACEBOARDS get the trick economy (it used to be hoverboard-only)', () => {
    const w = raceWorld('freestyle', buildTrackMap(park()));
    const t = w.map.raceTrack!;
    const s = w.addSoldier('Rider', 'infantry', 0, 'human');
    const v = w.spawnVehicle('vector', 0, t.grid[0]);   // a RACEBOARD, not 'hoverboard'
    v.yaw = t.startYaw; s.pos = { ...t.grid[0] }; w.forceBoard(s, v);
    const cmds = new Map();
    for (let i = 0; i < 300; i++) {
      cmds.set(s.id, { moveX: 0.5, moveZ: -1, aimYaw: v.yaw, fire: false, jump: i === 30, use: false } as never);
      w.step(1 / 30, cmds);
    }
    expect(v.trick, 'a raceboard has no trick state — stepBoard never ran for it').toBeTruthy();
  });
});

describe('the RDS toybox', () => {
  it('A JUMP IS A LIP — it authors real terrain, not a flat run', () => {
    const flat = buildTrackMap(starterOval());
    const withJumps = buildTrackMap(park());
    expect(flat.height, 'a jumpless oval should stay flat').toBeUndefined();
    expect(withJumps.height, 'a track with jumps must author height').toBeTruthy();
    expect(withJumps.height!.some((h) => h > 0)).toBe(true);
    expect(withJumps.ramp!.some((r) => r === 1), 'the climb to the lip must be graded').toBe(true);
  });

  it('mines and oil are real, and they leave the car', () => {
    const w = raceWorld('circuit', buildTrackMap(starterOval()));
    const t = w.map.raceTrack!;
    const s = w.addSoldier('Me', 'infantry', 0, 'human');
    const v = w.spawnVehicle('musclecar', 0, t.grid[0]);
    w.setFit(v, { tires: 'allterrain', engine: 'stock', chassis: 'standard', cargo: ['mines', 'oil'] } as never);
    s.pos = { ...t.grid[0] }; w.forceBoard(s, v);
    expect(v.mines).toBeGreaterThan(0);
    expect(v.oil).toBeGreaterThan(0);
    const carried = (v.mines ?? 0) + (v.oil ?? 0);
    const cmds = new Map();
    for (let i = 0; i < 200; i++) {
      // G in a vehicle drops what is loaded, out the back
      cmds.set(s.id, { moveX: 0, moveZ: -1, aimYaw: v.yaw, fire: false, jump: false, use: false, grenade: i % 25 === 0 } as never);
      w.step(1 / 30, cmds);
    }
    expect((v.mines ?? 0) + (v.oil ?? 0), 'nothing left the car').toBeLessThan(carried);
    expect(w.gadgets.size, 'nothing landed on the track').toBeGreaterThan(0);
  });
});

describe('the trackside cameras', () => {
  const inWorld = (c: { x: number; z: number }) => Math.abs(c.x) < WORLD / 2 && Math.abs(c.z) < WORLD / 2;
  const key = (c: { x: number; z: number }) => `${c.x.toFixed(0)},${c.z.toFixed(0)}`;

  it('every circuit carries a start-line camera and one out on the lap', () => {
    for (const cams of [camerasFor(starterOval()), camerasFor(park()),
      generateRaceTrack(7).raceTrack!.cameras!]) {
      expect(cams.length).toBeGreaterThanOrEqual(2);
      // two cameras on the same piece of tarmac is one camera
      expect(new Set(cams.map(key)).size, 'the cameras are stacked').toBe(cams.length);
      // a camera posted outside the fence watches the circuit from off the map
      expect(cams.every(inWorld), 'a camera is off the edge of the world').toBe(true);
    }
  });

  it('the creator can place them, and authored cameras win', () => {
    const mine = { ...park(), cameras: [{ x: 5, y: 0, z: 5 }] };
    expect(camerasFor(mine)).toEqual([{ x: 5, y: 0, z: 5 }]);
  });

  it('they reach the raceable map, so the broadcast can cut to them', () => {
    expect(buildTrackMap(park()).raceTrack!.cameras!.length).toBeGreaterThanOrEqual(2);
  });

  it('the same track always cuts to the same corner (stable, not random-per-run)', () => {
    expect(camerasFor(park())).toEqual(camerasFor(park()));
  });
});
