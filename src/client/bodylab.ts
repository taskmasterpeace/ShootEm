// ---------------------------------------------------------------------------
// THE BODY SHOP (/bodylab.html) — Robert's body decision, staged live.
// His ruling (2026-07-22, batch 3): "I think we need the capsule from the LSW
// stuff, but we should improve it a little bit… I think we need legs, right?
// Because we wanna be able to crouch… Build me something to show it to me,
// and I'll decide from there."
//
// Round 4 (2026-07-22, live ruling): the capsule candidates read as "a cheap
// robot" — both dismissed. The PAPERCRAFT (the Style Lab body Robert liked,
// stylelab.ts:384) takes the stage in both faction dresses.
//
// Three pedestals, one shared truth:
//   A — THE CURRENT RIG   buildSoldier() exactly as the game ships it. Its
//                         crouch is honest here: the 0.5u dip the renderer
//                         does (renderer.ts ~2636) and NOTHING else.
//   B — THE PAPERCRAFT    United Front dress — v2 proportions, skin head and
//                         hands, camo plates proud of the cloth, REAL knees:
//                         the crouch genuinely folds.
//   C — THE PAPERCRAFT    Collective dress — same body, the sealed faction:
//                         proof the style carries both armies.
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
// ---------------------------------------------------------------------------
// THE PAPERCRAFT SOLDIER — ported from the Style Lab (stylelab.ts:384, the
// body Robert LIKED: "I did like that paper craft thing that we had before").
// Round-4 ruling (2026-07-22, live): the capsule candidates read as "a cheap
// robot" — both are OFF the pedestals. The papercraft takes the stage in both
// faction dresses. Same v2 proportions, same hand-placed off-hand shoulder;
// the knee groups gain the contract names (shinL/shinR) so the game's own
// gait drives them here.
// ---------------------------------------------------------------------------
interface FactionDress { jacket: number; trouser: number; camoA: number; camoB: number; accent: number }
const UF_DRESS: FactionDress = { jacket: 0x687a34, trouser: 0x5c4a30, camoA: 0x4c5c24, camoB: 0x8a9450, accent: 0xe8a33d };
const COL_DRESS: FactionDress = { jacket: 0x38414f, trouser: 0x22252c, camoA: 0x2a3340, camoB: 0x55616f, accent: 0x35c8f0 };

function buildPapercraft(dress: FactionDress): THREE.Group {
  const g = new THREE.Group();
  const SKIN = 0xc9835f, JACKET = dress.jacket, TROUSER = dress.trouser, BOOT = 0x24262a;
  const box = (w: number, h: number, d: number, c: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, { rough: 0.85 }));
    m.castShadow = true;
    return m;
  };

  // ---- torso: a named GROUP at the bend point so the lean carries the
  // jacket, belt, camo and strap together (the lab drove these by ref) ----
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.98;
  g.add(torso);
  const jacket = box(0.36, 0.52, 0.46, JACKET); jacket.position.y = 0.24; torso.add(jacket);
  const belt = box(0.38, 0.07, 0.48, BOOT); belt.position.y = -0.04; torso.add(belt);
  // camo plates proud of the cloth — they ARE the style
  const camo = (w: number, h: number, x: number, y: number, z: number, c: number) => {
    const m = box(0.02, h, w, c);
    m.position.set(x, y, z);
    torso.add(m);
  };
  camo(0.14, 0.12, 0.19, 0.34, 0.08, dress.camoA);
  camo(0.11, 0.09, 0.19, 0.12, -0.12, dress.camoB);
  camo(0.13, 0.1, -0.19, 0.26, 0.05, dress.camoA);
  // the faction strap — accent color AND a shape
  const strap = box(0.05, 0.54, 0.09, dress.accent);
  strap.position.set(0.19, 0.22, 0.04);
  strap.rotation.x = 0.55;
  torso.add(strap);

  // ---- head: the bare 0.3 cube, skin — the cut gap below it is the look ----
  const head = box(0.3, 0.3, 0.3, SKIN);
  head.position.y = 1.68;
  head.name = 'head';
  g.add(head);

  // ---- arms: shoulder cube → upper → elbow group → forearm → skin hand ----
  const mkArm = (dz: number, side: 'R' | 'L') => {
    const arm = new THREE.Group();
    arm.position.set(0, 1.4, dz);
    arm.name = 'arm' + side;
    const sh = box(0.15, 0.15, 0.15, JACKET); sh.position.y = 0; arm.add(sh);
    const up = box(0.12, 0.28, 0.13, JACKET); up.position.y = -0.22; arm.add(up);
    const elbow = new THREE.Group();
    elbow.position.y = -0.4;
    elbow.name = 'elbow' + side;
    const fore = box(0.1, 0.24, 0.11, JACKET); fore.position.y = -0.12; elbow.add(fore);
    const hand = box(0.11, 0.12, 0.1, SKIN); hand.position.y = -0.29; elbow.add(hand);
    arm.add(elbow);
    g.add(arm);
  };
  mkArm(0.3, 'L');
  mkArm(-0.3, 'R');
  // THE OFF-HAND SHOULDER, PLACED BY ROBERT (gizmo, 2026-07-20) — forward
  // 3cm, down 7cm, 10cm inward; the IK owns the rotation live. Preserved
  // verbatim from the lab (it placed armL at the lab's -z slot).
  const offhand = g.getObjectByName('armR');
  if (offhand) offhand.position.set(0.0326, 1.3258, -0.2046);

  // ---- legs: thigh → knee group (contract name shin*) → shin → boot ----
  const mkLeg = (dz: number, side: 'R' | 'L') => {
    const leg = new THREE.Group();
    leg.position.set(0, 0.92, dz);
    leg.name = 'leg' + side;
    const th = box(0.17, 0.36, 0.19, TROUSER); th.position.y = -0.19; leg.add(th);
    const camoT = box(0.02, 0.09, 0.11, side === 'R' ? dress.camoA : dress.camoB);
    camoT.position.set(0.09, -0.2, 0); th.add(camoT);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    knee.name = 'shin' + side; // the game's rig contract drives THIS name
    const shin = box(0.14, 0.32, 0.16, TROUSER); shin.position.y = -0.16; knee.add(shin);
    // A FOOT IS LONG, NOT WIDE (the lab lesson): a boot, not a snowshoe
    const bt = box(0.26, 0.12, 0.13, BOOT); bt.position.set(0.06, -0.42, 0); knee.add(bt);
    leg.add(knee);
    g.add(leg);
  };
  mkLeg(0.14, 'L');
  mkLeg(-0.14, 'R');
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
  kind: 'rig' | 'craft';
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
  mount(buildPapercraft(UF_DRESS), 1, 22, 'craft'),
  mount(buildPapercraft(COL_DRESS), 2, 33, 'craft'),
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
  } else {
    // the fold real knees buy: thighs swing forward, knees bite back, the
    // torso leans into it and the head stays on the fight. DEEP — the whole
    // argument is that this body can get LOWER than A's fake dip
    p.body.position.y = -0.52;
    for (const n of ['legL', 'legR'] as const) { const o = p.joints[n]; if (o) o.rotation.z += 1.45; }
    for (const n of ['shinL', 'shinR'] as const) { const o = p.joints[n]; if (o) o.rotation.z += -1.95; }
    const torso = p.joints.torso; if (torso) torso.rotation.z += -0.3;
    const head = p.joints.head; if (head) head.rotation.z += 0.32;
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
      kind: 'human', time: t, id: p.id, speed: SPEED[pose],
      airborne: false, dt, state: p.gait,
    });
    applyCrouch(p);
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
