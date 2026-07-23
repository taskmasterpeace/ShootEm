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

// ---------------------------------------------------------------------------
// THE CONTROL (2026-07-23). Robert: "at a time of day in the game, battlefield
// or not, we should see a clock that we will control later."
//
// The laws: the chip reads the world you are STANDING IN; a world with no
// clock says so rather than inventing an hour; and the control never
// teleports the world when you change how fast the day runs.
// ---------------------------------------------------------------------------
import {
  clockForField, clockFromElapsed, defaultTimeControl, elapsedGameMs, freeze,
  isControlled, loadTimeControl, nudge, phaseName, resetControl, saveTimeControl,
  scrubToHour, setRate, unfreeze,
} from '../src/client/worldclock';

// the client guards localStorage everywhere; an in-memory store lets the
// control's round trips actually be exercised
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const HOUR = GAME_DAY_MS / 24;

describe('the time of day, in words', () => {
  it('names the light you are fighting in', () => {
    expect(phaseName(clockFromPhase(0, 2 / 24))).toBe('DEAD OF NIGHT');
    expect(phaseName(clockFromPhase(0, 7 / 24))).toBe('DAWN');
    expect(phaseName(clockFromPhase(0, 12 / 24))).toBe('MIDDAY');
    expect(phaseName(clockFromPhase(0, 20 / 24))).toBe('DUSK');
    expect(phaseName(clockFromPhase(0, 23 / 24))).toBe('NIGHT');
  });
});

describe('the clock where you are standing', () => {
  it('outside a match it reads the world clock', () => {
    const c = clockForField(null, CLOCK_EPOCH_MS + 9 * HOUR);
    expect(c.field).toBe(false);
    expect(c.h).toBe(9);
  });

  it('ON THE FIELD it reads the world you are standing in, not the wall', () => {
    // the wall says 09:00; the field you are standing in says 21:00
    const c = clockForField({ phase01: 21 / 24, dayOffset: 0 }, CLOCK_EPOCH_MS + 9 * HOUR);
    expect(c.field).toBe(true);
    expect(c.h).toBe(21);
    expect(c.night).toBe(true);
  });

  it('carries the days a long match has crossed', () => {
    const c = clockForField({ phase01: 0.25, dayOffset: 2 }, CLOCK_EPOCH_MS + 5 * GAME_DAY_MS);
    expect(c.day).toBe(7); // launched on day 5, two days of fighting later
  });
});

