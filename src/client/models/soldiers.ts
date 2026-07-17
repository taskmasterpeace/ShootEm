// Soldier-shaped things: troopers per class, the undead, Dr. Voss, the K9,
// and the riders that vehicles borrow.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TEAM_COLORS } from '../../sim/data';
import { zombieArmRest } from '../animation';
import type { ClassId, SoldierKind, Team } from '../../sim/types';
import { box, cyl, limb, mat } from './shared';

// ---------------------------------------------------------------------------
// GLB BODIES (Robert's models, tools/add-soldier.mjs): every class probes
// /models/soldier_<class>.glb at boot — a file that exists wears in, a 404
// stays procedural, ZERO code wiring per model. Bodies are segmented into
// the SAME eight named joints the animator swings, so gait/ragdoll/melee
// never know the difference. United Front only (the faction law: Collective
// shows no skin), and only once the one cached download lands — until then,
// and forever in tests, the procedural trooper stands in. Never a pop
// mid-soldier: the choice is made per-build, not per-frame.
// ---------------------------------------------------------------------------
const GLB_CLASSES: ClassId[] = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];
const GLB_BODIES: Partial<Record<ClassId, string>> = Object.fromEntries(
  GLB_CLASSES.map((c) => [c, `/models/soldier_${c}.glb`]),
);
const glbBodies = new Map<string, THREE.Group>();
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  for (const url of Object.values(GLB_BODIES)) {
    try {
      new GLTFLoader().load(url, (gltf) => {
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            const m = o.material as THREE.MeshStandardMaterial;
            m.vertexColors = true;
            // the baked colors wash out under the game sun — pull them down
            // toward the procedural UF olive so both bodies read as one army
            m.color.setRGB(0.62, 0.60, 0.52);
            m.roughness = 0.9;
          }
        });
        glbBodies.set(url, gltf.scene);
      }, undefined, () => { /* absent file = procedural forever; no drama */ });
    } catch { /* headless env */ }
  }
}

export function buildSoldier(team: Team, classId: ClassId, kind: SoldierKind): THREE.Group {
  if (kind === 'scientist') return buildScientist();
  if (kind === 'dog') return buildDog(team);
  const isZed = kind !== 'human' && kind !== 'bot';
  if (isZed) return buildZombie(kind);
  const glbUrl = team === 0 ? GLB_BODIES[classId] : undefined;
  const body = glbUrl ? glbBodies.get(glbUrl) : undefined;
  return body ? buildGlbTrooper(body, classId) : buildTrooper(team, classId);
}

/** LSW palette (no purple — house law). One place both the renderer and the
 *  harness read, so a Firebrand looks the same wherever it's shown. */
export const LSW_TINT: Record<string, { tint: number; scale: number }> = {
  firebrand: { tint: 0xff6a1a, scale: 1.25 },
  plaguebearer: { tint: 0x7fa83c, scale: 1.3 },
  frostbite: { tint: 0x8fd4e8, scale: 1.3 },  // pale ice-blue glow
  ragebeast: { tint: 0xb23030, scale: 1.45 }, // blood-iron
  titan: { tint: 0x9a8466, scale: 1.6 },      // weathered stone — the biggest silhouette now
};

/** Turn a built trooper body INTO an LSW body: scale up past a trooper,
 *  glow its faction shade, and tag it so the frame loop feeds the aura.
 *  Robert: "make sure visually the LSWs look different." */
export function dressAsLsw(mesh: THREE.Group, id: string): THREE.Group {
  const look = LSW_TINT[id] ?? { tint: 0xffffff, scale: 1.25 };
  mesh.scale.setScalar(look.scale);
  mesh.userData.lsw = id;
  mesh.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && 'emissive' in m) { m.emissive = new THREE.Color(look.tint); m.emissiveIntensity = 0.18; }
  });
  return mesh;
}

/** Robert's body + the game's rifle: clone the named-joint rig, give every
 *  part its own material instance (cloak alpha must never bleed across
 *  soldiers), and hang the class rifle exactly where buildTrooper does. */
function buildGlbTrooper(src: THREE.Group, classId: ClassId): THREE.Group {
  const g = new THREE.Group();
  const body = src.clone(true);
  body.traverse((o) => {
    if (o instanceof THREE.Mesh) o.material = (o.material as THREE.Material).clone();
  });
  g.add(body);
  // rifle-hold rest pose — the run cycle swings around these bases
  const armR = body.getObjectByName('armR');
  const armL = body.getObjectByName('armL');
  if (armR) armR.rotation.z = -0.5;
  if (armL) armL.rotation.z = -0.75;
  // the faction band: one amber stripe over the left shoulder — the GLB
  // body is Robert's art, the stripe is the army it fights for
  const trim = mat(TEAM_COLORS[0], { emissive: TEAM_COLORS[0] });
  const band = box(0.3, 0.05, 0.14, trim);
  band.position.set(0.02, 1.52, 0.3);
  g.add(band);
  const gun = buildRifle(classId);
  gun.position.set(0.42, 1.28, -0.16);
  gun.userData.baseX = gun.position.x;
  g.add(gun);
  return g;
}

