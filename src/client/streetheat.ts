// ═══════════════════════════════════════════════════════════════════════════
// STREET HEAT — the street's temper, GTA2's wanted level made neighbourly.
//
// Robert: *"create vigilante and pedestrian audio. think gta2."* In GTA2 the
// city keeps score of your mayhem and turns on you by degrees. Here the street
// does the same: commit violence near civilians — fire your gun on their
// corner, nearly run them down, get one of them killed — and a temper rises.
// Cross a line and the nearest bystander stops being a bystander: it CHALLENGES
// you, then WARNS you, then (still climbing) says it will fight — the vigilante.
// Behave, and the temper cools and the street forgets.
//
// This is a PURE state machine — no DOM, no world, no rng, no clock. streetvoice
// feeds it provocations and ticks it; it answers with the line to shout, if any.
// Pure so it can be unit-tested and so it can never perturb the sim (the whole
// street layer is client-side, read-only).
// ═══════════════════════════════════════════════════════════════════════════

/** 0 calm · 1 challenged · 2 warned · 3 swinging. */
export type HeatStage = 0 | 1 | 2 | 3;

export type VigilanteCry = 'challenge' | 'warn' | 'engage';

export interface HeatConfig {
  /** how fast the temper cools when you stop offending (heat/second) */
  decayPerSec: number;
  /** the temper at which the street challenges / warns / swings */
  challengeAt: number;
  warnAt: number;
  engageAt: number;
  /** provocation weights — how much each kind of mayhem stokes the temper */
  shotNearby: number;   // you fired your weapon on a civilian street
  nearMiss: number;     // you nearly ran someone down
  casualty: number;     // a civilian died in your mayhem
}

export const DEFAULT_HEAT: HeatConfig = {
  decayPerSec: 0.14,
  challengeAt: 0.5,
  warnAt: 0.85,
  engageAt: 1.25,
  shotNearby: 0.05,
  nearMiss: 0.22,
  casualty: 0.7,
};

/** The stage a given temper sits at. */
function stageFor(heat: number, c: HeatConfig): HeatStage {
  if (heat >= c.engageAt) return 3;
  if (heat >= c.warnAt) return 2;
  if (heat >= c.challengeAt) return 1;
  return 0;
}

const CRY: Record<Exclude<HeatStage, 0>, VigilanteCry> = { 1: 'challenge', 2: 'warn', 3: 'engage' };

export class StreetHeat {
  heat = 0;
  stage: HeatStage = 0;
  private cfg: HeatConfig;

  constructor(cfg: HeatConfig = DEFAULT_HEAT) { this.cfg = cfg; }

  /** Mayhem near civilians raises the temper. Silent — it only accumulates;
   *  the SPEAKING happens on the threshold cross in `tick`. */
  provoke(amount: number): void {
    this.heat = Math.min(2, this.heat + Math.max(0, amount));
  }

  provokeShot(): void { this.provoke(this.cfg.shotNearby); }
  provokeNearMiss(): void { this.provoke(this.cfg.nearMiss); }
  provokeCasualty(): void { this.provoke(this.cfg.casualty); }

  /**
   * Advance time: the temper cools. If crossing a NEW hostility line upward,
   * return the cry the street should shout (challenge/warn/engage); else null.
   * The stage also relaxes as the temper falls, so a later spree re-escalates.
   */
  tick(dt: number): VigilanteCry | null {
    this.heat = Math.max(0, this.heat - this.cfg.decayPerSec * Math.max(0, dt));
    const target = stageFor(this.heat, this.cfg);
    if (target > this.stage) {
      this.stage = target;
      return CRY[this.stage as Exclude<HeatStage, 0>];
    }
    if (target < this.stage) this.stage = target; // cool off, ready to re-anger
    return null;
  }

  /** Is the street hostile enough to gloat if you go down right now? */
  get hostile(): boolean { return this.stage >= 1; }
}
