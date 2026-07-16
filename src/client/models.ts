import * as THREE from 'three';
import { TEAM_COLORS } from '../sim/data';
import { zombieArmRest } from './animation';
import type { ClassId, SoldierKind, Team, VehicleKind } from '../sim/types';

const mat = (color: number, opts: { metal?: number; rough?: number; emissive?: number } = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metal ?? 0.15,
    roughness: opts.rough ?? 0.75,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissive ? 0.9 : 0,
  });

const box = (w: number, h: number, d: number, m: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = true;
  return mesh;
};
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 10) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.castShadow = true;
  return mesh;
};
/** Box with its origin at the TOP — rotate to swing like a limb from its joint. */
const limb = (w: number, h: number, d: number, m: THREE.Material) => {
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

export function buildSoldier(team: Team, classId: ClassId, kind: SoldierKind): THREE.Group {
  if (kind === 'scientist') return buildScientist();
  if (kind === 'dog') return buildDog(team);
  const isZed = kind !== 'human' && kind !== 'bot';
  return isZed ? buildZombie(kind) : buildTrooper(team, classId);
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
function buildRider(team: Team, pose: 'surf' | 'straddle'): THREE.Group {
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

export function buildVehicle(kind: VehicleKind, team: Team): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const body = mat(team === 0 ? 0x74602f : 0x2f6478, { rough: 0.55, metal: 0.35 });
  const bodyDark = mat(team === 0 ? 0x57481f : 0x224b5c, { rough: 0.6, metal: 0.3 });
  const dark = mat(0x24241f, { rough: 0.5, metal: 0.4 });
  const glow = mat(teamCol, { emissive: teamCol });

  const wheels: THREE.Group[] = [];
  const addWheel = (x: number, z: number, r: number, w: number) => {
    const axle = new THREE.Group();
    axle.position.set(x, r, z);
    const tire = cyl(r, r, w, dark, 12);
    tire.rotation.x = Math.PI / 2;
    axle.add(tire);
    const hub = cyl(r * 0.45, r * 0.45, w + 0.02, mat(0x55554a, { metal: 0.6, rough: 0.3 }), 8);
    hub.rotation.x = Math.PI / 2;
    axle.add(hub);
    g.add(axle);
    wheels.push(axle);
  };

  const turret = new THREE.Group();
  turret.name = 'turret';
  const recoil = new THREE.Group();
  recoil.name = 'gunRecoil';
  turret.add(recoil);

  switch (kind) {
    case 'boat': {
      // the Pike: a flat-bottomed river gunboat — bow wedge, low freeboard,
      // wheelhouse aft, deck MG forward. Sits low; the water does the rest.
      const hull = box(3.4, 0.55, 1.7, body);
      hull.position.y = 0.45;
      g.add(hull);
      const bow = box(0.9, 0.45, 1.2, bodyDark);
      bow.position.set(1.95, 0.42, 0);
      bow.rotation.z = -0.18;
      g.add(bow);
      const gunwaleL = box(3.2, 0.22, 0.12, bodyDark);
      gunwaleL.position.set(0, 0.82, 0.8);
      const gunwaleR = gunwaleL.clone();
      gunwaleR.position.z = -0.8;
      g.add(gunwaleL, gunwaleR);
      const house = box(0.9, 0.7, 1.1, bodyDark);
      house.position.set(-1.05, 1.05, 0);
      g.add(house);
      const glass = box(0.08, 0.28, 0.9, mat(0x9fd8e8, { rough: 0.2, metal: 0.4 }));
      glass.position.set(-0.58, 1.2, 0);
      g.add(glass);
      const stripe = box(3.42, 0.07, 0.3, glow);
      stripe.position.set(0, 0.74, 0);
      g.add(stripe);
      const outboard = box(0.35, 0.55, 0.5, dark);
      outboard.position.set(-1.85, 0.55, 0);
      g.add(outboard);
      const gun = box(1.0, 0.1, 0.1, dark);
      gun.position.set(0.5, 0.05, 0);
      recoil.add(gun);
      turret.position.set(0.7, 0.95, 0);
      break;
    }
    case 'buggy': {
      const hull = box(2.5, 0.5, 1.5, body);
      hull.position.y = 0.8;
      g.add(hull);
      const nose = box(0.7, 0.34, 1.3, bodyDark);
      nose.position.set(1.5, 0.72, 0);
      g.add(nose);
      // roll cage
      for (const [x1, z1] of [[0.5, 0.6], [0.5, -0.6], [-0.7, 0.6], [-0.7, -0.6]] as const) {
        const bar = cyl(0.04, 0.04, 0.75, dark, 6);
        bar.position.set(x1, 1.35, z1);
        g.add(bar);
      }
      const roof = box(1.5, 0.06, 1.35, dark);
      roof.position.set(-0.1, 1.75, 0);
      g.add(roof);
      const seat = box(0.5, 0.4, 0.9, mat(0x35322a, { rough: 0.95 }));
      seat.position.set(-0.45, 1.1, 0);
      g.add(seat);
      addWheel(0.95, 0.85, 0.4, 0.28);
      addWheel(0.95, -0.85, 0.4, 0.28);
      addWheel(-0.85, 0.85, 0.4, 0.28);
      addWheel(-0.85, -0.85, 0.4, 0.28);
      const stripe = box(2.52, 0.06, 0.3, glow);
      stripe.position.set(0, 1.08, 0);
      g.add(stripe);
      const gun = box(1.1, 0.1, 0.1, dark);
      gun.position.set(0.55, 0.05, 0);
      recoil.add(gun);
      turret.position.set(-0.1, 1.82, 0);
      break;
    }
    case 'tank': {
      const hull = box(3.9, 0.7, 2.4, body);
      hull.position.y = 0.95;
      g.add(hull);
      // sloped glacis
      const glacis = box(0.9, 0.66, 2.4, bodyDark);
      glacis.position.set(2.05, 0.82, 0);
      glacis.rotation.z = 0.42;
      g.add(glacis);
      const rear = box(0.5, 0.55, 2.3, bodyDark);
      rear.position.set(-2.0, 0.9, 0);
      rear.rotation.z = -0.3;
      g.add(rear);
      for (const side of [1, -1]) {
        const tread = box(4.3, 0.75, 0.6, dark);
        tread.position.set(0, 0.45, side * 1.38);
        g.add(tread);
        const fender = box(4.35, 0.08, 0.65, bodyDark);
        fender.position.set(0, 0.87, side * 1.38);
        g.add(fender);
        // road wheels peeking under the tread line
        for (const wx of [-1.5, -0.75, 0, 0.75, 1.5]) {
          const rw = cyl(0.26, 0.26, 0.5, mat(0x1a1a16, { rough: 0.6 }), 10);
          rw.rotation.x = Math.PI / 2;
          rw.position.set(wx, 0.28, side * 1.38);
          g.add(rw);
        }
      }
      // turret
      const dome = box(1.7, 0.55, 1.5, body);
      dome.position.y = 0.32;
      turret.add(dome);
      const domeTop = box(1.1, 0.22, 1.0, bodyDark);
      domeTop.position.y = 0.68;
      turret.add(domeTop);
      const hatch = cyl(0.22, 0.22, 0.1, dark, 10);
      hatch.position.set(-0.2, 0.83, 0.25);
      turret.add(hatch);
      const barrel = cyl(0.09, 0.12, 2.5, dark, 10);
      barrel.rotation.z = -Math.PI / 2;
      barrel.position.set(1.95, 0.35, 0);
      recoil.add(barrel);
      const muzzle = cyl(0.14, 0.14, 0.3, dark, 10);
      muzzle.rotation.z = -Math.PI / 2;
      muzzle.position.set(3.1, 0.35, 0);
      recoil.add(muzzle);
      const antenna = cyl(0.015, 0.015, 0.9, dark, 4);
      antenna.position.set(-0.7, 1.2, -0.55);
      turret.add(antenna);
      const stripe = box(0.7, 0.08, 1.52, glow);
      stripe.position.set(-0.75, 0.62, 0);
      turret.add(stripe);
      turret.position.set(-0.2, 1.35, 0);
      break;
    }
    case 'apc': {
      const hull = box(3.4, 1.15, 2.1, body);
      hull.position.y = 1.15;
      g.add(hull);
      const nose = box(1.0, 0.9, 2.1, bodyDark);
      nose.position.set(2.0, 0.95, 0);
      nose.rotation.z = 0.35;
      g.add(nose);
      const cabin = box(1.6, 0.4, 1.7, bodyDark);
      cabin.position.set(-0.4, 1.9, 0);
      g.add(cabin);
      // side hatches + vision slits
      for (const side of [1, -1]) {
        const hatch = box(0.7, 0.6, 0.06, bodyDark);
        hatch.position.set(-0.6, 1.1, side * 1.06);
        g.add(hatch);
        const slit = box(1.6, 0.08, 0.04, mat(0x101010, { rough: 0.3 }));
        slit.position.set(0.6, 1.5, side * 1.06);
        g.add(slit);
      }
      addWheel(1.25, 1.08, 0.46, 0.32);
      addWheel(1.25, -1.08, 0.46, 0.32);
      addWheel(0, 1.08, 0.46, 0.32);
      addWheel(0, -1.08, 0.46, 0.32);
      addWheel(-1.25, 1.08, 0.46, 0.32);
      addWheel(-1.25, -1.08, 0.46, 0.32);
      const beacon = box(0.4, 0.12, 0.4, glow);
      beacon.position.set(-1.3, 1.95, 0);
      g.add(beacon);
      const gun = box(1.0, 0.1, 0.1, dark);
      gun.position.set(0.5, 0.1, 0);
      recoil.add(gun);
      const shield = box(0.08, 0.3, 0.5, bodyDark);
      shield.position.set(0.25, 0.12, 0);
      recoil.add(shield);
      turret.position.set(0.5, 2.15, 0);
      break;
    }
    case 'skiff': {
      const hull = box(2.3, 0.3, 1.05, body);
      hull.position.y = 0.95;
      g.add(hull);
      const canopy = box(0.9, 0.22, 0.7, mat(0x18242a, { rough: 0.25, metal: 0.6 }));
      canopy.position.set(0.45, 1.18, 0);
      g.add(canopy);
      const fin = box(0.65, 0.55, 0.1, bodyDark);
      fin.position.set(-1.0, 1.35, 0);
      fin.rotation.z = 0.25;
      g.add(fin);
      for (const side of [1, -1]) {
        const pod = cyl(0.18, 0.26, 0.95, dark, 10);
        pod.rotation.z = Math.PI / 2;
        pod.position.set(-0.15, 0.82, side * 0.72);
        g.add(pod);
        const ring = cyl(0.15, 0.15, 0.05, glow, 10);
        ring.rotation.z = Math.PI / 2;
        ring.position.set(-0.66, 0.82, side * 0.72);
        ring.name = side === 1 ? 'thrustL' : 'thrustR';
        g.add(ring);
      }
      const gun = box(0.85, 0.09, 0.09, dark);
      gun.position.set(0.42, 0.05, 0);
      recoil.add(gun);
      turret.position.set(0.5, 1.28, 0);
      break;
    }
    case 'hoverboard': {
      // low, sleek deck with a glowing underside
      const deck = box(1.6, 0.12, 0.55, body);
      deck.position.y = 0.45;
      g.add(deck);
      const nose = box(0.35, 0.1, 0.4, bodyDark);
      nose.position.set(0.9, 0.47, 0);
      nose.rotation.z = 0.12;
      g.add(nose);
      const underglow = box(1.3, 0.05, 0.4, glow);
      underglow.position.y = 0.36;
      underglow.name = 'thrustL';
      g.add(underglow);
      for (const x of [0.5, -0.5]) {
        const pod = cyl(0.1, 0.14, 0.14, dark, 8);
        pod.position.set(x, 0.32, 0);
        g.add(pod);
      }
      // the rider (renderer shows it only while someone's aboard):
      // surf stance — feet apart along the deck, knees bent, leaning in
      g.add(buildRider(team, 'surf'));
      break;
    }
    case 'bike': {
      // recon bike: two fat wheels, low saddle, front MG
      const frame = box(1.9, 0.3, 0.4, body);
      frame.position.y = 0.75;
      g.add(frame);
      const tank = box(0.6, 0.28, 0.42, bodyDark);
      tank.position.set(0.25, 0.98, 0);
      g.add(tank);
      const saddle = box(0.55, 0.12, 0.4, mat(0x2a2622, { rough: 0.95 }));
      saddle.position.set(-0.45, 0.99, 0);
      g.add(saddle);
      const bars = box(0.08, 0.3, 0.7, dark);
      bars.position.set(0.75, 1.1, 0);
      g.add(bars);
      addWheel(0.85, 0, 0.42, 0.3);
      addWheel(-0.75, 0, 0.42, 0.3);
      const stripe = box(1.9, 0.05, 0.15, glow);
      stripe.position.set(0, 0.92, 0);
      g.add(stripe);
      const gun = box(0.8, 0.08, 0.08, dark);
      gun.position.set(0.4, 0.02, 0);
      recoil.add(gun);
      turret.position.set(0.9, 0.95, 0);
      // the rider, crouched over the tank (renderer toggles with occupancy)
      g.add(buildRider(team, 'straddle'));
      break;
    }
    case 'flyer': {
      // gunship: lifted hull, canted rotor pods, weapons chin
      const hull = box(2.4, 0.55, 1.1, body);
      hull.position.y = 1.6;
      g.add(hull);
      const canopy = box(0.7, 0.35, 0.8, mat(0x18242a, { rough: 0.25, metal: 0.6 }));
      canopy.position.set(1.05, 1.85, 0);
      g.add(canopy);
      const tail = box(1.1, 0.25, 0.3, bodyDark);
      tail.position.set(-1.6, 1.75, 0);
      g.add(tail);
      const tailFin = box(0.35, 0.6, 0.08, bodyDark);
      tailFin.position.set(-2.05, 2.05, 0);
      g.add(tailFin);
      for (const side of [1, -1]) {
        const boom = box(0.25, 0.12, 0.9, dark);
        boom.position.set(0.1, 1.95, side * 1.0);
        g.add(boom);
        const rotor = cyl(0.65, 0.65, 0.06, mat(0x30363c, { metal: 0.5, rough: 0.35 }), 12);
        rotor.position.set(0.1, 2.1, side * 1.35);
        rotor.name = side === 1 ? 'rotorL' : 'rotorR';
        g.add(rotor);
        const ring = cyl(0.68, 0.68, 0.05, glow, 12);
        ring.position.set(0.1, 2.02, side * 1.35);
        g.add(ring);
      }
      const chin = box(0.9, 0.12, 0.12, dark);
      chin.position.set(0.45, 0.0, 0);
      recoil.add(chin);
      turret.position.set(0.9, 1.3, 0);
      break;
    }
    case 'transport': {
      // long crew hull with sensor mast, ECM fins, comms dish — a rolling ops center
      const hull = box(4.2, 1.3, 2.2, body);
      hull.position.y = 1.25;
      g.add(hull);
      const cab = box(0.9, 0.9, 2.0, bodyDark);
      cab.position.set(2.3, 1.1, 0);
      g.add(cab);
      const winshield = box(0.15, 0.4, 1.6, mat(0x101820, { rough: 0.3, metal: 0.5 }));
      winshield.position.set(2.75, 1.45, 0);
      g.add(winshield);
      // crew station humps along the spine
      for (const [x, name] of [[0.9, 'sensors'], [-0.3, 'ecm'], [-1.5, 'comms']] as const) {
        const pod = box(0.8, 0.35, 1.6, bodyDark);
        pod.position.set(x, 2.05, 0);
        g.add(pod);
        void name;
      }
      // sensor mast
      const mast = cyl(0.04, 0.04, 1.4, dark, 6);
      mast.position.set(0.9, 3.0, 0.6);
      g.add(mast);
      const radar = box(0.5, 0.08, 0.18, glow);
      radar.position.set(0.9, 3.7, 0.6);
      radar.name = 'spin';
      g.add(radar);
      // ECM fins
      for (const side of [1, -1]) {
        const fin = box(0.5, 0.5, 0.06, mat(0x3a4a52, { metal: 0.5, rough: 0.4 }));
        fin.position.set(-0.3, 2.5, side * 0.5);
        fin.rotation.x = side * 0.35;
        g.add(fin);
      }
      // comms dish
      const dish = cyl(0.35, 0.08, 0.2, mat(0xd8d8d0, { metal: 0.6, rough: 0.3 }), 10);
      dish.position.set(-1.5, 2.55, -0.4);
      dish.rotation.z = 0.6;
      g.add(dish);
      addWheel(1.6, 1.15, 0.5, 0.35);
      addWheel(1.6, -1.15, 0.5, 0.35);
      addWheel(0.2, 1.15, 0.5, 0.35);
      addWheel(0.2, -1.15, 0.5, 0.35);
      addWheel(-1.4, 1.15, 0.5, 0.35);
      addWheel(-1.4, -1.15, 0.5, 0.35);
      const beacon = box(0.5, 0.1, 0.5, glow);
      beacon.position.set(-2.0, 2.0, 0);
      g.add(beacon);
      const gun = box(0.9, 0.09, 0.09, dark);
      gun.position.set(0.45, 0.08, 0);
      recoil.add(gun);
      turret.position.set(1.6, 2.15, 0);
      break;
    }
    case 'ambulance': {
      // boxy medical van — white body, red cross, light bar
      const white = mat(0xe8e6e0, { rough: 0.6 });
      const hull = box(3.0, 1.4, 1.9, white);
      hull.position.y = 1.2;
      g.add(hull);
      const cab = box(0.8, 0.8, 1.8, mat(0xd8d6d0, { rough: 0.55 }));
      cab.position.set(1.75, 0.95, 0);
      g.add(cab);
      // red crosses both sides + roof
      for (const side of [1, -1]) {
        const cv = box(0.06, 0.7, 0.22, mat(0xd8453a, { emissive: 0xd8453a }));
        cv.position.set(-0.2, 1.35, side * 0.97);
        const ch = box(0.06, 0.22, 0.7, mat(0xd8453a, { emissive: 0xd8453a }));
        ch.position.set(-0.2, 1.35, side * 0.97);
        g.add(cv, ch);
      }
      const lightbar = box(0.5, 0.12, 1.2, mat(0xd8453a, { emissive: 0xff5040 }));
      lightbar.position.set(1.4, 2.0, 0);
      lightbar.name = 'pulse';
      g.add(lightbar);
      // heal aura: a soft green ring on the ground showing the actual radius
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(6.4, 7, 40),
        new THREE.MeshBasicMaterial({ color: 0x5aff8a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.06;
      aura.name = 'healRing';
      aura.userData.aura = true; // ground-radius overlay, not hull — tests and tools filter on this
      g.add(aura);
      addWheel(1.15, 1.0, 0.42, 0.3);
      addWheel(1.15, -1.0, 0.42, 0.3);
      addWheel(-1.05, 1.0, 0.42, 0.3);
      addWheel(-1.05, -1.0, 0.42, 0.3);
      break;
    }
    case 'tunneler': {
      // tracked grinder with a huge rotating drill cone
      const hull = box(3.2, 1.3, 2.2, bodyDark);
      hull.position.y = 1.15;
      g.add(hull);
      const spine = box(2.4, 0.4, 1.4, body);
      spine.position.y = 1.95;
      g.add(spine);
      // the whole cutting head lives in one named group so it grinds as a unit
      const drillGrp = new THREE.Group();
      drillGrp.name = 'drill';
      drillGrp.position.set(2.4, 1.1, 0);
      const drillCone = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 1.8, 12),
        mat(0x8a8578, { metal: 0.7, rough: 0.35 }),
      );
      drillCone.rotation.z = -Math.PI / 2;
      drillCone.castShadow = true;
      drillGrp.add(drillCone);
      // teeth spiral down the cone — they spin with it
      for (let i = 0; i < 6; i++) {
        const tooth = box(0.4, 0.12, 0.12, dark);
        const a = (i / 6) * Math.PI * 2;
        const along = -0.35 + (i % 3) * 0.35; // toward the tip
        const r = 0.75 - (i % 3) * 0.22;      // cone narrows
        tooth.position.set(along, Math.sin(a) * r, Math.cos(a) * r);
        drillGrp.add(tooth);
      }
      g.add(drillGrp);
      for (const side of [1, -1]) {
        const tread = box(3.4, 0.9, 0.55, dark);
        tread.position.set(-0.2, 0.5, side * 1.25);
        g.add(tread);
      }
      const warn = box(0.8, 0.1, 0.8, mat(0xe8a33d, { emissive: 0xe8a33d }));
      warn.position.set(-1.2, 1.85, 0);
      warn.name = 'pulse';
      g.add(warn);
      break;
    }
    case 'mech': {
      // Goliath Assault Walker: a bipedal weapons platform. Tall, wide-stanced,
      // reads as LEGS from the top-down camera — the legs are the mechanic.
      // Hip groups are named legL/legR; the renderer swings them with speed.
      const mkLeg = (side: 1 | -1): THREE.Group => {
        const hip = new THREE.Group();
        hip.name = side === 1 ? 'legL' : 'legR';
        hip.position.set(0, 1.75, side * 0.62);
        const thigh = box(0.42, 0.85, 0.34, bodyDark);
        thigh.position.y = -0.42;
        hip.add(thigh);
        const knee = cyl(0.2, 0.2, 0.4, dark, 8);
        knee.rotation.x = Math.PI / 2;
        knee.position.y = -0.9;
        hip.add(knee);
        const shin = box(0.3, 0.75, 0.26, body);
        shin.position.set(0.08, -1.3, 0);
        hip.add(shin);
        const foot = box(0.85, 0.18, 0.5, dark);
        foot.position.set(0.18, -1.68, 0);
        hip.add(foot);
        return hip;
      };
      g.add(mkLeg(1), mkLeg(-1));
      // pelvis + torso
      const pelvis = box(0.9, 0.45, 1.1, dark);
      pelvis.position.y = 1.8;
      g.add(pelvis);
      const torso = box(1.7, 0.85, 1.5, body);
      torso.position.y = 2.45;
      g.add(torso);
      const plate = box(0.5, 0.6, 1.2, bodyDark); // chest glacis
      plate.position.set(0.95, 2.4, 0);
      plate.rotation.z = 0.25;
      g.add(plate);
      // cockpit canopy — the pilot sits where you'd expect the head
      const canopy = box(0.55, 0.32, 0.7, mat(0x1c2a30, { metal: 0.2, rough: 0.15 }));
      canopy.position.set(0.62, 2.95, 0);
      g.add(canopy);
      // left shoulder: missile pod (dressing — the promise of a refit, §3.1)
      const pod = box(0.7, 0.5, 0.55, bodyDark);
      pod.position.set(-0.35, 3.05, 0.75);
      g.add(pod);
      // four launch tubes on the pod's forward face (pod-local coordinates)
      for (let i = 0; i < 4; i++) {
        const tube = cyl(0.07, 0.07, 0.2, dark, 8);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(0.32, i < 2 ? 0.12 : -0.12, i % 2 ? 0.14 : -0.14);
        pod.add(tube);
      }
      // right arm: the GAU-9, mounted on the turret so aim + recoil work
      const shoulder = box(0.5, 0.5, 0.45, dark);
      shoulder.position.set(0, 0.55, -0.95);
      turret.add(shoulder);
      const barrel = cyl(0.09, 0.12, 1.7, dark, 10);
      barrel.rotation.z = -Math.PI / 2;
      barrel.position.set(1.15, 0.5, -0.95);
      recoil.add(barrel);
      const brake = cyl(0.15, 0.15, 0.3, mat(0x55554a, { metal: 0.6, rough: 0.3 }), 8);
      brake.rotation.z = -Math.PI / 2;
      brake.position.set(2.05, 0.5, -0.95);
      recoil.add(brake);
      turret.position.set(0, 2.45, 0);
      // antenna + warning lamp — every War World heavy carries its pulse
      const mast = cyl(0.025, 0.025, 0.8, dark, 6);
      mast.position.set(-0.7, 3.3, -0.5);
      g.add(mast);
      const lamp = box(0.16, 0.1, 0.16, mat(0xe8a33d, { emissive: 0xe8a33d }));
      lamp.position.set(-0.7, 3.72, -0.5);
      lamp.name = 'pulse';
      g.add(lamp);
      break;
    }
    case 'emplacement': {
      // sandbagged static gun: hexagonal base, shield plates, long barrel
      const base = cyl(1.5, 1.7, 0.5, mat(0x6a6353, { rough: 0.95 }), 6);
      base.position.y = 0.25;
      g.add(base);
      const mount = cyl(0.4, 0.5, 0.7, dark, 8);
      mount.position.y = 0.8;
      g.add(mount);
      const shieldL = box(0.1, 0.8, 1.0, bodyDark);
      shieldL.position.set(0.5, 1.3, 0.55);
      shieldL.rotation.y = -0.3;
      turret.add(shieldL);
      const shieldR = shieldL.clone();
      shieldR.position.z = -0.55;
      shieldR.rotation.y = 0.3;
      turret.add(shieldR);
      const breech = box(0.9, 0.4, 0.4, body);
      breech.position.set(0.1, 0.15, 0);
      turret.add(breech);
      const barrel = cyl(0.08, 0.11, 2.0, dark, 10);
      barrel.rotation.z = -Math.PI / 2;
      barrel.position.set(1.4, 0.2, 0);
      recoil.add(barrel);
      const muzzle = cyl(0.13, 0.13, 0.25, dark, 10);
      muzzle.rotation.z = -Math.PI / 2;
      muzzle.position.set(2.3, 0.2, 0);
      recoil.add(muzzle);
      turret.position.set(0, 1.15, 0);
      break;
    }
  }
  g.add(turret);
  g.userData.wheels = wheels;
  return g;
}

// ---------------------------------------------------------------------------
// Sci-fi gadgets
// ---------------------------------------------------------------------------

export function buildGadget(type: string, team: Team): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const glow = mat(teamCol, { emissive: teamCol });
  const dark = mat(0x2a2a26, { metal: 0.5, rough: 0.4 });

  switch (type) {
    case 'warpA':
    case 'warpB': {
      // tripod pylon with a floating ring
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = box(0.07, 0.7, 0.07, dark);
        leg.position.set(Math.cos(a) * 0.4, 0.32, Math.sin(a) * 0.4);
        leg.rotation.x = Math.sin(a) * 0.4;
        leg.rotation.z = -Math.cos(a) * 0.4;
        g.add(leg);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 24), glow);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.1;
      ring.name = 'spin';
      g.add(ring);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22),
        mat(type === 'warpA' ? 0xffffff : 0x222222, { emissive: type === 'warpA' ? 0xffffff : teamCol }));
      core.position.y = 1.1;
      g.add(core);
      break;
    }
    case 'skitter': {
      // GL-40 alt-fire: a demolition charge on six legs, mid-sprint
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), dark);
      body.scale.y = 0.6;
      body.position.y = 0.28;
      g.add(body);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), glow);
      eye.position.set(0.28, 0.3, 0); // forward — it LOOKS at its victim
      g.add(eye);
      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const leg = box(0.05, 0.32, 0.05, dark);
        leg.position.set((Math.floor(i / 2) - 1) * 0.22, 0.14, side * 0.3);
        leg.rotation.x = side * 0.7;
        leg.name = 'leg';
        g.add(leg);
      }
      break;
    }
    case 'target_beacon': {
      const base = cyl(0.25, 0.35, 0.25, dark, 8);
      base.position.y = 0.12;
      g.add(base);
      const mast = cyl(0.03, 0.03, 0.9, dark, 6);
      mast.position.y = 0.7;
      g.add(mast);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0xff5040, { emissive: 0xff5040 }));
      dish.position.y = 1.2;
      dish.name = 'pulse';
      g.add(dish);
      break;
    }
    case 'orbital': {
      const canister = cyl(0.3, 0.36, 0.6, mat(0x8a2020, { metal: 0.4, rough: 0.5 }), 10);
      canister.position.y = 0.3;
      g.add(canister);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(0xff2020, { emissive: 0xff2020 }));
      lamp.position.y = 0.72;
      lamp.name = 'pulse';
      g.add(lamp);
      break;
    }
    case 'shield': {
      const emitter = cyl(0.35, 0.5, 0.5, dark, 8);
      emitter.position.y = 0.25;
      g.add(emitter);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: teamCol, transparent: true, opacity: 0.16,
          emissive: teamCol, emissiveIntensity: 0.35, side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      dome.name = 'dome';
      g.add(dome);
      break;
    }
    case 'drone': {
      const body = box(0.5, 0.16, 0.5, dark);
      g.add(body);
      for (const [dx, dz] of [[0.32, 0.32], [0.32, -0.32], [-0.32, 0.32], [-0.32, -0.32]]) {
        const rotor = cyl(0.16, 0.16, 0.03, mat(0x3a3f44, { metal: 0.5, rough: 0.3 }), 8);
        rotor.position.set(dx, 0.1, dz);
        rotor.name = 'rotor';
        g.add(rotor);
      }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glow);
      eye.position.set(0.26, -0.05, 0);
      g.add(eye);
      break;
    }
    case 'supply_pod': {
      const capsule = cyl(0.7, 0.9, 1.8, mat(0x6a6f5a, { metal: 0.45, rough: 0.4 }), 10);
      capsule.position.y = 0.9;
      g.add(capsule);
      const stripe = cyl(0.92, 0.92, 0.18, mat(0xe8a33d, { emissive: 0xe8a33d }), 10);
      stripe.position.y = 0.5;
      g.add(stripe);
      break;
    }
    case 'camera': {
      // spy camera on a tripod mast — small but findable (and shootable)
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = box(0.05, 0.5, 0.05, dark);
        leg.position.set(Math.cos(a) * 0.22, 0.24, Math.sin(a) * 0.22);
        leg.rotation.x = Math.sin(a) * 0.35;
        leg.rotation.z = -Math.cos(a) * 0.35;
        g.add(leg);
      }
      const mast = cyl(0.05, 0.07, 1.2, dark, 6);
      mast.position.y = 1.0;
      g.add(mast);
      const headGrp = new THREE.Group();
      headGrp.name = 'camHead'; // slow pan — it's watching
      headGrp.position.y = 1.7;
      const head = box(0.34, 0.22, 0.22, dark);
      headGrp.add(head);
      const lens = box(0.1, 0.12, 0.12, glow);
      lens.position.set(0.2, 0, 0);
      headGrp.add(lens);
      g.add(headGrp);
      const blink = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(0xff4030, { emissive: 0xff4030 }));
      blink.position.set(0, 1.86, 0);
      blink.name = 'pulse';
      g.add(blink);
      break;
    }
    case 'flare': {
      // burning IR decoy — a tiny blinding sun that sinks as it burns
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xfff2c0, { emissive: 0xffd070 }));
      core.name = 'pulse';
      core.position.y = 2.4;
      g.add(core);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffa030, emissive: 0xff8020, emissiveIntensity: 1.2,
          transparent: true, opacity: 0.35, depthWrite: false,
        }),
      );
      halo.name = 'halo';
      halo.position.y = 2.4;
      g.add(halo);
      break;
    }
    case 'smoke_field': {
      // billowing gray puffs
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(1.6 + (i % 2) * 0.7, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x9aa0a6, transparent: true, opacity: 0.45, roughness: 1, depthWrite: false }),
        );
        puff.position.set(Math.cos(a) * 1.6, 1.2 + (i % 3) * 0.7, Math.sin(a) * 1.6);
        puff.name = 'puff';
        g.add(puff);
      }
      break;
    }
    case 'fire_field': {
      // low licking phosphorus flames
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.35, 1.1 + (i % 2) * 0.5, 6),
          mat(0xff8c30, { emissive: 0xff6a18, rough: 0.6 }),
        );
        flame.position.set(Math.cos(a) * 2.2, 0.5, Math.sin(a) * 2.2);
        flame.name = 'flame';
        g.add(flame);
      }
      const emberGlow = cyl(3.6, 3.6, 0.06, new THREE.MeshStandardMaterial({
        color: 0xff5010, emissive: 0xff4808, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.4, depthWrite: false,
      }) as THREE.Material, 16);
      emberGlow.position.y = 0.04;
      g.add(emberGlow);
      break;
    }
  }
  return g;
}

