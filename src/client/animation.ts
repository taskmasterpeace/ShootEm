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
  'elbowL', 'elbowR', // W6.2: the forearm pivots — strikes and holds bend here
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

// ---------------------------------------------------------------------------
// THE HOLD LIBRARY (feel pass #2) — additive arm/gun offsets per weapon
// family, applied by the renderer over the solved grip. The silhouette says
// what's in the hands before the tracer does.
// ---------------------------------------------------------------------------
export interface HoldDef {
  /** additive z-swing on each arm (radians) */
  armL: number; armR: number;
  /** additive gun offsets (units / radians) */
  gunY: number; gunZ: number; gunRotZ: number;
  /** extra torso pitch for heavy braced carries */
  torsoX?: number;
  /** unarmed — the gun hides and the arms swing free */
  hideGun?: boolean;
}

export const WEAPON_HOLDS: Record<string, HoldDef> = {
  rifle: { armL: 0, armR: 0, gunY: 0, gunZ: 0, gunRotZ: 0 },          // the solved shoulder carry
  carbine: { armL: 0, armR: 0, gunY: 0, gunZ: 0, gunRotZ: 0 },
  pistol: { armL: 1.35, armR: 1.35, gunY: 0.12, gunZ: 0, gunRotZ: 0 }, // isosceles, eye line
  shotgun: { armL: 0.3, armR: 0.1, gunY: -0.05, gunZ: 0, gunRotZ: -0.06 }, // low and level
  slugger: { armL: 0.1, armR: 0, gunY: -0.08, gunZ: 0, gunRotZ: -0.04 },   // long low-ready
  laser: { armL: -0.1, armR: -0.15, gunY: -0.22, gunZ: 0.04, gunRotZ: 0, torsoX: -0.07 }, // hip-braced, leaned back
  lmg: { armL: -0.1, armR: -0.15, gunY: -0.22, gunZ: 0.04, gunRotZ: 0, torsoX: -0.07 },
  hmg: { armL: -0.1, armR: -0.15, gunY: -0.22, gunZ: 0.04, gunRotZ: 0, torsoX: -0.07 },
  at_rocket: { armL: 0.2, armR: 0.35, gunY: 0.24, gunZ: -0.1, gunRotZ: 0.1 },  // shouldered
  ap_rocket: { armL: 0.2, armR: 0.35, gunY: 0.24, gunZ: -0.1, gunRotZ: 0.1 },
  mortar: { armL: 0.2, armR: 0.35, gunY: 0.24, gunZ: -0.1, gunRotZ: 0.1 },
  grenade: { armL: 0.15, armR: 0.3, gunY: -0.06, gunZ: 0, gunRotZ: -0.03 }, // lobber's cradle
  melee: { armL: 0, armR: 0, gunY: 0, gunZ: 0, gunRotZ: 0, hideGun: true },
  melee_weapon: { armL: 0.45, armR: 0.65, gunY: 0.08, gunZ: 0, gunRotZ: 0.6 },
  special: { armL: 0, armR: 0, gunY: 0, gunZ: 0, gunRotZ: 0 },
};

/** recoil personality per family (feel pass #4): kick multiplier, recovery
 *  window, and muzzle flip — a slugger's whole torso shoves for 0.35s, an
 *  SMG barely shrugs. */
export const RECOIL_SCALE: Record<string, { kick: number; recover: number; flip: number }> = {
  rifle: { kick: 1, recover: 0.09, flip: 0 },
  carbine: { kick: 0.9, recover: 0.09, flip: 0 },
  pistol: { kick: 1.2, recover: 0.1, flip: 0.35 },
  shotgun: { kick: 2.2, recover: 0.16, flip: 0.2 },
  slugger: { kick: 2.6, recover: 0.35, flip: 0.1 },
  laser: { kick: 0.5, recover: 0.06, flip: 0 },
  smg: { kick: 0.6, recover: 0.05, flip: 0.06 },
  melee: { kick: 0, recover: 0.1, flip: 0 },
  melee_weapon: { kick: 0, recover: 0.1, flip: 0 },
  lmg: { kick: 1.4, recover: 0.12, flip: 0.04 },
  hmg: { kick: 1.6, recover: 0.14, flip: 0.05 },
  at_rocket: { kick: 2.0, recover: 0.3, flip: 0.15 },
  ap_rocket: { kick: 2.0, recover: 0.3, flip: 0.15 },
  mortar: { kick: 2.4, recover: 0.35, flip: 0.1 },
  grenade: { kick: 0.4, recover: 0.08, flip: 0 },
};

