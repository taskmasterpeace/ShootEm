// ---------------------------------------------------------------------------
// THE BODY SHOP (/bodylab.html) — Robert's body decision, staged live.
// His ruling (2026-07-22, batch 3): "I think we need the capsule from the LSW
// stuff, but we should improve it a little bit… I think we need legs, right?
// Because we wanna be able to crouch… Build me something to show it to me,
// and I'll decide from there."
//
// Three pedestals, one shared truth:
//   A — THE CURRENT RIG   buildSoldier() exactly as the game ships it. Its
//                         crouch is honest here: the 0.5u dip the renderer
//                         does (renderer.ts ~2636) and NOTHING else.
//   B — CAPSULE + LEGS    the LSW-toy technique grown up: capsule limbs with
//                         a SPHERE CAP AT EVERY PIVOT (the invisible-joint
//                         trick from the D:\lsw autopsy), icosahedron fists —
//                         and a real leg chain, so crouch actually FOLDS.
//   C — CAPSULE BARE POD  the purist no-legs pod on a hover skirt. Its crouch
//                         can only SQUASH — the case for legs, made visually.
//
// All three ride the SAME rig contract (legL/legR/shinL/shinR/armL/armR/
// head/torso) and the SAME poseSoldierJoints the game uses — the walk you
// see is the walk you'd get. No purple. Decision page, not shipped art.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { poseSoldierJoints, type GaitState, type Joints } from './animation';
import { buildSoldier } from './models/soldiers';

type PoseId = 'idle' | 'walk' | 'run' | 'crouch' | 'crouchwalk';

// ---------------------------------------------------------------------------
// SCENE — the tactical-terminal bench
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141612);
scene.fog = new THREE.Fog(0x141612, 18, 46);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
camera.position.set(6.4, 2.3, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.maxPolarAngle = Math.PI * 0.55;
controls.minDistance = 2.5;
controls.maxDistance = 18;

scene.add(new THREE.HemisphereLight(0xcfd8d2, 0x2a2820, 0.9));
const sun = new THREE.DirectionalLight(0xffe8c0, 1.7);
sun.position.set(10, 16, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x9fb8c8, 0.5);
rim.position.set(-8, 6, -4);
scene.add(rim);

// floor + pedestal discs
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x1b1e18, roughness: 0.95 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(60, 60, 0x2c2f26, 0x22251e);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.5;
grid.position.y = 0.002;
scene.add(grid);

// pedestal z positions: A · B · C — camera sits at +X looking back, so +Z is
// screen-LEFT; A leads on the left to match the legend cards
const SLOTS = [2.4, 0, -2.4];
for (const z of SLOTS) {
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.05, 0.06, 40),
    new THREE.MeshStandardMaterial({ color: 0x24271f, roughness: 0.8, metalness: 0.2 }),
  );
  disc.position.set(0, 0.03, z);
  disc.receiveShadow = true;
  scene.add(disc);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.015, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0xe8a33d, emissive: 0xe8a33d, emissiveIntensity: 0.4 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.065, z);
  scene.add(ring);
}

// ---------------------------------------------------------------------------
// THE CAPSULE BUILDER — the LSW technique: a sphere cap AT every pivot, so a
// bending joint never opens a seam. Limbs are capsules hanging −Y from named
// joints; fists are icosahedra; the body faces +X (rig law).
// ---------------------------------------------------------------------------
function mat(color: number, o: { rough?: number; metal?: number; emissive?: number } = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0.15,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissive ? 0.85 : 0,
  });
}
function capsule(r: number, len: number, m: THREE.Material): THREE.Mesh {
  const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m);
  c.castShadow = true;
  return c;
}
function sphere(r: number, m: THREE.Material): THREE.Mesh {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
  s.castShadow = true;
  return s;
}

interface CapsulePalette { suit: number; plate: number; trim: number; glow: number; visor: number }
const UF_PAL: CapsulePalette = { suit: 0x5c5236, plate: 0x46422e, trim: 0x8a7a4a, glow: 0xe8a33d, visor: 0x1a1712 };
const COL_PAL: CapsulePalette = { suit: 0x2c3840, plate: 0x415663, trim: 0x5e7886, glow: 0x35c8e8, visor: 0x0c1216 };

