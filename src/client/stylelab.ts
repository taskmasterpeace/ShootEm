// ---------------------------------------------------------------------------
// THE STYLE LAB (/style.html) — round three: the PAPERCRAFT SOLDIER, alone.
// Robert's cut: "get rid of everything and we're gonna keep just the paper
// craft, and we're gonna start editing that up a little bit."
//
// What this bench is now:
//   · TWO papercraft soldiers — United Front and Collective — in properly
//     DIFFERENT dress (his note: the old olive-vs-slate read as the same guy)
//   · the body reworked: hem gone ("they look like they got on a dress"),
//     head smaller, torso narrower
//   · guns PARENTED INTO THE RIGHT HAND — the pistol cannot float beside the
//     fist anymore because it is a child of it; the launcher alone rides a
//     shoulder mount, and flight stows everything on a back mount
//   · a RUN CARRY distinct from the IDLE hold per weapon (his note: "when
//     they're running they should hold their weapon different than when
//     they stop") — low port carry on the two-handers, a pumping bent-arm
//     sprint for the pistol
//   · an EDIT MODE: click any part, drag the gizmo (T translates, R
//     rotates), read the numbers, COPY them — the tuning loop Robert asked
//     to drive himself
//
// Also mounted as a tab in the unified harness (an iframe of this same page
// — one source of truth, two doors).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

type ActionId = 'idle' | 'run' | 'dash' | 'slash' | 'fly' | 'roll';
type GunId = 'rifle' | 'smg' | 'shotgun' | 'pistol' | 'launcher' | 'rail' | 'flamer';
type MeleeId = 'none' | 'sword' | 'laser' | 'axe';

// ---------------------------------------------------------------------------
// SCENE
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fa4b4);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdfe9f2, 0x53514a, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(18, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera as THREE.OrthographicCamera;
sc.left = -20; sc.right = 20; sc.top = 16; sc.bottom = -16; sc.far = 90;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 70),
  new THREE.MeshStandardMaterial({ color: 0x6f7a58, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const M = (c: number, rough = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
const DARK = 0x2c2f33;
const STEEL = 0x9aa0a6;

// ---------------------------------------------------------------------------
// FACTION DRESS — pushed APART (Robert: "the colors are too close together").
// UF is WARM: olive fatigues over earth-brown trousers, amber strap.
// COL is COLD: deep blue-charcoal over near-black, cyan strap. Nobody
// squints. The accent strap stays a shape cue per the game's §18 law.
// ---------------------------------------------------------------------------
interface FactionDress {
  jacket: number; trouser: number; camoA: number; camoB: number; accent: number;
}
const UF_DRESS: FactionDress = { jacket: 0x687a34, trouser: 0x5c4a30, camoA: 0x4c5c24, camoB: 0x8a9450, accent: 0xe8a33d };
const COL_DRESS: FactionDress = { jacket: 0x38414f, trouser: 0x22252c, camoA: 0x2a3340, camoB: 0x55616f, accent: 0x35c8f0 };

// ---------------------------------------------------------------------------
// GUNS — long axis +X. Each silhouette must answer "what is that?" from the
// game camera. The pistol's grip hangs BELOW the slide so the fist wraps the
// grip and the barrel clears it (his note: "the barrel is sticking out of
// the handle").
// ---------------------------------------------------------------------------
/** an invisible left-hand grip marker — the IK solver plants the off-hand
 *  HERE every frame, so two-handed weapons are two-handed by construction
 *  (and the hand chases the gun live when Robert drags it in edit mode) */
function gripL(g: THREE.Group, x: number, y: number, z: number) {
  const m = new THREE.Object3D();
  m.name = 'gripL';
  m.position.set(x, y, z);
  g.add(m);
}

function makeRifle(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 0.1), M(DARK, 0.6));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), M(STEEL, 0.4));
  barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.5;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.08), M(DARK, 0.6));
  mag.position.set(0.05, -0.16, 0); mag.rotation.z = 0.25;
  g.add(body, barrel, mag);
  gripL(g, 0.28, -0.03, 0); // forend, ahead of the mag
  return g;
}
function makeSmg(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.1), M(DARK, 0.55));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), M(STEEL, 0.4));
  barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.3;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.07), M(DARK, 0.6));
  mag.position.set(0.1, -0.15, 0); mag.rotation.z = 0.12;
  g.add(body, barrel, mag);
  gripL(g, 0.2, -0.03, 0);
  return g;
}
function makeShotgun(): THREE.Group {
  const g = new THREE.Group();
  for (const dz of [-0.05, 0.05]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 7), M(0x4a4238, 0.5));
    tube.rotation.z = Math.PI / 2; tube.position.set(0.18, 0.02, dz);
    g.add(tube);
  }
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.13), M(0x6b4a2f, 0.9));
  stock.position.x = -0.2;
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.16), M(0x8a5a36, 0.8));
  pump.position.set(0.22, -0.07, 0);
  g.add(stock, pump);
  gripL(g, 0.22, -0.07, 0); // THE PUMP — "the other arm has to be grabbing the brown part in the front"
  return g;
}
function makePistol(): THREE.Group {
  const g = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.07), M(STEEL, 0.4));
  slide.position.set(0.1, 0.1, 0); // the slide rides HIGH —
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.07), M(DARK, 0.6));
  grip.position.set(-0.02, -0.02, 0); grip.rotation.z = 0.18; // — the grip hangs low, INSIDE the fist
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 6), M(DARK, 0.4));
  muzzle.rotation.z = Math.PI / 2; muzzle.position.set(0.29, 0.1, 0);
  g.add(slide, grip, muzzle);
  gripL(g, 0.0, -0.12, 0); // the support hand cups under the grip (isosceles)
  return g;
}
function makeLauncher(): THREE.Group {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.95, 8), M(0x5a6248, 0.8));
  tube.rotation.z = Math.PI / 2;
  const ringF = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 8), M(DARK, 0.6));
  ringF.rotation.z = Math.PI / 2; ringF.position.x = 0.42;
  const ringB = ringF.clone(); ringB.position.x = -0.42;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), M(DARK, 0.6));
  grip.position.set(0.16, -0.16, 0);
  g.add(tube, ringF, ringB, grip);
  gripL(g, 0.16, -0.18, 0); // the front grip under the tube
  return g;
}
/** the RG-2, UNMISTAKABLE this time (Robert: "I can't tell what type of gun
 *  it is") — nearly as long as the man is tall: heavy receiver, a scope up
 *  top, a full-length accelerator rail with three coils, a skeleton stock. */