/** Jump gate: a glowing arch. */
export function buildGate(): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(0x3a3f44, { metal: 0.6, rough: 0.3 });
  const portal = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.16, 10, 28),
    mat(0x66e8ff, { emissive: 0x44ccee }),
  );
  portal.position.y = 1.9;
  portal.name = 'spin';
  g.add(portal);
  const film = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 24),
    new THREE.MeshStandardMaterial({
      color: 0x66e8ff, emissive: 0x44ccee, emissiveIntensity: 0.5,
      transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  film.position.y = 1.9;
  g.add(film);
  for (const side of [1, -1]) {
    const post = box(0.3, 2.2, 0.3, frame);
    post.position.set(0, 1.1, side * 1.8);
    g.add(post);
  }
  return g;
}

/** Grav-lift pad. */
export function buildPad(): THREE.Group {
  const g = new THREE.Group();
  const disc = cyl(1.3, 1.5, 0.18, mat(0x30363c, { metal: 0.5, rough: 0.4 }), 16);
  disc.position.y = 0.09;
  g.add(disc);
  const lens = cyl(1.0, 1.0, 0.1, mat(0x30d0c0, { emissive: 0x18a894 }), 16); // grav-lift energy: teal (no purple)
  lens.position.y = 0.2;
  lens.name = 'pulse';
  g.add(lens);
  return g;
}

export function buildTurretMesh(team: Team): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const legMat = mat(0x3a3a34, { metal: 0.4 });
  // tripod legs
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = box(0.08, 0.55, 0.08, legMat);
    leg.position.set(Math.cos(a) * 0.32, 0.26, Math.sin(a) * 0.32);
    leg.rotation.x = Math.sin(a) * 0.35;
    leg.rotation.z = -Math.cos(a) * 0.35;
    g.add(leg);
  }
  const post = cyl(0.1, 0.12, 0.7, mat(0x4a4a42));
  post.position.y = 0.85;
  g.add(post);
  const head = new THREE.Group();
  head.name = 'head';
  const headBox = box(0.55, 0.36, 0.44, mat(0x50554a, { metal: 0.3 }));
  head.add(headBox);
  const barrelL = box(0.7, 0.07, 0.07, mat(0x24241f, { metal: 0.5 }));
  barrelL.position.set(0.55, 0.06, 0.08);
  const barrelR = barrelL.clone();
  barrelR.position.z = -0.08;
  head.add(barrelL, barrelR);
  const eye = box(0.09, 0.09, 0.18, mat(teamCol, { emissive: teamCol }));
  eye.position.set(0.29, 0.12, 0);
  eye.name = 'eye';
  head.add(eye);
  head.position.y = 1.32;
  g.add(head);
  return g;
}