function buildCapsuleTrooper(pal: CapsulePalette, legs: boolean): THREE.Group {
  const g = new THREE.Group();
  const suit = mat(pal.suit, { rough: 0.85 });
  const plate = mat(pal.plate, { rough: 0.5, metal: 0.35 });
  const trim = mat(pal.trim, { rough: 0.5, metal: 0.3 });
  const glow = mat(pal.glow, { emissive: pal.glow, rough: 0.35 });

  // ---- torso: one clean pod (chest capsule over a pelvis sphere) ----
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.98;
  g.add(torso);
  const chest = capsule(0.27, 0.34, plate);
  chest.position.y = 0.32;
  torso.add(chest);
  const sternum = capsule(0.06, 0.22, glow); // the power seam — reads at range
  sternum.position.set(0.24, 0.32, 0);
  torso.add(sternum);
  const belt = sphere(0.22, trim);
  belt.scale.y = 0.6;
  belt.position.y = 0.02;
  torso.add(belt);

  // ---- head: dome + visor band, child of the named joint ----
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 1.62;
  g.add(head);
  const dome = sphere(0.175, suit);
  dome.position.y = 0.08;
  head.add(dome);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.178, 18, 10, 0, Math.PI * 2, Math.PI * 0.34, Math.PI * 0.22), mat(pal.visor, { rough: 0.2, metal: 0.6 }));
  visor.position.y = 0.08;
  visor.rotation.z = -Math.PI / 2; // band faces +X — the way the body walks
  head.add(visor);
  const visorGlow = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 24, Math.PI * 0.9), mat(pal.glow, { emissive: pal.glow }));
  visorGlow.position.set(0.13, 0.09, 0);
  visorGlow.rotation.y = Math.PI / 2;
  visorGlow.rotation.z = Math.PI * 0.55;
  head.add(visorGlow);

  // ---- arms: shoulder sphere → upper capsule → elbow sphere → forearm → fist ----
  for (const side of [1, -1]) {
    const arm = new THREE.Group();
    arm.name = side === 1 ? 'armL' : 'armR';
    arm.position.set(0, 1.48, side * 0.34);
    g.add(arm);
    arm.add(sphere(0.115, plate)); // deltoid cap AT the pivot — the invisible joint
    const upper = capsule(0.08, 0.2, suit);
    upper.position.y = -0.19;
    arm.add(upper);
    const elbow = new THREE.Group();
    elbow.name = side === 1 ? 'elbowL' : 'elbowR';
    elbow.position.y = -0.36;
    arm.add(elbow);
    elbow.add(sphere(0.085, trim)); // elbow cap
    const fore = capsule(0.07, 0.18, suit);
    fore.position.y = -0.16;
    elbow.add(fore);
    const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.095, 0), plate);
    fist.castShadow = true;
    fist.position.y = -0.32;
    elbow.add(fist);
  }

  if (legs) {
    // ---- the leg chain: hip sphere → thigh → knee sphere → shin → foot ----
    for (const side of [1, -1]) {
      const hip = new THREE.Group();
      hip.name = side === 1 ? 'legL' : 'legR';
      hip.position.set(0, 0.96, side * 0.16);
      g.add(hip);
      hip.add(sphere(0.125, trim)); // hip cap at the pivot
      const thigh = capsule(0.1, 0.24, suit);
      thigh.position.y = -0.21;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.name = side === 1 ? 'shinL' : 'shinR';
      knee.position.y = -0.44;
      hip.add(knee);
      knee.add(sphere(0.1, plate)); // knee cap — the fold never opens a seam
      const shin = capsule(0.082, 0.22, suit);
      shin.position.y = -0.2;
      knee.add(shin);
      const foot = sphere(0.115, plate);
      foot.scale.set(1.5, 0.55, 0.9);
      foot.position.set(0.07, -0.47, 0);
      knee.add(foot);
    }
  } else {
    // ---- the bare pod: the torso runs long, a hover skirt closes it ----
    const pod = capsule(0.24, 0.42, suit);
    pod.position.y = 0.62;
    g.add(pod);
    const skirt = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 10, 28), plate);
    skirt.rotation.x = Math.PI / 2;
    skirt.position.y = 0.34;
    skirt.castShadow = true;
    g.add(skirt);
    const lift = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 24), glow);
    lift.rotation.x = Math.PI / 2;
    lift.position.y = 0.26;
    g.add(lift);
    // the contact shadow that sells the hover
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    g.add(shadow);
  }
  return g;
}

// ---------------------------------------------------------------------------
// THE THREE PEDESTALS
// ---------------------------------------------------------------------------
interface Pedestal {
  root: THREE.Group;
  body: THREE.Group;
  joints: Joints;
  gait: GaitState;
  id: number;
  kind: 'rig' | 'legs' | 'pod';
}

