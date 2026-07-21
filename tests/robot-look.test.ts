// ---------------------------------------------------------------------------
// W3.8 BOTS LOOK LIKE ROBOTS — "chrome, subordinate". A bot body chromes
// toward steel (metalness up, roughness down, color pulled to gunmetal) so
// flesh and machine read apart at a glance; a human body keeps the class
// palette. Same silhouette, same rig, same team tint underneath.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildSoldier } from '../src/client/models/soldiers';

function mats(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mm of Array.isArray(m.material) ? m.material : [m.material]) {
      if ((mm as THREE.MeshStandardMaterial).isMeshStandardMaterial) out.push(mm as THREE.MeshStandardMaterial);
    }
  });
  return out;
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('W3.8 — bots look like robots', () => {
  it('a bot body is CHROME; a human body is not', () => {
    // team 1 rides the procedural body in node (no GLB loader here)
    const bot = mats(buildSoldier(1, 'infantry', 'bot'));
    const man = mats(buildSoldier(1, 'infantry', 'human'));
    expect(bot.length).toBeGreaterThan(3);
    expect(avg(bot.map((m) => m.metalness)), 'steel skin').toBeGreaterThanOrEqual(0.85);
    expect(avg(man.map((m) => m.metalness)), 'flesh keeps the class palette').toBeLessThan(0.5);
    expect(avg(bot.map((m) => m.roughness)), 'polished').toBeLessThanOrEqual(0.35);
  });

  it('the chrome never leaks between builds — humans built after bots stay flesh', () => {
    buildSoldier(1, 'heavy', 'bot');
    const man = mats(buildSoldier(1, 'heavy', 'human'));
    expect(avg(man.map((m) => m.metalness))).toBeLessThan(0.5);
  });

  it('the ANDROID law: a UF bot keeps its face — skin stays, the rest steels', () => {
    // faction identity (visual.test.ts) says the United Front SHOWS a face;
    // their machines are androids: a human face on a chrome chassis
    const uf = mats(buildSoldier(0, 'infantry', 'bot'));
    const skin = uf.filter((m) => m.color.getHex() === 0xd0a67e);
    const steel = uf.filter((m) => m.color.getHex() !== 0xd0a67e);
    expect(skin.length, 'the face survived').toBeGreaterThan(0);
    expect(avg(steel.map((m) => m.metalness)), 'the chassis is chrome').toBeGreaterThanOrEqual(0.85);
    expect(avg(skin.map((m) => m.metalness)), 'the face is not chromed').toBeLessThan(0.5);
  });
});
