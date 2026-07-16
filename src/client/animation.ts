import type * as THREE from 'three';
import type { SoldierKind } from '../sim/types';

// ---------------------------------------------------------------------------
// Shared soldier posing. The in-game renderer AND the model harness both call
// poseSoldierJoints, so the walk cycle and the undead reach are defined once —
// fix a pose here and it lands in the game and the debug tool together.
// ---------------------------------------------------------------------------

export type Joints = Record<string, THREE.Object3D | undefined>;

/** The named joints the animator drives. Cache these once per mesh. */
export const JOINT_NAMES = [
  'legL', 'legR', 'shinL', 'shinR', 'armL', 'armR', 'head', 'torso', 'gun', 'belly',
  'legFL', 'legFR', 'legRL', 'legRR', 'tail', // the K9's quadruped set
] as const;

/** The undead kinds that shamble and reach (everything that isn't a person). */
export function isUndead(kind: SoldierKind): boolean {
  return kind !== 'human' && kind !== 'bot' && kind !== 'scientist' && kind !== 'dog';
}

/**
 * Resting shoulder angle (local rotation.z) for a zombie arm.
 *
 * The soldier root faces +X (yaw 0) and every limb hangs DOWN from its joint
 * (−Y). Rotating a down-pointing limb about +Z by a POSITIVE angle swings its
 * far end toward +X — i.e. FORWARD, out in front of the body where the prey is.
 * A negative angle throws the arms behind the back, which is the bug this
 * replaced: zombies used to reach backwards. Keep these positive.
 *
 * `isLeft` is the armL side, posed a touch higher than armR so the reach reads
 * as a lurching, asymmetric grab rather than a symmetric zombie salute.
 */
export function zombieArmRest(kind: SoldierKind, isLeft: boolean): number {
  if (kind === 'sprinter') return isLeft ? 1.7 : 1.5; // lunging — arms thrown out ahead
  return isLeft ? 1.5 : 1.2;
}

/** The zombie reach sways at this fraction of the gait rate — the growl marker rides its crest. */
export const REACH_SWAY_RATE = 0.55;

/**
 * Continuous gait accumulator. Absolute-time phase (t × rate) is fine for
 * posing, but rate depends on speed — so any speed change (cloak, armor,
 * strafing jitter) multiplied by elapsed time teleports the phase, and
 * anything keyed to phase crossings (footsteps) fires spuriously. Callers
 * that want animation MARKERS pass one of these per body; phase then
 * integrates rate×dt and survives speed changes and render-world swaps.
 */
export interface GaitState {
  phase?: number;
  swayPhase?: number;
}

export interface GaitInput {
  kind: SoldierKind;
  /** world/sim time in seconds */
  time: number;
  /** entity id — decorrelates the gait phase between bodies */
  id: number;
  /** horizontal ground speed, units/s */
  speed: number;
  /** true when off the ground (jetpack tuck) */
  airborne: boolean;
  /** frame delta — required for continuous phase + markers */
  dt?: number;
  /** persistent per-body accumulator — required for markers */
  state?: GaitState;
}

export interface GaitPose {
  /** the gait phase this frame — the caller reuses it for body bob */
  phase: number;
  moving: boolean;
  /** a boot hit the ground this frame (sin(phase) zero-crossing while moving) */
  footstep: boolean;
  /** an undead reach-sway cycle crested this frame — growl cue */
  growl: boolean;
}

/**
 * Pose a soldier's limb joints for one frame of the alive gait (and, for the
 * undead, the reaching arms / lolling head / breathing belly). Mutates only the
 * joint rotations and scale — the caller still owns the mesh-root transform
 * (bob + lean) and any weapon recoil, which need renderer-only state.
 */
