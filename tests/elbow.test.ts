// ---------------------------------------------------------------------------
// W6.2 — NAMED ELBOW JOINTS. The trooper's forearm groups (correctly pivoted
// at the elbow, hanging −Y like every limb in the rig law) now carry names —
// elbowL / elbowR — and ride JOINT_NAMES, so the animator can bend a strike
// instead of swinging the whole arm slab. GLB bodies don't carry them yet;
// the joint cache stores undefined and every pose skips them gracefully
// (the same contract the quadruped-only names already rely on).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { JOINT_NAMES } from '../src/client/animation';
import { buildSoldier } from '../src/client/models/soldiers';

describe('W6.2 — the elbows have names', () => {
  it('JOINT_NAMES carries the pair', () => {
    expect(JOINT_NAMES).toContain('elbowL');
    expect(JOINT_NAMES).toContain('elbowR');
  });

  it('a procedural trooper owns both elbows, pivoted under the shoulder', () => {
    const g = buildSoldier(1, 'infantry', 'human');
    for (const name of ['elbowL', 'elbowR'] as const) {
      const e = g.getObjectByName(name);
      expect(e, `${name} exists`).toBeTruthy();
      expect(e!.position.y, 'the pivot sits at the elbow').toBeLessThan(0);
      let meshes = 0;
      e!.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
      expect(meshes, 'the joint owns visible geometry (rig law)').toBeGreaterThan(0);
      // the parent is the shoulder — the named arm joint
      expect(e!.parent?.name).toMatch(/^arm[LR]$/);
    }
  });

  it('bending an elbow moves the hand and nothing upstream', () => {
    const g = buildSoldier(1, 'infantry', 'human');
    const elbow = g.getObjectByName('elbowR')!;
    const hand = g.getObjectByName('handR')!;
    const arm = g.getObjectByName('armR')!;
    g.updateMatrixWorld(true);
    const handBefore = hand.getWorldPosition(new THREE.Vector3());
    const armRot = arm.rotation.z;
    elbow.rotation.z += 0.8;
    g.updateMatrixWorld(true);
    const handAfter = hand.getWorldPosition(new THREE.Vector3());
    expect(handAfter.distanceTo(handBefore), 'the hand swung').toBeGreaterThan(0.05);
    expect(arm.rotation.z, 'the shoulder never moved').toBe(armRot);
  });
});
