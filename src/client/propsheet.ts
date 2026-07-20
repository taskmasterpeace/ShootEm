// ---------------------------------------------------------------------------
// THE PROP CONTACT SHEET (/props.html) — every prop the generator can place,
// stood on its claimed footprint next to a 1.8u soldier post, so scale is a
// thing you SEE rather than a number you hope about.
//
// It exists because the map is only as good as its furniture, and furniture is
// the one part of this codebase the gates cannot check: a GLB that loads fine,
// fits fine and grounds fine can still be half the size a barn should be, or
// floating, or facing its own back. tsc can't see that. This page can.
//
// Labels are PROJECTED from each prop's real world position every frame. The
// first cut of this page laid the props out in 3D and the labels in flat HTML
// columns, and the two had nothing to do with each other — it confidently
// captioned a barn "watertower". A label that isn't derived from the thing it
// names is just a rumour.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { TILE } from '../sim/map';
import { buildProp } from './models/props';

/** Every placeable prop, with the tile footprint the generator claims for it. */
const SHEET: { type: string; tiles: number }[] = [
  { type: 'tree', tiles: 1 },
  { type: 'rock', tiles: 1 },
  { type: 'crate', tiles: 1 },
  { type: 'bunker', tiles: 0 },
  { type: 'clone_bay', tiles: 1 },
  { type: 'silo', tiles: 1 },
  { type: 'flare_stack', tiles: 1 },
  { type: 'crane', tiles: 1 },
  { type: 'wreck', tiles: 1 },
  { type: 'memorial', tiles: 1 },
  { type: 'crop', tiles: 0 },
  { type: 'barn', tiles: 2 },
  { type: 'farmhouse', tiles: 2 },
  { type: 'silo_farm', tiles: 1 },
  { type: 'windmill', tiles: 1 },
  { type: 'watertower', tiles: 1 },
  { type: 'hangar', tiles: 3 },
];

const SOLDIER_H = 1.8; // the yardstick: everything is measured against a man
const COLS = 6;
const PITCH_X = 17;
const PITCH_Z = 19;
const ROWS = Math.ceil(SHEET.length / COLS);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fa4b4);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 900);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdfe9f2, 0x53514a, 1.05));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
sun.position.set(40, 70, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const shadowCam = sun.shadow.camera as THREE.OrthographicCamera;
shadowCam.left = -90; shadowCam.right = 90; shadowCam.top = 90; shadowCam.bottom = -90; shadowCam.far = 260;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x6f7a58, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const originX = -((COLS - 1) * PITCH_X) / 2;
const originZ = -((ROWS - 1) * PITCH_Z) / 2;
const slots: { type: string; pos: THREE.Vector3; el: HTMLDivElement }[] = [];
const labelBox = document.getElementById('labels') as HTMLDivElement;

SHEET.forEach((entry, i) => {
  const x = originX + (i % COLS) * PITCH_X;
  const z = originZ + Math.floor(i / COLS) * PITCH_Z;

  // the claimed footprint, drawn on the deck — a prop that overhangs its
  // claim is the whole reason this square is here
  if (entry.tiles > 0) {
    const w = entry.tiles * TILE;
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w),
      new THREE.MeshStandardMaterial({ color: 0x3d4434, roughness: 1 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, 0.02, z);
    scene.add(pad);
  }

  // THE YARDSTICK. If the barn isn't clearly bigger than this, the barn is wrong.
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, SOLDIER_H, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8483c, roughness: 0.8 }),
  );
  post.position.set(x - 4.2, SOLDIER_H / 2, z + 3.4);
  post.castShadow = true;
  scene.add(post);

  const obj = buildProp(entry.type, 1);
  obj.position.set(x, 0, z);
  scene.add(obj);

  const el = document.createElement('div');
  el.className = 'lbl';
  el.textContent = entry.type;
  labelBox.appendChild(el);
  slots.push({ type: entry.type, pos: new THREE.Vector3(x, 0, z + 5.4), el });
});

camera.position.set(0, 46, 68);
camera.lookAt(0, 2, -2);

// GLB props mount asynchronously (props.ts law: buildProp is synchronous, the
// mesh arrives later), so we just keep drawing. __sheet lets a screenshot wait
// for the library to settle instead of guessing at a timeout — and report what
// actually has geometry, which is the question that matters.
let frames = 0;
const v = new THREE.Vector3();
function loop() {
  frames++;
  for (const s of slots) {
    v.copy(s.pos).project(camera);
    s.el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    s.el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

/** Per prop: does it actually have triangles on the deck, and how big is it?
 *  An empty group renders as nothing at all and looks identical to a prop
 *  that's simply off-camera — this tells them apart. */
function census() {
  const box = new THREE.Box3();
  return slots.map((s) => {
    const obj = scene.children.find(
      (c) => c.position.x === s.pos.x && c.position.z === s.pos.z - 5.4 && !(c as THREE.Mesh).isMesh,
    );
    if (!obj) return { type: s.type, meshes: 0, h: 0, w: 0 };
    let meshes = 0;
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    box.setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    return {
      type: s.type, meshes,
      h: +size.y.toFixed(2), w: +size.x.toFixed(2),
      minY: +box.min.y.toFixed(2),
    };
  });
}

interface SheetHandle { frames: () => number; census: typeof census }
(window as unknown as { __sheet: SheetHandle }).__sheet = { frames: () => frames, census };

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