/** THE POWER-CAST SCHOOLS (feel pass #6): how a god throws a signature.
 *  SLAM — both arms overhead, driven down. THRUST — both arms punched
 *  forward (the default). CHANNEL — one arm held out, sustained. The last
 *  four are the LSW-embodiment attack poses (attackPose lower-cased):
 *  LOB — overhand hurl. BRACE — cheek-weld + recoil. SHOULDER — launcher
 *  shouldered. FLICK — fast low-tell snap. */
export type CastSchool = 'slam' | 'thrust' | 'channel' | 'lob' | 'brace' | 'shoulder' | 'flick';
export const CAST_SCHOOL: Record<string, CastSchool> = {
  titan: 'slam', crusher: 'slam', tremor: 'slam', ragebeast: 'slam',
  leviathan: 'slam', cataclysm: 'slam', gargoyle: 'slam', vanguard: 'slam',
  frostbite: 'channel', reactor: 'channel', crimson: 'channel', magnetar: 'channel',
  eclipse: 'channel', chronos: 'channel', wraith: 'channel', dominator: 'channel',
  // everyone else punches forward: voltstriker, overload, pulse, oblivion,
  // riptide, gravwarden, stormcaller, and every blink-walker at the departure
};

// ---------------------------------------------------------------------------
// THE FEEL-PASS MATH — the renderer and the harness share these, so the
// game and the workbench tell the same truth (and the laws can test them).
// ---------------------------------------------------------------------------

/** THE TURN's yaw spring (feel pass #1): exponential approach to the aim
 *  yaw — fast while moving, measured at rest. Returns the residual diff so
 *  the caller can make the head LEAD the body. Never teleports; settles in
 *  a third of a second at a hard flip. */
export function stepYawSpring(state: { v: number }, targetYaw: number, dt: number, moving: boolean): number {
  const diff = Math.atan2(Math.sin(targetYaw - state.v), Math.cos(targetYaw - state.v));
  state.v += diff * Math.min(1, dt * (moving ? 11 : 7));
  return diff;
}

/** THE GRENADE THROW's right-arm curve (feel pass #3): wind back, whip
 *  through with overshoot, settle to rest. k = 0..1 through the motion. */
export function throwArmCurve(k: number): number {
  if (k < 0.44) return -0.9 * (k / 0.44);
  if (k < 0.77) {
    const w = (k - 0.44) / 0.33;
    const back = 1 + 2.70158 * (w - 1) ** 3 + 1.70158 * (w - 1) ** 2; // easeOutBack
    return -0.9 + 3.2 * back;
  }
  return 2.3 * (1 - (k - 0.77) / 0.23);
}

