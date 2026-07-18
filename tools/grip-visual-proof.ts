/** dev-only: dump solved joint poses for the GLB trooper as JSON, for the
 *  Blender render proof (tools/grip-render.py).
 *
 *  npx tsx tools/grip-visual-proof.ts
 *
 * Emits tools/atlas/grip-proof.json with:
 *   before: the legacy fixed arm angles + original gun spot
 *   after:  the solved grip (arm angles + slid gun) + a mid-stride run frame
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { poseSoldierJoints, type Joints } from '../src/client/animation';
import { solveGlbGrip } from '../src/client/models/grip';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'atlas', 'grip-proof.json');
mkdirSync(dirname(OUT), { recursive: true });

const buf = readFileSync(join(ROOT, 'public', 'models', 'soldier_infantry.glb'));
const loader = new GLTFLoader();
const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
  loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
const body = gltf.scene;

// a toy rifle (receiver + barrel) to stand in for buildRifle's geometry —
// the anchors are what matter
const gun = new THREE.Group();
gun.name = 'gun';
gun.position.set(0.42, 1.28, -0.16);
const wrap = new THREE.Group();
wrap.add(body);
wrap.add(gun);
wrap.updateMatrixWorld(true);

// ---- BEFORE: the legacy fixed pose ---------------------------------------
const before = {
  armR: { z: -0.5, x: 0 }, armL: { z: -0.75, x: 0 },
  gun: { x: 0.42, y: 1.28, z: -0.16 },
  legL: 0, legR: 0, shinL: 0, shinR: 0, torsoX: 0, headX: 0, headZ: 0,
};

// ---- AFTER: the solved grip + a mid-stride run frame ----------------------
const armR = body.getObjectByName('armR');
const armL = body.getObjectByName('armL');
const dist = solveGlbGrip(wrap, armR, armL, gun);
wrap.updateMatrixWorld(true);

// the mid-stride: run the gait on the body's own joints (legs forward)
const joints: Joints = {};
for (const n of ['legL', 'legR', 'shinL', 'shinR', 'head', 'torso'] as const) {
  joints[n] = body.getObjectByName(n);
}
// find a phase with legL well forward by stepping the gait a few frames
const state: { phase?: number } = {};
let frame = 0;
for (let i = 0; i < 40; i++) {
  const out = poseSoldierJoints(joints, { kind: 'human', time: i / 60, id: 7, speed: 6, airborne: false, dt: 1 / 60, state });
  frame = i;
  if (joints.legL && joints.legL.rotation.z > 0.3) { void out; break; }
}

const r = (o: THREE.Object3D | undefined, a: 'x' | 'y' | 'z') => (o ? Number(o.rotation[a].toFixed(4)) : 0);
const proof = {
  before,
  after: {
    armR: { x: r(armR, 'x'), y: r(armR, 'y'), z: r(armR, 'z') },
    armL: { x: r(armL, 'x'), y: r(armL, 'y'), z: r(armL, 'z') },
    gun: { x: gun.position.x, y: gun.position.y, z: gun.position.z },
    run: {
      frame,
      legL: r(joints.legL, 'z'), legR: r(joints.legR, 'z'),
      shinL: r(joints.shinL, 'z'), shinR: r(joints.shinR, 'z'),
      torsoX: r(joints.torso, 'x'), headX: r(joints.head, 'x'), headZ: r(joints.head, 'z'),
    },
    distances: dist,
  },
};
writeFileSync(OUT, JSON.stringify(proof, null, 2));
console.log('proof →', OUT);
console.log(JSON.stringify(proof, null, 2));
