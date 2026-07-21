// Shared low-poly vocabulary for every model in the game — one material
// factory, three primitives. Every silhouette in War World is built from
// these four words.
import * as THREE from 'three';
import { applyDarkness } from '../darkness';
export const mat = (color: number, opts: { metal?: number; rough?: number; emissive?: number } = {}) => {
  const m = new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metal ?? 0.15,
    roughness: opts.rough ?? 0.75,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissive ? 0.9 : 0,
  });
  applyDarkness(m); // READING THE DARK: the whole model vocabulary obeys the cone
  return m;
};

export const box = (w: number, h: number, d: number, m: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = true;
  return mesh;
};
export const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 10) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.castShadow = true;
  return mesh;
};
/** Box with its origin at the TOP — rotate to swing like a limb from its joint. */
export const limb = (w: number, h: number, d: number, m: THREE.Material) => {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0);
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  return mesh;
};

// ---------------------------------------------------------------------------
// Soldiers. Root faces +X (yaw 0). Jointed hierarchy — the renderer animates
// hips/legs/shins/arms/gun by name.
// ---------------------------------------------------------------------------

