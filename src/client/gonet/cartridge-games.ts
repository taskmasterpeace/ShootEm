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

/** Every cabinet gets its own noise — never the match rng, so nobody playing a
 *  game on their bunk can disturb a replay of the war. */
class Noise {
  constructor(private seed = 1) {}
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

// ── DEEP SHAFT (Kuchler Home, 2201) ────────────────────────────────────────
// "Dig down. Something down there is digging up."
//
// The blurb is the design, and it took a failing test to see it. The first cut
// had the thing chasing you from ABOVE, so digging hard was pure defence — and
// measured, an idle drill and a hammered one scored *exactly the same*, because
// the outcome never depended on the player at all.
//
// Read the box again: it is BELOW YOU AND COMING UP. So every metre of score is
// a metre closer to the thing that ends the run. The meeting is not avoidable
// and is not supposed to be — the only question a miner gets is HOW FAST, and
// the answer costs him, because at speed the seams arrive quicker than he can
// read them. Push-your-luck, in a shaft.

interface Seam { y: number; x: number; w: number }

class DeepShaft implements CartridgeGame {
  score = 0;
  over = false;
  readonly hint = '← → STEER · ↓ DIG HARDER';

  private drillX = SCREEN_W / 2;
  private depth = 0;          // metres, and the score
  private seams: Seam[] = [];
  private nextSeamAt = 30;
  /** it started deep and it is coming up. You will meet. */
  private riser = 340;
  private t = 0;
  private rnd = new Noise(7);

  step(dt: number, input: GameInput): void {
    if (this.over) return;
    this.t += dt;

    // DOWN leans on the drill: more metres per second, and less time to read
    // the seam that is already coming at you
    const hard = input.down;
    this.depth += (hard ? 30 : 16) * dt;
    this.score = Math.floor(this.depth);

    // it rises at its own pace and does not care how you are getting on
    this.riser -= 9 * dt;
    if (this.depth >= this.riser) this.over = true;   // you met it

    const move = 58 * dt;
    if (input.left) this.drillX -= move;
    if (input.right) this.drillX += move;
    this.drillX = Math.max(4, Math.min(SCREEN_W - 4, this.drillX));

    // lay seams ahead of the drill, measured in metres not pixels
    while (this.depth + 120 > this.nextSeamAt) {
      const w = 28 + this.rnd.next() * Math.min(70, 26 + this.t * 1.6);
      this.seams.push({ y: this.nextSeamAt, x: this.rnd.next() * (SCREEN_W - w), w });
      this.nextSeamAt += 26 + this.rnd.next() * 16;
    }
    this.seams = this.seams.filter((sm) => sm.y > this.depth - 40);

    for (const sm of this.seams) {
      if (Math.abs(sm.y - this.depth) < 1.4
        && this.drillX + 2 > sm.x && this.drillX - 2 < sm.x + sm.w) this.over = true;
    }
  }

  /** metres → screen row, with the drill pinned a third of the way down */
  private row(metres: number): number { return SCREEN_H / 3 + (metres - this.depth) * 1.5; }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const sm of this.seams) {
      const y = this.row(sm.y);
      if (y < -4 || y > SCREEN_H + 4) continue;
      ctx.fillRect(Math.round(sm.x), Math.round(y), Math.round(sm.w), 4);
    }
    // the thing below: a bar rising up the shaft at you. Only drawn once it is
    // actually on the screen — it spends most of the run far below.
    const cy = this.row(this.riser);
    if (cy > 4 && cy < SCREEN_H - 1) {
      const barY = Math.round(cy);
      ctx.fillRect(0, barY, SCREEN_W, 3);
      for (let x = 2; x < SCREEN_W; x += 12) ctx.fillRect(x, barY - 3, 3, 3);
    }
    const dx = Math.round(this.drillX);
    const dy = Math.round(SCREEN_H / 3);
    ctx.fillRect(dx - 3, dy - 4, 6, 6);
    ctx.fillRect(dx - 1, dy + 2, 2, 4);   // the bit, pointing down
  }
}

// ── HARVEST 88 (Green March Software, 2188) ────────────────────────────────
// "Four seasons a year. Bring the crop in before the frost."
//
// A farming game with a clock in it. Crops ripen on their own schedule and go
// over if you leave them; the frost line walks down the field and takes
// whatever it touches. The tension is entirely about ROUTE — you can always see
// more ripe crop than you have time to reach.

interface Crop { x: number; y: number; ripe: number }  // <0 growing · 1..4 ready · then over

class Harvest88 implements CartridgeGame {
  score = 0;
  over = false;
  readonly hint = '← ↑ → ↓ DRIVE · BRING IT IN';

