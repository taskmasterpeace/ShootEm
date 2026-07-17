// Deployables and objectives: gadgets, sentries, pickups, the flags.
import * as THREE from 'three';
import { TEAM_COLORS } from '../../sim/data';
import type { Team } from '../../sim/types';
import { box, cyl, mat } from './shared';

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

/**
 * The sentry emplacement. The old build was a wire-frame ghost — 0.08u
 * tripod legs, 0.07u barrels, all dark greys, faction shown by a 0.09u eye.
 * At command height (camDist 30) that collapses into an unreadable black
 * lump (Robert's screenshot). This one is silhouette-first: a hex ground
 * plate, armor skirts, a real mantlet with a gun shield, twin barrels with
 * muzzle brakes, and the faction worn as PLATES and a visor strip — not a
 * pixel. UF wears olive drab; the Collective wears graphite with its glow.
 */
export function buildTurretMesh(team: Team): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const bodyMat = mat(team === 0 ? 0x6e6742 : 0x3c434c, { metal: 0.25, rough: 0.7 });
  const darkMat = mat(0x2e2e28, { metal: 0.45, rough: 0.6 });
  const steelMat = mat(0x55534a, { metal: 0.4, rough: 0.55 });
  const trimMat = mat(teamCol, { emissive: teamCol, rough: 0.5 });
  trimMat.emissiveIntensity = 0.85; // the faction must SHOUT at command zoom

  // hex ground plate — the emplacement OWNS its ground
  const pad = cyl(0.66, 0.72, 0.12, darkMat, 6);
  pad.position.y = 0.06;
  g.add(pad);
  // three armor skirts, thick enough to survive distance
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const skirt = box(0.4, 0.44, 0.12, bodyMat);
    skirt.position.set(Math.cos(a) * 0.5, 0.3, Math.sin(a) * 0.5);
    skirt.rotation.y = -a + Math.PI / 2;
    skirt.rotation.x = 0.24;
    g.add(skirt);
    // a team stripe on each skirt so the faction reads from EVERY side
    const stripe = box(0.34, 0.07, 0.02, trimMat);
    stripe.position.set(Math.cos(a) * 0.56, 0.42, Math.sin(a) * 0.56);
    stripe.rotation.y = -a + Math.PI / 2;
    stripe.rotation.x = 0.24;
    g.add(stripe);
  }
  // pedestal + collar
  const post = cyl(0.17, 0.22, 0.5, steelMat, 8);
  post.position.y = 0.62;
  g.add(post);
  const collar = cyl(0.24, 0.24, 0.1, darkMat, 8);
  collar.position.y = 0.9;
  g.add(collar);

  // the rotating head: mantlet + shield + twin guns + visor
  const head = new THREE.Group();
  head.name = 'head';
  const mantlet = box(0.62, 0.4, 0.52, bodyMat);
  head.add(mantlet);
  // side armor cheeks in team color — the faction read at 30u
  const cheekL = box(0.44, 0.3, 0.05, trimMat);
  cheekL.position.set(-0.02, 0.02, 0.29);
  const cheekR = cheekL.clone();
  cheekR.position.z = -0.29;
  head.add(cheekL, cheekR);
  // gun shield: a wide angled plate with a firing notch
  const shield = box(0.07, 0.5, 0.66, steelMat);
  shield.position.set(0.32, 0.04, 0);
  shield.rotation.z = -0.12;
  head.add(shield);
  const notchTop = box(0.08, 0.1, 0.2, darkMat);
  notchTop.position.set(0.34, 0.26, 0);
  head.add(notchTop);
  // twin barrels — thick, sleeved, braked
  for (const side of [1, -1]) {
    const sleeve = cyl(0.07, 0.08, 0.26, darkMat, 6);
    sleeve.rotation.z = Math.PI / 2;
    sleeve.position.set(0.5, 0.04, side * 0.11);
    head.add(sleeve);
    const barrel = box(0.62, 0.09, 0.09, darkMat);
    barrel.position.set(0.78, 0.04, side * 0.11);
    head.add(barrel);
    const brake = box(0.12, 0.13, 0.13, steelMat);
    brake.position.set(1.06, 0.04, side * 0.11);
    head.add(brake);
  }
  // ammo drum on the hip, team-striped
  const drum = box(0.24, 0.3, 0.2, darkMat);
  drum.position.set(-0.28, -0.08, 0.2);
  head.add(drum);
  const drumBand = box(0.26, 0.08, 0.22, trimMat);
  drumBand.position.set(-0.28, 0.0, 0.2);
  head.add(drumBand);
  // the eye: a wide visor STRIP, not a pixel — the renderer pulses it
  const eye = box(0.06, 0.1, 0.34, mat(teamCol, { emissive: teamCol }));
  eye.position.set(0.33, 0.14, 0);
  eye.name = 'eye';
  head.add(eye);
  // sensor fin
  const fin = box(0.16, 0.18, 0.04, bodyMat);
  fin.position.set(-0.2, 0.26, 0);
  head.add(fin);
  head.position.y = 1.14;
  g.add(head);
  // presence scale: the sim's hit cylinder is r=1.2 — the mesh keeps inside
  // it while claiming enough pixels to read at command height
  g.scale.setScalar(1.15);
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