export function buildFlag(team: Team): THREE.Group {
  const g = new THREE.Group();
  const pole = cyl(0.05, 0.05, 3, mat(0xd8d8d0, { metal: 0.5 }), 6);
  pole.position.y = 1.5;
  g.add(pole);
  const cloth = box(1.2, 0.8, 0.06, mat(TEAM_COLORS[team], { emissive: TEAM_COLORS[team] }));
  cloth.position.set(0.62, 2.5, 0);
  cloth.name = 'cloth';
  g.add(cloth);
  return g;
}

export function buildPickup(type: string): THREE.Group {
  const g = new THREE.Group();
  let m: THREE.Mesh;
  switch (type) {
    case 'medkit': {
      m = box(0.7, 0.5, 0.7, mat(0xe8e8e2));
      const cross = box(0.15, 0.55, 0.45, mat(0xd8453a, { emissive: 0xd8453a }));
      const cross2 = box(0.45, 0.55, 0.15, mat(0xd8453a, { emissive: 0xd8453a }));
      g.add(cross, cross2);
      break;
    }
    case 'ammo':
      m = box(0.7, 0.5, 0.5, mat(0x6a7a3a));
      g.add(box(0.5, 0.15, 0.3, mat(0xe0c060, { emissive: 0xe0c060, metal: 0.7 })));
      break;
    case 'energy':
      m = cyl(0.3, 0.3, 0.7, mat(0x3888c8, { emissive: 0x3888c8 }), 8);
      break;
    default: // flamer
      m = cyl(0.25, 0.25, 0.8, mat(0xc86428, { emissive: 0xc84818 }), 8);
      m.rotation.z = Math.PI / 2;
  }
  m.position.y = 0.35;
  g.add(m);
  g.position.y = 0.4;
  return g;
}

