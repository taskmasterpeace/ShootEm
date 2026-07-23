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
import { buildWeaponModel } from './models/weapons';

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
  mkArm(0.3, 'R');
  mkArm(-0.3, 'L');
  // THE OFF-HAND SHOULDER, PLACED BY ROBERT (gizmo, 2026-07-20) — forward
  // 3cm, down 7cm, 10cm inward. It exists FOR THE GUN REACH (his live note,
  // round 4: unarmed it read "messed up" — because it's a foregrip reach).
  // Same lab convention: the gun hand is R (+z), the off-hand is L (−z).
  const offhand = g.getObjectByName('armL');
  if (offhand) offhand.position.set(0.0326, 1.3258, -0.2046);
  // the gun mount — a wrist group inside the right hand, exactly the lab's
  const elbowR = g.getObjectByName('elbowR');
  if (elbowR) {
    const wrist = new THREE.Group();
    wrist.name = 'wrist';
    wrist.position.y = -0.29;
    elbowR.add(wrist);
  }

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
  gun?: THREE.Group;   // craft only — the Kuchler in the wrist mount
  wrist?: THREE.Group;
  muzzleX?: number;    // gun-local muzzle tip, for the flash
  flash?: THREE.Mesh;
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

// the same rifle on every pedestal — apples to apples (Robert, round 4:
// "you gotta let me see how it look with a gun, bro… holding a gun, running")
const RIFLE_ID = 'rifle_kuchler_2';

const pedestals: Pedestal[] = [
  mount(buildSoldier(0, 'infantry', 'human', RIFLE_ID), 0, 11, 'rig'),
  mount(buildPapercraft(UF_DRESS), 1, 22, 'craft'),
  mount(buildPapercraft(COL_DRESS), 2, 33, 'craft'),
];
for (const p of pedestals) {
  if (p.kind !== 'craft') continue;
  p.wrist = (p.body.getObjectByName('wrist') as THREE.Group) ?? undefined;
  if (p.wrist) {
    p.gun = buildWeaponModel(RIFLE_ID);
    // the muzzle tip — where the flash lives (gun local, muzzle +X law)
    p.muzzleX = new THREE.Box3().setFromObject(p.gun).max.x;
    // gripL — the off-hand's IK target, seated on the gun's REAL handguard
    // anchor (the grip contract; falls back to the rifle default +0.30,-0.06)
    const anchors = (p.gun.userData as { anchors?: { handguard?: { x: number; y: number } | null } }).anchors;
    const hg = anchors?.handguard ?? { x: 0.3, y: -0.06 };
    if (hg) {
      const m = new THREE.Object3D();
      m.name = 'gripL';
      m.position.set(hg.x, hg.y, 0);
      p.gun.add(m);
    }
    // the muzzle flash — hidden until the trigger says otherwise
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    flash.position.set(p.muzzleX + 0.12, 0, 0);
    flash.visible = false;
    p.gun.add(flash);
    p.flash = flash;
    p.wrist.add(p.gun);
  }
}

