// ───────────────────────────────────────────────────────────────────────────
// THE FLAG FALLS ON EVERYONE — a race gives every entrant a result.
//
// Playtested headless across three seeds and both classes, and the same number
// came back every time: **1 racer classified in a field of 8.** `endMatch`
// fired the instant the leader crossed, freezing the other seven mid-lap with
// `finished: false`, no finish time and nothing to file. A sporting event where
// only the winner gets a line is not a sport, and the newspaper could only ever
// report a name because a name was all the sim produced.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { raceResults } from '../src/sim/modes';
import { raceHeadline, type PressIssue, type RacePressData } from '../src/client/newspaper';
import type { VehicleKind } from '../src/sim/types';

/** run one full race with a filled grid, exactly as main.ts seats it */
function runRace(seed: number, kinds: VehicleKind[] = ['comet', 'vector', 'sprite']) {
  const w = new World({
    seed, mode: 'race', difficulty: 'veteran', botsPerTeam: 8,
    matchMinutes: 15, theme: 'savanna',
  } as never);
  const track = w.map.raceTrack!;
  const me = w.addSoldier('You', 'infantry', 0, 'human');
  const mv = w.spawnVehicle(kinds[0], 0, track.grid[0]);
  mv.yaw = track.startYaw; me.pos = { ...track.grid[0] }; w.forceBoard(me, mv);
  const n = Math.min(8, track.grid.length);
  for (let i = 1; i < n; i++) {
    const b = w.addSoldier('R' + i, 'infantry', 1, 'bot');
    const v = w.spawnVehicle(kinds[i % kinds.length], 1, track.grid[i]);
    v.yaw = track.startYaw; b.pos = { ...track.grid[i] }; w.forceBoard(b, v);
  }
  let t = 0;
  while (t < 400 && !w.mode.over) { w.step(1 / 60, new Map()); t += 1 / 60; }
  return { w, entrants: n };
}

describe('the whole field is classified at the flag', () => {
  it('every entrant leaves with a result, not just the winner', () => {
    const { w, entrants } = runRace(7);
    expect(w.mode.over, 'the race actually finished').toBe(true);
    const sheet = raceResults(w.mode);
    expect(sheet.length, 'measured at 1 of 8 before this').toBe(entrants);
  });

  it('the sheet is a real order — 1..N, no gaps, no ties', () => {
    const { w, entrants } = runRace(11);
    const places = raceResults(w.mode).map((r) => r.place);
    expect(places).toEqual(Array.from({ length: entrants }, (_, i) => i + 1));
  });

  it('exactly one winner, and he is the one who crossed', () => {
    const { w } = runRace(42);
    const sheet = raceResults(w.mode);
    const won = sheet.filter((r) => r.won);
    expect(won.length).toBe(1);
    expect(won[0].place).toBe(1);
    const champ = w.mode.racers!.find((r) => r.id === won[0].id)!;
    expect(champ.finished, 'the winner FINISHED; the rest are classified').toBe(true);
  });

  it('everyone behind him carries a real margin — laps down or a gap', () => {
    const { w } = runRace(7);
    for (const r of raceResults(w.mode).filter((x) => !x.won)) {
      const hasMargin = r.lapsDown > 0 || r.gap !== undefined;
      expect(hasMargin, `P${r.place} left with no margin at all`).toBe(true);
      if (r.gap !== undefined) expect(r.gap).toBeGreaterThanOrEqual(0);
    }
  });

  it('a margin never goes backwards down the sheet', () => {
    const { w } = runRace(11);
    const sheet = raceResults(w.mode);
    let worst = -1;
    for (const r of sheet) {
      const rank = r.lapsDown * 1000 + (r.gap ?? 0);
      expect(rank, `P${r.place} is ahead of someone who beat him`).toBeGreaterThanOrEqual(worst);
      worst = rank;
    }
  });

  it('classification is idempotent — a late tick cannot rewrite the sheet', () => {
    const { w } = runRace(42);
    const before = JSON.stringify(raceResults(w.mode));
    for (let i = 0; i < 120; i++) w.step(1 / 60, new Map());
    expect(JSON.stringify(raceResults(w.mode))).toBe(before);
  });

  it('the result survives the wire — it is all on the mode state', () => {
    // single AND multiplayer: RacerState is snapshot-serialised, so a puppet
    // client reads the same sheet the host computed rather than guessing
    const { w } = runRace(7);
    const round = JSON.parse(JSON.stringify(w.mode.racers));
    expect(round.every((r: { classified?: boolean; finished: boolean }) => r.classified || r.finished)).toBe(true);
  });
});

describe('the desk can finally report a race', () => {
  const issue = (podium: RacePressData['podium']): PressIssue => ({
    at: 1, modeName: 'CIRCUIT RACING', won: true, myKills: 0, theirKills: 0,
    aceName: 'Doc', aceKills: 0, longestShot: 0, myCost: 0, theirCost: 0,
    underdog: false, medals: [], season: 1,
    race: {
      discipline: 'CIRCUIT RACING', venue: 'savanna-circuit', cls: 'BOARD',
      winner: 'Doc', lap: 18.9, field: 8, recordTaken: false, podium,
    },
  });

  it('a lapped field reads as a rout', () => {
    const h = raceHeadline(issue([
      { name: 'Doc', place: 1, lapsDown: 0 },
      { name: 'Reyes', place: 2, lapsDown: 1 },
    ]));
    expect(h).toMatch(/LAP|ALONE|NO CONTEST/);
  });

  it('three tenths reads as a photo finish', () => {
    const h = raceHeadline(issue([
      { name: 'Doc', place: 1, lapsDown: 0 },
      { name: 'Reyes', place: 2, lapsDown: 0, gap: 0.3 },
    ]));
    expect(h).toMatch(/EDGES|PHOTO|SECONDS DECIDE/);
  });

  it('and a plain win is still a plain win', () => {
    const h = raceHeadline(issue([
      { name: 'Doc', place: 1, lapsDown: 0 },
      { name: 'Reyes', place: 2, lapsDown: 0, gap: 9 },
    ]));
    expect(h).toMatch(/TAKES|WINS|HONOURS/);
  });

  it('an old issue with no podium still prints — the desk never breaks', () => {
    expect(raceHeadline(issue(undefined)).length).toBeGreaterThan(4);
  });
});