/**
 * §5.3 Military working dog — a German-Shepherd silhouette on four named leg
 * joints (legFL/FR/RL/RR) so the trot cycle can swing them, plus a tail and a
 * team-colored K9 harness so you know whose dog is eating your infiltrator.
 * Root faces +X like every soldier.
 */
function buildDog(team: Team): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const coat = mat(0x8a6b42, { rough: 0.95 });   // tan working coat
  const saddle = mat(0x2b2620, { rough: 0.95 }); // black saddle + mask
  const dark = mat(0x1c1915, { rough: 0.9 });
  const vest = mat(0x3a3630, { rough: 0.7 });
  const trim = mat(teamCol, { emissive: teamCol });

  // ---- body: deep chest forward, hips a touch lower (the shepherd slope) ----
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.62;
  g.add(torso);
  const chest = box(0.5, 0.34, 0.3, coat);
  chest.position.set(0.18, 0.04, 0);
  torso.add(chest);
  const hind = box(0.42, 0.3, 0.27, coat);
  hind.position.set(-0.22, -0.02, 0);
  hind.rotation.z = -0.08; // sloped croup
  torso.add(hind);
  const back = box(0.55, 0.08, 0.31, saddle); // the black saddle marking
  back.position.set(0, 0.18, 0);
  torso.add(back);
  // K9 service harness: vest wrap over the shoulders + team stripe
  const wrap = box(0.26, 0.4, 0.36, vest);
  wrap.position.set(0.16, 0.02, 0);
  torso.add(wrap);
  const stripe = box(0.27, 0.09, 0.37, trim);
  stripe.position.set(0.16, 0.1, 0);
  torso.add(stripe);

  // ---- head: skull, dark snout, pricked ears ----
  const headGrp = new THREE.Group();
  headGrp.name = 'head';
  headGrp.position.set(0.48, 0.86, 0);
  g.add(headGrp);
  const neck = box(0.2, 0.26, 0.18, coat);
  neck.position.set(-0.1, -0.14, 0);
  neck.rotation.z = 0.5;
  headGrp.add(neck);
  const skull = box(0.24, 0.2, 0.2, coat);
  headGrp.add(skull);
  const snout = box(0.2, 0.12, 0.12, saddle);
  snout.position.set(0.2, -0.03, 0);
  headGrp.add(snout);
  const nose = box(0.05, 0.06, 0.07, dark);
  nose.position.set(0.31, -0.01, 0);
  headGrp.add(nose);
  for (const side of [1, -1]) {
    const ear = box(0.06, 0.14, 0.07, saddle);
    ear.position.set(-0.06, 0.16, side * 0.07);
    ear.rotation.x = side * -0.12;
    headGrp.add(ear);
  }

  // ---- four legs, named so the renderer can drive the trot ----
  const legSpots: [string, number, number][] = [
    ['legFL', 0.32, 0.12], ['legFR', 0.32, -0.12],
    ['legRL', -0.3, 0.12], ['legRR', -0.3, -0.12],
  ];
  for (const [name, lx, lz] of legSpots) {
    const hip = new THREE.Group();
    hip.name = name;
    hip.position.set(lx, 0.52, lz);
    hip.add(limb(0.1, 0.46, 0.1, coat));
    const paw = box(0.14, 0.07, 0.1, dark);
    paw.position.set(0.03, -0.46, 0);
    hip.add(paw);
    g.add(hip);
  }

  // ---- tail: swept back and down, wagged by the animator ----
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-0.42, 0.68, 0);
  tail.add(limb(0.08, 0.34, 0.08, saddle));
  tail.rotation.z = -0.9;
  g.add(tail);

  return g;
}