function makeRail(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.1), M(DARK, 0.5));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6), M(STEEL, 0.35));
  barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.68;
  for (const cx of [0.4, 0.66, 0.92]) {
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.07, 8), M(0x3d6a8a, 0.4));
    coil.rotation.z = Math.PI / 2; coil.position.x = cx;
    g.add(coil);
  }
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8), M(0x2c3034, 0.4));
  scope.rotation.z = Math.PI / 2; scope.position.set(0.0, 0.13, 0);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.08), M(STEEL, 0.6));
  stock.position.set(-0.32, 0.02, 0); stock.rotation.z = -0.18;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.09), M(DARK, 0.7));
  pad.position.set(-0.44, -0.02, 0);
  const foreGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), M(DARK, 0.6));
  foreGrip.position.set(0.34, -0.12, 0);
  g.add(body, barrel, scope, stock, pad, foreGrip);
  gripL(g, 0.34, -0.14, 0); // the foregrip
  return g;
}
function makeFlamer(): THREE.Group {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 7), M(0x4a4f55, 0.5));
  tube.rotation.z = Math.PI / 2; tube.position.x = 0.1;
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 7), M(STEEL, 0.4));
  bell.rotation.z = -Math.PI / 2; bell.position.x = 0.44;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), M(0x8a3b2a, 0.6));
  tank.rotation.z = Math.PI / 2; tank.position.set(-0.1, -0.15, 0);
  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffa02a }));
  pilot.position.set(0.5, 0.02, 0);
  g.add(tube, bell, tank, pilot);
  gripL(g, 0.26, -0.04, 0); // both hands on the tube
  return g;
}

const BUILD_GUN: Record<GunId, () => THREE.Group> = {
  rifle: makeRifle, smg: makeSmg, shotgun: makeShotgun, pistol: makePistol,
  launcher: makeLauncher, rail: makeRail, flamer: makeFlamer,
};

