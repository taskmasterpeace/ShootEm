// ───────────────────────────────────────────────────────────────────────────
// THE SHELF RUNS — every cartridge in the Deck is a game you can actually play.
//
// The Deck shipped as a display case with a save file: five beautifully dressed
// cartridges, one of which had a runtime. This suite is the standard the other
// four had to meet, and it is deliberately about PLAY rather than plumbing:
//
//   · it ENDS            — a cabinet game that cannot be lost is a screensaver
//   · it SCORES          — in the unit printed on its own label
//   · skill BEATS idle   — if playing well is not better than not playing,
//                          there is no game here, only an animation
//   · it never touches the match rng (every cabinet carries its own noise)
//
// The blurb on the box is the spec. "Stack it higher. It is going to fall."
// means the tower must actually erode; "eight hours" means eight is the win.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { CARTRIDGES, type CartridgeId } from '../src/client/gonet/cartridges';
import {
  GAMES, SCREEN_H, SCREEN_W, isPlayable,
  type CartridgeGame, type GameInput,
} from '../src/client/gonet/cartridge-games';

const IDLE: GameInput = { up: false, down: false, left: false, right: false, fire: false };
const hold = (over: Partial<GameInput>): GameInput => ({ ...IDLE, ...over });

/** run a cartridge for up to `cap` seconds at 60Hz with a scripted controller */
function play(id: CartridgeId, input: (t: number, g: CartridgeGame) => GameInput, cap = 150) {
  const g = GAMES[id]!();
  let t = 0;
  while (!g.over && t < cap) { g.step(1 / 60, input(t, g)); t += 1 / 60; }
  return { g, t, score: g.score, over: g.over };
}

/** a pretend canvas that records nothing but proves draw() is safe to call */
function stubCtx() {
  const rects: number[][] = [];
  return {
    rects,
    ctx: { fillRect: (x: number, y: number, w: number, h: number) => { rects.push([x, y, w, h]); } } as unknown as CanvasRenderingContext2D,
  };
}