/** Dr. Voss: lab coat, spectacles, no weapon. The whole point of safehouse mode. */
function buildScientist(): THREE.Group {
  const g = new THREE.Group();
  const coat = mat(0xe4e2d8, { rough: 0.9 });
  const slacks = mat(0x4a4a52, { rough: 0.9 });
  const skin = mat(0xd0a67e, { rough: 0.8 });
  const dark = mat(0x26241f, { rough: 0.8 });

  for (const side of [1, -1]) {
    const hip = new THREE.Group();
    hip.name = side === 1 ? 'legL' : 'legR';
    hip.position.set(0, 0.96, side * 0.13);
    hip.add(limb(0.18, 0.44, 0.19, slacks));
    const knee = new THREE.Group();
    knee.name = side === 1 ? 'shinL' : 'shinR';
    knee.position.y = -0.44;
    knee.add(limb(0.15, 0.42, 0.16, slacks));
    const shoe = box(0.28, 0.1, 0.16, dark);
    shoe.position.set(0.05, -0.45, 0);
    knee.add(shoe);
    hip.add(knee);
    g.add(hip);
  }

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.98;
  g.add(torso);
  const chest = box(0.46, 0.52, 0.6, coat);
  chest.position.y = 0.28;
  torso.add(chest);
  // coat tails
  const tail = box(0.4, 0.3, 0.62, coat);
  tail.position.set(-0.06, -0.1, 0);
  torso.add(tail);
  // clipboard under one arm
  const clipboard = box(0.04, 0.26, 0.2, mat(0xc8a86a, { rough: 0.9 }));
  clipboard.position.set(0.2, 0.24, 0.34);
  torso.add(clipboard);

  // arms hang at his sides (he's not a fighter)
  for (const side of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.name = side === 1 ? 'armL' : 'armR';
    shoulder.position.set(0, 1.48, side * 0.3);
    shoulder.add(limb(0.13, 0.32, 0.13, coat));
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    elbow.add(limb(0.11, 0.28, 0.11, coat));
    const hand = box(0.09, 0.09, 0.09, skin);
    hand.position.y = -0.3;
    elbow.add(hand);
    elbow.rotation.z = -0.15;
    shoulder.add(elbow);
    shoulder.rotation.z = side === 1 ? 0.08 : -0.05;
    g.add(shoulder);
  }

  const headGrp = new THREE.Group();
  headGrp.name = 'head';
  headGrp.position.y = 1.62;
  g.add(headGrp);
  const face = box(0.26, 0.28, 0.28, skin);
  face.position.y = 0.14;
  headGrp.add(face);
  const hair = box(0.24, 0.08, 0.3, mat(0xbfbfb8, { rough: 0.95 })); // gray hair
  hair.position.y = 0.3;
  headGrp.add(hair);
  // spectacles
  for (const side of [1, -1]) {
    const lens = box(0.03, 0.08, 0.09, mat(0x333333, { rough: 0.3, metal: 0.5 }));
    lens.position.set(0.15, 0.16, side * 0.07);
    headGrp.add(lens);
  }
  return g;
}

function buildRifle(classId: ClassId): THREE.Group {
  const gun = new THREE.Group();
  gun.name = 'gun';
  const gunmetal = mat(0x23231f, { metal: 0.55, rough: 0.35 });
  const furniture = mat(0x3a352b, { rough: 0.7 });
  const heavy = classId === 'heavy';
  const sniper = classId === 'infiltrator';

  const rw = heavy ? 0.85 : sniper ? 0.75 : 0.68; // receiver length
  const rh = heavy ? 0.17 : 0.11;
  const receiver = box(rw, rh, heavy ? 0.13 : 0.09, gunmetal);
  gun.add(receiver);
  const barrel = box(sniper ? 0.62 : heavy ? 0.35 : 0.42, 0.055, 0.055, gunmetal);
  barrel.position.set(rw / 2 + barrel.geometry.parameters.width / 2 - 0.02, heavy ? 0.03 : 0.015, 0);
  gun.add(barrel);
  const stock = box(0.2, 0.13, 0.07, furniture);
  stock.position.set(-rw / 2 - 0.08, -0.02, 0);
  gun.add(stock);
  const mag = box(0.08, 0.18, 0.06, furniture);
  mag.position.set(0.05, -rh / 2 - 0.08, 0);
  mag.rotation.z = 0.25;
  gun.add(mag);
  const grip = box(0.06, 0.12, 0.06, furniture);
  grip.position.set(-0.15, -rh / 2 - 0.05, 0);
  gun.add(grip);
  if (heavy) {
    const drum = cyl(0.09, 0.09, 0.1, furniture, 10);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0.12, -0.14, 0);
    gun.add(drum);
    const brake = box(0.08, 0.09, 0.09, gunmetal);
    brake.position.set(rw / 2 + 0.32, 0.03, 0);
    gun.add(brake);
  }
  if (sniper) {
    const scope = cyl(0.035, 0.035, 0.2, gunmetal, 8);
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0.05, rh / 2 + 0.05, 0);
    gun.add(scope);
    const lens = cyl(0.03, 0.03, 0.01, mat(0x66ccff, { emissive: 0x3388cc }), 8);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.155, rh / 2 + 0.05, 0);
    gun.add(lens);
  }
  return gun;
}

