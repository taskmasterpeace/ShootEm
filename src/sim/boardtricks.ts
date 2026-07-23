// ═══════════════════════════════════════════════════════════════════════════
// THE BOARD — "Tony Hawk meets Halo".
//
// Canon (docs/THREE-GAMES-ONE-WAR.md §"Hoverboard mastery"): *"wall ride ·
// power slide · grind rails · drift · bunny hop · boost jump · reverse · air
// brake · trick off ramps."*
//
// The hoverboard shipped as a hull with `speed: 24` and a drift constant. Nine
// verbs on the sheet, none of them in the game. This is the machine that makes
// them real, and the thing that ties them together is an ECONOMY:
//
//        do something difficult  →  COMBO builds
//        land it clean           →  the combo BANKS into BOOST
//        spend boost             →  more speed → bigger tricks
//        land it badly           →  you BAIL and the combo is gone
//
// That last line is the whole design. Tricks that pay out on take-off are
// free; tricks that only pay when you land them are a game. Everything here
// is pure arithmetic over a state bag — no rng, no time, no DOM — so the
// tests can pin the landing window exactly.
// ═══════════════════════════════════════════════════════════════════════════

export interface TrickState {
  /** 0..100 — the fuel. */
  boost: number;
  /** points earned in the air/on a rail, unbanked and still losable */
  combo: number;
  /** rises as you chain without bailing */
  multiplier: number;
  /** radians turned since leaving the ground */
  spin: number;
  /** seconds off the ground */
  airtime: number;
  /** seconds locked to a rail */
  grindTime: number;
  /** seconds against a wall */
  wallTime: number;
  /** seconds held in a power slide */
  slideTime: number;
  /** what to show the player about the run so far */
  lastTrick: string;
  /** the trick names in this chain, for the readout */
  chain: string[];
  /** true while a bail is playing out — controls are mush */
  bailedUntil: number;
  /** FREESTYLE: everything LANDED since the last bail. Boost is spent and so
   *  cannot be a score; this only ever grows, and a bail takes all of it. */
  runScore: number;
  /** last frame's heading, so a spin is just steering held in the air */
  lastYaw?: number;
}

export function newTrickState(): TrickState {
  return {
    boost: 0, combo: 0, multiplier: 1, spin: 0, airtime: 0,
    grindTime: 0, wallTime: 0, slideTime: 0, lastTrick: '', chain: [], bailedUntil: 0,
    runScore: 0,
  };
}

export const BOOST_MAX = 100;
/** what a full boost is worth on top speed */
export const BOOST_SPEED = 1.55;
/** boost burned per second while held */
export const BOOST_BURN = 34;
/** the alignment a landing needs to be kept. Below this you bail. */
export const LAND_WINDOW = 0.55;
/** combo → boost */
export const BANK_RATE = 0.28;

// ── EARNING ────────────────────────────────────────────────────────────────

/**
 * One airborne tick. `yawDelta` is how far the nose turned this frame, so a
 * spin is just steering held in the air — no trick buttons, which is what
 * keeps the board playable with one thumb.
 */
export function stepAir(t: TrickState, dt: number, yawDelta: number): void {
  t.airtime += dt;
  t.spin += Math.abs(yawDelta);
  // airtime alone is worth something — a big float IS a trick
  t.combo += dt * 26;
}

/** Grinding a rail or a ledge. Steady money, and it holds the chain open. */
export function stepGrind(t: TrickState, dt: number): void {
  t.grindTime += dt;
  t.combo += dt * 42;
}

/** Riding a wall. Pays better than a rail and is harder to hold. */
export function stepWallRide(t: TrickState, dt: number): void {
  t.wallTime += dt;
  t.combo += dt * 55;
}

/**
 * A power slide. `slipAngle` is the radians between where the nose points and
 * where the board is actually travelling — so a lazy drift earns nothing and a
 * full sideways carve earns properly.
 */
export function stepSlide(t: TrickState, dt: number, slipAngle: number, speed01: number): void {
  const bite = Math.min(1, Math.abs(slipAngle) / (Math.PI * 0.42));
  if (bite < 0.25) return;               // that is just a turn, not a slide
  t.slideTime += dt;
  t.combo += dt * 38 * bite * Math.max(0.35, speed01);
}

// ── THE NAME OF THE THING ──────────────────────────────────────────────────

/** Spins are named the way everybody already names them. */
export function spinName(spin: number): string | undefined {
  const deg = (spin * 180) / Math.PI;
  if (deg >= 1080) return '1080';
  if (deg >= 900) return '900';
  if (deg >= 720) return '720';
  if (deg >= 540) return '540';
  if (deg >= 360) return '360';
  if (deg >= 180) return '180';
  return undefined;
}

