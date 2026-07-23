// ═══════════════════════════════════════════════════════════════════════════
// THE CARTRIDGES, RUNNING — the games the Deck actually plays.
//
// cartridges.ts is the SHELF (the registry, the save, the high scores). This is
// the part that was missing: a cartridge you can switch on and actually PLAY.
// Until now `playCartridge()` was a browser alert() showing the back-of-the-box
// blurb — a display case with a save file.
//
// THE LAW (cartridges.ts): A SPORT MAKES YOU BETTER AT THE WAR. A CARTRIDGE DOES
// NOT. Nothing in here grants a skill, a stat, a licence or a rank. Getting good
// at ORBIT RUN is worth exactly nothing on a battlefield, and that is the point —
// it is the only thing in the game with no instrumental value, which is what
// makes it rest.
//
// PERIOD RULES, so it reads as a 2196 handheld and not a modern browser toy:
//   · ONE COLOUR. Every game draws in its cartridge's own ink on its own base;
//     the label IS the palette. No gradients, no alpha ramps, no bloom.
//   · A LOW GRID. The playfield is 160×96 "hardware" pixels, scaled up hard with
//     smoothing off, so a pixel is a chunky square you can count.
//   · NO EASING. Things move in whole steps at a fixed rate. Nothing lerps.
//   · The CRT is the screen's, not ours — `.gn-screen2` already lays scanlines
//     over the top (styles.css), so the canvas stays honest and flat.
//
// Pure and self-contained: no THREE, no sim, no rng from the match stream. A
// game here can never perturb a replay — it is a canvas and a score.
// ═══════════════════════════════════════════════════════════════════════════
import type { CartridgeId } from './cartridges';

/** The hardware. Every cartridge draws to exactly this grid. */
export const SCREEN_W = 160;
export const SCREEN_H = 96;

/** What the Deck's D-pad reports this frame. */
export interface GameInput {
  up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean;
}

/** The contract a cartridge implements to be playable inside the Deck. */
export interface CartridgeGame {
  /** advance one frame */
  step(dt: number, input: GameInput): void;
  /** draw the playfield in `ink` on `base` — one colour, no shading */
  draw(ctx: CanvasRenderingContext2D): void;
  /** the number that goes on the high-score table */
  readonly score: number;
  /** true once the run is finished — the host files the score */
  readonly over: boolean;
  /** the one line printed under the screen while playing */
  readonly hint: string;
}

export type CartridgeFactory = () => CartridgeGame;

// ── ORBIT RUN (Maklov Amusements, 2196) ────────────────────────────────────
// "Thread the belt. Do not touch the rocks. The rocks are everywhere."
//
// The belt scrolls at you and the gaps do not line up. You hold a lane and pick
// your moment. It gets faster and it does not stop getting faster — the only
// question a cabinet game ever really asks.

interface Rock { x: number; y: number; h: number }

class OrbitRun implements CartridgeGame {
  score = 0;
  over = false;
  readonly hint = '↑ ↓ THREAD THE BELT';

  private shipY = SCREEN_H / 2;
  private rocks: Rock[] = [];
  private nextRockIn = 0;
  private speed = 44;          // hardware pixels per second, climbing
  private t = 0;
  private seed = 1;

  /** the cabinet's own noise — never the match rng, so a replay is untouched */
  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  step(dt: number, input: GameInput): void {
    if (this.over) return;
    this.t += dt;
    // the belt never stops speeding up — this is the whole difficulty curve
    this.speed = 44 + this.t * 3.2;

    // the ship holds a lane; whole steps, no easing (period rule)
    const move = 62 * dt;
    if (input.up) this.shipY -= move;
    if (input.down) this.shipY += move;
    this.shipY = Math.max(5, Math.min(SCREEN_H - 5, this.shipY));

    // lay new rock every so often, with a gap that drifts
    this.nextRockIn -= dt;
    if (this.nextRockIn <= 0) {
      // the gap tightens as it speeds up, but never past a threadable 22px
      const gap = Math.max(22, 40 - this.t * 0.55);
      const gapTop = 4 + this.rnd() * (SCREEN_H - 8 - gap);
      this.rocks.push({ x: SCREEN_W + 2, y: 0, h: gapTop });
      this.rocks.push({ x: SCREEN_W + 2, y: gapTop + gap, h: SCREEN_H - (gapTop + gap) });
      this.nextRockIn = Math.max(0.42, 1.05 - this.t * 0.012);
    }

    const shipX = 26;
    for (const r of this.rocks) {
      const wasAhead = r.x > shipX;
      r.x -= this.speed * dt;
      // a rock cleared is a point — count one of each pair
      if (wasAhead && r.x <= shipX && r.y === 0) this.score++;
      // collision: the ship is a 5×5 block at shipX
      if (r.x < shipX + 3 && r.x > shipX - 5
        && this.shipY + 2 > r.y && this.shipY - 2 < r.y + r.h) this.over = true;
    }
    this.rocks = this.rocks.filter((r) => r.x > -8);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // the belt: rocks as solid blocks, the ship as a chevron, all one colour
    for (const r of this.rocks) ctx.fillRect(Math.round(r.x), Math.round(r.y), 6, Math.round(r.h));
    const y = Math.round(this.shipY);
    ctx.fillRect(26, y - 2, 5, 5);
    ctx.fillRect(23, y - 1, 3, 3);   // the tail, so it reads as pointing right
  }
}

// ── THE SHELF OF RUNNABLE GAMES ────────────────────────────────────────────
// A cartridge with no entry here is still a real object you own and trade — it
// just has no runtime yet, and the Deck says so honestly rather than pretending.
export const GAMES: Partial<Record<CartridgeId, CartridgeFactory>> = {
  orbit_run: () => new OrbitRun(),
};

export const isPlayable = (id: CartridgeId): boolean => !!GAMES[id];