function buildTrooper(team: Team, classId: ClassId): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const inf = classId === 'infiltrator';
  const uf = team === 0; // United Front: veteran steel. Collective: synthetic glass.

  // ---- faction palettes ----
  // UF reads as WORN MILITARY: olive fatigues, layered tan-steel plates,
  // amber trim, exposed chin — humans in a long war.
  // Collective reads as SYNTHETIC: graphite bodysuit, smooth blue-steel
  // shell, cyan glow lines, a sealed dome — nobody home behind the visor.
  const uniformCol = inf ? (uf ? 0x2e2c26 : 0x232b33) : uf ? 0x5c5236 : 0x2c3840;
  const armorCol = inf ? (uf ? 0x211f1a : 0x1b232b) : uf ? 0x46422e : 0x415663;
  const edgeCol = uf ? 0x8a7a4a : 0x5e7886;
  const uniform = mat(uniformCol, { rough: 0.92 });
  const armor = mat(armorCol, { rough: uf ? 0.72 : 0.45, metal: uf ? 0.22 : 0.5 });
  const edge = mat(edgeCol, { rough: 0.55, metal: 0.35 });
  const dark = mat(0x26241f, { rough: 0.8 });
  const skin = mat(0xd0a67e, { rough: 0.8 });
  const trim = mat(teamCol, { emissive: teamCol });
  const glow = mat(teamCol, { emissive: teamCol, rough: 0.3 });

  // ---- legs (jointed: thigh -> shin+boot), armored per faction ----
  for (const side of [1, -1]) {
    const hip = new THREE.Group();
    hip.name = side === 1 ? 'legL' : 'legR';
    hip.position.set(0, 0.96, side * 0.15);
    const thigh = limb(0.21, 0.44, 0.22, uniform);
    hip.add(thigh);
    // thigh plate (UF: strapped slab · C: molded shell with a glow seam)
    const thighPlate = limb(0.1, 0.3, 0.2, armor);
    thighPlate.position.set(0.09, -0.04, 0);
    hip.add(thighPlate);
    if (!uf) {
      const seam = limb(0.04, 0.26, 0.04, glow);
      seam.position.set(0.13, -0.06, 0.07 * side);
      hip.add(seam);
    }
    const knee = new THREE.Group();
    knee.name = side === 1 ? 'shinL' : 'shinR';
    knee.position.y = -0.44;
    const shin = limb(0.17, 0.42, 0.18, uniform);
    knee.add(shin);
    const pad = box(0.14, 0.14, 0.17, uf ? edge : armor);
    pad.position.set(0.08, -0.06, 0);
    knee.add(pad);
    const greave = limb(0.07, 0.3, 0.15, armor);
    greave.position.set(0.1, -0.1, 0);
    knee.add(greave);
    const boot = box(0.32, 0.12, 0.19, dark);
    boot.position.set(0.06, -0.46, 0);
    knee.add(boot);
    const sole = box(0.34, 0.04, 0.21, mat(0x14120f, { rough: 0.95 }));
    sole.position.set(0.06, -0.52, 0);
    knee.add(sole);
    hip.add(knee);
    g.add(hip);
  }
  // hip skirt plates hang from the belt line
  for (const side of [1, -1]) {
    const skirt = box(0.16, 0.2, 0.12, armor);
    skirt.position.set(0.12, 0.9, side * 0.24);
    skirt.rotation.z = -0.12;
    g.add(skirt);
  }

  // ---- torso ----
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.98;
  g.add(torso);
  const chest = box(0.5, 0.52, 0.66, uniform);
  chest.position.y = 0.28;
  torso.add(chest);
  const belt = box(0.52, 0.09, 0.68, dark);
  belt.position.y = 0.02;
  torso.add(belt);

  if (uf) {
    // layered angular carrier: two stacked front plates, canted
    const plateHi = box(0.14, 0.24, 0.52, armor);
    plateHi.position.set(0.26, 0.42, 0);
    plateHi.rotation.z = -0.08;
    const plateLo = box(0.13, 0.22, 0.48, armor);
    plateLo.position.set(0.28, 0.18, 0);
    plateLo.rotation.z = 0.06;
    torso.add(plateHi, plateLo);
    const plateEdge = box(0.03, 0.05, 0.5, edge);
    plateEdge.position.set(0.33, 0.31, 0);
    torso.add(plateEdge);
    for (const pz of [-0.17, 0.0, 0.17]) {
      const pouch = box(0.09, 0.14, 0.13, dark);
      pouch.position.set(0.3, 0.08, pz);
      torso.add(pouch);
      const flap = box(0.1, 0.05, 0.14, uniform);
      flap.position.set(0.3, 0.16, pz);
      torso.add(flap);
    }
    const canteen = cyl(0.06, 0.06, 0.14, edge, 8);
    canteen.position.set(-0.05, 0.02, 0.36);
    torso.add(canteen);
  } else {
    // molded shell with a glowing power core line down the sternum
    const shell = box(0.13, 0.44, 0.54, armor);
    shell.position.set(0.27, 0.3, 0);
    torso.add(shell);
    const core = box(0.04, 0.34, 0.06, glow);
    core.position.set(0.34, 0.3, 0);
    torso.add(core);
    for (const side of [1, -1]) {
      const rib = box(0.05, 0.02, 0.2, glow);
      rib.position.set(0.33, 0.18, side * 0.15);
      torso.add(rib);
    }
    for (let i = 0; i < 2; i++) {
      const seg = box(0.1, 0.07, 0.5, mat(armorCol, { rough: 0.5, metal: 0.45 }));
      seg.position.set(0.28, 0.02 + i * 0.09, 0);
      torso.add(seg);
    }
  }

  // back gear
  const pack = box(0.2, 0.34, 0.44, classId === 'medic' ? mat(0xd8d8d2, { rough: 0.8 }) : armor);
  pack.position.set(-0.32, 0.3, 0);
  torso.add(pack);
  if (uf) {
    const bedroll = cyl(0.07, 0.07, 0.4, uniform, 8);
    bedroll.rotation.x = Math.PI / 2;
    bedroll.position.set(-0.3, 0.54, 0);
    torso.add(bedroll);
    const antenna = cyl(0.015, 0.015, 0.5, dark, 4);
    antenna.position.set(-0.42, 0.62, -0.16);
    torso.add(antenna);
  } else {
    for (const side of [1, -1]) {
      const cell = box(0.06, 0.2, 0.08, glow);
      cell.position.set(-0.44, 0.32, side * 0.12);
      torso.add(cell);
    }
  }

  if (classId === 'medic') {
    const crossV = box(0.05, 0.22, 0.07, mat(0xd8453a, { emissive: 0xd8453a }));
    const crossH = box(0.05, 0.07, 0.22, mat(0xd8453a, { emissive: 0xd8453a }));
    crossV.position.set(-0.44, 0.3, 0);
    crossH.position.set(-0.44, 0.3, 0);
    torso.add(crossV, crossH);
  }
  if (classId === 'engineer') {
    const wrench = box(0.06, 0.3, 0.08, mat(0xb8b0a0, { metal: 0.7, rough: 0.3 }));
    wrench.position.set(-0.45, 0.28, 0.12);
    wrench.rotation.x = 0.3;
    torso.add(wrench);
    for (const side of [1, -1]) {
      const satchel = box(0.12, 0.12, 0.1, dark);
      satchel.position.set(0.05, 0.0, side * 0.37);
      torso.add(satchel);
    }
  }
  if (classId === 'jump') {
    const packL = cyl(0.09, 0.11, 0.42, mat(0x555a60, { metal: 0.5, rough: 0.4 }), 8);
    packL.position.set(-0.38, 0.3, 0.13);
    const packR = packL.clone();
    packR.position.z = -0.13;
    torso.add(packL, packR);
    for (const side of [1, -1]) {
      const nozzle = cyl(0.05, 0.08, 0.1, dark, 8);
      nozzle.position.set(-0.38, 0.03, side * 0.13);
      torso.add(nozzle);
      const fin = box(0.02, 0.24, 0.1, armor);
      fin.position.set(-0.5, 0.34, side * 0.22);
      torso.add(fin);
    }
  }
  if (classId === 'heavy') {
    const bandolier = box(0.08, 0.5, 0.1, dark);
    bandolier.position.set(0.28, 0.28, 0.1);
    bandolier.rotation.x = 0.5;
    torso.add(bandolier);
    for (let i = 0; i < 4; i++) {
      const round = box(0.03, 0.07, 0.03, edge);
      round.position.set(0.33, 0.14 + i * 0.1, 0.16 - i * 0.04);
      round.rotation.x = 0.5;
      torso.add(round);
    }
  }
  if (classId === 'pathfinder') {
    for (const side of [1, -1]) {
      const pylon = cyl(0.05, 0.07, 0.4, mat(0x5ac8b0, { emissive: 0x2e8a76, metal: 0.4 }), 6);
      pylon.position.set(-0.44, 0.42, side * 0.14);
      torso.add(pylon);
    }
  }
  if (classId === 'ghost') {
    const mast = cyl(0.02, 0.02, 0.7, dark, 4);
    mast.position.set(-0.4, 0.7, -0.15);
    torso.add(mast);
    const dish = cyl(0.1, 0.02, 0.06, mat(0x7a90a8, { emissive: 0x4a6078, metal: 0.5 }), 8);
    dish.position.set(-0.4, 1.06, -0.15);
    torso.add(dish);
  }
  if (classId === 'infantry') {
    for (const pz of [-0.3, 0.3]) {
      const frag = cyl(0.045, 0.045, 0.1, mat(0x3d4a2e, { rough: 0.6 }), 6);
      frag.position.set(0.18, 0.0, pz);
      torso.add(frag);
    }
  }

  // shoulder pauldrons — the faction reads from across the map
  for (const side of [1, -1]) {
    if (uf) {
      const padHi = box(0.26, 0.09, 0.22, armor);
      padHi.position.set(0, 0.6, side * 0.38);
      const padLo = box(0.24, 0.08, 0.2, armor);
      padLo.position.set(0.02, 0.52, side * 0.4);
      padLo.rotation.x = side * 0.2;
      torso.add(padHi, padLo);
      const stripe = box(0.27, 0.035, 0.23, trim);
      stripe.position.set(0, 0.66, side * 0.38);
      torso.add(stripe);
    } else {
      const disc = cyl(0.16, 0.18, 0.1, armor, 8);
      disc.position.set(0, 0.58, side * 0.38);
      disc.rotation.x = side * 0.25;
      torso.add(disc);
      const ring = cyl(0.17, 0.17, 0.025, glow, 8);
      ring.position.set(0, 0.63, side * 0.38);
      ring.rotation.x = side * 0.25;
      torso.add(ring);
    }
  }

  // ---- arms: posed holding the rifle two-handed (rig unchanged) ----
  const armMat = uniform;
  const gloveMat = dark;
  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(0.05, 1.5, -0.34);
  const upperR = limb(0.15, 0.3, 0.15, armMat);
  armR.add(upperR);
  const elbowPadR = box(0.1, 0.09, 0.13, uf ? edge : armor);
  elbowPadR.position.set(0.04, -0.3, 0);
  armR.add(elbowPadR);
  const foreR = new THREE.Group();
  foreR.position.y = -0.3;
  const lowerR = limb(0.12, 0.28, 0.12, armMat);
  foreR.add(lowerR);
  if (!uf) {
    const armSeam = limb(0.03, 0.2, 0.03, glow);
    armSeam.position.set(0.06, -0.02, 0.05);
    foreR.add(armSeam);
  }
  const handR = box(0.1, 0.1, 0.1, gloveMat);
  handR.position.y = -0.32;
  foreR.add(handR);
  foreR.rotation.z = -1.15;
  armR.add(foreR);
  armR.rotation.z = -0.5;
  g.add(armR);
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.05, 1.5, 0.34);
  const upperL = limb(0.15, 0.3, 0.15, armMat);
  armL.add(upperL);
  const elbowPadL = box(0.1, 0.09, 0.13, uf ? edge : armor);
  elbowPadL.position.set(0.04, -0.3, 0);
  armL.add(elbowPadL);
  const foreL = new THREE.Group();
  foreL.position.y = -0.3;
  const lowerL = limb(0.12, 0.28, 0.12, armMat);
  foreL.add(lowerL);
  const handL = box(0.1, 0.1, 0.1, gloveMat);
  handL.position.y = -0.32;
  foreL.add(handL);
  foreL.rotation.z = -1.3;
  foreL.rotation.x = -0.55;
  armL.add(foreL);
  armL.rotation.z = -0.75;
  armL.rotation.x = -0.35;
  g.add(armL);

  // ---- head: the faction's face ----
  const headGrp = new THREE.Group();
  headGrp.name = 'head';
  headGrp.position.y = 1.62;
  g.add(headGrp);
  if (inf) {
    // hooded infiltrator, both factions — the job hides the flag
    const neck = cyl(0.08, 0.09, 0.1, uf ? skin : armor, 8);
    neck.position.y = -0.04;
    headGrp.add(neck);
    const face = box(0.26, 0.26, 0.28, uf ? skin : armor);
    face.position.y = 0.14;
    headGrp.add(face);
    const hood = box(0.34, 0.3, 0.36, mat(0x1c1a22, { rough: 0.95 }));
    hood.position.y = 0.2;
    headGrp.add(hood);
    for (const side of [1, -1]) {
      const eye = box(0.05, 0.05, 0.08, glow);
      eye.position.set(0.17, 0.16, side * 0.07);
      headGrp.add(eye);
    }
  } else if (uf) {
    // combat helmet, dark goggles, HUMAN chin — a person under the steel
    const neck = cyl(0.08, 0.09, 0.1, skin, 8);
    neck.position.y = -0.04;
    headGrp.add(neck);
    const face = box(0.26, 0.26, 0.28, skin);
    face.position.y = 0.14;
    headGrp.add(face);
    const goggles = box(0.07, 0.08, 0.26, mat(0x141414, { rough: 0.25, metal: 0.65 }));
    goggles.position.set(0.15, 0.19, 0);
    headGrp.add(goggles);
    const helmet = box(0.36, 0.18, 0.4, armor);
    helmet.position.y = 0.33;
    headGrp.add(helmet);
    const brim = box(0.44, 0.05, 0.44, armor);
    brim.position.set(0.02, 0.25, 0);
    headGrp.add(brim);
    for (const side of [1, -1]) {
      const rail = box(0.3, 0.05, 0.03, edge);
      rail.position.set(0.02, 0.32, side * 0.21);
      headGrp.add(rail);
    }
    const band = box(0.37, 0.045, 0.41, trim);
    band.position.y = 0.28;
    headGrp.add(band);
  } else {
    // the Collective dome: sealed, smooth, a single glowing visor band —
    // no skin anywhere. Nobody is sure there is a face in there.
    const neck = cyl(0.09, 0.1, 0.1, armor, 8);
    neck.position.y = -0.04;
    headGrp.add(neck);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), armor.clone());
    dome.castShadow = true;
    dome.position.y = 0.2;
    dome.scale.set(1.05, 1.15, 1);
    headGrp.add(dome);
    const jaw = box(0.2, 0.12, 0.24, armor);
    jaw.position.set(0.05, 0.04, 0);
    headGrp.add(jaw);
    const visor = box(0.1, 0.06, 0.3, glow);
    visor.position.set(0.16, 0.2, 0);
    headGrp.add(visor);
    const crest = box(0.28, 0.03, 0.06, glow);
    crest.position.set(-0.02, 0.4, 0);
    headGrp.add(crest);
  }

  // ---- rifle, carried at the shoulder line ----
  const gun = buildRifle(classId);
  gun.position.set(0.42, 1.28, -0.16);
  gun.userData.baseX = gun.position.x;
  g.add(gun);

  return g;
}

