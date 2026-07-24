// ═══════════════════════════════════════════════════════════════════════════
// THE FALLEN — the bodies the field keeps, and what time does to them.
//
// Robert: *"we will be adding body decay to skeletons, but right now blood
// lasts a very long time and bodies disappear."*
//
// He had the inversion exactly right, and it measured worse than it sounds:
//
//   A BODY lasted 4.0 seconds. `corpse = !s.alive && time < s.respawnAt` —
//   and at RESPAWN_DELAY the very same mesh stood back up as a living man.
//   The body did not fade, it was repossessed.
//
//   A BLOOD SPLAT lasted forever. The decal pool had no clock at all, only a
//   900-deep FIFO, so a stain from the first minute was still wet in the last
//   and only ever vanished when 900 newer marks shoved it out.
//
// The stain outlived the man by an unbounded margin. This is the other half of
// the repair: a body stays where it fell, goes to bone, and is finally taken by
// the ground — while the blood it left dries and goes first (renderer.ts).
//
// COST IS THE WHOLE DESIGN. A corpse mesh is six parts, so a field of forty
// bodies drawn the obvious way is 240 draw calls — worse than the problem it
// replaces. Every body here lives in THREE InstancedMeshes (torso · head ·
// limbs), so the entire field of the dead is **3 draw calls** no matter how
// many of them there are, and paling to bone is a per-instance colour, which
// is free.
//
// Presentation only. The sim knows nothing about this — no tick, no rng, no
// state that could cross into a replay or a snapshot.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

/** how many bodies the field holds before the oldest is taken */
export const FALLEN_MAX = 48;
/** seconds a body lies as it fell, before time starts on it */
export const FRESH_S = 50;
/** …and how long the turn to bone takes */
export const BONES_S = 110;
/** bones sit for this long after that, then the ground has them */
export const BONE_REST_S = 180;
/** the whole life of one of the fallen */
export const FALLEN_LIFE = FRESH_S + BONES_S + BONE_REST_S;
/** a body stays hidden this long so it never doubles the dying soldier's mesh */
export const REVEAL_S = 3.9;

/** the colour a body is when it falls, and the colour bone goes */
const FLESH = new THREE.Color(0x4a4034);
const BONE = new THREE.Color(0xb9b3a2);

interface Body { x: number; z: number; yaw: number; born: number }

const M = new THREE.Matrix4();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const Q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const C = new THREE.Color();
/** where each limb sits relative to the body's own origin */
const LIMBS: ReadonlyArray<readonly [number, number, number]> = [
  [0.32, 0.1, 0.16], [-0.32, 0.1, 0.16], [0.15, 0.1, -0.5], [-0.15, 0.1, -0.5],
];

/**
 * How far through its decay a body is, 0..1, and what stage that reads as.
 * Pure — the tests drive this directly rather than counting pixels.
 */
export function decayOf(age: number): { t: number; stage: 'fresh' | 'turning' | 'bones' | 'gone' } {
  if (age >= FALLEN_LIFE) return { t: 1, stage: 'gone' };
  if (age < FRESH_S) return { t: 0, stage: 'fresh' };
  if (age < FRESH_S + BONES_S) {
    return { t: (age - FRESH_S) / BONES_S, stage: 'turning' };
  }
  return { t: 1, stage: 'bones' };
}

export class TheFallen {
  private torso: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private limbs: THREE.InstancedMesh;
  private bodies: Body[] = [];

  constructor(private scene: THREE.Scene) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mk = (geo: THREE.BufferGeometry, n: number) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.castShadow = false;      // the dead do not need to cast; it is a real saving at 48
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    this.torso = mk(new THREE.BoxGeometry(0.5, 0.26, 0.92), FALLEN_MAX);
    this.head = mk(new THREE.SphereGeometry(0.16, 8, 6), FALLEN_MAX);
    this.limbs = mk(new THREE.BoxGeometry(0.13, 0.13, 0.58), FALLEN_MAX * 4);
  }

  get count(): number { return this.bodies.length; }

  /** A man went down here. `yaw` is how he was facing; `now` is the sim clock. */
  add(x: number, z: number, yaw: number, now: number): void {
    // THE FIELD HAS A BUDGET, and the oldest body pays it. Evicting the oldest
    // rather than refusing the newest matters: the thing you just watched
    // happen must always be the thing you can still see.
    if (this.bodies.length >= FALLEN_MAX) this.bodies.shift();
    this.bodies.push({ x, z, yaw, born: now });
  }

  /**
   * Age the field. Called at a low rate by the renderer — bodies are not in a
   * hurry, and rewriting 48 × 6 matrices every frame is exactly the churn the
   * instancing exists to avoid.
   */
  update(now: number): void {
    // take the ones the ground has finished with
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      if (now - this.bodies[i].born >= FALLEN_LIFE) this.bodies.splice(i, 1);
    }
    let n = 0;
    let limb = 0;
    for (const b of this.bodies) {
      const age = now - b.born;
      if (age < REVEAL_S) continue;            // the dying soldier still owns this spot
      const { t, stage } = decayOf(age);
      // flesh → bone, then the last stretch settles into the ground
      C.copy(FLESH).lerp(BONE, stage === 'fresh' ? 0 : t);
      const rest = Math.max(0, age - FRESH_S - BONES_S);
      const sink = Math.min(1, rest / BONE_REST_S);
      const y = -sink * 0.16;                  // it goes down, it does not blink out
      const k = 1 - sink * 0.18;               // and draws in a little as it goes

      Q.setFromAxisAngle(UP, b.yaw);
      M.compose(V.set(b.x, 0.16 + y, b.z), Q, S.set(k, k, k));
      this.torso.setMatrixAt(n, M); this.torso.setColorAt(n, C);
      M.compose(V.set(b.x + Math.sin(b.yaw) * 0.58, 0.15 + y, b.z + Math.cos(b.yaw) * 0.58), Q, S.set(k, k, k));
      this.head.setMatrixAt(n, M); this.head.setColorAt(n, C);
      for (const [lx, ly, lz] of LIMBS) {
        const rx = lx * Math.cos(b.yaw) + lz * Math.sin(b.yaw);
        const rz = -lx * Math.sin(b.yaw) + lz * Math.cos(b.yaw);
        M.compose(V.set(b.x + rx, ly + y, b.z + rz), Q, S.set(k, k, k));
        this.limbs.setMatrixAt(limb, M); this.limbs.setColorAt(limb, C);
        limb++;
      }
      n++;
    }
    this.torso.count = n;
    this.head.count = n;
    this.limbs.count = limb;
    this.torso.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.limbs.instanceMatrix.needsUpdate = true;
    if (this.torso.instanceColor) this.torso.instanceColor.needsUpdate = true;
    if (this.head.instanceColor) this.head.instanceColor.needsUpdate = true;
    if (this.limbs.instanceColor) this.limbs.instanceColor.needsUpdate = true;
  }

  /** A fresh field for a fresh match. */
  reset(): void {
    this.bodies.length = 0;
    this.torso.count = 0;
    this.head.count = 0;
    this.limbs.count = 0;
  }

  dispose(): void {
    for (const m of [this.torso, this.head, this.limbs]) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
  }
}