// ---------------------------------------------------------------------------
// THE HOLDS. Guns live INSIDE the right hand (a child of the wrist), so the
// gun's local rotation must counter the arm chain to aim the muzzle where the
// hold wants it: localRotZ ≈ desiredWorldPitch − (armR.z + elbowR). Every
// number here is drag-tunable live in EDIT mode; COPY prints them back.
//
// `run` is the SPRINT CARRY — a different hold entirely (Robert: "when
// they're running they should hold their weapon different than when they
// stop"): two-handers drop to a low port across the body; the pistol pumps
// at the chest, muzzle down, off-hand free and swinging.
// ---------------------------------------------------------------------------
interface HoldPose {
  armR: [number, number]; elbowR: number;   // [rotX, rotZ], elbow bend
  armL: [number, number]; elbowL: number;
  local: [number, number, number];           // gun offset inside its mount
  localRotZ: number;
  leftFree?: boolean;                        // off-hand leaves the gun (pistol sprint)
}
interface HoldDef {
  mount: 'hand' | 'shoulder';
  idle: HoldPose;
  run: HoldPose;
}
const HOLDS: Record<GunId, HoldDef> = {
  rifle: {
    mount: 'hand',
    idle: { armR: [0, 0.35], elbowR: 1.1, armL: [0.62, 0.5], elbowL: 0.95, local: [0.1, -0.03, 0], localRotZ: -1.51 },
    // run local is ROBERT'S NUMBER (gizmo, 2026-07-20, during:"run") — the
    // sprint grip shifts 3cm forward and 3cm lower on the rifle than mine.
    // Scoped to run exactly as the COPY payload said; idle untouched.
    run:  { armR: [0, 0.12], elbowR: 0.7, armL: [0.55, 0.42], elbowL: 0.85, local: [0.131, -0.0576, 0], localRotZ: -1.32 },
  },
  smg: {
    mount: 'hand',
    idle: { armR: [0, 0.3], elbowR: 1.25, armL: [0.6, 0.45], elbowL: 1.1, local: [0.08, -0.03, 0], localRotZ: -1.59 },
    run:  { armR: [0, 0.12], elbowR: 0.75, armL: [0.52, 0.4], elbowL: 0.9, local: [0.08, -0.03, 0], localRotZ: -1.37 },
  },
  // TWO HANDS (Robert): left arm COMPLETELY bent, off-hand under the barrel
  shotgun: {
    mount: 'hand',
    idle: { armR: [0, 0.3], elbowR: 0.85, armL: [0.6, 0.55], elbowL: 1.35, local: [0.12, -0.04, 0], localRotZ: -1.15 },
    run:  { armR: [0, 0.1], elbowR: 0.6, armL: [0.52, 0.45], elbowL: 1.1, local: [0.12, -0.04, 0], localRotZ: -1.2 },
  },
  // ISOSCELES standing; a pumping bent-arm carry at a sprint, muzzle down.
  // The local seat is ROBERT'S OWN NUMBER — dragged in the edit gizmo and
  // COPY-pasted back (2026-07-20): the pistol sits 3.5cm deeper in the fist
  // and a touch higher than my guess. The gizmo loop works; keep using it.
  pistol: {
    mount: 'hand',
    idle: { armR: [0, 1.45], elbowR: 0.12, armL: [0.4, 1.15], elbowL: 0.6, local: [0.0048, -0.0274, 0.0015], localRotZ: -1.57 },
    run:  { armR: [0, 0.3], elbowR: 1.3, armL: [0, -0.1], elbowL: 0.5, local: [0.0048, -0.0274, 0.0015], localRotZ: -1.9, leftFree: true },
  },
  // the tube rides the SHOULDER MOUNT — hands brace it, they don't carry it
  launcher: {
    mount: 'shoulder',
    idle: { armR: [0, 0.9], elbowR: 1.5, armL: [0.5, 0.7], elbowL: 1.2, local: [0, 0, 0], localRotZ: 0.04 },
    run:  { armR: [0, 0.7], elbowR: 1.3, armL: [0.45, 0.6], elbowL: 1.1, local: [0, 0, 0], localRotZ: 0.14 },
  },
  rail: {
    mount: 'hand',
    idle: { armR: [0, 0.3], elbowR: 0.85, armL: [0.55, 0.8], elbowL: 0.55, local: [0.16, -0.04, 0], localRotZ: -1.25 },
    run:  { armR: [0, 0.1], elbowR: 0.55, armL: [0.5, 0.65], elbowL: 0.5, local: [0.16, -0.04, 0], localRotZ: -1.1 },
  },
  flamer: {
    mount: 'hand',
    idle: { armR: [0, 0.4], elbowR: 0.9, armL: [0.62, 0.62], elbowL: 0.9, local: [0.1, -0.04, 0], localRotZ: -1.28 },
    run:  { armR: [0, 0.2], elbowR: 0.7, armL: [0.55, 0.55], elbowL: 0.8, local: [0.1, -0.04, 0], localRotZ: -1.15 },
  },
};

// ---------------------------------------------------------------------------
// THE PAPERCRAFT SOLDIER, v2 proportions: hem deleted (the "dress"), head
// 0.34 (was 0.4), torso 0.36 wide (was 0.42). Segment cuts stay — they ARE
// the style.
// ---------------------------------------------------------------------------
interface Rig {
  label: string;
  root: THREE.Group;
  body: THREE.Group;
  gun: THREE.Group;
  wrist: THREE.Group;         // gun mount inside the right hand
  shoulderMount: THREE.Group; // launcher home
  backMount: THREE.Group;     // flight stow
  armR: THREE.Group; armL: THREE.Group;
  elbowR: THREE.Group; elbowL: THREE.Group;
  legR: THREE.Group; legL: THREE.Group;
  kneeR: THREE.Group; kneeL: THREE.Group;
  blade: THREE.Group;
  meleeProp: THREE.Group;     // sword/laser/axe in the right hand when melee is armed
  ghosts: THREE.Mesh[];
  parts: { name: string; obj: THREE.Object3D }[]; // EDIT-mode selectables
}

// THE SLASH ARC, FLAT (Robert: "the game is played top-down — the slashing
// is in the wrong direction. It should go ACROSS, forming a letter C around
// the character"). Two layers per his ask — a close arc and a far arc — so a
// knife, a sword, a laser blade and a battle axe can each claim a reach.
interface ArcStyle { color: number; inner: [number, number]; outer: [number, number]; span: number }
const ARC_STYLES: Record<MeleeId, ArcStyle> = {
  none:  { color: 0xeef4ff, inner: [0.5, 0.85], outer: [0.9, 1.15], span: Math.PI * 0.7 },
  sword: { color: 0xdfe9f2, inner: [0.55, 0.95], outer: [1.0, 1.45], span: Math.PI * 0.8 },
  laser: { color: 0x54e0ff, inner: [0.55, 1.0], outer: [1.05, 1.7], span: Math.PI * 0.95 },
  axe:   { color: 0xffb54a, inner: [0.5, 1.05], outer: [1.1, 1.35], span: Math.PI * 0.6 },
};