export function poseSoldierJoints(j: Joints, inp: GaitInput): GaitPose {
  const { time: t, id, speed, airborne, kind, dt, state } = inp;
  const zed = isUndead(kind);
  const moving = speed > 0.6;

  if (kind === 'dog') {
    // K9 trot: diagonal pairs (FL+RR vs FR+RL) swing in anti-phase, driven by
    // ground speed. The tail keeps its own metronome — quick when working,
    // lazy at heel — and the head drops into the run like it means it.
    const phase = t * (4 + speed * 0.9) + (id % 9) * 0.77;
    const stride = moving ? 0.55 * Math.min(1, speed / 8 + 0.3) : 0;
    const swing = Math.sin(phase) * stride;
    if (j.legFL) j.legFL.rotation.z = swing;
    if (j.legRR) j.legRR.rotation.z = swing;
    if (j.legFR) j.legFR.rotation.z = -swing;
    if (j.legRL) j.legRL.rotation.z = -swing;
    if (j.tail) j.tail.rotation.x = Math.sin(t * (moving ? 9 : 3) + id) * 0.35;
    if (j.head) j.head.rotation.z = moving ? -0.12 : Math.sin(t * 1.5 + id) * 0.08;
    // paws are quiet — no footstep cue, and dogs don't growl (they bark on events)
    return { phase, moving, footstep: false, growl: false };
  }

  const gaitRate = zed
    ? kind === 'sprinter' ? 15 : kind === 'brute' ? 4.5 : 6
    : 5.5 + speed * 0.75;

  // phase: integrated when the caller keeps state (markers), absolute otherwise
  let phase: number;
  let footstep = false;
  let growl = false;
  if (state && dt !== undefined) {
    const seeded = state.phase !== undefined;
    const prev = state.phase ?? t * gaitRate + (id % 9) * 0.77;
    phase = prev + (seeded ? gaitRate * dt : 0);
    state.phase = phase;
    // footfalls land on the half-cycles of the leg swing
    footstep = seeded && moving && !airborne &&
      Math.floor(phase / Math.PI) !== Math.floor(prev / Math.PI);
    if (zed) {
      const sPrev = state.swayPhase ?? phase * REACH_SWAY_RATE;
      const sway = sPrev + (seeded ? gaitRate * REACH_SWAY_RATE * dt : 0);
      state.swayPhase = sway;
      growl = seeded &&
        Math.floor(sway / (Math.PI * 2)) !== Math.floor(sPrev / (Math.PI * 2));
    }
  } else {
    phase = t * gaitRate + (id % 9) * 0.77;
  }
  const stride = moving
    ? (kind === 'brute' ? 0.75 : kind === 'sprinter' ? 0.9 : 0.55) * Math.min(1, speed / 5 + 0.35)
    : 0;
  const swing = Math.sin(phase) * stride;

  if (j.legL && j.legR && j.shinL && j.shinR) {
    if (airborne) {
      // jetpack tuck
      j.legL.rotation.z = 0.55;
      j.legR.rotation.z = 0.3;
      j.shinL.rotation.z = -0.9;
      j.shinR.rotation.z = -0.7;
    } else {
      j.legL.rotation.z = swing;
      j.legR.rotation.z = -swing;
      j.shinL.rotation.z = stride ? -Math.max(0, Math.sin(phase + 0.5)) : 0;
      j.shinR.rotation.z = stride ? -Math.max(0, -Math.sin(phase + 0.5)) : 0;
    }
  }

  if (zed) {
    // undead: reaching arms sway forward, head lolls, brutes lumber, bellies pulse
    const sway = kind === 'brute' ? 0.35 : 0.16;
    if (j.armL) j.armL.rotation.z = zombieArmRest(kind, true) + Math.sin(phase * REACH_SWAY_RATE) * sway;
    if (j.armR) j.armR.rotation.z = zombieArmRest(kind, false) + Math.cos(phase * 0.5) * sway;
    if (j.head) j.head.rotation.z = Math.sin(phase * 0.45) * 0.12;
    if (j.torso) j.torso.rotation.x = Math.sin(phase * 0.5) * (kind === 'brute' ? 0.1 : 0.07);
    if (j.belly) j.belly.scale.setScalar(1 + Math.sin(t * 6) * 0.06);
  }

  return { phase, moving, footstep, growl };
}
