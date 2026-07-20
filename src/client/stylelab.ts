// ---------------------------------------------------------------------------
// THE STYLE LAB (/style.html) — Robert: "what if they were dressed like a
// simpler geometric shape… like a capsule with the gun on the right side…
// they bop up and down when they run… a dash… lean forward with little action
// lines… a slash down like one stroke of an X… I kind of want to experiment."
//
// So: an experiment. Four bodies on pedestals — the CURRENT soldier as the
// baseline, then capsule rigs at three budgets (1 shape, 4 shapes, 12 shapes)
// — all running the same stylized move set at once so the answer is a look,
// not an argument:
//
//   RUN   — the bop: a bounce with a forward lean and a little roll
//   DASH  — double-tap lunge: hard lean, squash-and-stretch, afterimage
//           ghosts, speed lines flying off the back
//   SLASH — melee: one stroke of an X, a blade arc swept down-right
//   FLY   — the jetpack pose: the gun STOWS across the back (the current
//           models fly badly precisely because the gun keeps sticking out)
//   SHOTGUN/RIFLE — the silhouette toggle: a fat double-barrel must read
//           differently from a long rifle at command zoom, or shotguns
//           aren't "kind of important" the way Robert wants them to be
//
// Pure bench. No sim, no game code touched — buildSoldier is imported only
// as the baseline to beat. window.__style drives it deterministically.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { JOINT_NAMES, poseSoldierJoints, type Joints } from './animation';
import { buildSoldier } from './models/soldiers';

type ActionId = 'run' | 'dash' | 'slash' | 'fly' | 'roll';
type GunId = 'rifle' | 'smg' | 'shotgun' | 'pistol' | 'launcher' | 'rail' | 'flamer';

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
sc.left = -30; sc.right = 30; sc.top = 20; sc.bottom = -20; sc.far = 90;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 80),
  new THREE.MeshStandardMaterial({ color: 0x6f7a58, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const M = (c: number, rough = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
const TEAM = 0xe8a33d;   // United Front amber
const DARK = 0x2c2f33;
const STEEL = 0x9aa0a6;

// ---------------------------------------------------------------------------
// GUNS — the silhouette is the whole point. Long axis +X (muzzle forward).
// ---------------------------------------------------------------------------
function makeRifle(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 0.1), M(DARK, 0.6));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), M(STEEL, 0.4));
  barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.5;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.08), M(DARK, 0.6));
  mag.position.set(0.05, -0.16, 0); mag.rotation.z = 0.25;
  g.add(body, barrel, mag);
  return g;
}
/** tiny L: slide over grip — reads as a pistol from any distance */
function makePistol(): THREE.Group {
  const g = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.07), M(STEEL, 0.4));
  slide.position.set(0.06, 0.03, 0);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.07), M(DARK, 0.6));
  grip.position.set(-0.05, -0.09, 0); grip.rotation.z = 0.2;
  g.add(slide, grip);
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
  return g;
}
/** the MML: a fat tube that lives ON the shoulder */
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
  return g;
}
/** the RG-2: all barrel, a scope riding the spine */
function makeRail(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.09), M(DARK, 0.55));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.85, 6), M(STEEL, 0.35));
  barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.55;
  const scope = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.05), M(0x2c3034, 0.4));
  scope.position.set(0.02, 0.1, 0);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.08), M(0x4a4238, 0.8));
  stock.position.x = -0.26;
  g.add(body, barrel, scope, stock);
  return g;
}
/** the burner: tube, under-slung fuel bottle, pilot light always on */
function makeFlamer(): THREE.Group {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 7), M(0x4a4f55, 0.5));
  tube.rotation.z = Math.PI / 2; tube.position.x = 0.1;
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 7), M(STEEL, 0.4));
  bell.rotation.z = -Math.PI / 2; bell.position.x = 0.44;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), M(0x8a3b2a, 0.6));
  tank.rotation.z = Math.PI / 2; tank.position.set(-0.1, -0.13, 0);
  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffa02a }));
  pilot.position.set(0.5, 0.02, 0);
  g.add(tube, bell, tank, pilot);
  return g;
}

const BUILD_GUN: Record<GunId, () => THREE.Group> = {
  rifle: makeRifle, smg: makeSmg, shotgun: makeShotgun, pistol: makePistol,
  launcher: makeLauncher, rail: makeRail, flamer: makeFlamer,
};

/** HOW A HUMAN HOLDS EACH ONE (Robert: "I wanna see how you hold the shotgun…
 *  a pistol… all of the ones"). Mirrors the game's own WEAPON_HOLDS
 *  archetypes: isosceles pistol, shouldered launcher, long low-ready rail,
 *  hip-braced flamer. Numbers are gun transform + arm/elbow pose + mitt
 *  anchors, applied as the per-frame baseline for every armed body. */