describe('the control', () => {
  it('does nothing by default — the world simply tells you the time', () => {
    localStorage.clear();
    const tc = defaultTimeControl();
    expect(isControlled(tc)).toBe(false);
    const at = CLOCK_EPOCH_MS + 3 * GAME_DAY_MS + 9 * HOUR;
    expect(elapsedGameMs(tc, at)).toBe(at - CLOCK_EPOCH_MS);
  });

  it('CHANGING THE RATE NEVER TELEPORTS THE WORLD', () => {
    const at = CLOCK_EPOCH_MS + 4 * GAME_DAY_MS + 7 * HOUR;
    const before = elapsedGameMs(defaultTimeControl(), at);
    for (const rate of [0.5, 4, 12, 0]) {
      expect(elapsedGameMs(setRate(defaultTimeControl(), rate, at), at)).toBeCloseTo(before, 3);
    }
  });

  it('but the day really does run faster afterwards', () => {
    const at = CLOCK_EPOCH_MS + GAME_DAY_MS;
    const later = at + 10 * 60 * 1000;
    const normal = defaultTimeControl();
    const fast = setRate(defaultTimeControl(), 4, at);
    const nMoved = elapsedGameMs(normal, later) - elapsedGameMs(normal, at);
    const fMoved = elapsedGameMs(fast, later) - elapsedGameMs(fast, at);
    expect(fMoved).toBeCloseTo(nMoved * 4, 0);
  });

  it('HELD MEANS HELD, and releasing carries on from where it stopped', () => {
    const at = CLOCK_EPOCH_MS + 5 * GAME_DAY_MS + 11 * HOUR;
    const held = freeze(defaultTimeControl(), at);
    const wasAt = elapsedGameMs(held, at);
    expect(elapsedGameMs(held, at + 5 * GAME_DAY_MS)).toBe(wasAt);
    const running = unfreeze(held, at + 5 * GAME_DAY_MS);
    expect(elapsedGameMs(running, at + 5 * GAME_DAY_MS)).toBeCloseTo(wasAt, 3);
    expect(elapsedGameMs(running, at + 5 * GAME_DAY_MS + HOUR)).toBeGreaterThan(wasAt);
  });

  it('scrubs to an hour, always forward rather than a day backwards', () => {
    const at = CLOCK_EPOCH_MS + 10 * HOUR;
    expect(clockFromElapsed(elapsedGameMs(scrubToHour(defaultTimeControl(), 20, at), at)).h).toBe(20);
    const toDawn = scrubToHour(defaultTimeControl(), 5, at);
    expect(clockFromElapsed(elapsedGameMs(toDawn, at)).h).toBe(5);
    expect(elapsedGameMs(toDawn, at)).toBeGreaterThan(elapsedGameMs(defaultTimeControl(), at));
  });

  it('nudges a held clock as well as a running one', () => {
    const at = CLOCK_EPOCH_MS + 8 * HOUR;
    expect(clockFromElapsed(elapsedGameMs(nudge(freeze(defaultTimeControl(), at), 3 * HOUR, at), at)).h).toBe(11);
    expect(clockFromElapsed(elapsedGameMs(nudge(defaultTimeControl(), 3 * HOUR, at), at)).h).toBe(11);
  });

  it('never runs the clock before the war began', () => {
    const back = nudge(defaultTimeControl(), -999 * GAME_DAY_MS, CLOCK_EPOCH_MS);
    expect(elapsedGameMs(back, CLOCK_EPOCH_MS)).toBeGreaterThanOrEqual(0);
  });

  it('round-trips through storage, and CLEAR restores true time', () => {
    localStorage.clear();
    const at = CLOCK_EPOCH_MS + GAME_DAY_MS;
    saveTimeControl(setRate(freeze(defaultTimeControl(), at), 4, at));
    expect(loadTimeControl().rate).toBe(4);
    expect(isControlled(loadTimeControl())).toBe(true);
    saveTimeControl(resetControl());
    expect(isControlled(loadTimeControl())).toBe(false);
  });

  it('refuses a negative or absurd rate rather than running the world backwards', () => {
    localStorage.clear();
    saveTimeControl({ ...defaultTimeControl(), rate: -5 });
    expect(loadTimeControl().rate).toBe(0);
    saveTimeControl({ ...defaultTimeControl(), rate: 9999 });
    expect(loadTimeControl().rate).toBe(60);
  });

  it('a corrupt store falls back to true time instead of a broken clock', () => {
    localStorage.clear();
    localStorage.setItem('ww_time_control', '{not json');
    expect(isControlled(loadTimeControl())).toBe(false);
  });

  it("inherits #90's bare admin scrub", () => {
    localStorage.clear();
    localStorage.setItem('ww_admin_clock_offset', String(3 * HOUR));
    expect(loadTimeControl().offsetMs).toBe(3 * HOUR);
  });
});

describe('the sim runs the same day, at the rate it was handed', () => {
  it('advances its own day from world.time', () => {
    const w = new World({ seed: 1, mode: 'tdm', botsPerTeam: 0, clockPhase: 0 });
    expect(w.clockNow()).toBeCloseTo(0, 5);
    w.time = 3600;
    expect(w.clockNow()).toBeCloseTo(0.5, 5);
  });

  it('a faster day crosses more of them', () => {
    const fast = new World({ seed: 1, mode: 'tdm', botsPerTeam: 0, clockPhase: 0, clockRate: 4 });
    fast.time = 3600;
    expect(fast.clockNow()).toBeCloseTo(0, 5);
    expect(fast.clockDayOffset()).toBe(2);
  });

  it('A HELD CLOCK HOLDS THE SKY — rate 0 freezes the world mid-match', () => {
    const w = new World({ seed: 1, mode: 'tdm', botsPerTeam: 0, clockPhase: 20 / 24, clockRate: 0 });
    const before = w.clockNow();
    w.time = 7200 * 3;
    expect(w.clockNow()).toBeCloseTo(before, 6);
    expect(w.clockDayOffset()).toBe(0);
  });

  it('a world with NO clock says so rather than inventing an hour', () => {
    const yard = new World({ seed: 1, mode: 'tdm', botsPerTeam: 0 });
    expect(yard.hasClock()).toBe(false);
    expect(yard.clockNow()).toBe(0.5);
    expect(new World({ seed: 1, mode: 'tdm', botsPerTeam: 0, clockPhase: 0.25 }).hasClock()).toBe(true);
  });
});