function gatherJoints(root: THREE.Object3D): Joints {
  const j: Joints = {};
  for (const name of ['legL', 'legR', 'shinL', 'shinR', 'armL', 'armR', 'elbowL', 'elbowR', 'head', 'torso']) {
    j[name] = root.getObjectByName(name) ?? undefined;
  }
  return j;
}

function mount(body: THREE.Group, slot: number, id: number, kind: Pedestal['kind']): Pedestal {
  const root = new THREE.Group();
  root.position.set(0, 0.06, SLOTS[slot]);
  root.rotation.y = 0; // bodies face +X — straight at the camera
  root.add(body);
  scene.add(root);
  return { root, body, joints: gatherJoints(body), gait: {}, id, kind };
}

const pedestals: Pedestal[] = [
  mount(buildSoldier(0, 'infantry', 'human'), 0, 11, 'rig'),
  mount(buildCapsuleTrooper(UF_PAL, true), 1, 22, 'legs'),
  mount(buildCapsuleTrooper(COL_PAL, false), 2, 33, 'pod'),
];

// the GLB infantry body streams in async — re-audition pedestal A when it lands
for (const delay of [1500, 4000]) {
  setTimeout(() => {
    const fresh = buildSoldier(0, 'infantry', 'human');
    const p = pedestals[0];
    p.root.remove(p.body);
    p.body = fresh;
    p.root.add(fresh);
    p.joints = gatherJoints(fresh);
  }, delay);
}

// ---------------------------------------------------------------------------
// POSES — gait via the game's own poseSoldierJoints; crouch as each body can
// ---------------------------------------------------------------------------
let pose: PoseId = 'idle';
const SPEED: Record<PoseId, number> = { idle: 0, walk: 3.4, run: 8.6, crouch: 0, crouchwalk: 3.2 };
const crouching = () => pose === 'crouch' || pose === 'crouchwalk';

function applyCrouch(p: Pedestal) {
  if (!crouching()) return;
  if (p.kind === 'rig') {
    // the game's honest crouch: a 0.5u dip, nothing folds (renderer.ts ~2636)
    p.body.position.y = -0.5;
  } else if (p.kind === 'legs') {
    // the fold the legs buy: thighs swing forward, knees bite back, the
    // torso leans into it and the head stays on the fight
    p.body.position.y = -0.34;
    for (const n of ['legL', 'legR'] as const) { const o = p.joints[n]; if (o) o.rotation.z += 1.05; }
    for (const n of ['shinL', 'shinR'] as const) { const o = p.joints[n]; if (o) o.rotation.z += -1.3; }
    const torso = p.joints.torso; if (torso) torso.rotation.z += -0.22;
    const head = p.joints.head; if (head) head.rotation.z += 0.24;
  } else {
    // the pod's only move: squash. This is the whole argument for legs.
    p.body.scale.y = 0.68;
  }
}

const clock = new THREE.Clock();
let t = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  for (const p of pedestals) {
    // reset the frame-owned transforms, then pose fresh (renderer does the same)
    p.body.position.y = 0;
    p.body.scale.set(1, 1, 1);
    for (const name of Object.keys(p.joints)) {
      const o = p.joints[name];
      if (o) o.rotation.set(0, 0, 0);
    }
    poseSoldierJoints(p.joints, {
      kind: 'human', time: t, id: p.id, speed: SPEED[pose] * (p.kind === 'pod' && crouching() ? 0 : 1),
      airborne: false, dt, state: p.gait,
    });
    applyCrouch(p);
    // the pod has no legs to stride with — give it the hover bob instead
    if (p.kind === 'pod') p.body.position.y += 0.05 + Math.sin(t * 2.2 + 1.7) * 0.035;
  }
  controls.update();
  renderer.render(scene, camera);
}
frame();

// ---------------------------------------------------------------------------
// CONTROLS
// ---------------------------------------------------------------------------
const buttons = [...document.querySelectorAll<HTMLButtonElement>('#bar button')];
function setPose(next: PoseId) {
  pose = next;
  for (const b of buttons) b.classList.toggle('on', b.dataset.pose === next);
}
for (const b of buttons) b.addEventListener('click', () => setPose(b.dataset.pose as PoseId));
addEventListener('keydown', (e) => {
  const map: Record<string, PoseId> = { '1': 'idle', '2': 'walk', '3': 'run', '4': 'crouch', '5': 'crouchwalk' };
  if (map[e.key]) setPose(map[e.key]);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// live-verify handle
(window as unknown as Record<string, unknown>).__bodylab = { scene, pedestals, setPose, camera, controls };