interface HoldDef {
  gun: [number, number, number];
  gunRotZ: number;
  armR: [number, number]; elbowR: number;   // [rotX, rotZ] + elbow bend
  armL: [number, number]; elbowL: number;
  mittR: [number, number, number];
  mittL: [number, number, number];
}
const HOLDS: Record<GunId, HoldDef> = {
  rifle:    { gun: [0.3, 1.14, 0.33],  gunRotZ: -0.06, armR: [0, 0.35],  elbowR: 1.1,  armL: [0.62, 0.5],  elbowL: 0.95, mittR: [0.06, 1.05, 0.5],  mittL: [0.5, 1.08, 0.5] },
  smg:      { gun: [0.26, 1.18, 0.33], gunRotZ: -0.04, armR: [0, 0.3],   elbowR: 1.25, armL: [0.6, 0.45],  elbowL: 1.1,  mittR: [0.08, 1.1, 0.5],   mittL: [0.42, 1.12, 0.5] },
  // low and level, off-hand way out on the pump
  shotgun:  { gun: [0.32, 1.02, 0.34], gunRotZ: -0.1,  armR: [0, 0.3],   elbowR: 0.85, armL: [0.66, 0.75], elbowL: 0.6,  mittR: [0.04, 0.96, 0.5],  mittL: [0.58, 0.98, 0.5] },
  // isosceles: the whole right arm extends; the pistol lives at eye line
  pistol:   { gun: [0.62, 1.32, 0.34], gunRotZ: 0,     armR: [0, 1.45],  elbowR: 0.12, armL: [0.35, 1.2],  elbowL: 0.5,  mittR: [0.56, 1.3, 0.4],   mittL: [0.44, 1.22, 0.44] },
  // the tube rides the SHOULDER
  launcher: { gun: [0.12, 1.52, 0.3],  gunRotZ: 0.04,  armR: [0, 0.9],   elbowR: 1.5,  armL: [0.5, 0.7],   elbowL: 1.2,  mittR: [0.3, 1.45, 0.4],   mittL: [0.05, 1.32, 0.42] },
  // long low-ready: muzzle dipped, both hands far apart
  rail:     { gun: [0.36, 1.08, 0.33], gunRotZ: -0.14, armR: [0, 0.25],  elbowR: 0.9,  armL: [0.6, 0.62],  elbowL: 0.7,  mittR: [0.02, 1.0, 0.48],  mittL: [0.62, 0.96, 0.48] },
  // hip-braced, wide grip — the weight is real
  flamer:   { gun: [0.3, 0.98, 0.36],  gunRotZ: 0.02,  armR: [0, 0.4],   elbowR: 0.9,  armL: [0.65, 0.55], elbowL: 0.8,  mittR: [0.05, 0.95, 0.5],  mittL: [0.5, 0.95, 0.5] },
};

function makeShotgun(): THREE.Group {
  // FAT AND SHORT — you should know it's a shotgun from the ceiling
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
  return g;
}

// ---------------------------------------------------------------------------
// THE CAPSULE RIGS — three budgets of the same idea.
// Every rig exposes { root, body, gun, mittR?, blade } so one animator drives all.
// ---------------------------------------------------------------------------
interface Rig {
  label: string;
  root: THREE.Group;      // pedestal-space: position/facing
  body: THREE.Group;      // bobs, leans, squashes
  gun: THREE.Group;       // swaps rifle/shotgun, stows on fly
  gunHome: { pos: THREE.Vector3; rot: THREE.Euler };
  blade: THREE.Mesh;      // the slash arc
  mittR?: THREE.Mesh;     // 12-shape only: the floating hand that sells it
  mittL?: THREE.Mesh;
  // the reference rigs (Robert's two images) carry REAL limbs — pivot groups
  // at shoulder and hip; the animator swings them when present
  armR?: THREE.Group;
  armL?: THREE.Group;
  legR?: THREE.Group;
  legL?: THREE.Group;
  // second-order joints (Robert: "the knees need to bend… they look like they
  // don't wanna bend the elbows at all") — child pivots inside the limbs
  elbowR?: THREE.Group;
  elbowL?: THREE.Group;
  kneeR?: THREE.Group;
  kneeL?: THREE.Group;
  jet?: THREE.Mesh;       // flight flame
  ghosts: THREE.Mesh[];   // dash afterimages (capsule clones)
  ghostGeo: THREE.BufferGeometry;
}

/** the slash arc: one stroke of an X — a ring-fan that sweeps down-right */
function makeBlade(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.55, 1.15, 20, 1, 0, Math.PI * 0.62);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xeef4ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.visible = false;
  return m;
}