function makeBlade(): THREE.Group {
  const g = new THREE.Group();
  g.visible = false;
  // lies FLAT: the fan is built in XZ (rotated from XY), swept about Y
  for (let layer = 0; layer < 2; layer++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.9, 24, 1, 0, Math.PI * 0.7),
      new THREE.MeshBasicMaterial({
        color: 0xeef4ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    g.add(m);
  }
  return g;
}

function styleBlade(blade: THREE.Group, style: ArcStyle) {
  const layers = blade.children as THREE.Mesh[];
  const specs = [style.inner, style.outer];
  layers.forEach((m, i) => {
    m.geometry.dispose();
    m.geometry = new THREE.RingGeometry(specs[i][0], specs[i][1], 24, 1, 0, style.span);
    (m.material as THREE.MeshBasicMaterial).color.setHex(style.color);
  });
}

// ---- the melee props the hand swings ----
function makeSword(): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.12), M(0xd8dee6, 0.3));
  blade.position.x = 0.45;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.2), M(0x8a6a30, 0.5));
  guard.position.x = 0.06;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), M(0x3a2c1c, 0.8));
  grip.position.x = -0.05;
  g.add(blade, guard, grip);
  return g;
}
function makeLaserSword(): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.04, 0.04),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  core.position.x = 0.5;
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x54e0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.position.x = 0.5;
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 8), M(0x9aa0a6, 0.35));
  hilt.rotation.z = Math.PI / 2; hilt.position.x = -0.02;
  g.add(core, glow, hilt);
  return g;
}
function makeAxe(): THREE.Group {
  const g = new THREE.Group();
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.8, 7), M(0x6b4a2f, 0.85));
  haft.rotation.z = Math.PI / 2; haft.position.x = 0.3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.34), M(0x8a8f94, 0.35));
  head.position.set(0.62, 0, 0.08);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.1), M(0xd8dee6, 0.25));
  edge.position.set(0.62, 0, 0.27);
  g.add(haft, head, edge);
  return g;
}
const BUILD_MELEE: Record<Exclude<MeleeId, 'none'>, () => THREE.Group> = {
  sword: makeSword, laser: makeLaserSword, axe: makeAxe,
};

function papercraftRig(label: string, dress: FactionDress): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const SKIN = 0xc9835f, JACKET = dress.jacket, TROUSER = dress.trouser, BOOT = 0x24262a;
  const box = (w: number, h: number, d: number, c: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
    m.castShadow = true;
    return m;
  };

  // narrower torso, no hem — the jacket ends at a belt like a jacket
  const torso = box(0.36, 0.52, 0.46, JACKET); torso.position.y = 1.22; torso.name = 'torso'; body.add(torso);
  const belt = box(0.38, 0.07, 0.48, BOOT); belt.position.y = 0.94; body.add(belt);
  // smaller again (Robert, round two of "a little smaller") — same cut gap
  const head = box(0.3, 0.3, 0.3, SKIN); head.position.y = 1.68; head.name = 'head'; body.add(head);

  // camo plates proud of the cloth
  const camo = (w: number, h: number, x: number, y: number, z: number, c: number) => {
    const m = box(0.02, h, w, c);
    m.position.set(x, y, z);
    body.add(m);
  };
  camo(0.14, 0.12, 0.19, 1.32, 0.08, dress.camoA);
  camo(0.11, 0.09, 0.19, 1.1, -0.12, dress.camoB);
  camo(0.13, 0.1, -0.19, 1.24, 0.05, dress.camoA);
  // the faction strap — accent color AND a shape
  const strap = box(0.05, 0.54, 0.09, dress.accent);
  strap.position.set(0.19, 1.2, 0.04);
  strap.rotation.x = 0.55;
  strap.name = 'strap';
  body.add(strap);

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
    body.add(arm);
    const wrist = new THREE.Group();
    wrist.position.y = -0.29;
    elbow.add(wrist);
    return { arm, elbow, wrist };
  };
  const mkLeg = (dz: number, side: 'R' | 'L') => {
    const leg = new THREE.Group();
    leg.position.set(0, 0.92, dz);
    leg.name = 'leg' + side;
    const th = box(0.17, 0.36, 0.19, TROUSER); th.position.y = -0.19; leg.add(th);
    const camoT = box(0.02, 0.09, 0.11, side === 'R' ? dress.camoA : dress.camoB);
    camoT.position.set(0.09, -0.2, 0); th.add(camoT);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    const shin = box(0.14, 0.32, 0.16, TROUSER); shin.position.y = -0.16; knee.add(shin);
    // A FOOT IS LONG, NOT WIDE. The old boot was 0.28 across on legs 0.28
    // apart — standing together the two read as ONE slab (Robert: "the feet
    // are unified"), and the run looked clunky for the same reason. Narrow
    // side-to-side, longer front-to-back: a boot, not a snowshoe.
    const bt = box(0.26, 0.12, 0.13, BOOT); bt.position.set(0.06, -0.42, 0); knee.add(bt);
    leg.add(knee);
    body.add(leg);
    return { leg, knee };
  };

  const aR = mkArm(0.3, 'R'), aL = mkArm(-0.3, 'L');
  // THE OFF-HAND SHOULDER, PLACED BY ROBERT (gizmo, 2026-07-20, "for all
  // weapons — the shoulder for the offhand always seems a little too far
  // away"): forward 3cm, down 7cm, and 10cm INWARD off the symmetric slot,
  // so the reach across to any foregrip stops looking stretched. The
  // rotation from his paste is discarded on purpose — the IK owns it live.
  aL.arm.position.set(0.0326, 1.3258, -0.2046);
  const lR = mkLeg(0.14, 'R'), lL = mkLeg(-0.14, 'L');

  const shoulderMount = new THREE.Group();
  shoulderMount.position.set(0.1, 1.52, 0.26);
  body.add(shoulderMount);
  const backMount = new THREE.Group();
  backMount.position.set(-0.28, 1.25, 0);
  backMount.rotation.z = 1.05;
  body.add(backMount);

  const gun = new THREE.Group();
  gun.name = 'gun';
  aR.wrist.add(gun);
  const meleeProp = new THREE.Group();
  meleeProp.name = 'melee';
  aR.wrist.add(meleeProp);

  const rig: Rig = {
    label, root, body, gun, meleeProp,
    wrist: aR.wrist, shoulderMount, backMount,
    armR: aR.arm, armL: aL.arm, elbowR: aR.elbow, elbowL: aL.elbow,
    legR: lR.leg, legL: lL.leg, kneeR: lR.knee, kneeL: lL.knee,
    blade: makeBlade(), ghosts: [],
    parts: [],
  };
  // the C-arc wraps the BODY: centred on the man, waist height, flat
  rig.blade.position.set(0, 1.0, 0);
  body.add(rig.blade);
  const ghostGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);
  for (let i = 0; i < 3; i++) {
    const ghost = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({ color: JACKET, transparent: true, opacity: 0, depthWrite: false }));
    ghost.position.y = 1.05;
    root.add(ghost);
    rig.ghosts.push(ghost);
  }
  rig.parts = [
    { name: 'gun', obj: gun },
    { name: 'armR', obj: aR.arm }, { name: 'armL', obj: aL.arm },
    { name: 'elbowR', obj: aR.elbow }, { name: 'elbowL', obj: aL.elbow },
    { name: 'legR', obj: lR.leg }, { name: 'legL', obj: lL.leg },
    { name: 'head', obj: head }, { name: 'torso', obj: torso }, { name: 'strap', obj: strap },
  ];
  return rig;
}