/** What the run that just ended should be called. */
export function trickName(t: TrickState): string {
  const parts: string[] = [];
  const spin = spinName(t.spin);
  if (spin) parts.push(spin);
  if (t.wallTime > 0.25) parts.push('WALL RIDE');
  if (t.grindTime > 0.25) parts.push('GRIND');
  if (t.slideTime > 0.4) parts.push('POWER SLIDE');
  if (!parts.length && t.airtime > 0.6) parts.push('AIR');
  return parts.join(' + ');
}

// ── LANDING: where it is won or lost ───────────────────────────────────────

export interface Landing {
  /** did the run survive the landing */
  landed: boolean;
  /** points banked (0 on a bail) */
  banked: number;
  /** boost gained */
  boost: number;
  /** what to announce */
  name: string;
  /** the multiplier AFTER this landing */
  multiplier: number;
}

/**
 * Come down.
 *
 * `alignment` is 0..1: how well the board's nose agrees with where it is
 * actually going at the moment of touchdown (1 = dead straight, 0 = fully
 * sideways). Land inside the window and the whole combo banks and the
 * multiplier climbs; miss it and you eat it and the combo is gone.
 *
 * A landing with nothing to bank is not a bail — stepping off a kerb should
 * never punish anybody.
 */
export function land(t: TrickState, alignment: number, now: number): Landing {
  const had = t.combo;
  const name = trickName(t);
  const clean = alignment >= LAND_WINDOW;

  if (had < 1) { resetRun(t); return { landed: true, banked: 0, boost: 0, name: '', multiplier: t.multiplier }; }

  if (!clean) {
    // BAILED. The combo is gone and the board is mush for a beat.
    t.combo = 0;
    t.multiplier = 1;
    t.bailedUntil = now + 0.9;
    t.lastTrick = 'BAILED';
    t.chain = [];
    t.runScore = 0;   // FREESTYLE: the run dies with the landing
    resetRun(t);
    return { landed: false, banked: 0, boost: 0, name: 'BAILED', multiplier: 1 };
  }

  // a cleaner landing than the window pays a little better
  const quality = 0.85 + 0.15 * ((alignment - LAND_WINDOW) / (1 - LAND_WINDOW));
  const banked = Math.round(had * t.multiplier * quality);
  const gained = Math.min(BOOST_MAX - t.boost, banked * BANK_RATE);
  t.boost = Math.min(BOOST_MAX, t.boost + gained);
  t.runScore += banked;   // FREESTYLE: the run grows with every clean landing
  t.multiplier = Math.min(6, t.multiplier + 1);
  if (name) { t.lastTrick = name; t.chain.push(name); }
  resetRun(t);
  return { landed: true, banked, boost: gained, name, multiplier: t.multiplier };
}

/** Clear the per-run counters, keep boost/multiplier/chain. */
function resetRun(t: TrickState): void {
  t.combo = 0; t.spin = 0; t.airtime = 0; t.grindTime = 0; t.wallTime = 0; t.slideTime = 0;
}

/** Touching down and rolling normally for a while ends the chain. */
export function coolChain(t: TrickState, dt: number): void {
  t.multiplier = Math.max(1, t.multiplier - dt * 0.55);
  if (t.multiplier <= 1.01 && t.chain.length) t.chain = [];
}

// ── SPENDING ───────────────────────────────────────────────────────────────

/** Burn boost. Returns the speed multiplier to apply this tick. */
export function spendBoost(t: TrickState, dt: number, wanted: boolean): number {
  if (!wanted || t.boost <= 0) return 1;
  t.boost = Math.max(0, t.boost - BOOST_BURN * dt);
  return BOOST_SPEED;
}

/**
 * THE BOOST JUMP. A charged launch that costs boost — the way you reach the
 * roof you could not otherwise reach. Returns the upward velocity, or 0 when
 * there is not enough in the tank.
 */
export const BOOST_JUMP_COST = 28;
export function boostJump(t: TrickState, charge01: number): number {
  if (t.boost < BOOST_JUMP_COST) return 0;
  t.boost -= BOOST_JUMP_COST;
  return 7 + 6 * Math.max(0, Math.min(1, charge01));
}

/** The plain hop — free, small, and the door to everything else. */
export const HOP_VELOCITY = 5.2;

/** The air brake: kills horizontal drift so a bad line can still be saved. */
export const AIR_BRAKE_DRAG = 2.6;