function capsuleRig(label: string, shapes: 1 | 4 | 12, dress?: FactionDress): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // THE PILL. One capsule IS the soldier. Radius/length tuned so the whole
  // body stands ~1.7u — same read as a trooper at command zoom.
  const capGeo = new THREE.CapsuleGeometry(0.42, 0.72, 6, 12);
  const cap = new THREE.Mesh(capGeo, M(dress ? dress.jacket : TEAM));
  cap.castShadow = true;
  cap.position.y = 0.86;
  body.add(cap);
  if (dress) {
    // faction belt — the accent as a ring you read from every angle
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.435, 0.07, 14), M(dress.accent, 0.6));
    belt.position.y = 0.98;
    body.add(belt);
    // camo plates sunk into the shell
    for (const [px, py, pz, c] of [
      [0.28, 1.15, 0.25, dress.camoA], [0.3, 0.72, -0.2, dress.camoB], [-0.3, 1.0, 0.18, dress.camoA],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.16), M(c, 0.95));
      m.position.set(px, py, pz);
      body.add(m);
    }
  }

  const gun = new THREE.Group();
  gun.add(makeRifle());
  // THE GUN ON THE RIGHT SIDE — carried at the chest, not dangling at the hip
  gun.position.set(0.2, 1.06, 0.5);
  gun.rotation.y = -0.06;
  gun.rotation.z = -0.06;
  body.add(gun);
  const gunHome = { pos: gun.position.clone(), rot: gun.rotation.clone() };

  const rig: Rig = {
    label, root, body, gun, gunHome,
    blade: makeBlade(), ghosts: [], ghostGeo: capGeo,
  };
  body.add(rig.blade);
  rig.blade.position.set(0.4, 1.0, 0.5);

  if (shapes >= 4) {
    // visor: the face is a STRIPE, not a face
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.56), M(0x18242e, 0.25));
    visor.position.set(0.34, 1.24, 0); // on the face — travel is +X, so the face is +X
    body.add(visor);
    // pack: the back has hardware
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.5), M(0x5a5146, 0.9));
    pack.position.set(-0.42, 0.92, 0);
    pack.castShadow = true;
    body.add(pack);
  }
  if (shapes >= 12) {
    // THE FLOATING MITTS — arms with no arms. This is the piece that fixes
    // "flying doesn't look good": hands that hold, tuck, and swing without a
    // welded limb to fight. Rayman shipped a whole franchise on this.
    const mittGeo = new THREE.SphereGeometry(0.16, 8, 6);
    // glove-tan, and parked ON the weapon — grip and foregrip — so they read
    // as hands holding a gun, not white things bouncing around
    const mittR = new THREE.Mesh(mittGeo, M(0xc9a97a));
    mittR.position.set(0.06, 1.05, 0.5); mittR.castShadow = true;
    const mittL = new THREE.Mesh(mittGeo, M(0xc9a97a));
    mittL.position.set(0.5, 1.08, 0.5); mittL.castShadow = true;
    body.add(mittR, mittL);
    rig.mittR = mittR; rig.mittL = mittL;
    // feet nubs — the bop reads harder with something to leave the ground
    for (const dz of [-0.22, 0.22]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M(0x3a3f45));
      foot.position.set(0, 0.12, dz);
      foot.castShadow = true;
      body.add(foot);
    }
    // antenna + tail-light: silhouette garnish
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4), M(STEEL, 0.4));
    ant.position.set(-0.3, 1.55, -0.12); ant.rotation.z = 0.25;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff5347 }));
    tip.position.set(-0.35, 1.74, -0.12);
    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.55, 7),
      new THREE.MeshBasicMaterial({ color: 0xffa02a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    jet.rotation.x = Math.PI;
    jet.position.set(-0.42, 0.5, 0);
    body.add(ant, tip, jet);
    rig.jet = jet;
  }

  // dash afterimages: three fading clones of the pill
  for (let i = 0; i < 3; i++) {
    const ghost = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({
      color: TEAM, transparent: true, opacity: 0, depthWrite: false,
    }));
    ghost.position.y = 0.86;
    root.add(ghost);
    rig.ghosts.push(ghost);
  }
  return rig;
}


// ---------------------------------------------------------------------------
// THE REFERENCE RIGS — built from the two images Robert has "always had".
// ---------------------------------------------------------------------------

/** Ref 1, "the standard one": a papercraft mannequin. Box head, brown jacket
 *  with a flared hem, SEGMENTED limbs with visible cuts at every joint, dark
 *  trousers, boots. The whole idea of this body is that it is made of joints —
 *  so it gets real shoulder and hip pivots and earns the full move set. */
