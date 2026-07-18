/** dev-only: print the grip solve's real numbers — where the gun ended up,
 *  where the hands are, how far they are from the anchors. */
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildSoldier } from '../src/client/models/soldiers';
import { RIFLE_ANCHORS, solveGlbGrip, armLength } from '../src/client/models/grip';
import type { ClassId } from '../src/sim/types';

const w2l = (root: THREE.Object3D, o: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  o.getWorldPosition(v);
  return root.worldToLocal(v);
};

for (const cls of ['infantry', 'heavy'] as ClassId[]) {
  const body = buildSoldier(0, cls, 'bot');
  body.updateMatrixWorld(true);
  const gun = body.getObjectByName('gun')!;
  const armR = body.getObjectByName('armR')!;
  const armL = body.getObjectByName('armL')!;
  const handR = body.getObjectByName('handR')!;
  const handL = body.getObjectByName('handL')!;
  const anchor = (local: THREE.Vector3) => body.worldToLocal(local.clone().applyMatrix4(gun.matrixWorld));
  const grip = anchor(RIFLE_ANCHORS.grip);
  const guard = anchor(RIFLE_ANCHORS.handguard);
  console.log(`=== ${cls} (procedural) ===`);
  console.log('gun.position:', gun.position.x.toFixed(3), gun.position.y.toFixed(3), gun.position.z.toFixed(3));
  console.log('armR rot.z:', armR.rotation.z.toFixed(3), 'rot.x:', armR.rotation.x.toFixed(3));
  console.log('armL rot.z:', armL.rotation.z.toFixed(3), 'rot.x:', armL.rotation.x.toFixed(3));
  console.log('handR → grip dist:', w2l(body, handR).distanceTo(grip).toFixed(3));
  console.log('handL → guard dist:', w2l(body, handL).distanceTo(guard).toFixed(3));
}

// ---- the GLB body (straight-arm solve) --------------------------------------
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const buf = readFileSync(join(ROOT, 'public', 'models', 'soldier_infantry.glb'));
const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
  new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
{
  const body = gltf.scene;
  const gun = new THREE.Group();
  gun.name = 'gun';
  gun.position.set(0.42, 1.28, -0.16);
  const wrap = new THREE.Group();
  wrap.add(body);
  wrap.add(gun);
  wrap.updateMatrixWorld(true);
  const armR = body.getObjectByName('armR')!;
  const armL = body.getObjectByName('armL')!;
  const before = { z: armR.rotation.z, x: armR.rotation.x };
  const dist = solveGlbGrip(wrap, armR, armL, gun);
  wrap.updateMatrixWorld(true);
  console.log('=== infantry (GLB body) ===');
  console.log('gun.position:', gun.position.x.toFixed(3), gun.position.y.toFixed(3), gun.position.z.toFixed(3));
  console.log('armR rot.z:', armR.rotation.z.toFixed(3), 'rot.x:', armR.rotation.x.toFixed(3), ' (was', before.z.toFixed(2), before.x.toFixed(2) + ')');
  console.log('armL rot.z:', armL.rotation.z.toFixed(3), 'rot.x:', armL.rotation.x.toFixed(3));
  console.log('arm lengths:', armLength(armR).toFixed(3), armLength(armL).toFixed(3));
  console.log('solve distances:', JSON.stringify(dist, null, 1));
}