// ---------------------------------------------------------------------------
// The undead
// ---------------------------------------------------------------------------

function buildZombie(kind: SoldierKind): THREE.Group {
  const g = new THREE.Group();
  const scale = kind === 'brute' ? 1.65 : kind === 'bomber' ? 1.2 : kind === 'sprinter' ? 0.92 : kind === 'stalker' ? 1.05 : 1;
  const skinCol = kind === 'sprinter' ? 0xb07050 : kind === 'bomber' ? 0x97b26a : kind === 'stalker' ? 0x3d4a48 : 0x8fa86a;
  const ragCol = kind === 'sprinter' ? 0x53291f : kind === 'stalker' ? 0x1c2622 : 0x3d4a2e;
  const skin = mat(skinCol, { rough: 0.9 });
  const rags = mat(ragCol, { rough: 0.98 });
  const dark = mat(0x22261c, { rough: 0.95 });

  // legs (jointed like troopers so the shamble reads)
  for (const side of [1, -1]) {
    const hip = new THREE.Group();
    hip.name = side === 1 ? 'legL' : 'legR';
    hip.position.set(0, 0.92, side * 0.15);
    hip.add(limb(0.2, 0.44, 0.2, rags));
    const knee = new THREE.Group();
    knee.name = side === 1 ? 'shinL' : 'shinR';
    knee.position.y = -0.44;
    knee.add(limb(0.16, 0.42, 0.16, skin));
    const foot = box(0.26, 0.1, 0.16, dark);
    foot.position.set(0.05, -0.45, 0);
    knee.add(foot);
    hip.add(knee);
    g.add(hip);
  }

  // torso — torn shirt, hunched
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.94;
  g.add(torso);
  const chestW = kind === 'brute' ? 0.72 : 0.5;
  const chest = box(0.46, 0.5, chestW, rags);
  chest.position.y = 0.27;
  torso.add(chest);
  const gutRip = box(0.1, 0.2, chestW * 0.5, skin); // exposed midriff
  gutRip.position.set(0.2, 0.1, 0.05);
  torso.add(gutRip);
  if (kind === 'brute') {
    for (const side of [1, -1]) {
      const hump = box(0.4, 0.28, 0.26, skin);
      hump.position.set(-0.05, 0.55, side * 0.32);
      torso.add(hump);
    }
  }
  if (kind === 'bomber') {
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(0x9adf3a, { emissive: 0x9adf3a, rough: 0.45 }));
    belly.position.set(0.22, 0.12, 0);
    belly.castShadow = true;
    belly.name = 'belly';
    torso.add(belly);
  }
  if (kind === 'spitter') {
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xa0e040, { emissive: 0x7fae2a, rough: 0.5 }));
    sac.position.set(0.16, 0.52, 0);
    torso.add(sac);
  }

  // arms — reaching, asymmetric
  for (const side of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.name = side === 1 ? 'armL' : 'armR';
    shoulder.position.set(0.02, 1.44, side * (kind === 'brute' ? 0.44 : 0.32));
    const upper = limb(0.13, 0.3, 0.13, kind === 'brute' ? skin : rags);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    elbow.add(limb(0.11, 0.3, 0.11, skin));
    // claws
    for (const c of [-0.03, 0.03]) {
      const claw = box(0.1, 0.04, 0.03, dark);
      claw.position.set(0.05, -0.32, c);
      elbow.add(claw);
    }
    elbow.rotation.z = -0.25;
    shoulder.add(elbow);
    // reach FORWARD (+X) at the prey, one arm higher than the other.
    // Shared with the runtime animator so the rest pose and the sway agree.
    shoulder.rotation.z = zombieArmRest(kind, side === 1);
    g.add(shoulder);
  }

  // head — bare, tilted, glowing eyes
  const headGrp = new THREE.Group();
  headGrp.name = 'head';
  headGrp.position.y = 1.56;
  headGrp.rotation.x = kind === 'sprinter' ? 0 : 0.18; // sickly tilt
  g.add(headGrp);
  const skull = box(0.28, 0.28, kind === 'brute' ? 0.26 : 0.3, skin);
  skull.position.y = 0.12;
  headGrp.add(skull);
  const jaw = box(0.1, 0.08, 0.2, dark);
  jaw.position.set(0.12, 0.0, 0);
  headGrp.add(jaw);
  const eyeCol = kind === 'stalker' ? 0x3fe0c8 : 0xcc3322; // stalker: spectral teal (no purple)
  for (const side of [1, -1]) {
    const eye = box(0.05, 0.05, 0.06, mat(eyeCol, { emissive: eyeCol }));
    eye.position.set(0.14, 0.16, side * 0.08);
    headGrp.add(eye);
  }
  if (kind === 'stalker') {
    // phase shroud: tattered hood + drifting wisps (spectral teal — no purple)
    const hood = box(0.34, 0.24, 0.34, mat(0x14201e, { rough: 0.98 }));
    hood.position.y = 0.26;
    headGrp.add(hood);
    for (const side of [1, -1]) {
      const wisp = box(0.05, 0.4, 0.05, mat(0x3aa892, { emissive: 0x1f6a5c }));
      wisp.position.set(-0.25, 0.95, side * 0.3);
      wisp.rotation.x = side * 0.3;
      g.add(wisp);
    }
  }

  // sprinters run low
  if (kind === 'sprinter') {
    torso.rotation.z = -0.35;
    headGrp.position.x = 0.18;
    headGrp.position.y = 1.42;
  }

  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------------------