interface FactionDress {
  jacket: number; trouser: number; camoA: number; camoB: number; accent: number;
}
// THE FACTION QUESTION (Robert: "red versus blue? camouflage green versus
// camouflage gray?"): his own instinct, dressed — the BODY wears the camo
// (green vs gray), the ACCENT wears the faction (amber vs cyan), and the
// game's §18 law keeps a second channel beyond hue: the accent strap is a
// SHAPE cue too. Nobody has to be a red army man.
const UF_DRESS: FactionDress = { jacket: 0x5c6b3f, trouser: 0x37402f, camoA: 0x47542f, camoB: 0x707d4a, accent: 0xe8a33d };
const COL_DRESS: FactionDress = { jacket: 0x5c646e, trouser: 0x3a4047, camoA: 0x49515b, camoB: 0x737d88, accent: 0x3dbde8 };

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

  // torso: the jacket, with the flared hem that gives ref 1 its silhouette
  const torso = box(0.42, 0.5, 0.55, JACKET); torso.position.y = 1.24; body.add(torso);
  const hem = box(0.5, 0.14, 0.66, JACKET); hem.position.y = 0.95; body.add(hem);
  // camo: thin plates proud of the cloth (the voxel trick — no textures)
  const camo = (w: number, h: number, x: number, y: number, z: number, c: number) => {
    const m = box(0.02, h, w, c);
    m.position.set(x, y, z);
    body.add(m);
  };
  camo(0.16, 0.12, 0.22, 1.34, 0.1, dress.camoA);
  camo(0.12, 0.1, 0.22, 1.12, -0.14, dress.camoB);
  camo(0.14, 0.1, -0.22, 1.26, 0.06, dress.camoA);
  camo(0.1, 0.09, 0.26, 0.95, 0.18, dress.camoB); // one on the hem
  // the ACCENT STRAP — faction color as a shape, slung chest to hip
  const strap = box(0.05, 0.56, 0.09, dress.accent);
  strap.position.set(0.22, 1.22, 0.05);
  strap.rotation.x = 0.55;
  body.add(strap);
  // head: the big papercraft box, floating a visible CUT above the collar
  const head = box(0.4, 0.4, 0.4, SKIN); head.position.y = 1.74; body.add(head);

  // arms: shoulder cube -> upper -> ELBOW PIVOT -> forearm -> hand block.
  // The elbow is a live joint now (Robert: "they look like they don't wanna
  // bend the elbows at all — it should hold it like a real human would").
  const mkArm = (dz: number): { pivot: THREE.Group; elbow: THREE.Group } => {
    const arm = new THREE.Group();
    arm.position.set(0, 1.42, dz);
    const sh = box(0.17, 0.17, 0.17, JACKET); sh.position.y = 0; arm.add(sh);
    const up = box(0.13, 0.3, 0.14, JACKET); up.position.y = -0.24; arm.add(up);
    const elbow = new THREE.Group();
    elbow.position.y = -0.42;
    const fore = box(0.11, 0.26, 0.12, JACKET); fore.position.y = -0.13; elbow.add(fore);
    const hand = box(0.12, 0.13, 0.11, SKIN); hand.position.y = -0.31; elbow.add(hand);
    arm.add(elbow);
    body.add(arm);
    return { pivot: arm, elbow };
  };
  // legs: hip pivot -> thigh -> KNEE PIVOT -> shin + boot ("the knees need to bend")
  const mkLeg = (dz: number): { pivot: THREE.Group; knee: THREE.Group } => {
    const leg = new THREE.Group();
    leg.position.set(0, 0.92, dz);
    const th = box(0.18, 0.36, 0.2, TROUSER); th.position.y = -0.19; leg.add(th);
    const camoT = box(0.02, 0.09, 0.12, dz > 0 ? dress.camoA : dress.camoB);
    camoT.position.set(0.1, -0.2, 0); th.add(camoT);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    const sh = box(0.15, 0.34, 0.17, TROUSER); sh.position.y = -0.17; knee.add(sh);
    const bt = box(0.18, 0.12, 0.3, BOOT); bt.position.set(0.05, -0.44, 0); knee.add(bt);
    leg.add(knee);
    body.add(leg);
    return { pivot: leg, knee };
  };

  const gun = new THREE.Group();
  gun.add(makeRifle());
  // AT THE CHEST, where a human holds a rifle — not floating at the hip
  gun.position.set(0.3, 1.14, 0.33);
  gun.rotation.z = -0.06; // muzzle a breath down — the ready carry
  body.add(gun);

  const aR = mkArm(0.36), aL = mkArm(-0.36), lR = mkLeg(0.15), lL = mkLeg(-0.15);
  const rig: Rig = {
    label, root, body, gun,
    gunHome: { pos: gun.position.clone(), rot: gun.rotation.clone() },
    blade: makeBlade(), ghosts: [], ghostGeo: new THREE.BoxGeometry(0.5, 1.5, 0.55),
    armR: aR.pivot, armL: aL.pivot, elbowR: aR.elbow, elbowL: aL.elbow,
    legR: lR.pivot, legL: lL.pivot, kneeR: lR.knee, kneeL: lL.knee,
  };
  body.add(rig.blade);
  rig.blade.position.set(0.4, 1.1, 0.5);
  for (let i = 0; i < 3; i++) {
    const ghost = new THREE.Mesh(rig.ghostGeo, new THREE.MeshBasicMaterial({ color: JACKET, transparent: true, opacity: 0, depthWrite: false }));
    ghost.position.y = 1.1;
    root.add(ghost);
    rig.ghosts.push(ghost);
  }
  return rig;
}

/** Ref 2, "a random soldier": the voxel trooper. Helmet with an NVG nub,
 *  gray digital camo (patch boxes riding proud of the surface — honest voxel
 *  grammar, no textures), a vest with chest pouches, cube fists, boots. */