// the GLB infantry body streams in async — re-audition pedestal A when it lands
for (const delay of [1500, 4000]) {
  setTimeout(() => {
    const fresh = buildSoldier(0, 'infantry', 'human', RIFLE_ID);
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
let armed = true; // G stows the rifle — the bare-body read stays one key away
let firing = false; // hold F — Robert: "we need to see how he look when he's shooting it"
let fireCd = 0, flashT = 0, kick = 0;
const SPEED: Record<PoseId, number> = { idle: 0, walk: 3.4, run: 8.6, crouch: 0, crouchwalk: 3.2 };
const crouching = () => pose === 'crouch' || pose === 'crouchwalk';

// THE RIFLE CARRY — ported verbatim from the Style Lab HOLDS (stylelab.ts):
// the standing carry, and ROBERT'S OWN sprint numbers (gizmo, 2026-07-20 —
// "when they're running they should hold their weapon different").
interface HoldPose { armR: [number, number]; elbowR: number; armL: [number, number]; elbowL: number; local: [number, number, number]; localRotZ: number }
const CARRY: { idle: HoldPose; run: HoldPose } = {
  idle: { armR: [0, 0.35], elbowR: 1.1, armL: [0.62, 0.5], elbowL: 0.95, local: [0.1, -0.03, 0], localRotZ: -1.51 },
  run:  { armR: [0, 0.12], elbowR: 0.7, armL: [0.55, 0.42], elbowL: 0.85, local: [0.131, -0.0576, 0], localRotZ: -1.32 },
};

function applyCarry(p: Pedestal) {
  if (!p.gun || !p.wrist) return;
  p.gun.visible = armed;
  if (!armed) return; // stowed: the gait owns the arms again
  // firing plants you in the standing brace; otherwise the pose picks the carry
  const hold = firing ? CARRY.idle : pose === 'run' ? CARRY.run : CARRY.idle;
  const aR = p.joints.armR, aL = p.joints.armL, eR = p.joints.elbowR, eL = p.joints.elbowL;
  if (aR) aR.rotation.set(hold.armR[0], 0, hold.armR[1]);
  if (aL) aL.rotation.set(hold.armL[0], 0, hold.armL[1]);
  if (eR) eR.rotation.set(0, 0, hold.elbowR);
  if (eL) eL.rotation.set(0, 0, hold.elbowL);
  // the arms LIVE at a sprint (Robert: "the hands not moving with the body")
  // — the gun arm pumps with the stride; the off-hand follows through the IK
  if (pose === 'run' && !firing && aR) aR.rotation.z += Math.sin(t * 7.4 + p.id) * 0.07;
  p.gun.position.set(hold.local[0], hold.local[1], hold.local[2]);
  p.gun.rotation.set(0, 0, hold.localRotZ);
  p.gun.translateX(-kick); // recoil rides the gun's own axis
  if (p.flash) {
    p.flash.visible = flashT > 0;
    p.flash.rotation.x = (t * 53) % (Math.PI * 2); // a different petal every shot
  }
  solveOffhand(p); // the off-hand PLANTS on the foregrip — the reach the tuned shoulder exists for
}

// ---------------------------------------------------------------------------
// THE OFF-HAND SOLVE — the Style Lab's two-bone analytic IK (solveLeftArm),
// targeting the arsenal gun's REAL handguard anchor (userData.anchors, the
// grip contract from models/weapons.ts).
// ---------------------------------------------------------------------------
const L_UPPER = 0.4, L_FORE = 0.3;
const DOWN = new THREE.Vector3(0, -1, 0);
const _t = new THREE.Vector3(), _dir = new THREE.Vector3(), _n = new THREE.Vector3();
const _u = new THREE.Vector3(), _e = new THREE.Vector3(), _v = new THREE.Vector3();
const _qi = new THREE.Quaternion();

function solveOffhand(p: Pedestal) {
  const aL = p.joints.armL as THREE.Object3D | undefined;
  const eL = p.joints.elbowL as THREE.Object3D | undefined;
  const marker = p.gun?.getObjectByName('gripL');
  if (!aL || !eL || !marker) return;
  p.root.updateMatrixWorld(true);
  marker.getWorldPosition(_t);
  p.body.worldToLocal(_t);                        // target, body space
  const S = aL.position;                          // shoulder pivot (Robert's tuned seat)
  _dir.copy(_t).sub(S);
  const d = Math.min(Math.max(_dir.length(), Math.abs(L_UPPER - L_FORE) + 0.01), L_UPPER + L_FORE - 0.01);
  _dir.normalize();
  const gamma = Math.acos(Math.min(1, Math.max(-1, (L_UPPER * L_UPPER + d * d - L_FORE * L_FORE) / (2 * L_UPPER * d))));
  _n.crossVectors(_dir, DOWN);
  if (_n.lengthSq() < 1e-4) _n.set(0, 0, 1);
  _n.normalize();
  _u.copy(_dir).applyAxisAngle(_n, gamma);
  _e.copy(S).addScaledVector(_u, L_UPPER);
  if (_e.y > S.y + _dir.y * L_UPPER) {            // elbow above the line reads broken — flip
    _u.copy(_dir).applyAxisAngle(_n, -gamma);
    _e.copy(S).addScaledVector(_u, L_UPPER);
  }
  aL.quaternion.setFromUnitVectors(DOWN, _u);
  _v.copy(_t).sub(_e).normalize();
  _qi.copy(aL.quaternion).invert();
  _v.applyQuaternion(_qi);
  eL.quaternion.setFromUnitVectors(DOWN, _v.normalize());
}

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
  // the trigger — 7 rounds/sec, a kick per round, a petal of flash
  fireCd -= dt; flashT -= dt;
  kick *= Math.exp(-dt * 16);
  if (firing && armed && fireCd <= 0) { fireCd = 0.14; kick = 0.075; flashT = 0.055; }
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
    applyCarry(p); // the carry overrides the arm swing while armed — game law
    // THE LIFE PASS (Robert, round 4): the head moves while walking, the body
    // bobs at a run — candidates only; A stays exactly as the game ships it
    if (p.kind === 'craft') {
      const moving = SPEED[pose] > 0;
      const stride = t * (pose === 'run' ? 7.4 : 4.4) + p.id;
      if (moving) p.body.position.y += Math.abs(Math.sin(stride)) * (pose === 'run' ? 0.055 : 0.022);
      const head = p.joints.head;
      if (head) {
        head.rotation.z += Math.sin(stride) * (moving ? 0.055 : 0.02);
        head.rotation.x += Math.sin(stride * 0.5 + 0.7) * (moving ? 0.045 : 0.012);
      }
    }
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
  if (e.key === 'g' || e.key === 'G') armed = !armed;
  if ((e.key === 'f' || e.key === 'F') && !e.repeat) firing = true;
});
addEventListener('keyup', (e) => {
  if (e.key === 'f' || e.key === 'F') firing = false;
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// live-verify handle
(window as unknown as Record<string, unknown>).__bodylab = { scene, pedestals, setPose, camera, controls };
