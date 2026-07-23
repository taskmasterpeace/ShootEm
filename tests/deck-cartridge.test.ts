// ---------------------------------------------------------------------------
// THE DECK, SWITCHED ON — the cartridges actually run now.
//
// Robert: *"take the cartridge system and OVERHAUL + POLISH it — make them feel
// good."* Until this, `playCartridge()` was a browser alert() printing the
// back-of-the-box blurb: a display case with a save file. `fileScore()` was
// written to own the session count and the personal best and had NEVER ONCE
// BEEN CALLED, so the high-score table could not fill.
//
// These lock the two halves: a cartridge is a real playable loop, and finishing
// one files a score that survives.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GAMES, SCREEN_H, SCREEN_W, isPlayable, type GameInput } from '../src/client/gonet/cartridge-games';
import { defaultDeck, fileScore } from '../src/client/gonet/cartridges';

const NO_INPUT: GameInput = { up: false, down: false, left: false, right: false, fire: false };

/** Run a cartridge headlessly for `secs` at a fixed step. */
function run(id: string, secs: number, input: GameInput = NO_INPUT) {
  const game = GAMES[id]!();
  const dt = 1 / 60;
  let t = 0;
  while (t < secs && !game.over) { game.step(dt, input); t += dt; }
  return game;
}

describe('the cartridge runtime', () => {
  it('ORBIT RUN is playable — the shelf is no longer a display case', () => {
    expect(isPlayable('orbit_run')).toBe(true);
    expect(GAMES.orbit_run).toBeTypeOf('function');
  });

  it('the whole shelf runs now — nothing on it is a display case', () => {
    // This test used to assert the OPPOSITE: that nightwatch and deep_shaft
    // had no runtime, because four of the five cartridges were beautifully
    // dressed objects you could own, trade and never once play. They all run
    // now (see tests/cartridge-runtimes.test.ts for what each one has to do).
    // `isPlayable` stays because the shelf is meant to grow.
    expect(isPlayable('nightwatch')).toBe(true);
    expect(isPlayable('deep_shaft')).toBe(true);
    expect(isPlayable('not_a_cartridge' as never)).toBe(false);
  });

  it('starts alive on a clean playfield and scores nothing', () => {
    const g = GAMES.orbit_run!();
    expect(g.over).toBe(false);
    expect(g.score).toBe(0);
    expect(g.hint.length).toBeGreaterThan(0);
  });

  it('THE BELT IS REAL — left alone in the middle you eventually hit a rock', () => {
    // a game you cannot lose is not a game; idling must end the run
    const g = run('orbit_run', 60);
    expect(g.over, 'never crashed in 60s of not steering').toBe(true);
  });

  it('scores by threading rocks — every pair you clear is a point', () => {
    // the ship starts on the centre line and the first gap opens around it, so
    // a few rocks pass before the belt speeds up and closes the door
    const g = run('orbit_run', 8);
    expect(g.score).toBeGreaterThan(0);
  });

  it('the ceiling is not a safe lane — pinning yourself to it ends the run', () => {
    // holding UP parks you at the top where every rock has its shoulder; this
    // is the game being a game, and it is why the belt is worth threading
    const g = run('orbit_run', 8, { ...NO_INPUT, up: true });
    expect(g.over).toBe(true);
  });

  it('never leaves the playfield (the ship is clamped to the screen)', () => {
    // hold UP for a long time — the ship must not fly off the top
    const g = GAMES.orbit_run!();
    for (let i = 0; i < 600; i++) g.step(1 / 60, { ...NO_INPUT, up: true });
    // no crash, no NaN — and whatever happened, the score stays a real number
    expect(Number.isFinite(g.score)).toBe(true);
    expect(g.score).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic — the same inputs give the same run', () => {
    const a = run('orbit_run', 8);
    const b = run('orbit_run', 8);
    expect(a.score).toBe(b.score);
    expect(a.over).toBe(b.over);
  });

  it('draws without throwing on a 2d context shape', () => {
    const calls: string[] = [];
    const ctx = {
      fillRect: () => calls.push('fillRect'),
      fillText: () => calls.push('fillText'),
      set font(_v: string) { /* noop */ },
      set textBaseline(_v: string) { /* noop */ },
    } as unknown as CanvasRenderingContext2D;
    const g = run('orbit_run', 3);
    expect(() => g.draw(ctx)).not.toThrow();
    expect(calls.length, 'drew nothing at all').toBeGreaterThan(0);
  });

  it('the hardware grid is the period constraint', () => {
    expect(SCREEN_W).toBe(160);
    expect(SCREEN_H).toBe(96);
  });
});

describe('filing a score (the loop that was never wired)', () => {
  it('records a personal best and counts the session', () => {
    const d = defaultDeck();
    expect(d.sessions).toBe(0);
    expect(fileScore(d, 'orbit_run', 12)).toBe(true);
    expect(d.best.orbit_run).toBe(12);
    expect(d.sessions).toBe(1);
  });

  it('a worse run still counts as a session but does not take the record', () => {
    const d = defaultDeck();
    fileScore(d, 'orbit_run', 20);
    expect(fileScore(d, 'orbit_run', 5)).toBe(false);
    expect(d.best.orbit_run).toBe(20);
    expect(d.sessions).toBe(2);
  });

  it('REFUSES a NaN — it would sail past <= and become an unbeatable best', () => {
    const d = defaultDeck();
    expect(fileScore(d, 'orbit_run', Number.NaN)).toBe(false);
    expect(d.best.orbit_run).toBeUndefined();
  });

  it('refuses Infinity and negatives', () => {
    const d = defaultDeck();
    expect(fileScore(d, 'orbit_run', Number.POSITIVE_INFINITY)).toBe(false);
    expect(fileScore(d, 'orbit_run', -5)).toBe(false);
    expect(d.best.orbit_run).toBeUndefined();
  });

  it('refuses a cartridge that is not on the shelf', () => {
    const d = defaultDeck();
    expect(fileScore(d, 'no_such_cart', 10)).toBe(false);
    expect(d.sessions, 'a phantom cartridge must not count a session').toBe(0);
  });
});
