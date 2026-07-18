// ---------------------------------------------------------------------------
// THE RIFLE GRIP, SOLVED — not posed. Robert: "holding the gun properly."
//
// The stock builds parked the rifle at a fixed offset and set the arms at
// fixed angles: the hands never actually landed on the weapon, and the lie
// only held at command height. This solver does the honest thing: CCD
// (cyclic coordinate descent) over the real arm chain so the RIGHT hand
// closes on the pistol grip and the LEFT hand closes on the handguard, and
// it slides the rifle the last few centimeters toward the chest when the
// handguard would be out of reach. Build-time only — the pose is then
// static, and the renderer's run-carry/recoil stay additive on top of it.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

/** rifle-local anchor points (buildRifle's layout): the pistol grip and a
 *  point on the handguard the support hand should wrap. */
export const RIFLE_ANCHORS = {
  grip: new THREE.Vector3(-0.15, -0.11, 0),
  handguard: new THREE.Vector3(0.3, -0.06, 0),
};

export interface ArmChain {
  /** the named joint ('armL'/'armR') — rotation.x adducts, rotation.z swings */
  shoulder: THREE.Object3D;
  /** the elbow group under it — rotation.z bends */
  elbow: THREE.Object3D;
  /** the hand mesh (its position is the grip point) */
  hand: THREE.Object3D;
}

const _v = new THREE.Vector3();

function bodyPos(o: THREE.Object3D, root: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
  o.getWorldPosition(out);
  return root.worldToLocal(out);
}

function handReach(chain: ArmChain): number {
  // conservative reach: shoulder→elbow→hand lengths in a straight line
  const a = chain.elbow.position.length();
  const b = chain.hand.position.length();
  return a + b;
}

function handToTarget(root: THREE.Object3D, chain: ArmChain, target: THREE.Vector3): number {
  root.updateMatrixWorld(true);
  const hp = bodyPos(chain.hand, root, new THREE.Vector3());
  return hp.distanceTo(target);
}

/** coordinate-descent on the arm chain: try a small rotation on each axis,
 *  keep whatever shrinks hand-to-target, halve the step when nothing helps.
 *  No frame math, no sign conventions — it just converges (build-time only).
 *  THE ENVELOPE keeps it human: joints stay inside natural ranges, so the
 *  solver lands a pose a soldier could actually hold (the old unconstrained
 *  climb would happily twist a shoulder to −171° to grab the handguard). */
const LIMITS: Record<'x' | 'z', [number, number]> = { x: [-1.1, 0.6], z: [-1.5, 1.5] };
const ELBOW_Z: [number, number] = [-2.4, 0.2];

function settle(root: THREE.Object3D, chain: ArmChain, target: THREE.Vector3, _useShoulderX: boolean, iters = 400) {
  const axes: [THREE.Object3D, 'x' | 'z', [number, number]][] = [
    [chain.elbow, 'z', ELBOW_Z],
    [chain.shoulder, 'z', LIMITS.z],
    [chain.shoulder, 'x', LIMITS.x],
  ];
  let step = 0.25;
  let d = handToTarget(root, chain, target);
  while (step > 0.004 && iters-- > 0) {
    let improved = false;
    for (const [joint, axis, [lo, hi]] of axes) {
      for (const s of [1, -1] as const) {
        joint.rotation[axis] += s * step;
        if (joint.rotation[axis] < lo || joint.rotation[axis] > hi) {
          joint.rotation[axis] -= s * step; // outside the envelope — not a soldier's pose
          continue;
        }
        const d2 = handToTarget(root, chain, target);
        if (d2 < d - 1e-6) { d = d2; improved = true; break; }
        joint.rotation[axis] -= s * step;
      }
    }
    if (!improved) step *= 0.5;
  }
}

/**
 * Close both hands on the rifle. Solves armR onto the grip first; if the
 * handguard is beyond armL's reach, the rifle slides toward the chest until
 * it isn't (capped — the rifle never swallows the stock); then armL closes.
 * Mutates shoulder/elbow rotations and possibly gun.position. Returns the
 * final hand-to-anchor distances for the test suite.
 */