  private hx = SCREEN_W / 2;
  private hy = SCREEN_H / 2;
  private crops: Crop[] = [];
  private frost = -10;
  private season = 0;
  private rnd = new Noise(88);

  constructor() { for (let i = 0; i < 20; i++) this.plant(); }

  private plant(): void {
    this.crops.push({
      x: 8 + this.rnd.next() * (SCREEN_W - 16),
      y: 14 + this.rnd.next() * (SCREEN_H - 22),
      ripe: -this.rnd.next() * 4,
    });
  }

  step(dt: number, input: GameInput): void {
    if (this.over) return;

    const move = 54 * dt;
    if (input.left) this.hx -= move;
    if (input.right) this.hx += move;
    if (input.up) this.hy -= move;
    if (input.down) this.hy += move;
    this.hx = Math.max(3, Math.min(SCREEN_W - 3, this.hx));
    this.hy = Math.max(11, Math.min(SCREEN_H - 3, this.hy));

    // FOUR SEASONS A YEAR: the frost walks the field, the year turns over, and
    // it comes back sooner. Eight seasons and the farm is finished.
    this.frost += (7 + this.season * 1.7) * dt;
    if (this.frost > SCREEN_H) {
      this.frost = -8;
      this.season++;
      if (this.season >= 8) { this.over = true; return; }
      for (let i = 0; i < 6; i++) this.plant();
    }

    for (const c of this.crops) {
      c.ripe += dt * 0.42;
      if (c.y < this.frost) c.ripe = -99;          // frost takes it, ripe or not
      // THE HEADER IS WIDE. Measured at a 4px square pickup this played at ~4
      // tonnes a run — you drove over the crop and it stayed in the ground.
      // A combine cuts a swathe wider than itself; that is the machine.
      if (c.ripe >= 1 && c.ripe < 4
        && Math.abs(c.x - this.hx) < 7 && Math.abs(c.y - this.hy) < 4.5) {
        this.score += Math.max(1, Math.round(3 - (c.ripe - 1)));  // fresher pays better
        c.ripe = -99;
      }
    }
    this.crops = this.crops.filter((c) => c.ripe > -50 && c.ripe < 6);
    while (this.crops.length < 16) this.plant();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const c of this.crops) {
      if (c.ripe < 0) continue;
      const x = Math.round(c.x), y = Math.round(c.y);
      if (c.ripe < 1) ctx.fillRect(x, y + 2, 1, 2);                                      // a shoot
      else if (c.ripe < 4) { ctx.fillRect(x - 1, y, 3, 4); ctx.fillRect(x, y - 2, 1, 2); } // ready
      else ctx.fillRect(x - 1, y + 3, 3, 1);                                             // gone over
    }
    const f = Math.round(this.frost);
    if (f > 0 && f < SCREEN_H) for (let x = 0; x < SCREEN_W; x += 4) ctx.fillRect(x, f, 2, 1);
    for (let i = 0; i < 8; i++) ctx.fillRect(4 + i * 5, 5, i <= this.season ? 4 : 1, 3);
    const hx = Math.round(this.hx), hy = Math.round(this.hy);
    ctx.fillRect(hx - 3, hy - 2, 7, 5);
    ctx.fillRect(hx + 3, hy - 3, 2, 2);
  }
}

// ── SIEGE TOWER (Maklov Amusements, 2199) ──────────────────────────────────
// "Stack it higher. It is going to fall. Stack it higher."
//
// The stacker. The course sweeps, you drop it, the overhang is sheared off and
// gone forever. Nothing here is random — every floor you lose, you lost.

class SiegeTower implements CartridgeGame {
  score = 0;
  over = false;
  readonly hint = 'FIRE TO DROP';

  private w = 46;
  private x = (SCREEN_W - 46) / 2;
  private dir = 1;
  private speed = 46;
  private prevX = (SCREEN_W - 46) / 2;
  private prevW = 46;
  private floors: { x: number; w: number }[] = [{ x: (SCREEN_W - 46) / 2, w: 46 }];
  private wasFire = false;

