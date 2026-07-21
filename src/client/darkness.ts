// ---------------------------------------------------------------------------
// READING THE DARK (STATUS §1 / plan A2 steps 1+2+3+5): the analytic vision
// cone as a shader chunk — zero extra draws, zero passes, zero uploads
// (~6 ALU per fragment). Every LIT material multiplies its final color by a
// visibility factor computed per fragment from world position vs the eye:
//   · inside the aim cone (CONE_HALF — the SIM's own perception law) → lit
//   · the RING (9u, perception.ts) stays lit all around — never blind at
//     your own feet
//   · past perceiveRange → the murk floor (weather already closes the range,
//     so fog/storm/night TIGHTEN the cone for free — plan step 3)
// Soft smoothstep bands everywhere so the boundary reads as murk, not a
// laser line (step 2). Strength is a SETTING: off / subtle / full (step 5);
// `off` multiplies by exactly 1.0 — the classic look, untouched.
//
// COVERAGE (the plan's "real work"): one idempotent scene sweep — the
// renderer calls sweepDarkness on a slow cadence, patching every
// MeshStandard/MeshLambert material it finds; meshes added later (GLBs,
// drops, corpses) get caught by the next pass, and mat() (models/shared.ts)
// patches the whole model vocabulary at creation. MeshBasicMaterial is
// deliberately EXEMPT: rings, blips, muzzle glows are instruments, and
// instruments stay readable in the dark.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { CONE_HALF, RING } from '../sim/perception';
import type { DarknessLevel } from './settings';

/** the murk floor per setting — how dark "unseen" gets (1 = no darkness) */
export function darknessFloor(level: DarknessLevel): number {
  return level === 'off' ? 1 : level === 'full' ? 0.28 : 0.55;
}

// ONE set of uniform value objects shared by every patched material — the
// per-frame update writes here once and every shader in the scene sees it.
const U = {
  uWwEye: { value: new THREE.Vector3(0, 0, 0) },
  uWwYaw: { value: 0 },
  uWwCone: { value: CONE_HALF },
  uWwRange: { value: 66 },
  uWwFloor: { value: 1 }, // 1 = off (also the menu / dead-eye state)
};

const patched = new WeakSet<THREE.Material>();

/** Patch one material. Idempotent; composes with an existing onBeforeCompile. */
export function applyDarkness(m: THREE.Material) {
  if (patched.has(m)) return;
  patched.add(m);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    shader.uniforms.uWwEye = U.uWwEye;
    shader.uniforms.uWwYaw = U.uWwYaw;
    shader.uniforms.uWwCone = U.uWwCone;
    shader.uniforms.uWwRange = U.uWwRange;
    shader.uniforms.uWwFloor = U.uWwFloor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWwWorldPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 wwP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    wwP = instanceMatrix * wwP;
  #endif
  vWwWorldPos = ( modelMatrix * wwP ).xyz;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWwWorldPos;
uniform vec3 uWwEye; uniform float uWwYaw; uniform float uWwCone; uniform float uWwRange; uniform float uWwFloor;`)
      .replace('#include <dithering_fragment>', `{
  vec2 wwD = vWwWorldPos.xz - uWwEye.xz;
  float wwDist = length(wwD);
  float wwA = abs(atan(wwD.y, wwD.x) - uWwYaw);
  wwA = min(wwA, 6.28318530718 - wwA);
  float wwInCone = 1.0 - smoothstep(uWwCone * 0.82, uWwCone * 1.18, wwA);
  float wwRing = 1.0 - smoothstep(${(RING - 1).toFixed(1)}, ${(RING + 2.5).toFixed(1)}, wwDist);
  float wwFar = 1.0 - smoothstep(uWwRange * 0.7, uWwRange * 1.05, wwDist);
  float wwVis = max(wwRing, wwInCone * wwFar);
  gl_FragColor.rgb *= mix(uWwFloor, 1.0, wwVis);
}
#include <dithering_fragment>`);
  };
  // patched materials must not share compiled programs with unpatched twins
  m.customProgramCacheKey = () => 'ww-dark';
  m.needsUpdate = true;
}

/** Walk a scene and patch every lit material not yet patched. Cheap enough
 *  for a slow cadence — new meshes get caught by the next sweep. */
export function sweepDarkness(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || patched.has(m)) continue;
      const t = m as THREE.MeshStandardMaterial;
      if (t.isMeshStandardMaterial || (m as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
        applyDarkness(m);
        n++;
      }
    }
  });
  return n;
}

/** Per-frame: where the eye is, where it looks, how far it sees, and how
 *  dark the unseen gets. Pass floor 1 when there is no eye (menu, dead,
 *  setting off) — the world renders classically. */
export function setDarknessFrame(x: number, y: number, z: number, yaw: number, range: number, floor: number) {
  U.uWwEye.value.set(x, y, z);
  U.uWwYaw.value = yaw;
  U.uWwRange.value = range;
  U.uWwFloor.value = floor;
}

/** test hook — read the live uniform values */
export function darknessUniforms() {
  return { eye: U.uWwEye.value, yaw: U.uWwYaw.value, range: U.uWwRange.value, floor: U.uWwFloor.value };
}