function voxelRig(label: string): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const BASE = 0x828a92, DARKC = 0x555c64, LIGHTC = 0x9fa8b0, VEST = 0x464c54, SKIN = 0x8a5c40, BOOT = 0x33373c;
  const box = (w: number, h: number, d: number, c: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
    m.castShadow = true;
    return m;
  };
  // a camo patch: a thin box sitting proud of the surface, facing the camera
  // line — voxel camo without a texture
  const patch = (parent: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, c: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, w), new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
    m.position.set(x, y, z);
    parent.add(m);
  };

  const torso = box(0.4, 0.5, 0.52, BASE); torso.position.y = 1.28; body.add(torso);
  patch(body, 0.14, 0.1, 0.21, 1.4, 0.12, DARKC);
  patch(body, 0.1, 0.08, 0.21, 1.14, -0.1, LIGHTC);
  patch(body, 0.12, 0.09, -0.21, 1.3, 0.05, DARKC);
  const vest = box(0.44, 0.34, 0.56, VEST); vest.position.y = 1.33; body.add(vest);
  for (const dz of [-0.16, 0, 0.16]) {
    const pouch = box(0.09, 0.13, 0.12, DARKC); pouch.position.set(0.25, 1.28, dz); body.add(pouch);
  }
  const belt = box(0.44, 0.09, 0.58, VEST); belt.position.y = 1.0; body.add(belt);

  const head = box(0.3, 0.3, 0.3, SKIN); head.position.y = 1.68; body.add(head);
  for (const dz of [-0.07, 0.07]) {
    const eye = box(0.03, 0.05, 0.05, 0x22262a); eye.position.set(0.16, 1.7, dz); body.add(eye);
  }
  const helm = box(0.38, 0.2, 0.44, BASE); helm.position.y = 1.9; body.add(helm);
  const brim = box(0.42, 0.06, 0.48, DARKC); brim.position.set(0.02, 1.8, 0); body.add(brim);
  const nvg = box(0.1, 0.1, 0.1, VEST); nvg.position.set(0.22, 1.92, 0); body.add(nvg);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 4), M(0x2c3034, 0.5));
  ant.position.set(-0.2, 2.0, -0.16); body.add(ant);

  const mkArm = (dz: number): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(0, 1.46, dz);
    const up = box(0.14, 0.56, 0.16, BASE); up.position.y = -0.28; arm.add(up);
    patch(arm, 0.09, 0.1, 0.08, -0.3, 0, DARKC);
    const fist = box(0.17, 0.17, 0.17, 0x3a3f45); fist.position.y = -0.63; arm.add(fist);
    body.add(arm);
    return arm;
  };
  const mkLeg = (dz: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(0, 0.85, dz);
    const th = box(0.17, 0.68, 0.19, BASE); th.position.y = -0.36; leg.add(th);
    const bt = box(0.19, 0.16, 0.3, BOOT); bt.position.set(0.04, -0.78, 0); leg.add(bt);
    body.add(leg);
    return leg;
  };

  const gun = new THREE.Group();
  gun.add(makeRifle());
  gun.position.set(0.28, 1.12, 0.3); // chest carry, tucked into the body
  gun.rotation.z = -0.06;
  body.add(gun);

  const rig: Rig = {
    label, root, body, gun,
    gunHome: { pos: gun.position.clone(), rot: gun.rotation.clone() },
    blade: makeBlade(), ghosts: [], ghostGeo: new THREE.BoxGeometry(0.48, 1.6, 0.52),
    armR: mkArm(0.34), armL: mkArm(-0.34), legR: mkLeg(0.14), legL: mkLeg(-0.14),
  };
  body.add(rig.blade);
  rig.blade.position.set(0.4, 1.1, 0.5);
  for (let i = 0; i < 3; i++) {
    const ghost = new THREE.Mesh(rig.ghostGeo, new THREE.MeshBasicMaterial({ color: BASE, transparent: true, opacity: 0, depthWrite: false }));
    ghost.position.y = 1.1;
    root.add(ghost);
    rig.ghosts.push(ghost);
  }
  return rig;
}

// ---------------------------------------------------------------------------
// THE LINEUP
// ---------------------------------------------------------------------------
const PITCH = 6;
const rigs: Rig[] = [];
const labels: { at: THREE.Vector3; el: HTMLDivElement }[] = [];
const labelBox = document.getElementById('labels') as HTMLDivElement;

function addLabel(text: string, x: number) {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.textContent = text;
  labelBox.appendChild(el);
  labels.push({ at: new THREE.Vector3(x, 0, 2.6), el });
}

// THE BASELINE, UNBIASED (Robert: "why isn't it doing any of the stuff? this
// is kinda biased"). Fair point — it stood there like a statue while the
// candidates danced. Now it runs its ACTUAL in-game gait: poseSoldierJoints,
// the same function the renderer calls, drives its joints every frame, and
// the shared animator gives it the same root motion, ghosts and speed lines
// as everyone else. What you see is what the current rig can really do.
const curSoldier = buildSoldier(0, 'infantry', 'bot'); // faces +X at yaw 0 — the rig contract
const curRig: Rig = (() => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(curSoldier);
  root.add(body);
  const gun = new THREE.Group(); // the soldier's gun lives in its own hands; this is a dummy for the animator
  body.add(gun);
  const rig: Rig = {
    label: 'CURRENT (baseline)', root, body, gun,
    gunHome: { pos: gun.position.clone(), rot: gun.rotation.clone() },
    blade: makeBlade(), ghosts: [], ghostGeo: new THREE.BoxGeometry(0.7, 1.7, 0.7),
  };
  body.add(rig.blade);
  rig.blade.position.set(0.4, 1.1, 0.5);
  for (let i = 0; i < 3; i++) {
    const ghost = new THREE.Mesh(rig.ghostGeo, new THREE.MeshBasicMaterial({ color: 0x8a7a52, transparent: true, opacity: 0, depthWrite: false }));
    ghost.position.y = 0.95;
    root.add(ghost);
    rig.ghosts.push(ghost);
  }
  return rig;
})();
curRig.root.position.set(-2.5 * PITCH, 0, 0);
scene.add(curRig.root);
rigs.push(curRig);
addLabel('CURRENT (baseline)', -2.5 * PITCH);