export function buildProp(type: string, scale: number): THREE.Object3D {
  switch (type) {
    case 'rock': {
      // The collision footprint is a tile-quantized PLUS shape (map.ts rock
      // blobs: r=round(scale/1.6) tiles on the axes, less on diagonals), so
      // no sphere matches it exactly. ×1.45 is the compromise: it closes most
      // of the axis-direction invisible-wall gap (the reported bug) while
      // keeping the diagonal overhang — where the mesh pokes past collision —
      // under one world unit.
      const geo = new THREE.IcosahedronGeometry(scale * 1.45, 0);
      const mesh = new THREE.Mesh(geo, mat(0x6e685c, { rough: 0.95 }));
      mesh.position.y = scale * 0.5;
      mesh.castShadow = true;
      return mesh;
    }
    case 'tree': {
      const g = new THREE.Group();
      const trunk = cyl(0.18 * scale, 0.28 * scale, 2.2 * scale, mat(0x5a4632), 6);
      trunk.position.y = 1.1 * scale;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.5 * scale, 3 * scale, 7), mat(0x40613c, { rough: 0.9 }));
      crown.position.y = 3.4 * scale;
      crown.castShadow = true;
      const crown2 = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 2.2 * scale, 7), mat(0x4a6f44, { rough: 0.9 }));
      crown2.position.y = 4.3 * scale;
      crown2.castShadow = true;
      g.add(trunk, crown, crown2);
      return g;
    }
    case 'crate': {
      const g = new THREE.Group();
      const c = box(1.7, 1.1, 1.7, mat(0x7c6a44, { rough: 0.9 }));
      c.position.y = 0.55;
      const band = box(1.75, 0.15, 1.75, mat(0x4c4436));
      band.position.y = 0.55;
      g.add(c, band);
      return g;
    }
    case 'bunker': {
      const g = new THREE.Group();
      const wall = box(3, 2.4, 5, mat(0x5c5c50, { rough: 0.95 }));
      wall.position.y = 1.2;
      const roof = box(3.6, 0.3, 5.6, mat(0x4a4a40));
      roof.position.y = 2.55;
      g.add(wall, roof);
      return g;
    }
    case 'clone_bay': {
      // §21 The Reprint: the machine you come back from. A glass pod on a
      // steel collar, ~3u tall. PropSpec carries no team, so the core glows
      // neutral printer-amber — the bay serves whoever's base it stands in.
      // NO purple, ever.
      const g = new THREE.Group();
      const collar = cyl(1.0, 1.15, 0.3, mat(0x3a3f3c, { metal: 0.55, rough: 0.4 }), 12);
      collar.position.y = 0.15;
      const core = cyl(0.3, 0.3, 1.9, mat(0xf0b040, { emissive: 0xd88a18 }), 8);
      core.position.y = 1.35;
      core.name = 'core';
      // the glass is hand-rolled (not cyl()): transparent, no depth write, no
      // cast shadow — a pod that shades its own printer floor reads as solid
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, 2.3, 12, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0xbfe3e8, transparent: true, opacity: 0.22,
          roughness: 0.12, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      glass.position.y = 1.55;
      const cap = cyl(0.95, 0.8, 0.35, mat(0x3a3f3c, { metal: 0.55, rough: 0.4 }), 12);
      cap.position.y = 2.85;
      g.add(collar, core, glass, cap);
      return g;
    }
    default:
      return new THREE.Group();
  }
}