export function solveTwoHandedGrip(
  root: THREE.Object3D,
  armR: ArmChain | null,
  armL: ArmChain | null,
  gun: THREE.Object3D,
): { grip: number; handguard: number } {
  root.updateMatrixWorld(true);
  const gripWorld = RIFLE_ANCHORS.grip.clone().applyMatrix4(gun.matrixWorld);
  root.worldToLocal(gripWorld);
  const out = { grip: NaN, handguard: NaN };

  if (armR) {
    settle(root, armR, gripWorld, true);
    out.grip = handToTarget(root, armR, gripWorld);
  }

  if (armL) {
    const guardWorld = RIFLE_ANCHORS.handguard.clone().applyMatrix4(gun.matrixWorld);
    root.worldToLocal(guardWorld);
    // reach check: bring the rifle home until the support hand can wrap it
    const reach = handReach(armL) * 0.94;
    const shoulderPos = bodyPos(armL.shoulder, root, new THREE.Vector3());
    let dist = shoulderPos.distanceTo(guardWorld);
    let slides = 0;
    while (dist > reach && slides < 60) {
      // slide the gun toward the left shoulder along the closing direction
      gun.position.x -= 0.015;
      gun.position.z += Math.sign(shoulderPos.z - gun.position.z) * 0.025;
      root.updateMatrixWorld(true);
      guardWorld.copy(RIFLE_ANCHORS.handguard).applyMatrix4(gun.matrixWorld);
      root.worldToLocal(guardWorld);
      dist = shoulderPos.distanceTo(guardWorld);
      slides++;
    }
    // re-solve the firing hand after any slide, then close the support hand
    if (armR && slides > 0) {
      gripWorld.copy(RIFLE_ANCHORS.grip).applyMatrix4(gun.matrixWorld);
      root.worldToLocal(gripWorld);
      // reset armR's solved pose back toward neutral before re-solving
      settle(root, armR, gripWorld, true, 36);
      out.grip = handToTarget(root, armR, gripWorld);
    }
    settle(root, armL, guardWorld, true, 36);
    out.handguard = handToTarget(root, armL, guardWorld);
  }
  return out;
}

// ---------------------------------------------------------------------------
// the SEGMENTED-body path (Robert's GLB troopers): one rigid arm part per
// side, no elbow — solve the shoulder so the arm's TIP lands on the anchor.
// ---------------------------------------------------------------------------

/** aim a rigid arm at a target: CCD over the shoulder's two swing axes
 *  using a probe at the arm's tip. armLen is measured from the arm part's
 *  bounding box (each GLB body has its own proportions). */
function solveStraightArm(root: THREE.Object3D, shoulder: THREE.Object3D, armLen: number, target: THREE.Vector3) {
  const probe = new THREE.Object3D();
  probe.position.set(0, -armLen, 0);
  shoulder.add(probe);
  const chain: ArmChain = { shoulder, elbow: shoulder, hand: probe };
  settle(root, chain, target, true, 40);
  shoulder.remove(probe);
}

/** measure a rigid arm part's length: shoulder origin to the part's lowest
 *  point, in the shoulder's local frame (the arm hangs down at rest). */
export function armLength(shoulder: THREE.Object3D): number {
  const box3 = new THREE.Box3().setFromObject(shoulder);
  const shoulderWorld = new THREE.Vector3();
  shoulder.getWorldPosition(shoulderWorld);
  return Math.max(0.2, shoulderWorld.y - box3.min.y);
}

/**
 * The GLB trooper's grip: rigid arms solved onto the anchors, with the same
 * bring-the-rifle-home reach rule as the procedural solve.
 */
export function solveGlbGrip(
  root: THREE.Object3D,
  armR: THREE.Object3D | undefined,
  armL: THREE.Object3D | undefined,
  gun: THREE.Object3D,
): { grip: number; handguard: number } {
  root.updateMatrixWorld(true);
  const out = { grip: NaN, handguard: NaN };
  const gripWorld = RIFLE_ANCHORS.grip.clone().applyMatrix4(gun.matrixWorld);
  root.worldToLocal(gripWorld);

  if (armR) {
    solveStraightArm(root, armR, armLength(armR) * 0.96, gripWorld);
    const probe = new THREE.Object3D();
    probe.position.set(0, -armLength(armR) * 0.96, 0);
    armR.add(probe);
    out.grip = handToTarget(root, { shoulder: armR, elbow: armR, hand: probe }, gripWorld);
    armR.remove(probe);
  }

  if (armL) {
    const guardWorld = RIFLE_ANCHORS.handguard.clone().applyMatrix4(gun.matrixWorld);
    root.worldToLocal(guardWorld);
    const len = armLength(armL) * 0.96;
    const shoulderPos = bodyPos(armL, root, new THREE.Vector3());
    let dist = shoulderPos.distanceTo(guardWorld);
    let slides = 0;
    while (dist > len && slides < 24) {
      gun.position.x -= 0.012;
      gun.position.z += Math.sign(shoulderPos.z - gun.position.z) * 0.02;
      root.updateMatrixWorld(true);
      guardWorld.copy(RIFLE_ANCHORS.handguard).applyMatrix4(gun.matrixWorld);
      root.worldToLocal(guardWorld);
      dist = shoulderPos.distanceTo(guardWorld);
      slides++;
    }
    if (armR && slides > 0) {
      gripWorld.copy(RIFLE_ANCHORS.grip).applyMatrix4(gun.matrixWorld);
      root.worldToLocal(gripWorld);
      solveStraightArm(root, armR, armLength(armR) * 0.96, gripWorld);
    }
    solveStraightArm(root, armL, len, guardWorld);
    const probe = new THREE.Object3D();
    probe.position.set(0, -len, 0);
    armL.add(probe);
    out.handguard = handToTarget(root, { shoulder: armL, elbow: armL, hand: probe }, guardWorld);
    armL.remove(probe);
  }
  return out;
}
