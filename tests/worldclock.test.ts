// ---------------------------------------------------------------------------
// THE ONE CLOCK (#123) — one formula, one truth.
// The client math is pure (UTC → day/time), and the sim's law is pinned:
// a clocked world's night comes from TIME, never from the weather dice.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { CLOCK_EPOCH_MS, GAME_DAY_MS, clockFromPhase, clockLabel, gameNow } from '../src/client/worldclock';
import { World } from '../src/sim/world';

describe('the one clock — the pure math', () => {
  it('the epoch is day 0, midnight, and it is night', () => {
    const c = gameNow(CLOCK_EPOCH_MS);
    expect(c.day).toBe(0);
    expect(c.h).toBe(0);
    expect(c.m).toBe(0);
    expect(c.night).toBe(true);
  });

  it('206.5 game days later it is D206, noon, daytime — from ANY wall clock', () => {
    const c = gameNow(CLOCK_EPOCH_MS + GAME_DAY_MS * 206.5);
    expect(c.day).toBe(206);
    expect(c.h).toBe(12);
    expect(c.night).toBe(false);
    expect(clockLabel(c)).toBe('D206 · 12:00');
  });

  it('the night boundaries hold: 05:59 dark, 06:00 light, 20:59 light, 21:00 dark', () => {
    expect(clockFromPhase(1, (5 * 60 + 59) / (24 * 60)).night).toBe(true);
    expect(clockFromPhase(1, (6 * 60) / (24 * 60)).night).toBe(false);
    expect(clockFromPhase(1, (20 * 60 + 59) / (24 * 60)).night).toBe(false);
    expect(clockFromPhase(1, (21 * 60) / (24 * 60)).night).toBe(true);
  });

  it('two clients at the same instant read the same clock (determinism)', () => {
    const t = CLOCK_EPOCH_MS + 987654321;
    expect(gameNow(t)).toEqual(gameNow(t));
  });
});

describe('the one clock — the sky obeys (sim law)', () => {
  it('a world launched at clock-night IS night from step one', () => {
    const w = new World({ seed: 11, mode: 'tdm', clockPhase: 23 / 24 });
    expect(w.weather.kind).toBe('night');
    expect(w.clockNight()).toBe(true);
  });

  it('a clocked daytime world never ROLLS night — the dice lost that word', () => {
    const w = new World({ seed: 12, mode: 'tdm', clockPhase: 0.5 }); // noon
    for (let i = 0; i < 500 * 30; i++) {
      w.step(1 / 30, new Map());
      expect(w.weather.kind).not.toBe('night');
    }
  });

  it('dusk lands mid-match exactly when the clock says', () => {
    // 20:59 at launch — night begins 60 game-minutes later = 300 sim-seconds
    const w = new World({ seed: 13, mode: 'tdm', clockPhase: (20 * 60 + 59) / (24 * 60) });
    expect(w.weather.kind).not.toBe('night');
    for (let i = 0; i < 400 * 30 && w.weather.kind !== 'night'; i++) w.step(1 / 30, new Map());
    expect(w.weather.kind).toBe('night');
    expect(w.clockNight()).toBe(true);
  });

  it('an unclocked world keeps the old dice (legacy tools and tests untouched)', () => {
    const w = new World({ seed: 14, mode: 'tdm' });
    expect(w.clockNow()).toBe(0.5); // permanent midday
    expect(w.clockNight()).toBe(false);
  });
});