// ---------------------------------------------------------------------------
// THE PAIR
// ---------------------------------------------------------------------------
const rigs: Rig[] = [];
const labels: { at: THREE.Vector3; el: HTMLDivElement }[] = [];
const labelBox = document.getElementById('labels') as HTMLDivElement;

function addLabel(text: string, x: number) {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.textContent = text;
  labelBox.appendChild(el);
  labels.push({ at: new THREE.Vector3(x, 0, 2.4), el });
}

const PITCH = 5;
[
  papercraftRig('UNITED FRONT', UF_DRESS),
  papercraftRig('COLLECTIVE', COL_DRESS),
].forEach((rig, i) => {
  rig.root.position.set((i - 0.5) * PITCH, 0, 0);
  scene.add(rig.root);
  rigs.push(rig);
  addLabel(rig.label, (i - 0.5) * PITCH);
});

camera.position.set(0, 4.6, 11.5);
camera.lookAt(0, 1.2, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 3;
controls.maxDistance = 40;

// ---------------------------------------------------------------------------
// EDIT MODE — click a part, drag the gizmo, copy the numbers.
// While editing, the animator's hands are OFF the puppet: poses freeze so
// the gizmo's work isn't overwritten sixty times a second.
// ---------------------------------------------------------------------------
const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.setSize(0.8);
scene.add(gizmo.getHelper()); // r169+: the controls aren't an Object3D; their helper is
gizmo.addEventListener('dragging-changed', (e) => { controls.enabled = !(e as unknown as { value: boolean }).value; });

let editMode = false;
let selected: { rig: Rig; name: string; obj: THREE.Object3D } | null = null;
const editPanel = document.getElementById('edit-panel') as HTMLDivElement;
const raycaster = new THREE.Raycaster();

function refreshReadout() {
  if (!selected) { editPanel.textContent = 'EDIT: click a part (gun, arms, head…) · G move · R rotate'; return; }
  const o = selected.obj;
  const f = (n: number) => n.toFixed(3);
  editPanel.textContent =
    `${selected.rig.label} · ${selected.name}\n` +
    `pos  ${f(o.position.x)}, ${f(o.position.y)}, ${f(o.position.z)}\n` +
    `rot  ${f(o.rotation.x)}, ${f(o.rotation.y)}, ${f(o.rotation.z)}`;
}
gizmo.addEventListener('objectChange', refreshReadout);

function setEdit(on: boolean) {
  editMode = on;
  document.getElementById('btn-edit')!.classList.toggle('on', on);
  (document.getElementById('btn-mode') as HTMLElement).style.display = on ? '' : 'none';
  (document.getElementById('btn-copy') as HTMLElement).style.display = on ? '' : 'none';
  editPanel.style.display = on ? 'block' : 'none';
  if (!on) { gizmo.detach(); selected = null; }
  refreshReadout();
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!editMode || gizmo.dragging) return;
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const hits = raycaster.intersectObjects(rigs.map((r) => r.root), true);
  for (const hit of hits) {
    // walk up to the nearest registered part
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      for (const rig of rigs) {
        const part = rig.parts.find((pp) => pp.obj === o);
        if (part) {
          selected = { rig, name: part.name, obj: part.obj };
          gizmo.attach(part.obj);
          refreshReadout();
          return;
        }
      }
      o = o.parent;
    }
  }
});

document.getElementById('btn-mode')!.addEventListener('click', () => {
  const next = gizmo.getMode() === 'translate' ? 'rotate' : 'translate';
  gizmo.setMode(next);
  document.getElementById('btn-mode')!.textContent = `MODE: ${next === 'translate' ? 'MOVE' : 'ROTATE'}`;
});
document.getElementById('btn-copy')!.addEventListener('click', () => {
  if (!selected) return;
  const o = selected.obj;
  const data = {
    part: selected.name,
    gun: gunKind,
    during: action, // which hold was live when the gizmo froze — run and idle differ
    position: [o.position.x, o.position.y, o.position.z].map((n) => +n.toFixed(4)),
    rotation: [o.rotation.x, o.rotation.y, o.rotation.z].map((n) => +n.toFixed(4)),
  };
  void navigator.clipboard?.writeText(JSON.stringify(data));
  editPanel.textContent += '\n(copied)';
});
addEventListener('keydown', (e) => {
  if (!editMode) return;
  if (e.key === 'g') gizmo.setMode('translate');
  if (e.key === 'r') gizmo.setMode('rotate');
});

