// ---------------------------------------------------------------------------
// THE GRIP LAWS — after the solve, both hands are ON the rifle. Not near it,
// not "reads at command height" — on it, per class, provably.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSoldier } from '../src/client/models/soldiers';
import { RIFLE_ANCHORS } from '../src/client/models/grip';
import type { ClassId } from '../src/sim/types';

const CLASSES: ClassId[] = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];

function measure(body: THREE.Group) {
  body.updateMatrixWorld(true);
  const gun = body.getObjectByName('gun')!;
  const handR = body.getObjectByName('handR')!;
  const handL = body.getObjectByName('handL')!;
  const anchor = (local: THREE.Vector3) => {
    const w = local.clone().applyMatrix4(gun.matrixWorld);
    return body.worldToLocal(w);
  };
  const dist = (hand: THREE.Object3D, target: THREE.Vector3) => {
    const hp = new THREE.Vector3();
    hand.getWorldPosition(hp);
    return body.worldToLocal(hp).distanceTo(target);
  };
  return {
    grip: dist(handR, anchor(RIFLE_ANCHORS.grip)),
    handguard: dist(handL, anchor(RIFLE_ANCHORS.handguard)),
  };
}

describe('the rifle grip', () => {
  for (const cls of CLASSES) {
    it(`${cls}: both hands land on the rifle (procedural trooper)`, () => {
      const body = buildSoldier(0, cls, 'bot');
      const { grip, handguard } = measure(body);
      expect(grip, `${cls}: right hand off the grip by ${grip.toFixed(3)}u`).toBeLessThan(0.09);
      expect(handguard, `${cls}: left hand off the handguard by ${handguard.toFixed(3)}u`).toBeLessThan(0.12);
    });
  }

  it('the rifle never slides into the chest — the hold stays a hold', () => {
    const body = buildSoldier(0, 'infantry', 'bot');
    const gun = body.getObjectByName('gun')!;
    expect(gun.position.x).toBeGreaterThan(0.1); // muzzle stays off the sternum
    expect(gun.position.z).toBeLessThan(0.25);   // and never past the left shoulder
  });

  it('collective troopers get the same solve (no faction privilege at the grip)', () => {
    const body = buildSoldier(1, 'infantry', 'bot');
    const { grip, handguard } = measure(body);
    expect(grip).toBeLessThan(0.09);
    expect(handguard).toBeLessThan(0.12);
  });
});
