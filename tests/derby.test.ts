// ---------------------------------------------------------------------------
// DESTRUCTION DERBY (docs/RACING.md) — Racing Destruction Set's other half.
// No laps, no flag: the last machine still running wins. Every tool already
// existed (crusher, mines, oil, landings), so the mode is a RULE, not a
// system. Nobody dies at the fair — a wrecked driver walks away.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

function derby(n = 3) {
  const w = new World({ seed: 4, mode: 'derby', botsPerTeam: 0 });
  const cars = [];
  for (let i = 0; i < n; i++) {
    const s = w.addSoldier(`D${i}`, 'infantry', (i % 2) as 0 | 1, 'human');
    s.alive = true;
    const v = w.spawnVehicle('musclecar', (i % 2) as 0 | 1, { x: -60 + i * 12, y: 0, z: -60 });
    v.alive = true;
    w.forceBoard(s, v);
    cars.push({ s, v });
  }
  w.mode.countdown = 0;
  return { w, cars };
}

describe('the derby', () => {
  it('counts the machines still running', () => {
    const { w } = derby(3);
    w.step(1 / 60, new Map());
    expect(w.mode.zombiesLeft, 'three started').toBe(3);
  });

  it('ends when one machine is left, and names its side', () => {
    const { w, cars } = derby(3);
    w.step(1 / 60, new Map());
    expect(w.mode.over).toBe(false);
    // wreck two of them
    while (cars[1].v.alive) w.damageVehicle(cars[1].v, 400, -1, 'gl');
    while (cars[2].v.alive) w.damageVehicle(cars[2].v, 400, -1, 'gl');
    w.step(1 / 60, new Map());
    expect(w.mode.over, 'the derby never called it').toBe(true);
    expect(w.mode.winner).toBe(cars[0].v.team);
  });

  it('a wrecked driver is not a dead driver — nobody dies at the fair', () => {
    const { w, cars } = derby(2);
    while (cars[1].v.alive) w.damageVehicle(cars[1].v, 400, -1, 'gl');
    w.step(1 / 60, new Map());
    expect(cars[1].s.alive, 'the derby killed a driver').toBe(true);
  });

  it('the countdown holds the field before the flag drops', () => {
    const { w } = derby(3);
    w.mode.countdown = 3;
    w.step(1 / 60, new Map());
    expect(w.mode.over, 'it ended during the countdown').toBe(false);
    expect(w.mode.countdown!).toBeLessThan(3);
  });
});