  step(dt: number, input: GameInput): void {
    if (this.over) return;
    this.x += this.dir * this.speed * dt;
    if (this.x <= 0) { this.x = 0; this.dir = 1; }
    if (this.x + this.w >= SCREEN_W) { this.x = SCREEN_W - this.w; this.dir = -1; }

    // RISING EDGE ONLY — holding the button must not machine-gun the tower
    const fire = input.fire && !this.wasFire;
    this.wasFire = input.fire;
    if (!fire) return;

    const left = Math.max(this.x, this.prevX);
    const right = Math.min(this.x + this.w, this.prevX + this.prevW);
    const overlap = right - left;
    if (overlap <= 1) { this.over = true; return; }   // missed the tower entirely

    this.w = overlap;          // the overhang is sheared off and gone
    this.x = left;
    this.prevX = left;
    this.prevW = overlap;
    this.floors.push({ x: left, w: overlap });
    this.score++;
    this.speed = Math.min(120, this.speed + 3.4);
    if (this.w < 4) this.over = true;                 // nothing left to build on
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // the tower grows DOWN from the drop line, so the top is always in view
    const drop = 18;
    const n = this.floors.length;
    for (let i = 0; i < n; i++) {
      const f = this.floors[n - 1 - i];
      const y = drop + i * 5;
      if (y > SCREEN_H) break;
      ctx.fillRect(Math.round(f.x), y, Math.round(f.w), 4);
    }
    ctx.fillRect(Math.round(this.x), drop - 9, Math.round(this.w), 4);
  }
}

// ── NIGHTWATCH (Odessa Grey Interactive, 2207) ─────────────────────────────
// "You have one torch and eight hours. Do not look behind you twice."
//
// The rare one, and the only cartridge on the shelf that is not about reflexes.
// You hold the torch on ONE of four sides. What the beam is on backs off; what
// it is not on comes closer. The title IS the mechanic: whatever you just
// turned away from is the thing that moved.

const NW_DIRS: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

class Nightwatch implements CartridgeGame {
  score = 0;
  over = false;
  readonly hint = '← ↑ → ↓ SWING THE TORCH';

  /** how close each of the four sides has crept: 0 far … 1 on you */
  private near = [0.1, 0.1, 0.1, 0.1];
  private facing = 0;         // 0 up · 1 right · 2 down · 3 left
  private hours = 0;
  private rnd = new Noise(2207);

  step(dt: number, input: GameInput): void {
    if (this.over) return;
    if (input.up) this.facing = 0;
    if (input.right) this.facing = 1;
    if (input.down) this.facing = 2;
    if (input.left) this.facing = 3;

    // one shift is eight hours; surviving it IS the win, and the score
    this.hours += dt * 0.55;
    this.score = Math.min(8, Math.floor(this.hours));
    if (this.hours >= 8) { this.over = true; return; }

    for (let i = 0; i < 4; i++) {
      if (i === this.facing) {
        this.near[i] = Math.max(0, this.near[i] - 0.55 * dt);   // the light pushes it back
      } else {
        // the dark gains, and gains faster as the night wears on
        this.near[i] += (0.055 + this.hours * 0.019 + this.rnd.next() * 0.03) * dt;
        if (this.near[i] >= 1) this.over = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const cx = SCREEN_W / 2, cy = SCREEN_H / 2 + 4;
    ctx.fillRect(cx - 2, cy - 2, 5, 5);              // you
    // the beam: a widening wedge on the side you are holding
    const b = NW_DIRS[this.facing];
    for (let d = 4; d < 34; d += 3) {
      const w = 2 + d * 0.42;
      ctx.fillRect(
        Math.round(cx + b[0] * d - (b[0] ? 1 : w / 2)),
        Math.round(cy + b[1] * d - (b[1] ? 1 : w / 2)),
        Math.round(b[0] ? 2 : w), Math.round(b[1] ? 2 : w),
      );
    }
    // what is out there, drawn at the distance it has closed to
    for (let i = 0; i < 4; i++) {
      const v = NW_DIRS[i];
      const d = 44 - this.near[i] * 34;
      const s = 3 + this.near[i] * 5;
      ctx.fillRect(Math.round(cx + v[0] * d - s / 2), Math.round(cy + v[1] * d - s / 2),
        Math.round(s), Math.round(s));
    }
    for (let h = 0; h < 8; h++) ctx.fillRect(4 + h * 6, 4, h < this.hours ? 5 : 1, 3);
  }
}

// ── THE SHELF OF RUNNABLE GAMES ────────────────────────────────────────────
// Every cartridge on the shelf now RUNS. `isPlayable` stays because the shelf
// is meant to grow: a cartridge with no entry here is still a real object you
// own and trade, and the Deck says so honestly rather than pretending.
export const GAMES: Partial<Record<CartridgeId, CartridgeFactory>> = {
  orbit_run: () => new OrbitRun(),
  deep_shaft: () => new DeepShaft(),
  harvest_88: () => new Harvest88(),
  siege_tower: () => new SiegeTower(),
  nightwatch: () => new Nightwatch(),
};

export const isPlayable = (id: CartridgeId): boolean => !!GAMES[id];