// THE FINALISTS (Robert: "I like the papercraft guy, and I like pill twelve
// shapes") — each in BOTH faction dresses, so green-vs-gray is a thing you
// see, not a thing we argue about. The voxel trooper keeps a seat as the
// what-camo-can-look-like reference.
const lineup: Rig[] = [
  papercraftRig('PAPERCRAFT · UNITED FRONT', UF_DRESS),
  papercraftRig('PAPERCRAFT · COLLECTIVE', COL_DRESS),
  voxelRig('VOXEL (camo ref)'),
  capsuleRig('PILL-12 · UNITED FRONT', 12, UF_DRESS),
  capsuleRig('PILL-12 · COLLECTIVE', 12, COL_DRESS),
];
lineup.forEach((rig, i) => {
  rig.root.position.set((i - 1.5) * PITCH, 0, 0);
  scene.add(rig.root);
  rigs.push(rig);
  addLabel(rig.label, (i - 1.5) * PITCH);
});

camera.position.set(0, 7.4, 25.5);
camera.lookAt(0, 1.2, 0);

// ROTATE AND LOOK AROUND (Robert asked): drag orbits, wheel zooms, right-drag
// pans. The damping makes it feel like a turntable, not a CAD tool.
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49; // never under the floor
controls.minDistance = 6;
controls.maxDistance = 60;

// ---------------------------------------------------------------------------
// THE ANIMATOR — one clock drives every rig so comparison is honest.
// ---------------------------------------------------------------------------
let action: ActionId = 'run';
let actionT = 0;            // seconds into the current action
let gunKind: GunId = 'rifle';

// speed lines live in world space, recycled
const LINES = 26;
const lineGeo = new THREE.BoxGeometry(0.5, 0.03, 0.03);
const lines: { m: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
for (let i = 0; i < LINES; i++) {
  const m = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
  }));
  scene.add(m);
  lines.push({ m, vel: new THREE.Vector3(), life: 0 });
}
let lineCursor = 0;
function speedLine(at: THREE.Vector3, dir: number) {
  const l = lines[lineCursor];
  lineCursor = (lineCursor + 1) % LINES;
  l.m.position.copy(at);
  l.m.position.y += 0.5 + Math.random() * 0.9;
  l.m.position.z += (Math.random() - 0.5) * 0.7;
  l.vel.set(-dir * (9 + Math.random() * 5), 0, 0);
  l.m.scale.setScalar(0.8 + Math.random() * 1.3);
  l.life = 0.35;
}

const GUNS: GunId[] = ['rifle', 'smg', 'shotgun', 'pistol', 'launcher', 'rail', 'flamer'];
function setGun(kind: GunId) {
  gunKind = kind;
  for (const r of rigs) {
    r.gun.clear();
    r.gun.add(BUILD_GUN[kind]());
  }
  document.getElementById('btn-gun')!.textContent = `GUN: ${kind.toUpperCase()} ▸`;
}

function play(a: ActionId) {
  action = a;
  actionT = 0;
  for (const b of document.querySelectorAll('.act')) b.classList.toggle('on', (b as HTMLElement).dataset.a === a);
}