/** FLIGHT STYLES (feel pass #5): each flier's air silhouette. */
export const FLIGHT_POSES: Record<string, { pitch: number; armZ: number; armX: number; headZ: number }> = {
  inferno: { pitch: -1.25, armZ: 2.7, armX: 0, headZ: 0.35 },     // SUPERMAN
  stormcaller: { pitch: -0.7, armZ: -0.5, armX: 0, headZ: 0.2 },  // GOKU
  gargoyle: { pitch: -0.9, armZ: -1.1, armX: 0.9, headZ: 0.15 },  // folded wings
  gargoyle_dive: { pitch: -1.4, armZ: -1.1, armX: 0.9, headZ: 0.15 }, // the shriek's dive
};

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

  // THE ZED CADENCE TRACKS THE GROUND (Robert: "refine zombies — they should
  // look like they are running"). The old rate was a CONSTANT: a plain
  // zombie charges at 8.5 u/s but took the same lazy six-beat as one
  // shambling at 2 — legs skating under a body the world was dragging
  // forward. Nobody read that as running, because it wasn't. Now the rate
  // rides speed like the living do; each kind keeps its own idle character
  // (a brute lumbers, a sprinter is a blur) and earns the rest by moving.
  const gaitRate = zed
    ? (kind === 'sprinter' ? 6 : kind === 'brute' ? 2.6 : 3.4) + speed * 0.72
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

  // THE WEIGHTED SWING (Robert: "really running"). A raw sin(phase) spends
  // equal time in the air and on the ground, so feet read as swinging
  // pendulums. The phase warp accelerates the swing-THROUGH and dwells on
  // the plant — feet hurry forward and arrive with weight. Speed scales it:
  // a jog is honest, a sprint means it.
  const runDrive = Math.min(1, speed / 9);
  const warp = phase + 0.28 * runDrive * Math.sin(phase);
  const swing = Math.sin(warp) * stride;

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
      // knees: a real knee LIFTS through the swing and is nearly straight by
      // the plant, with a small yield as the stance takes the weight. The
      // lift leads the leg's forward extreme, so the boot reaches the ground
      // toes-first instead of shin-first.
      const knee = (p: number) => {
        const lift = Math.max(0, Math.sin(p + 0.85));    // recovery — boot comes up
        const stance = Math.max(0, -Math.sin(p));         // planted — the yield
        return stride * (lift * 0.95 + stance * 0.14);
      };
      j.shinL.rotation.z = -knee(warp);
      j.shinR.rotation.z = -knee(warp + Math.PI);
    }
  }

  if (zed) {
    // undead: reaching arms sway forward, head lolls, brutes lumber, bellies
    // pulse — but a CHARGING zed drives with its arms. The reach opens up
    // and the sway doubles once it's really moving, so a sprinter reads as a
    // sprint and a shambler still shambles. Same joints, speed tells the story.
    const drive = Math.min(1, speed / 9);
    const sway = (kind === 'brute' ? 0.35 : 0.16) * (1 + drive * 1.6);
    if (j.armL) j.armL.rotation.z = zombieArmRest(kind, true) + Math.sin(phase * REACH_SWAY_RATE) * sway;
    if (j.armR) j.armR.rotation.z = zombieArmRest(kind, false) + Math.cos(phase * 0.5) * sway;
    if (j.head) j.head.rotation.z = Math.sin(phase * 0.45) * 0.12;
    // the charge tips them forward — a running dead thing is falling on purpose
    if (j.torso) j.torso.rotation.x = Math.sin(phase * 0.5) * (kind === 'brute' ? 0.1 : 0.07) - drive * 0.14;
    if (j.belly) j.belly.scale.setScalar(1 + Math.sin(t * 6) * 0.06);
  } else {
    // THE LIVING TORSO WORKS THE RUN. Shoulders counter-roll the leg swing
    // (every step is a small fall you catch; the chest rolls against it),
    // and the head stabilizes against the chest — the two things a locked
    // upper body never does. rotation.z on the torso stays the renderer's
    // (recoil lives there); rotation.x on the head stays the ragdoll's.
    const upper = Math.min(1, speed / 6);
    const grounded = moving && !airborne;
    if (j.torso) {
      j.torso.rotation.x = grounded
        ? -swing * 0.1 * upper                              // counter-roll the legs
        : Math.sin(t * 1.7 + id) * 0.018;                   // idle breath
    }
    if (j.head) {
      j.head.rotation.x = grounded
        ? swing * 0.07 * upper                              // stabilize against the chest
        : Math.sin(t * 0.5 + id * 1.3) * 0.09;              // idle scan the sector
      j.head.rotation.z = grounded ? 0.045 * Math.min(1, speed / 8) : 0; // into the run
    }
  }

  return { phase, moving, footstep, growl };
}