// ---------------------------------------------------------------------------
// THE ANIMATOR
// ---------------------------------------------------------------------------
let action: ActionId = 'run';
let actionT = 0;
let gunKind: GunId = 'rifle';

const LINES = 26;
const lineGeo = new THREE.BoxGeometry(0.5, 0.03, 0.03);
const lines: { m: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
for (let i = 0; i < LINES; i++) {
  const m = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(m);
  lines.push({ m, vel: new THREE.Vector3(), life: 0 });
}
let lineCursor = 0;
function speedLine(at: THREE.Vector3) {
  const l = lines[lineCursor];
  lineCursor = (lineCursor + 1) % LINES;
  l.m.position.copy(at);
  l.m.position.y += 0.5 + Math.random() * 0.9;
  l.m.position.z += (Math.random() - 0.5) * 0.7;
  l.vel.set(-(9 + Math.random() * 5), 0, 0);
  l.m.scale.setScalar(0.8 + Math.random() * 1.3);
  l.life = 0.35;
}

const GUNS: GunId[] = ['rifle', 'smg', 'shotgun', 'pistol', 'launcher', 'rail', 'flamer'];
const MELEES: MeleeId[] = ['none', 'sword', 'laser', 'axe'];
let meleeKind: MeleeId = 'none';
function setMelee(kind: MeleeId) {
  meleeKind = kind;
  for (const r of rigs) {
    r.meleeProp.clear();
    if (kind !== 'none') r.meleeProp.add(BUILD_MELEE[kind]());
    styleBlade(r.blade, ARC_STYLES[kind]);
  }
  document.getElementById('btn-melee')!.textContent = `MELEE: ${kind.toUpperCase()} ▸`;
}
function setGun(kind: GunId) {
  gunKind = kind;
  for (const r of rigs) {
    r.gun.clear();
    r.gun.add(BUILD_GUN[kind]());
    // re-home the gun to the new weapon's mount
    const H = HOLDS[kind];
    (H.mount === 'shoulder' ? r.shoulderMount : r.wrist).add(r.gun);
  }
  document.getElementById('btn-gun')!.textContent = `GUN: ${kind.toUpperCase()} ▸`;
}

function play(a: ActionId) {
  action = a;
  actionT = 0;
  for (const b of document.querySelectorAll('.act')) b.classList.toggle('on', (b as HTMLElement).dataset.a === a);
}

// ---------------------------------------------------------------------------
// LEFT-ARM IK (Robert, on the shotgun: "the other arm has to be grabbing the
// brown part in the front — it's a two-handed weapon"). Authored angles can
// only ever land the off-hand NEAR a grip; a two-bone solve lands it ON it.
// Shoulder and elbow are solved analytically each frame against the gun's
// gripL marker, in body space, elbow dropping naturally below the reach line.
// ---------------------------------------------------------------------------
const L_UPPER = 0.4;   // shoulder pivot → elbow pivot
const L_FORE = 0.29;   // elbow pivot → hand centre
const DOWN = new THREE.Vector3(0, -1, 0);
const _t = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _n = new THREE.Vector3();
const _u = new THREE.Vector3();
const _e = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();

function solveLeftArm(r: Rig) {
  const marker = r.gun.getObjectByName('gripL');
  if (!marker) return;
  r.root.updateMatrixWorld(true);
  marker.getWorldPosition(_t);
  r.body.worldToLocal(_t);                       // target, body space
  const S = r.armL.position;                     // shoulder pivot, body space
  _dir.copy(_t).sub(S);
  const d = Math.min(Math.max(_dir.length(), Math.abs(L_UPPER - L_FORE) + 0.01), L_UPPER + L_FORE - 0.01);
  _dir.normalize();
  // law of cosines: shoulder offset angle and elbow interior angle
  const gamma = Math.acos(Math.min(1, Math.max(-1, (L_UPPER * L_UPPER + d * d - L_FORE * L_FORE) / (2 * L_UPPER * d))));
  // elbow plane normal — perpendicular to the reach, biased so the elbow
  // falls BELOW the shoulder→grip line (a raised elbow reads broken)
  _n.crossVectors(_dir, DOWN);
  if (_n.lengthSq() < 1e-4) _n.set(0, 0, 1);
  _n.normalize();
  _u.copy(_dir).applyAxisAngle(_n, gamma);
  _e.copy(S).addScaledVector(_u, L_UPPER);       // elbow position candidate
  if (_e.y > S.y + _dir.y * L_UPPER) {           // elbow above the line? flip the plane
    _u.copy(_dir).applyAxisAngle(_n, -gamma);
    _e.copy(S).addScaledVector(_u, L_UPPER);
  }
  // shoulder: rotate the rest limb (hangs -Y) onto the upper-arm direction
  r.armL.quaternion.setFromUnitVectors(DOWN, _u);
  // elbow: in the shoulder's LOCAL frame, aim the forearm at the target
  _v.copy(_t).sub(_e).normalize();
  _qi.copy(r.armL.quaternion).invert();
  _v.applyQuaternion(_qi);
  r.elbowL.quaternion.setFromUnitVectors(DOWN, _v.normalize());
  void _q;
}

function applyHold(r: Rig, pose: HoldPose) {
  r.armR.rotation.set(pose.armR[0], 0, pose.armR[1]);
  r.armL.rotation.set(pose.armL[0], 0, pose.armL[1]);
  r.elbowR.rotation.set(0, 0, pose.elbowR);
  r.elbowL.rotation.set(0, 0, pose.elbowL);
  r.gun.position.set(pose.local[0], pose.local[1], pose.local[2]);
  r.gun.rotation.set(0, 0, pose.localRotZ);
}

let last = performance.now();
let frames = 0;
let frozen = false;
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!frozen && !editMode) actionT += dt;
  frames++;
  const t = now / 1000;

  controls.update();

  if (!editMode) {
    const H = HOLDS[gunKind];
    for (const r of rigs) {
      const b = r.body;
      b.position.set(0, 0, 0);
      b.rotation.set(0, 0, 0);
      b.scale.set(1, 1, 1);
      r.blade.visible = false;
      b.rotation.y = 0;
      for (const g of r.ghosts) (g.material as THREE.MeshBasicMaterial).opacity = 0;
      // the gun rides the mount the current action wants; an armed MELEE
      // sends the gun to the back and puts the blade in the fist instead
      const meleeArmed = meleeKind !== 'none';
      const wantBack = action === 'fly' || action === 'roll' || meleeArmed;
      const mount = wantBack ? r.backMount : H.mount === 'shoulder' ? r.shoulderMount : r.wrist;
      if (r.gun.parent !== mount) mount.add(r.gun);
      r.meleeProp.visible = meleeArmed;
      if (meleeArmed) { r.meleeProp.position.set(0.02, -0.04, 0); r.meleeProp.rotation.set(0, 0, -1.35); }

      // baseline: the hold for the current state — running is a DIFFERENT hold
      applyHold(r, action === 'run' || action === 'dash' ? H.run : H.idle);
      r.legR.rotation.set(0, 0, 0);
      r.legL.rotation.set(0, 0, 0);
      r.kneeR.rotation.set(0, 0, -0.2);
      r.kneeL.rotation.set(0, 0, -0.2);
      if (wantBack) { r.gun.position.set(0, 0, 0); r.gun.rotation.set(0, 0, 0); }
      if (meleeArmed && action !== 'slash' && action !== 'fly' && action !== 'roll') {
        // blade carried at the side, arms relaxed — the off-hand has no gun to hold
        r.armR.rotation.set(0, 0, 0.25);
        r.elbowR.rotation.set(0, 0, 0.5);
        r.armL.rotation.set(0, 0, -0.05);
        r.elbowL.rotation.set(0, 0, 0.35);
      }

      if (action === 'idle') {
        // breathing — weight shifts, the weapon stays ready
        b.position.y = Math.sin(t * 1.7 + r.root.position.x) * 0.015;
        b.rotation.x = Math.sin(t * 1.3 + r.root.position.x) * 0.012;
        solveLeftArm(r);
      } else if (action === 'run') {
        const phase = t * 9 + r.root.position.x;
        b.position.y = Math.abs(Math.sin(phase)) * 0.16;
        b.rotation.z = -0.16;
        b.rotation.x = Math.sin(phase) * 0.055;
        const sw = Math.sin(phase);
        r.legR.rotation.z = sw * 0.55;
        r.legL.rotation.z = -sw * 0.55;
        const bend = (p: number) => -0.25 - Math.max(0, Math.sin(p + 0.9)) * 0.9;
        r.kneeR.rotation.z = bend(phase);
        r.kneeL.rotation.z = bend(phase + Math.PI);
        if (H.run.leftFree) {
          // the free off-hand pumps the sprint
          r.armL.rotation.set(0, 0, Math.sin(phase) * 0.5 - 0.1);
          r.elbowL.rotation.set(0, 0, 0.9);
        } else {
          solveLeftArm(r); // both hands ON the weapon, even mid-stride
        }
      } else if (action === 'dash') {
        const k = Math.min(1, actionT / 0.5);
        const punch = Math.sin(Math.min(1, actionT / 0.42) * Math.PI);
        b.rotation.z = -0.62 * punch;
        b.scale.set(1 + 0.22 * punch, 1 - 0.18 * punch, 1 - 0.12 * punch);
        b.position.x = punch * 1.9;
        b.position.y = 0.05 * punch;
        r.legR.rotation.z = -0.7 * punch;
        r.legL.rotation.z = -0.55 * punch;
        r.kneeR.rotation.z = -0.2 - 0.7 * punch;
        r.kneeL.rotation.z = -0.2 - 0.55 * punch;
        for (let i = 0; i < r.ghosts.length; i++) {
          const g = r.ghosts[i];
          const back = (i + 1) / (r.ghosts.length + 1);
          g.position.x = b.position.x - back * 2.1;
          (g.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (0.34 - back * 0.09) * punch);
        }
        if (punch > 0.25 && Math.random() < 0.5) speedLine(new THREE.Vector3(r.root.position.x + b.position.x - 0.8, 0, r.root.position.z));
        if (!H.run.leftFree) solveLeftArm(r);
        if (k >= 1 && !frozen) play('run');
      } else if (action === 'slash') {
        // ACROSS, NOT DOWN (Robert): the game reads from above, so the arc
        // sweeps a C AROUND the man — the whole fan yaws about Y from his
        // left, across the front, to his right, while the torso twists into
        // it. Two layers trail slightly apart so close and far reach both read.
        const k = Math.min(1, actionT / 0.4);
        const swing = k < 0.15 ? 0 : (k - 0.15) / 0.85;
        const sweep = 1.9 - swing * 3.8;                 // +1.9 → −1.9 rad about Y
        r.blade.visible = swing > 0 && swing < 1;
        r.blade.rotation.set(0, sweep, 0);
        const op = Math.sin(Math.min(1, swing) * Math.PI);
        const [inner, outer] = r.blade.children as THREE.Mesh[];
        (inner.material as THREE.MeshBasicMaterial).opacity = 0.9 * op;
        outer.rotation.z = 0.22;                         // the far layer trails the close one
        (outer.material as THREE.MeshBasicMaterial).opacity = 0.55 * op;
        b.rotation.y = 0.55 - swing * 1.1;               // torso twists INTO the sweep
        b.rotation.z = -0.1 * Math.sin(k * Math.PI);
        // the right arm carries the blade horizontally across the body
        r.armR.rotation.set(-(0.9 - swing * 1.8), 0, 1.35);
        r.elbowR.rotation.set(0, 0, 0.25);
        r.legR.rotation.z = 0.25 * Math.sin(k * Math.PI);
        r.legL.rotation.z = -0.25 * Math.sin(k * Math.PI);
        if (meleeKind === 'none') solveLeftArm(r);       // gun stays two-handed through a knife-swipe
        if (k >= 1 && !frozen) play('run');
      } else if (action === 'fly') {
        const k = Math.min(1, actionT / 0.6);
        const ease = 1 - (1 - k) * (1 - k);
        b.position.y = ease * 1.5 + Math.sin(t * 2.2) * 0.07 * ease;
        b.rotation.z = -0.5 * ease;
        r.armR.rotation.set(0, 0, 2.6 * ease);
        r.armL.rotation.set(0, 0, 2.6 * ease);
        r.elbowR.rotation.set(0, 0, 0.1);
        r.elbowL.rotation.set(0, 0, 0.1);
        r.legR.rotation.z = -0.35 * ease;
        r.legL.rotation.z = -0.35 * ease;
        r.kneeR.rotation.z = -0.3 * ease;
        r.kneeL.rotation.z = -0.3 * ease;
        if (actionT > 2.2 && !frozen) play('run');
      } else if (action === 'roll') {
        // MAX PAYNE: dive, tuck, one revolution, up. The spin is solved
        // around the body CENTRE (a group rotates around its feet otherwise).
        const k = Math.min(1, actionT / 0.75);
        const ease = k * k * (3 - 2 * k);
        const th = -Math.PI * 2 * ease;
        const c = 0.85;
        const arc = Math.sin(Math.min(1, k / 0.35) * Math.PI) * 0.5;
        const cx = ease * 3.4;
        const cy = c + arc;
        b.rotation.z = th;
        b.position.x = cx + c * Math.sin(th);
        b.position.y = cy - c * Math.cos(th);
        b.scale.setScalar(1 - 0.12 * Math.sin(ease * Math.PI));
        r.armR.rotation.set(0, 0, 1.5);
        r.armL.rotation.set(0, 0, 1.5);
        r.elbowR.rotation.set(0, 0, 1.6);
        r.elbowL.rotation.set(0, 0, 1.6);
        r.legR.rotation.z = 1.1;
        r.legL.rotation.z = 1.1;
        r.kneeR.rotation.z = -1.9;
        r.kneeL.rotation.z = -1.9;
        for (let i = 0; i < r.ghosts.length; i++) {
          const g = r.ghosts[i];
          const back = (i + 1) / (r.ghosts.length + 1);
          g.position.x = b.position.x - back * 1.6;
          (g.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.22 * Math.sin(ease * Math.PI) * (1 - back * 0.4));
        }
        if (k > 0.05 && k < 0.5 && Math.random() < 0.4) speedLine(new THREE.Vector3(r.root.position.x + b.position.x - 0.6, 0, r.root.position.z));
        if (k >= 1 && !frozen) play('run');
      }
    }
  }

  for (const l of lines) {
    if (l.life <= 0) continue;
    l.life -= dt;
    l.m.position.addScaledVector(l.vel, dt);
    (l.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, l.life / 0.35) * 0.7;
    if (l.life <= 0) (l.m.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  const v = new THREE.Vector3();
  for (const L of labels) {
    v.copy(L.at).project(camera);
    L.el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    L.el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

for (const btn of document.querySelectorAll<HTMLElement>('.act')) {
  btn.addEventListener('click', () => play(btn.dataset.a as ActionId));
}
document.getElementById('btn-gun')!.addEventListener('click', () => setGun(GUNS[(GUNS.indexOf(gunKind) + 1) % GUNS.length]));
document.getElementById('btn-melee')!.addEventListener('click', () => setMelee(MELEES[(MELEES.indexOf(meleeKind) + 1) % MELEES.length]));
document.getElementById('btn-edit')!.addEventListener('click', () => setEdit(!editMode));
setGun('rifle');
setMelee('none');
play('run');
setEdit(false);
loop();

interface StyleHandle {
  frames: () => number;
  play: (a: ActionId) => void;
  gun: (g: GunId) => void;
  freeze: (a: ActionId, t: number) => void;
  thaw: () => void;
}
(window as unknown as { __style: StyleHandle }).__style = {
  frames: () => frames,
  play,
  gun: setGun,
  freeze: (a, tt) => { play(a); actionT = tt; frozen = true; },
  thaw: () => { frozen = false; play('run'); },
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