let last = performance.now();
let frames = 0;
let frozen = false; // freeze-frame: the bench holds an action at an exact t for capture
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!frozen) actionT += dt;
  frames++;
  const t = now / 1000;

  controls.update();

  // the baseline's limbs run the game's OWN gait — joints re-resolved each
  // frame because the team-0 GLB body can mount in and replace the meshes
  {
    const j: Joints = {};
    for (const name of JOINT_NAMES) j[name] = curSoldier.getObjectByName(name) ?? undefined;
    const speed = action === 'run' ? 8 : action === 'dash' ? 13 : 0;
    poseSoldierJoints(j, { kind: 'bot', time: t, id: 3, speed, airborne: action === 'fly' || action === 'roll' });
  }

  for (const r of rigs) {
    const b = r.body;
    // rest pose every frame; actions layer on top
    b.position.set(0, 0, 0);
    b.rotation.set(0, 0, 0);
    b.scale.set(1, 1, 1);
    const H = HOLDS[gunKind];
    r.gun.position.set(H.gun[0], H.gun[1], H.gun[2]);
    r.gun.rotation.set(0, 0, H.gunRotZ);
    r.blade.visible = false;
    if (r.jet) (r.jet.material as THREE.MeshBasicMaterial).opacity = 0;
    for (const g of r.ghosts) (g.material as THREE.MeshBasicMaterial).opacity = 0;

    // THE HOLD — the default truth for every armed, limbed body: right hand
    // back at the grip, left arm across to the foregrip, BOTH elbows bent
    // like a human's, knees carrying a slight athletic flex. Actions layer
    // their changes ON TOP of this instead of inventing their own arms.
    if (r.armR) {
      r.armR.rotation.set(H.armR[0], 0, H.armR[1]);
      r.armL!.rotation.set(H.armL[0], 0, H.armL[1]);
      if (r.elbowR) {
        r.elbowR.rotation.set(0, 0, H.elbowR);   // the bend that was missing
        r.elbowL!.rotation.set(0, 0, H.elbowL);
      }
      r.legR!.rotation.set(0, 0, 0);
      r.legL!.rotation.set(0, 0, 0);
      if (r.kneeR) {
        r.kneeR.rotation.set(0, 0, -0.2);   // soft knees — nobody stands on planks
        r.kneeL!.rotation.set(0, 0, -0.2);
      }
    }
    if (r.mittR && action !== 'fly') {
      r.mittR.position.set(H.mittR[0], H.mittR[1], H.mittR[2]);
      r.mittL!.position.set(H.mittL[0], H.mittL[1], H.mittL[2]);
    }

    if (action === 'run') {
      // THE BOP — |sin| bounce, forward lean, a breath of roll. The whole ask.
      const phase = t * 9 + r.root.position.x;
      b.position.y = Math.abs(Math.sin(phase)) * 0.16;
      b.rotation.z = -0.16;                      // lean INTO the run (travel = +X, the profile read)
      b.rotation.x = Math.sin(phase) * 0.055;    // the waddle that sells weight
      if (r.armR) {
        // the LEGS do the running — anti-phase scissor with a REAL KNEE:
        // the shin folds through the recovery swing and lands near-straight,
        // the same shape the game's own gait uses. Arms stay in the hold.
        const sw = Math.sin(phase);
        r.legR!.rotation.z = sw * 0.55;
        r.legL!.rotation.z = -sw * 0.55;
        if (r.kneeR) {
          const bend = (p: number) => -0.25 - Math.max(0, Math.sin(p + 0.9)) * 0.9;
          r.kneeR.rotation.z = bend(phase);
          r.kneeL!.rotation.z = bend(phase + Math.PI);
        }
      }
    } else if (action === 'dash') {
      // DOUBLE-TAP LUNGE — 0.5s: hard lean, squash-and-stretch, ghosts, lines
      const k = Math.min(1, actionT / 0.5);
      const punch = Math.sin(Math.min(1, actionT / 0.42) * Math.PI); // in-and-out
      b.rotation.z = -0.62 * punch;                   // the hard lean he asked for
      b.scale.set(1 + 0.22 * punch, 1 - 0.18 * punch, 1 - 0.12 * punch); // stretch INTO travel
      b.position.x = punch * 1.9;                     // the lunge itself
      b.position.y = 0.05 * punch;
      for (let i = 0; i < r.ghosts.length; i++) {
        const g = r.ghosts[i];
        const back = (i + 1) / (r.ghosts.length + 1);
        g.position.x = b.position.x - back * 2.1;
        (g.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (0.34 - back * 0.09) * punch);
      }
      if (r.armR) {
        // hands never leave the weapon — the legs trail back, knees folded
        r.legR!.rotation.z = -0.7 * punch;
        r.legL!.rotation.z = -0.55 * punch;
        if (r.kneeR) {
          r.kneeR.rotation.z = -0.2 - 0.7 * punch;
          r.kneeL!.rotation.z = -0.2 - 0.55 * punch;
        }
      }
      if (punch > 0.25 && Math.random() < 0.5) {
        speedLine(new THREE.Vector3(r.root.position.x + b.position.x - 0.8, 0, r.root.position.z), 1);
      }
      if (k >= 1 && !frozen) play('run');
    } else if (action === 'slash') {
      // ONE STROKE OF AN X — the blade fan sweeps upper-left → lower-right
      const k = Math.min(1, actionT / 0.38);
      const swing = k < 0.18 ? 0 : (k - 0.18) / 0.82;   // tiny windup, then commit
      r.blade.visible = swing > 0 && swing < 1;
      // RingGeometry lies in the camera plane already (normal +Z): the whole
      // stroke is one rotation — upper-left to lower-right, the X's first line
      r.blade.rotation.set(0, 0, 2.0 - swing * 2.9);
      (r.blade.material as THREE.MeshBasicMaterial).opacity = 0.85 * Math.sin(Math.min(1, swing) * Math.PI);
      b.rotation.z = -0.3 * Math.sin(k * Math.PI);       // body throws into it
      b.rotation.x = 0.18 * Math.sin(k * Math.PI);
      if (r.mittR) {
        // the mitt carries the stroke — high to low across the body
        r.mittR.position.y = 1.35 - swing * 0.85;
        r.mittR.position.x = 0.1 + swing * 0.5;
      }
      if (r.armR) {
        // the right arm IS the axe: overhead wind, then the committed chop —
        // the ELBOW whips through the stroke; the left hand keeps the gun
        r.armR!.rotation.set(0, 0, 2.5 - swing * 3.1);
        if (r.elbowR) r.elbowR.rotation.set(0, 0, 0.4 + swing * 0.9);
        r.legR!.rotation.z = 0.3 * Math.sin(k * Math.PI);  // step into it
        r.legL!.rotation.z = -0.3 * Math.sin(k * Math.PI);
      }
      if (k >= 1 && !frozen) play('run');
    } else if (action === 'fly') {
      // THE JETPACK POSE — and the answer to "the gun sticks out when they
      // fly": it STOWS. Slung diagonally across the pack, muzzle down-back.
      const k = Math.min(1, actionT / 0.6);
      const ease = 1 - (1 - k) * (1 - k);
      b.position.y = ease * 1.5 + Math.sin(t * 2.2) * 0.07 * ease;
      b.rotation.z = -0.5 * ease;                        // superman lean, nose into +X
      r.gun.position.set(-0.5, 1.05, 0);                 // onto the back
      r.gun.rotation.set(0, 0, 1.05);                    // slung diagonal, muzzle down-back
      if (r.jet) (r.jet.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 30) * 0.25;
      if (r.mittR) {
        r.mittR.position.set(0.7, 1.1, 0.3);             // fists PUNCH the sky ahead
        r.mittL!.position.set(0.7, 1.1, -0.3);
      }
      if (r.armR) {
        // superman: arms thrown far forward and STRAIGHT, legs trailing
        r.armR!.rotation.set(0, 0, 2.6 * ease);
        r.armL!.rotation.set(0, 0, 2.6 * ease);
        if (r.elbowR) { r.elbowR.rotation.set(0, 0, 0.1); r.elbowL!.rotation.set(0, 0, 0.1); }
        r.legR!.rotation.z = -0.35 * ease;
        r.legL!.rotation.z = -0.35 * ease;
        if (r.kneeR) { r.kneeR.rotation.z = -0.3 * ease; r.kneeL!.rotation.z = -0.3 * ease; }
      }
      if (actionT > 2.2 && !frozen) play('run');
    } else if (action === 'roll') {
      // MAX PAYNE (Robert: "a dive, like a dive roll type of deal"). One
      // 0.75s beat: DIVE out stretched, TUCK into a ball, roll a full
      // revolution along the travel line, come up on your feet.
      //
      // The spin must happen around the body's CENTRE, but a group rotates
      // around its origin (the feet) — so the position is solved from the
      // rotation each frame: keep the rotated centre riding the dive arc,
      // and the feet land where the math says, not where they started.
      const k = Math.min(1, actionT / 0.75);
      const ease = k * k * (3 - 2 * k);              // smoothstep drives both
      const th = -Math.PI * 2 * ease;                // one full forward revolution
      const c = 0.85;                                 // centre height of the tuck
      const arc = Math.sin(Math.min(1, k / 0.35) * Math.PI) * 0.5; // the dive's air
      const cx = ease * 3.4;                          // ground covered
      const cy = c + arc;
      b.rotation.z = th;
      b.position.x = cx + c * Math.sin(th);
      b.position.y = cy - c * Math.cos(th);
      b.scale.setScalar(1 - 0.12 * Math.sin(ease * Math.PI)); // the tuck squeeze
      if (r.armR) {
        // limbs HUG the ball — elbows and knees at full fold
        r.armR.rotation.set(0, 0, 1.5);
        r.armL!.rotation.set(0, 0, 1.5);
        if (r.elbowR) { r.elbowR.rotation.set(0, 0, 1.6); r.elbowL!.rotation.set(0, 0, 1.6); }
        r.legR!.rotation.z = 1.1;
        r.legL!.rotation.z = 1.1;
        if (r.kneeR) { r.kneeR.rotation.z = -1.9; r.kneeL!.rotation.z = -1.9; }
      }
      if (r.mittR) {
        r.mittR.position.set(0.1, 0.9, 0.45);        // hands pull in
        r.mittL!.position.set(0.3, 1.0, 0.45);
      }
      for (let i = 0; i < r.ghosts.length; i++) {
        const g = r.ghosts[i];
        const back = (i + 1) / (r.ghosts.length + 1);
        g.position.x = b.position.x - back * 1.6;
        (g.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.22 * Math.sin(ease * Math.PI) * (1 - back * 0.4));
      }
      if (k > 0.05 && k < 0.5 && Math.random() < 0.4) {
        speedLine(new THREE.Vector3(r.root.position.x + b.position.x - 0.6, 0, r.root.position.z), 1);
      }
      if (k >= 1 && !frozen) play('run');
    }
  }

  // speed lines decay in world space
  for (const l of lines) {
    if (l.life <= 0) continue;
    l.life -= dt;
    l.m.position.addScaledVector(l.vel, dt);
    (l.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, l.life / 0.35) * 0.7;
    if (l.life <= 0) (l.m.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  // labels track their pedestals
  const v = new THREE.Vector3();
  for (const L of labels) {
    v.copy(L.at).project(camera);
    L.el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    L.el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// buttons
for (const btn of document.querySelectorAll<HTMLElement>('.act')) {
  btn.addEventListener('click', () => play(btn.dataset.a as ActionId));
}
document.getElementById('btn-gun')!.addEventListener('click', () => setGun(GUNS[(GUNS.indexOf(gunKind) + 1) % GUNS.length]));
setGun('rifle');
play('run');
loop();

interface StyleHandle {
  frames: () => number;
  play: (a: ActionId) => void;
  gun: (g: GunId) => void;
  /** hold an action at exactly `t` seconds in — a screenshot can take its time */
  freeze: (a: ActionId, t: number) => void;
  thaw: () => void;
}
(window as unknown as { __style: StyleHandle }).__style = {
  frames: () => frames,
  play,
  gun: setGun,
  freeze: (a, t) => { play(a); actionT = t; frozen = true; },
  thaw: () => { frozen = false; play('run'); },
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
