import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildSoldier, repairGlbRig } from '../src/client/models/soldiers';
import { poseSoldierJoints, zombieArmRest } from '../src/client/animation';
import type { ClassId, SoldierKind, Team } from '../src/sim/types';

// THE RIG LAW (the character audit): a joint the animator swings MUST own
// visible geometry, pivoted at the top of its limb so rotation.z swings it
// like a pendulum toward +X. soldier_infantry.glb shipped with EMPTY arm
// joints (the arms were welded into the torso mesh) — the harness arrows
// animated while the arms stayed frozen, and every United Front LSW rides
// that body. repairGlbRig carves the arms back out; this suite pins it.

const GLBS = ['public/models/soldier_infantry.glb', 'public/models/soldier_pathfinder.glb'];
const LIMBS = ['armL', 'armR', 'legL', 'legR', 'shinL', 'shinR'] as const;
const CORE = ['head', 'torso'] as const;

function parseGlb(path: string): Promise<THREE.Group> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(ab, '', (g) => resolve(g.scene), (e) => reject(e));
  });
}

/** Bounds of the geometry a joint OWNS, in joint-local space — honouring the
 *  draw index (computeBoundingBox reads the whole shared attribute, which
 *  would lie for the carved arms). */
function jointBounds(joint: THREE.Object3D): { lo: THREE.Vector3; hi: THREE.Vector3; verts: number } {
  const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
  const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  let verts = 0;
  joint.updateMatrixWorld(true);
  const invJoint = joint.matrixWorld.clone().invert();
  joint.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const rel = m.matrixWorld.clone().premultiply(invJoint); // mesh → joint space
    const pos = m.geometry.getAttribute('position');
    const idx = m.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const vi = idx ? idx.getX(i) : i;
      v.fromBufferAttribute(pos, vi).applyMatrix4(rel);
      lo.min(v); hi.max(v);
      verts++;
    }
  });
  return { lo, hi, verts };
}

describe('the rig law — every shipped soldier GLB honours the animator contract', () => {
  for (const path of GLBS) {
    it(`${path.split('/').pop()}: all eight joints own top-pivoted geometry`, async () => {
      const scene = await parseGlb(path);
      repairGlbRig(scene);
      scene.updateMatrixWorld(true);
      for (const name of [...CORE, ...LIMBS]) {
        const joint = scene.getObjectByName(name);
        expect(joint, `${name} missing`).toBeTruthy();
        const { lo, hi, verts } = jointBounds(joint!);
        expect(verts, `${name} owns no geometry — the arrows would move, the mesh would not`).toBeGreaterThan(0);
        if ((LIMBS as readonly string[]).includes(name)) {
          // top pivot: the limb hangs −Y — no more than 35% of it above the joint
          const above = Math.max(0, hi.y), below = Math.max(0, -lo.y);
          expect(above / (above + below), `${name} pivot is not at the top of the limb`).toBeLessThan(0.35);
        }
      }
    });
  }
});

describe('the rig law — every PROCEDURAL character honours the same contract', () => {
  const CLASSES: ClassId[] = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];
  const ZEDS: SoldierKind[] = ['zombie', 'spitter', 'brute', 'sprinter', 'bomber', 'stalker'];

  const limbLaw = (root: THREE.Object3D, names: readonly string[], label: string) => {
    root.updateMatrixWorld(true);
    for (const name of names) {
      const joint = root.getObjectByName(name);
      expect(joint, `${label}: ${name} missing`).toBeTruthy();
      const { verts, lo, hi } = jointBounds(joint!);
      expect(verts, `${label}: ${name} owns no geometry`).toBeGreaterThan(0);
      const above = Math.max(0, hi.y), below = Math.max(0, -lo.y);
      expect(above / (above + below), `${label}: ${name} pivot is not at the top`).toBeLessThan(0.35);
    }
  };

  it('troopers (both factions, all eight classes)', () => {
    for (const team of [0, 1] as Team[]) for (const c of CLASSES) {
      limbLaw(buildSoldier(team, c, 'bot'), LIMBS, `team${team}/${c}`);
    }
  });

  it('the undead (all six kinds)', () => {
    for (const kind of ZEDS) {
      limbLaw(buildSoldier(0, 'infantry', kind), LIMBS, kind);
    }
  });

  it('the K9 (four leg joints, top-pivoted)', () => {
    limbLaw(buildSoldier(0, 'infantry', 'dog'), ['legFL', 'legFR', 'legRL', 'legRR'], 'dog');
  });
});

describe('the undead reach is DRIVEN — no frozen zombie arms', () => {
  it('the arms sway over time and always reach forward', () => {
    const j = { armL: new THREE.Object3D(), armR: new THREE.Object3D() };
    const zs: number[] = [];
    for (let i = 0; i < 80; i++) {
      poseSoldierJoints(j, { kind: 'zombie', time: i / 12, id: 1, speed: 3, airborne: false });
      zs.push(j.armL.rotation.z);
    }
    expect(Math.max(...zs) - Math.min(...zs), 'the reach never swayed — arms are frozen').toBeGreaterThan(0.05);
    for (const z of zs) expect(z, 'an arm swung behind the back').toBeGreaterThan(0.5);
  });

  it('every zombie kind rests its arms FORWARD (positive swing toward +X)', () => {
    for (const kind of ['zombie', 'spitter', 'brute', 'sprinter', 'bomber', 'stalker'] as const) {
      expect(zombieArmRest(kind, true)).toBeGreaterThan(0.9);
      expect(zombieArmRest(kind, false)).toBeGreaterThan(0.9);
    }
  });
});
