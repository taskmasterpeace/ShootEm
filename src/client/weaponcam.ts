// ---------------------------------------------------------------------------
// THE WEAPON-CAM (B1, Robert: "I wanna see the weapons in the UI — see what
// I'm using"): the HUD plate shows the EXACT equipped model, not an icon.
// Portraits are BAKED — one offscreen render per weapon id, cached as a data
// URL (the codex thumb-bench recipe, codex.ts:374) — so the per-frame cost of
// showing your gun is one <img> the browser already painted.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { buildWeaponModel } from './models/weapons';

let bench: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  holder: THREE.Group;
} | null = null;

const portraits = new Map<string, string>();

/** Wide plate aspect — a rifle is a long thing; give it a long frame. */
const W = 232, H = 76;

function makeBench() {
  if (bench) return bench;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  // the codex two-light rig, driven brighter — gunmetal is nearly black and
  // the HUD plate is ink; without extra light the model reads as a shadow
  scene.add(new THREE.HemisphereLight(0xdfe9f2, 0x6a6558, 1.7));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.1);
  sun.position.set(6, 12, 8);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xe8a33d, 0.5); // a whisper of house amber
  rim.position.set(-6, 3, -6);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);
  const holder = new THREE.Group();
  scene.add(holder);
  bench = { renderer, scene, camera, holder };
  return bench;
}

/**
 * The equipped gun's portrait, baked on first sight and cached forever
 * (weapon models are deterministic per id — same id, same gun, same shot).
 * Side-on with a whisper of yaw so depth reads; muzzle points RIGHT, the
 * direction the whole HUD's iconography walks.
 */
export function weaponPortrait(weaponId: string): string {
  const hit = portraits.get(weaponId);
  if (hit) return hit;
  const b = makeBench();
  b.holder.clear();
  let g: THREE.Object3D;
  try {
    g = buildWeaponModel(weaponId);
  } catch {
    return ''; // an unbuildable id must not take the HUD down
  }
  b.holder.add(g);
  // frame the long axis: guns run +X. Camera stands off on +Z with a small
  // yaw/height lean — the armory contact-sheet angle, tightened for HUD size.
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  const mid = box.getCenter(new THREE.Vector3());
  const halfW = Math.max(0.2, size.x / 2);
  const vFov = (b.camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * b.camera.aspect);
  const dist = (halfW / Math.tan(hFov / 2)) * 1.14 + size.z;
  b.camera.position.set(mid.x + dist * 0.16, mid.y + dist * 0.22, mid.z + dist);
  b.camera.lookAt(mid.x, mid.y, mid.z);
  b.renderer.render(b.scene, b.camera);
  const url = b.renderer.domElement.toDataURL('image/png');
  portraits.set(weaponId, url);
  b.holder.clear();
  return url;
}
