// ---------------------------------------------------------------------------
// THE ARMORY CONTACT SHEET (/armory.html) — every weapon family the arsenal
// generates, one ROW per family, its 4 brands × 3 marks marching across the
// columns. The propsheet's little sibling: silhouettes are a thing you SEE,
// and "the Kuchler is skeletal, the Titan is a brick" has to be visible from
// command height or the whole variation system is stat-table fiction.
//
// Keys: ↑/↓ walk the camera row to row, O returns to overview.
// window.__sheet: { frames, census, focus(row), overview } for screenshots.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { WEAPONS } from '../sim/data';
import { FAMILIES } from '../sim/arsenal';
import { buildWeaponModel } from './models/weapons';

const SCALE = 4.5;
const PITCH_X = 7;
const PITCH_Z = 5;

/** brand short codes for slot labels */
const BRAND_CODE: Record<string, string> = {
  maklov: 'MK', kuchler: 'KU', titan: 'TA', harkov: 'HK', ceres: 'CF', kamenel: 'KM',
};
const ROMAN = ['', 'I', 'II', 'III'];

/** rows: the 16 generated families in arsenal order, then grenades, specials */
const rows: { label: string; ids: string[] }[] = [];
for (const f of FAMILIES) {
  const ids = Object.keys(WEAPONS).filter(
    (id) => id.startsWith(`${f.family}_`) && WEAPONS[id].family === f.family,
  );
  rows.push({ label: f.label.toUpperCase(), ids });
}
for (const fam of ['grenade', 'special', 'marker'] as const) {
  const ids = Object.keys(WEAPONS).filter((id) => WEAPONS[id].family === fam);
  rows.push({ label: fam.toUpperCase(), ids });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x272c33);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 900);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe8f0f8, 0x6a675e, 1.75));
const sun = new THREE.DirectionalLight(0xfff2d8, 2.3);
sun.position.set(30, 60, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const shadowCam = sun.shadow.camera as THREE.OrthographicCamera;
shadowCam.left = -110; shadowCam.right = 110; shadowCam.top = 110; shadowCam.bottom = -110; shadowCam.far = 300;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const COLS = Math.max(...rows.map((r) => r.ids.length));
const originX = -((COLS - 1) * PITCH_X) / 2;
const originZ = -((rows.length - 1) * PITCH_Z) / 2;

const labelBox = document.getElementById('labels') as HTMLDivElement;
const slots: { id: string; obj: THREE.Group; pos: THREE.Vector3; el: HTMLDivElement }[] = [];
const rowAnchors: { z: number; el: HTMLDivElement }[] = [];

rows.forEach((row, ri) => {
  const z = originZ + ri * PITCH_Z;

  const famEl = document.createElement('div');
  famEl.className = 'lbl fam';
  famEl.textContent = row.label;
  labelBox.appendChild(famEl);
  rowAnchors.push({ z, el: famEl });

  row.ids.forEach((id, ci) => {
    const x = originX + ci * PITCH_X;
    const obj = buildWeaponModel(id);
    obj.scale.setScalar(SCALE);
    // rest the piece just above the deck, angled a touch toward the camera
    obj.position.set(x, 1.1, z);
    obj.rotation.y = -0.25;
    scene.add(obj);

    const el = document.createElement('div');
    el.className = 'lbl';
    const parts = id.split('_');
    const brand = BRAND_CODE[parts[parts.length - 2]];
    const mk = Number(parts[parts.length - 1]);
    el.textContent = brand && mk ? `${brand}·${ROMAN[mk]}` : id;
    labelBox.appendChild(el);
    slots.push({ id, obj, pos: new THREE.Vector3(x, 0, z + 1.9), el });
  });
});

let focusRow = -1; // -1 = overview
function overview() {
  focusRow = -1;
  camera.position.set(0, 95, originZ + rows.length * PITCH_Z * 0.72);
  camera.lookAt(0, 0, 0);
}
function focus(ri: number) {
  focusRow = Math.max(0, Math.min(rows.length - 1, ri));
  const z = originZ + focusRow * PITCH_Z;
  // center on the row's ACTUAL spread — a 3-gun row (markers) used to sit
  // off-frame left while the camera framed the 12-wide grid's middle
  const cx = originX + ((rows[focusRow].ids.length - 1) * PITCH_X) / 2;
  camera.position.set(cx, 11, z + 10.5);
  camera.lookAt(cx, 1, z - 0.5);
}
overview();

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') focus(focusRow < 0 ? 0 : focusRow + 1);
  else if (e.key === 'ArrowUp') focus(focusRow < 0 ? rows.length - 1 : focusRow - 1);
  else if (e.key.toLowerCase() === 'o') overview();
});

let frames = 0;
const v = new THREE.Vector3();
function loop() {
  frames++;
  for (const s of slots) {
    v.copy(s.pos).project(camera);
    const off = v.z > 1; // behind the camera: park it off-screen
    s.el.style.left = off ? '-999px' : `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    s.el.style.top = off ? '-999px' : `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
  }
  for (const r of rowAnchors) {
    v.set(originX - PITCH_X * 0.9, 0, r.z).project(camera);
    const off = v.z > 1;
    r.el.style.left = off ? '-999px' : `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    r.el.style.top = off ? '-999px' : `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

/** Per weapon: mesh count, triangle count, bbox — the numbers the budget law
 *  cares about, from the objects actually on the deck. */
function census() {
  const box3 = new THREE.Box3();
  const size = new THREE.Vector3();
  return slots.map((s) => {
    let meshes = 0;
    let tris = 0;
    s.obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        meshes++;
        const geo = m.geometry as THREE.BufferGeometry;
        tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      }
    });
    box3.setFromObject(s.obj);
    box3.getSize(size);
    return {
      id: s.id, meshes, tris: Math.round(tris),
      w: +(size.x / SCALE).toFixed(2), h: +(size.y / SCALE).toFixed(2),
    };
  });
}

interface SheetHandle {
  frames: () => number; census: typeof census;
  focus: (ri: number) => void; overview: () => void; rows: number;
}
(window as unknown as { __sheet: SheetHandle }).__sheet = {
  frames: () => frames, census, focus, overview, rows: rows.length,
};

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