describe('the whole shelf runs', () => {
  it('every cartridge on the shelf has a runtime', () => {
    for (const c of CARTRIDGES) {
      expect(isPlayable(c.id), `${c.title} is a display case`).toBe(true);
    }
    expect(Object.keys(GAMES).length).toBe(CARTRIDGES.length);
  });

  it('every game draws inside the hardware, on the first frame and a late one', () => {
    for (const c of CARTRIDGES) {
      const g = GAMES[c.id]!();
      for (const frames of [1, 200]) {
        for (let i = 0; i < frames; i++) g.step(1 / 60, IDLE);
        const { ctx, rects } = stubCtx();
        expect(() => g.draw(ctx), `${c.title} draw threw`).not.toThrow();
        expect(rects.length, `${c.title} drew nothing`).toBeGreaterThan(0);
        for (const [x, y, w, h] of rects) {
          expect(Number.isFinite(x) && Number.isFinite(y), `${c.title} drew NaN`).toBe(true);
          expect(w, `${c.title} drew a zero/negative width`).toBeGreaterThan(0);
          expect(h, `${c.title} drew a zero/negative height`).toBeGreaterThan(0);
          expect(x, `${c.title} drew off the left`).toBeGreaterThan(-40);
          expect(x, `${c.title} drew off the right`).toBeLessThan(SCREEN_W + 40);
          expect(y, `${c.title} drew off the top`).toBeGreaterThan(-40);
          expect(y, `${c.title} drew off the bottom`).toBeLessThan(SCREEN_H + 40);
        }
      }
    }
  });

  it('every game says what the buttons do', () => {
    for (const c of CARTRIDGES) {
      const g = GAMES[c.id]!();
      expect(g.hint.length, `${c.title} has no hint`).toBeGreaterThan(4);
    }
  });

  it('a finished game stays finished and stops scoring', () => {
    for (const c of CARTRIDGES) {
      const { g } = play(c.id, () => IDLE, 200);
      if (!g.over) continue;               // SIEGE TOWER waits for a player, by design
      const final = g.score;
      for (let i = 0; i < 120; i++) g.step(1 / 60, hold({ up: true, fire: true }));
      expect(g.over, `${c.title} un-ended itself`).toBe(true);
      expect(g.score, `${c.title} kept scoring after the run`).toBe(final);
    }
  });

  it('nobody scores negative, ever', () => {
    for (const c of CARTRIDGES) {
      const { score } = play(c.id, (t) => hold({ up: t % 1 < 0.5, down: t % 1 >= 0.5, fire: true }), 60);
      expect(score, `${c.title}`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('each game keeps the promise on its own box', () => {
  it('ORBIT RUN — the belt gets faster, so an idle ship dies', () => {
    const { over, t } = play('orbit_run', () => IDLE, 60);
    expect(over).toBe(true);
    expect(t, 'and it does not take all day about it').toBeLessThan(30);
  });

  it('DEEP SHAFT — "something down there is digging up": you always meet it', () => {
    // it is BELOW you and rising, so the run always ends — the miner never gets
    // to escape, only to choose how deep he was when it found him
    const lazy = play('deep_shaft', () => IDLE, 200);
    expect(lazy.over).toBe(true);
  });

  it('DEEP SHAFT — leaning on the drill pays in metres (the whole decision)', () => {
    // the first cut of this game had the thing chasing from ABOVE, and an idle
    // drill scored EXACTLY what a hammered one did — the player was decorative.
    // Depth must be worth something, or there is no reason to touch the stick.
    const lazy = play('deep_shaft', () => IDLE, 200);
    const hard = play('deep_shaft', () => hold({ down: true }), 200);
    expect(hard.score, 'digging hard reaches deeper before the meeting')
      .toBeGreaterThan(lazy.score);
  });

  it('HARVEST 88 — four seasons a year, and the farm ends after eight', () => {
    const { over, t } = play('harvest_88', () => IDLE, 200);
    expect(over, 'the years run out').toBe(true);
    expect(t).toBeGreaterThan(30);   // it is a season game, not a reflex game
  });

  it('HARVEST 88 — driving the field brings a crop in', () => {
    // a crude circuit of the field, which is the least a player would do
    const driven = play('harvest_88',
      (t) => hold({ right: Math.sin(t) > 0, left: Math.sin(t) <= 0, up: Math.cos(t * 1.3) > 0, down: Math.cos(t * 1.3) <= 0 }), 200);
    const parked = play('harvest_88', () => IDLE, 200);
    expect(parked.score, 'a parked combine harvests nothing').toBe(0);
    expect(driven.score, 'a driven one brings the crop in').toBeGreaterThan(8);
  });

  it('SIEGE TOWER — "it is going to fall": the tower erodes to nothing', () => {
    // drop only when the course is over the tower's centre — perfect play
    const { g, score } = play('siege_tower', (_t, game) => {
      const s = game as CartridgeGame & { x: number; w: number; prevX: number; prevW: number };
      return hold({ fire: Math.abs((s.x + s.w / 2) - (s.prevX + s.prevW / 2)) < 1.2 });
    }, 200);
    expect(score, 'skill builds a real tower').toBeGreaterThan(10);
    expect(g.over, 'and it still comes down in the end').toBe(true);
  });

  it('SIEGE TOWER — holding the button does not machine-gun the tower', () => {
    const held = play('siege_tower', () => hold({ fire: true }), 20);
    // a single rising edge: one drop, then the run is waiting on a release
    expect(held.score).toBeLessThanOrEqual(1);
  });

  it('SIEGE TOWER — a wild drop that misses the tower ends it', () => {
    const g = GAMES.siege_tower!() as CartridgeGame & { x: number; prevX: number; prevW: number };
    g.x = 0; g.prevX = 120; g.prevW = 20;      // nothing underneath at all
    g.step(1 / 60, hold({ fire: true }));
    expect(g.over).toBe(true);
  });

  it('NIGHTWATCH — eight hours is the shift, and surviving it is the score', () => {
    // swing the torch around the compass: the correct way to work a watch
    const worked = play('nightwatch', (t) => {
      const f = Math.floor(t * 2.2) % 4;
      return hold({ up: f === 0, right: f === 1, down: f === 2, left: f === 3 });
    }, 60);
    expect(worked.score, 'a watch stood properly runs the full shift').toBe(8);

    const asleep = play('nightwatch', () => IDLE, 60);
    expect(asleep.over).toBe(true);
    expect(asleep.score, 'and one slept through does not').toBeLessThan(8);
  });

  it('NIGHTWATCH — the light really does push the dark back', () => {
    const g = GAMES.nightwatch!() as CartridgeGame & { near: number[]; facing: number };
    g.near = [0.8, 0.8, 0.8, 0.8];
    const before = g.near[0];
    for (let i = 0; i < 30; i++) g.step(1 / 60, hold({ up: true }));
    expect(g.facing).toBe(0);
    expect(g.near[0], 'what you look at backs off').toBeLessThan(before);
    expect(g.near[2], 'what you turn from closes in').toBeGreaterThan(before);
  });
});

describe('a cabinet can never disturb the war', () => {
  it('the same cartridge played the same way scores the same — its own noise', () => {
    for (const c of CARTRIDGES) {
      const script = (t: number) => hold({ up: t % 0.8 < 0.4, down: t % 0.8 >= 0.4, left: t % 1.4 < 0.7, right: t % 1.4 >= 0.7, fire: t % 0.5 < 0.25 });
      const a = play(c.id, script, 40);
      const b = play(c.id, script, 40);
      expect(b.score, `${c.title} is not deterministic`).toBe(a.score);
    }
  });

  it('no game reaches for Math.random', () => {
    const real = Math.random;
    let touched = 0;
    Math.random = () => { touched++; return real(); };
    try {
      for (const c of CARTRIDGES) play(c.id, () => hold({ fire: true }), 25);
    } finally { Math.random = real; }
    expect(touched, 'a cabinet must carry its own noise').toBe(0);
  });
});