// Vehicles. Face +X. Wheels live in named axle groups so the renderer can
// spin them; the turret barrel sits in 'gunRecoil' for firing kick.
// Open vehicles (bike, hoverboard) carry a 'rider' figure the renderer shows
// only while the driver seat is occupied — no more haunted ghost-rides.
// ---------------------------------------------------------------------------

/** A compact posed rider for open vehicles. Named 'rider' for the renderer. */
export function buildRider(team: Team, pose: 'surf' | 'straddle'): THREE.Group {
  const rider = new THREE.Group();
  rider.name = 'rider';
  const uniform = mat(team === 0 ? 0x6b5c38 : 0x3a5a66, { rough: 0.9 });
  const armor = mat(team === 0 ? 0x4e4228 : 0x27414c, { rough: 0.7, metal: 0.2 });
  const dark = mat(0x26241f, { rough: 0.8 });
  const trim = mat(TEAM_COLORS[team], { emissive: TEAM_COLORS[team] });

  const torso = box(0.34, 0.44, 0.4, uniform);
  const head = box(0.24, 0.24, 0.26, armor);
  const band = box(0.25, 0.05, 0.27, trim);

  if (pose === 'surf') {
    // feet spread along the deck, knees bent, arms out for balance
    rider.position.set(0, 0.51, 0);
    for (const [x, lean] of [[0.38, -0.25], [-0.34, 0.3]] as const) {
      const leg = box(0.14, 0.5, 0.15, uniform);
      leg.position.set(x, 0.24, 0);
      leg.rotation.z = lean;
      rider.add(leg);
      const boot = box(0.3, 0.09, 0.16, dark);
      boot.position.set(x, 0.05, 0);
      rider.add(boot);
    }
    torso.position.set(0.02, 0.68, 0);
    torso.rotation.z = -0.18; // leaning into the ride
    rider.add(torso);
    for (const side of [1, -1]) {
      // arms thrown wide for balance — the classic surf silhouette
      const arm = box(0.11, 0.11, 0.52, uniform);
      arm.position.set(0.04, 0.86, side * 0.45);
      arm.rotation.x = side * -0.35; // slight upward sweep
      rider.add(arm);
      const glove = box(0.1, 0.1, 0.1, mat(0x26241f, { rough: 0.8 }));
      glove.position.set(0.04, 0.94, side * 0.68);
      rider.add(glove);
    }
    head.position.set(0.08, 1.05, 0);
    rider.add(head);
    band.position.set(0.08, 1.14, 0);
    rider.add(band);
  } else {
    // straddling the saddle, crouched over the handlebars
    rider.position.set(-0.35, 0.95, 0);
    for (const side of [1, -1]) {
      const thigh = box(0.4, 0.14, 0.13, uniform);
      thigh.position.set(0.1, 0.05, side * 0.24);
      thigh.rotation.y = side * -0.15;
      rider.add(thigh);
      const shin = box(0.13, 0.4, 0.12, uniform);
      shin.position.set(0.28, -0.18, side * 0.3);
      rider.add(shin);
      const boot = box(0.26, 0.08, 0.13, dark);
      boot.position.set(0.32, -0.4, side * 0.3);
      rider.add(boot);
    }
    torso.position.set(0.28, 0.32, 0);
    torso.rotation.z = -0.85; // hunched racing tuck
    rider.add(torso);
    for (const side of [1, -1]) {
      const arm = box(0.48, 0.11, 0.11, uniform);
      arm.position.set(0.62, 0.38, side * 0.2);
      arm.rotation.z = -0.35;
      rider.add(arm);
    }
    head.position.set(0.62, 0.56, 0);
    rider.add(head);
    band.position.set(0.62, 0.66, 0);
    rider.add(band);
  }
  return rider;
}

