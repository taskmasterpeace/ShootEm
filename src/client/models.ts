import * as THREE from 'three';
import { TEAM_COLORS } from '../sim/data';
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

/** Low-poly soldier. Root faces +X (yaw 0). */
export function buildSoldier(team: Team, classId: ClassId, kind: SoldierKind): THREE.Group {
  const g = new THREE.Group();
  const isZed = kind !== 'human' && kind !== 'bot';
  const teamCol = isZed
    ? (kind === 'brute' ? 0x5a7a3a
      : kind === 'spitter' ? 0x7a9a4a
      : kind === 'sprinter' ? 0xb9503a
      : kind === 'bomber' ? 0x8fbf2a
      : 0x6b8f4e)
    : TEAM_COLORS[team];
  const skin = isZed ? (kind === 'sprinter' ? 0xb07050 : 0x8fa86a) : 0xd9b38c;
  const armor = mat(isZed ? (kind === 'sprinter' ? 0x5a3226 : 0x3d4a2e) : team === 0 ? 0x8a6c34 : 0x33708a, { rough: 0.85 });
  const accent = mat(teamCol, { emissive: isZed ? 0 : teamCol });

  const scale = kind === 'brute' ? 1.65 : kind === 'bomber' ? 1.25 : kind === 'sprinter' ? 0.9 : 1;

  // torso
  const torso = box(0.55, 0.7, 0.8, armor);
  torso.position.y = 1.05;
  g.add(torso);
  // team stripe / shoulder pads
  const padL = box(0.2, 0.18, 0.24, accent);
  padL.position.set(0, 1.35, 0.45);
  const padR = padL.clone();
  padR.position.z = -0.45;
  g.add(padL, padR);
  // head
  const head = box(0.38, 0.36, 0.38, mat(skin));
  head.position.y = 1.62;
  g.add(head);
  const visor = box(0.12, 0.12, 0.3, isZed ? mat(0xcc3333, { emissive: 0xcc3333 }) : mat(0x222222, { rough: 0.3, metal: 0.6 }));
  visor.position.set(0.18, 1.64, 0);
  g.add(visor);
  // legs
  const legL = box(0.22, 0.7, 0.24, mat(0x3a3a34));
  legL.position.set(0, 0.35, 0.18);
  const legR = legL.clone();
  legR.position.z = -0.18;
  legL.name = 'legL';
  legR.name = 'legR';
  g.add(legL, legR);
  // arms + gun
  if (!isZed) {
    const gun = box(0.9, 0.14, 0.14, mat(0x2b2b28, { metal: 0.5, rough: 0.4 }));
    gun.position.set(0.55, 1.15, 0.12);
    gun.name = 'gun';
    g.add(gun);
    if (classId === 'jump') {
      const pack = box(0.25, 0.5, 0.5, mat(0x555a60, { metal: 0.4 }));
      pack.position.set(-0.4, 1.1, 0);
      g.add(pack);
      const nozL = cyl(0.06, 0.09, 0.2, mat(0x333, { metal: 0.6 }));
      nozL.position.set(-0.4, 0.8, 0.16);
      const nozR = nozL.clone();
      nozR.position.z = -0.16;
      g.add(nozL, nozR);
    }
    if (classId === 'medic') {
      const cross = box(0.06, 0.3, 0.1, mat(0xffffff, { emissive: 0xffffff }));
      const cross2 = box(0.06, 0.1, 0.3, mat(0xffffff, { emissive: 0xffffff }));
      cross.position.set(-0.31, 1.1, 0);
      cross2.position.set(-0.31, 1.1, 0);
      g.add(cross, cross2);
    }
  } else {
    // claw arms reaching forward
    const armL = box(0.7, 0.16, 0.16, mat(skin));
    armL.position.set(0.35, 1.2, 0.3);
    const armR = armL.clone();
    armR.position.z = -0.3;
    g.add(armL, armR);
    if (kind === 'bomber') {
      // bloated glowing belly — shoot it before it reaches you
      const belly = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        mat(0x9adf3a, { emissive: 0x9adf3a, rough: 0.5 }),
      );
      belly.position.set(0.18, 0.95, 0);
      belly.castShadow = true;
      g.add(belly);
    }
    if (kind === 'sprinter') {
      // hunched forward posture
      g.rotation.z = 0;
      const spine = box(0.5, 0.14, 0.14, mat(0x7a3a2a));
      spine.position.set(-0.15, 1.5, 0);
      spine.rotation.z = -0.5;
      g.add(spine);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

/** Vehicles face +X. */
export function buildVehicle(kind: VehicleKind, team: Team): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const body = mat(team === 0 ? 0x7a6030 : 0x2f6478, { rough: 0.6, metal: 0.35 });
  const dark = mat(0x24241f, { rough: 0.5, metal: 0.4 });
  const glow = mat(teamCol, { emissive: teamCol });

  const turret = new THREE.Group();
  turret.name = 'turret';

  switch (kind) {
    case 'buggy': {
      const hull = box(2.6, 0.6, 1.6, body);
      hull.position.y = 0.75;
      g.add(hull);
      const cab = box(1.1, 0.5, 1.3, dark);
      cab.position.set(-0.3, 1.25, 0);
      g.add(cab);
      for (const [x, z] of [[0.9, 0.85], [0.9, -0.85], [-0.9, 0.85], [-0.9, -0.85]]) {
        const wheel = cyl(0.42, 0.42, 0.3, dark, 12);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.42, z);
        g.add(wheel);
      }
      const gun = box(1.2, 0.12, 0.12, dark);
      gun.position.set(0.6, 0.25, 0);
      turret.add(gun);
      turret.position.set(-0.3, 1.6, 0);
      break;
    }
    case 'tank': {
      const hull = box(4, 0.9, 2.6, body);
      hull.position.y = 0.85;
      g.add(hull);
      for (const side of [1, -1]) {
        const tread = box(4.2, 0.7, 0.55, dark);
        tread.position.set(0, 0.45, side * 1.35);
        g.add(tread);
      }
      const dome = box(1.7, 0.65, 1.6, body);
      dome.position.y = 0.35;
      turret.add(dome);
      const barrel = cyl(0.12, 0.15, 2.6, dark, 8);
      barrel.rotation.z = -Math.PI / 2;
      barrel.position.set(1.9, 0.4, 0);
      turret.add(barrel);
      turret.position.set(-0.2, 1.35, 0);
      const stripe = box(0.8, 0.1, 2.62, glow);
      stripe.position.set(-1.4, 1.32, 0);
      g.add(stripe);
      break;
    }
    case 'apc': {
      const hull = box(3.6, 1.3, 2.2, body);
      hull.position.y = 1.1;
      g.add(hull);
      const nose = box(0.8, 0.9, 2.2, body);
      nose.position.set(2.05, 0.9, 0);
      nose.rotation.z = 0.3;
      g.add(nose);
      for (const [x] of [[1.3], [0], [-1.3]]) {
        for (const side of [1, -1]) {
          const wheel = cyl(0.5, 0.5, 0.35, dark, 12);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(x, 0.5, side * 1.15);
          g.add(wheel);
        }
      }
      const beacon = box(0.5, 0.15, 0.5, glow);
      beacon.position.set(-1.2, 1.85, 0);
      g.add(beacon);
      const gun = box(1.1, 0.12, 0.12, dark);
      gun.position.set(0.55, 0.2, 0);
      turret.add(gun);
      turret.position.set(0.6, 1.95, 0);
      break;
    }
    case 'skiff': {
      const hull = box(2.4, 0.35, 1.1, body);
      hull.position.y = 0.95;
      g.add(hull);
      const fin = box(0.7, 0.55, 0.12, mat(0x2b2b28));
      fin.position.set(-1, 1.35, 0);
      g.add(fin);
      for (const side of [1, -1]) {
        const pod = cyl(0.2, 0.28, 0.9, dark, 8);
        pod.rotation.z = Math.PI / 2;
        pod.position.set(-0.2, 0.8, side * 0.75);
        g.add(pod);
        const glowRing = cyl(0.16, 0.16, 0.06, glow, 8);
        glowRing.rotation.z = Math.PI / 2;
        glowRing.position.set(-0.68, 0.8, side * 0.75);
        g.add(glowRing);
      }
      const gun = box(0.9, 0.1, 0.1, dark);
      gun.position.set(0.45, 0.1, 0);
      turret.add(gun);
      turret.position.set(0.5, 1.2, 0);
      break;
    }
  }
  g.add(turret);
  return g;
}

export function buildTurretMesh(team: Team): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const base = cyl(0.5, 0.7, 0.5, mat(0x3a3a34, { metal: 0.4 }));
  base.position.y = 0.25;
  g.add(base);
  const post = cyl(0.14, 0.14, 0.9, mat(0x4a4a42));
  post.position.y = 0.9;
  g.add(post);
  const head = new THREE.Group();
  head.name = 'head';
  const headBox = box(0.6, 0.4, 0.5, mat(0x50554a, { metal: 0.3 }));
  head.add(headBox);
  const barrel = box(0.8, 0.1, 0.1, mat(0x24241f, { metal: 0.5 }));
  barrel.position.x = 0.6;
  head.add(barrel);
  const eye = box(0.1, 0.1, 0.2, mat(teamCol, { emissive: teamCol }));
  eye.position.set(0.31, 0.12, 0);
  head.add(eye);
  head.position.y = 1.5;
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
      const geo = new THREE.IcosahedronGeometry(scale, 0);
      const mesh = new THREE.Mesh(geo, mat(0x6e685c, { rough: 0.95 }));
      mesh.position.y = scale * 0.4;
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
      g.add(trunk, crown);
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
    default:
      return new THREE.Group();
  }
}
