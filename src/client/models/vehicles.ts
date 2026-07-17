// The motor pool: every hull from the buggy to the Goliath.
import * as THREE from 'three';
import { TEAM_COLORS } from '../../sim/data';
import type { Team, VehicleKind } from '../../sim/types';
import { box, cyl, mat } from './shared';
import { buildRider } from './soldiers';

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

