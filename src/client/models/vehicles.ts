// The motor pool: every hull from the buggy to the Goliath.
import * as THREE from 'three';
import { TEAM_COLORS, VEHICLES } from '../../sim/data';
import type { Team, VehicleKind } from '../../sim/types';
import { box, cyl, mat } from './shared';
import { buildRider } from './soldiers';

export function buildVehicle(kind: VehicleKind, team: Team): THREE.Group {
  // the civilian roster paints itself — a taxi is yellow on either side of
  // the war (team still colors nothing; civilians carry no faction trim)
  if (VEHICLES[kind]?.civilian) return buildCivilianVehicle(kind);
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
    case 'submarine': {
      const pressureHull = cyl(0.92, 0.92, 5.8, body, 12);
      pressureHull.rotation.z = Math.PI / 2;
      pressureHull.position.y = 0.62;
      g.add(pressureHull);
      const bow = cyl(0.08, 0.9, 1.35, bodyDark, 12);
      bow.rotation.z = -Math.PI / 2;
      bow.position.set(3.55, 0.62, 0);
      g.add(bow);
      const stern = cyl(0.88, 0.18, 1.25, bodyDark, 12);
      stern.rotation.z = -Math.PI / 2;
      stern.position.set(-3.45, 0.62, 0);
      g.add(stern);
      const sail = box(1.25, 0.9, 0.65, bodyDark);
      sail.position.set(-0.35, 1.48, 0);
      g.add(sail);
      const mast = cyl(0.06, 0.06, 0.85, dark, 7);
      mast.position.set(-0.2, 2.32, 0);
      g.add(mast);
      for (const side of [1, -1]) {
        const divePlane = box(1.2, 0.1, 0.55, bodyDark);
        divePlane.position.set(1.25, 0.65, side * 0.92);
        g.add(divePlane);
        const tailPlane = box(0.55, 0.08, 1.15, bodyDark);
        tailPlane.position.set(-3.25, 0.65, side * 0.48);
        g.add(tailPlane);
      }
      const propeller = new THREE.Group();
      propeller.name = 'propeller';
      propeller.position.set(-4.15, 0.62, 0);
      propeller.add(box(0.08, 1.55, 0.14, dark), box(0.08, 0.14, 1.55, dark));
      g.add(propeller);
      for (const z of [-0.32, 0.32]) {
        const tube = cyl(0.13, 0.13, 0.9, dark, 8);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(0.45, 0, z);
        recoil.add(tube);
      }
      turret.position.set(3.1, 0.62, 0);
      const stripe = box(3.8, 0.08, 0.12, glow);
      stripe.position.set(0, 0.7, 0.93);
      g.add(stripe);
      const sonarRing = new THREE.Mesh(
        new THREE.RingGeometry(4.7, 5.05, 48),
        new THREE.MeshBasicMaterial({
          color: team === 0 ? 0x55e6dd : 0xf0ad55,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      sonarRing.rotation.x = -Math.PI / 2;
      sonarRing.name = 'sonarRing';
      sonarRing.visible = false;
      sonarRing.userData.aura = true;
      g.add(sonarRing);
      break;
    }
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
    case 'comet':
    case 'vector':
    case 'sprite': {
      // the raceboards — hoverboard silhouette, each in its own livery so you
      // can read the class from across the grid. Red = Comet (speed), amber =
      // Vector (balance), cyan = Sprite (grip). No purple, ever.
      const livery = kind === 'comet' ? 0xff4a2a : kind === 'sprite' ? 0x3dbde8 : 0xe8a33d;
      const race = mat(livery, { rough: 0.4, metal: 0.5 });
      const raceGlow = mat(livery, { emissive: livery });
      const deck = box(1.7, 0.11, 0.52, body);
      deck.position.y = 0.45;
      g.add(deck);
      const stripe = box(1.72, 0.02, 0.16, race); // centre racing stripe
      stripe.position.y = 0.51;
      g.add(stripe);
      const nose = box(0.4, 0.1, 0.42, race);
      nose.position.set(0.92, 0.47, 0);
      nose.rotation.z = 0.14;
      g.add(nose);
      const fin = box(0.5, 0.22, 0.05, race); // a little tail fin — reads as "racer"
      fin.position.set(-0.7, 0.6, 0);
      g.add(fin);
      const underglow = box(1.35, 0.05, 0.4, raceGlow);
      underglow.position.y = 0.36;
      underglow.name = 'thrustL';
      g.add(underglow);
      for (const x of [0.55, -0.55]) {
        const pod = cyl(0.1, 0.14, 0.14, dark, 8);
        pod.position.set(x, 0.32, 0);
        g.add(pod);
      }
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
      // NO proxy rider any more (Robert: "the hoverboard needs to look like
      // the character is actually on it"). The old buildRider was a hardcoded
      // team-colored stand-in — no class, no gun, no identity. The renderer
      // now keeps the REAL soldier mesh visible and poses it surfing on the
      // deck instead of hiding it (see the surf branch in renderer.ts).
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
    // ==== V2/V3/V4 THE AIR PROGRAM ====
    // At command zoom these read by PLANFORM: swept delta (strike), thin
    // needle with a long nose (interceptor), fat slab with four engines
    // (bomber), boxy launcher with raised rails (AA).
    case 'strikejet': {
      // VULTURE — a swept delta, nose-heavy, rocket pods slung under
      const hull = box(3.0, 0.42, 0.7, body);
      hull.position.y = 1.5;
      g.add(hull);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 6), body);
      nose.rotation.z = -Math.PI / 2;
      nose.position.set(2.0, 1.5, 0);
      g.add(nose);
      const canopy = box(0.65, 0.3, 0.5, mat(0x18242a, { rough: 0.2, metal: 0.65 }));
      canopy.position.set(0.75, 1.78, 0);
      g.add(canopy);
      for (const side of [1, -1]) {
        // the delta: a wide swept wing, thick at the root
        const wing = box(1.5, 0.14, 1.5, bodyDark);
        wing.position.set(-0.25, 1.48, side * 1.05);
        wing.rotation.y = side * 0.42;
        g.add(wing);
        const pod = cyl(0.16, 0.16, 0.9, dark, 7);
        pod.rotation.z = Math.PI / 2;
        pod.position.set(-0.1, 1.28, side * 1.15);
        pod.name = side === 1 ? 'podL' : 'podR';
        g.add(pod);
        const fin = box(0.5, 0.55, 0.07, bodyDark);
        fin.position.set(-1.35, 1.78, side * 0.45);
        fin.rotation.z = 0.2;
        g.add(fin);
      }
      const exhaust = cyl(0.26, 0.3, 0.4, mat(0x2a2f35, { metal: 0.6, rough: 0.3 }), 8);
      exhaust.rotation.z = Math.PI / 2;
      exhaust.position.set(-1.6, 1.5, 0);
      g.add(exhaust);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 7), mat(0xff9a3c, { emissive: 0xff9a3c }));
      flame.rotation.z = Math.PI / 2;
      flame.position.set(-2.15, 1.5, 0);
      flame.name = 'thrustL';
      g.add(flame);
      const turret = new THREE.Group();
      turret.name = 'turret';
      turret.position.set(0.9, 1.35, 0);
      const gunR = new THREE.Group();
      gunR.name = 'gunRecoil';
      const muzzle = cyl(0.09, 0.09, 0.7, dark, 6);
      muzzle.rotation.z = Math.PI / 2;
      muzzle.position.x = 0.35;
      gunR.add(muzzle);
      turret.add(gunR);
      g.add(turret);
      break;
    }
    case 'interceptor': {
      // FALCON — a needle: long nose, short straight wings, twin tails
      const hull = box(3.4, 0.34, 0.5, body);
      hull.position.y = 1.5;
      g.add(hull);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.5, 6), bodyDark);
      nose.rotation.z = -Math.PI / 2;
      nose.position.set(2.35, 1.5, 0);
      g.add(nose);
      const canopy = box(0.8, 0.3, 0.42, mat(0x1b2a33, { rough: 0.15, metal: 0.7 }));
      canopy.position.set(0.85, 1.76, 0);
      g.add(canopy);
      for (const side of [1, -1]) {
        const wing = box(0.9, 0.1, 1.35, bodyDark);
        wing.position.set(-0.1, 1.5, side * 0.95);
        wing.rotation.y = side * 0.2;
        g.add(wing);
        // twin canted tails — the interceptor's signature from above
        const tail = box(0.55, 0.62, 0.07, bodyDark);
        tail.position.set(-1.5, 1.82, side * 0.42);
        tail.rotation.z = 0.28;
        tail.rotation.x = side * 0.3;
        g.add(tail);
        const eng = cyl(0.19, 0.22, 0.5, mat(0x2a2f35, { metal: 0.6, rough: 0.3 }), 8);
        eng.rotation.z = Math.PI / 2;
        eng.position.set(-1.5, 1.5, side * 0.28);
        g.add(eng);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.75, 7), mat(0x8ad8ff, { emissive: 0x8ad8ff }));
        fl.rotation.z = Math.PI / 2;
        fl.position.set(-2.0, 1.5, side * 0.28);
        fl.name = side === 1 ? 'thrustL' : 'thrustR';
        g.add(fl);
      }
      const turret = new THREE.Group();
      turret.name = 'turret';
      turret.position.set(1.4, 1.42, 0);
      const gunR = new THREE.Group();
      gunR.name = 'gunRecoil';
      for (const dz of [-0.1, 0.1]) {
        const barrel = cyl(0.055, 0.055, 0.9, dark, 6);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.45, 0, dz);
        gunR.add(barrel);
      }
      turret.add(gunR);
      g.add(turret);
      break;
    }
    case 'bomber': {
      // ANVIL — a fat slab with four engines and a bomb bay. Reads HUGE.
      const hull = box(4.4, 0.8, 1.5, body);
      hull.position.y = 1.7;
      g.add(hull);
      const nose = box(1.0, 0.6, 1.1, mat(0x1b2a33, { rough: 0.25, metal: 0.5 }));
      nose.position.set(2.5, 1.7, 0);
      g.add(nose);
      const bay = box(2.2, 0.3, 1.1, dark);
      bay.position.set(0.1, 1.24, 0);
      bay.name = 'bay';
      g.add(bay);
      for (const side of [1, -1]) {
        const wing = box(1.6, 0.18, 3.2, bodyDark);
        wing.position.set(-0.2, 1.75, side * 2.0);
        g.add(wing);
        for (const [ex, off] of [[0.35, 1.25], [0.05, 2.5]] as const) {
          const eng = cyl(0.28, 0.28, 0.85, mat(0x30363c, { metal: 0.55, rough: 0.3 }), 8);
          eng.rotation.z = Math.PI / 2;
          eng.position.set(ex, 1.55, side * off);
          g.add(eng);
          const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 7), mat(0xffb45c, { emissive: 0xffb45c }));
          fl.rotation.z = Math.PI / 2;
          fl.position.set(ex - 0.75, 1.55, side * off);
          fl.name = side === 1 ? 'thrustL' : 'thrustR';
          g.add(fl);
        }
        const tail = box(0.7, 0.9, 0.1, bodyDark);
        tail.position.set(-2.1, 2.2, side * 0.5);
        g.add(tail);
      }
      const spine = box(3.6, 0.22, 0.3, bodyDark);
      spine.position.set(-0.2, 2.15, 0);
      g.add(spine);
      const turret = new THREE.Group();
      turret.name = 'turret';
      turret.position.set(-1.4, 2.05, 0);
      const gunR = new THREE.Group();
      gunR.name = 'gunRecoil';
      const barrel = cyl(0.07, 0.07, 0.6, dark, 6);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.x = 0.3;
      gunR.add(barrel);
      turret.add(gunR);
      g.add(turret);
      break;
    }
    case 'gunship': {
      // WARHAWK — the A-10 school: STRAIGHT wings (the anti-delta read), a huge
      // nose cannon, twin H-tails, engines slung HIGH on the rear. A gun with wings.
      const armour = mat(team === 0 ? 0x6f6a52 : 0x40565f, { rough: 0.7, metal: 0.3 });
      const hull = box(3.2, 0.6, 0.9, armour);
      hull.position.y = 1.5;
      g.add(hull);
      const nose = box(1.0, 0.55, 0.7, bodyDark);
      nose.position.set(1.9, 1.5, 0);
      g.add(nose);
      const canopy = box(0.7, 0.34, 0.55, mat(0x18242a, { rough: 0.2, metal: 0.6 }));
      canopy.position.set(1.1, 1.82, 0);
      g.add(canopy);
      for (const side of [1, -1]) {
        const wing = box(1.3, 0.12, 2.0, armour); // straight, thick — no sweep
        wing.position.set(-0.1, 1.46, side * 1.5);
        g.add(wing);
        const pod = cyl(0.16, 0.16, 0.85, dark, 7); // under-wing rocket pods (warhawk_pods)
        pod.rotation.z = Math.PI / 2;
        pod.position.set(0.0, 1.28, side * 1.55);
        pod.name = side === 1 ? 'podL' : 'podR';
        g.add(pod);
        const tail = box(0.55, 0.6, 0.08, bodyDark); // twin H-tail fins
        tail.position.set(-1.75, 1.85, side * 0.75);
        g.add(tail);
        const nac = cyl(0.28, 0.28, 0.95, mat(0x30363c, { metal: 0.6, rough: 0.3 }), 9); // engines high on the rear
        nac.rotation.z = Math.PI / 2;
        nac.position.set(-1.2, 1.95, side * 0.6);
        g.add(nac);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 7), mat(0xff9a3c, { emissive: 0xff9a3c }));
        fl.rotation.z = Math.PI / 2;
        fl.position.set(-1.85, 1.95, side * 0.6);
        fl.name = side === 1 ? 'thrustL' : 'thrustR';
        g.add(fl);
      }
      const stab = box(0.5, 0.09, 1.7, bodyDark); // horizontal stab joining the twin tails
      stab.position.set(-1.75, 1.72, 0);
      g.add(stab);
      const cannon = cyl(0.13, 0.15, 1.3, mat(0x2a2a26, { metal: 0.7, rough: 0.25 }), 8); // the GAU snout
      cannon.rotation.z = Math.PI / 2;
      cannon.position.set(0.7, 0, 0);
      recoil.add(cannon);
      turret.position.set(1.7, 1.36, 0);
      break;
    }
    case 'airsuperiority': {
      // SPECTER — the raptor school: a blended DIAMOND planform, chined nose, twin
      // canted tails + canted stabs, two burners tucked to the centreline. Reads FAST.
      const jet = mat(team === 0 ? 0x6a5a34 : 0x2a5a68, { rough: 0.4, metal: 0.5 });
      const wingMat = mat(team === 0 ? 0x574a2a : 0x224b56, { rough: 0.45, metal: 0.45 });
      const hull = box(3.2, 0.4, 0.8, jet);
      hull.position.y = 1.5;
      g.add(hull);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 4), jet); // chined 4-facet wedge
      nose.rotation.z = -Math.PI / 2;
      nose.rotation.x = Math.PI / 4;
      nose.position.set(2.2, 1.5, 0);
      g.add(nose);
      const canopy = box(0.85, 0.3, 0.44, mat(0x1b2a33, { rough: 0.15, metal: 0.72 }));
      canopy.position.set(0.95, 1.74, 0);
      g.add(canopy);
      for (const side of [1, -1]) {
        const wing = box(1.4, 0.1, 1.5, wingMat); // wide blended diamond
        wing.position.set(-0.15, 1.5, side * 1.0);
        wing.rotation.y = side * 0.5;
        g.add(wing);
        const vtail = box(0.6, 0.62, 0.07, bodyDark); // twin canted vertical tails
        vtail.position.set(-1.4, 1.8, side * 0.45);
        vtail.rotation.z = 0.3;
        vtail.rotation.x = side * 0.32;
        g.add(vtail);
        const stab = box(0.7, 0.08, 0.7, bodyDark); // canted horizontal stab
        stab.position.set(-1.5, 1.48, side * 0.72);
        stab.rotation.y = side * 0.3;
        g.add(stab);
        const eng = cyl(0.2, 0.22, 0.55, mat(0x2a2f35, { metal: 0.6, rough: 0.3 }), 8);
        eng.rotation.z = Math.PI / 2;
        eng.position.set(-1.55, 1.5, side * 0.26);
        g.add(eng);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.85, 7), mat(0x8ad8ff, { emissive: 0x8ad8ff }));
        fl.rotation.z = Math.PI / 2;
        fl.position.set(-2.1, 1.5, side * 0.26);
        fl.name = side === 1 ? 'thrustL' : 'thrustR';
        g.add(fl);
      }
      const barrel = cyl(0.06, 0.06, 0.8, dark, 6); // internal cannon at the wing root
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.4, 0, 0.3);
      recoil.add(barrel);
      turret.position.set(1.3, 1.45, 0);
      break;
    }
    case 'stealthbomber': {
      // REAPER — a FLYING WING, all planform, no tail, no fuselage tube: the B-2 read.
      // Matte and dark so it barely reflects (radar can't lock it). A faint team spine.
      const skin = mat(team === 0 ? 0x2b271d : 0x1f262b, { rough: 0.72, metal: 0.15 }); // radar-absorbent matte
      const skinLit = mat(team === 0 ? 0x332f24 : 0x263039, { rough: 0.7, metal: 0.18 });
      for (const side of [1, -1]) {
        const panel = box(3.4, 0.16, 1.7, skin); // swept wing panels — leading edges meet at the apex
        panel.position.set(-0.2, 1.5, side * 1.15);
        panel.rotation.y = side * 0.62;
        g.add(panel);
        const saw = box(1.0, 0.14, 0.7, skinLit); // the trailing-edge sawtooth (the B-2 W)
        saw.position.set(-1.55, 1.5, side * 1.75);
        saw.rotation.y = side * 0.62;
        g.add(saw);
        const spine = box(3.0, 0.05, 0.1, mat(team === 0 ? 0x8a7a45 : 0x3a7a8a, { rough: 0.5, metal: 0.3 })); // dim team edge, not a glow
        spine.position.set(0.0, 1.6, side * 1.5);
        spine.rotation.y = side * 0.62;
        g.add(spine);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), mat(0x6a7a6a, { emissive: 0x36432f })); // subdued (masked) exhaust
        fl.rotation.z = Math.PI / 2;
        fl.position.set(-1.5, 1.5, side * 0.55);
        fl.name = side === 1 ? 'thrustL' : 'thrustR';
        g.add(fl);
      }
      const centre = box(2.6, 0.34, 1.1, skin); // blends the panels
      centre.position.set(0.1, 1.52, 0);
      g.add(centre);
      const apex = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 4), skin); // the leading point
      apex.rotation.z = -Math.PI / 2;
      apex.position.set(1.7, 1.52, 0);
      g.add(apex);
      const bump = box(0.9, 0.3, 0.7, skinLit); // the low cockpit blister
      bump.position.set(0.7, 1.74, 0);
      g.add(bump);
      const bay = box(1.8, 0.24, 0.8, mat(0x14151a, { rough: 0.6 })); // the belly bomb bay
      bay.position.set(0.0, 1.32, 0);
      bay.name = 'bay';
      g.add(bay);
      const sight = box(0.3, 0.1, 0.3, dark); // the bomb-release node (fires from the belly)
      sight.position.set(0.2, -0.05, 0);
      recoil.add(sight);
      turret.position.set(0.2, 1.32, 0);
      break;
    }
    case 'gunheli': {
      // HYDRA — a SINGLE-main-rotor gunship that volleys guided rockets: the Apache
      // read (NOT the Shrike's twin rotors). Fat rocket racks are the many heads.
      const hullMat = mat(team === 0 ? 0x5f5a3a : 0x2f5a5f, { rough: 0.6, metal: 0.3 });
      const fuselage = box(3.4, 0.7, 0.95, hullMat);
      fuselage.position.y = 1.5;
      g.add(fuselage);
      const front = box(0.9, 0.42, 0.75, mat(0x13252b, { rough: 0.2, metal: 0.65 })); // stepped tandem canopy
      front.position.set(1.35, 1.7, 0);
      g.add(front);
      const rear = box(0.8, 0.5, 0.78, mat(0x13252b, { rough: 0.2, metal: 0.65 }));
      rear.position.set(0.55, 1.92, 0);
      g.add(rear);
      const tail = box(2.6, 0.26, 0.32, bodyDark); // long tail boom
      tail.position.set(-2.6, 1.6, 0);
      g.add(tail);
      const fin = box(0.5, 0.9, 0.1, bodyDark);
      fin.position.set(-3.7, 1.95, 0);
      fin.rotation.z = 0.3;
      g.add(fin);
      const tailRotor = cyl(0.55, 0.55, 0.05, dark, 10); // vertical tail-rotor disc (the single-rotor tell)
      tailRotor.rotation.x = Math.PI / 2;
      tailRotor.position.set(-3.8, 1.95, 0.2);
      g.add(tailRotor);
      for (const side of [1, -1]) {
        const wing = box(0.6, 0.14, 1.0, bodyDark); // stub weapon wings
        wing.position.set(0.2, 1.4, side * 0.9);
        g.add(wing);
        for (const dy of [-0.12, 0.12]) for (const dz of [-0.12, 0.12]) { // a fat 2×2 rocket-tube rack
          const tube = cyl(0.09, 0.09, 1.0, mat(0x2a2a26, { metal: 0.5, rough: 0.4 }), 6);
          tube.rotation.z = Math.PI / 2;
          tube.position.set(0.35, 1.28 + dy, side * 1.35 + dz);
          g.add(tube);
        }
        const skid = box(2.0, 0.1, 0.1, dark); // landing skids
        skid.position.set(0.2, 0.75, side * 0.6);
        g.add(skid);
      }
      const chin = box(1.1, 0.13, 0.13, dark); // chin cannon (hydra_cannon)
      chin.position.set(0.55, 0, 0);
      recoil.add(chin);
      turret.position.set(1.3, 1.05, 0);
      const mast = cyl(0.11, 0.11, 0.7, dark, 8);
      mast.position.set(0.0, 2.3, 0);
      g.add(mast);
      const rotor = new THREE.Group(); // ONE dominant main rotor (4 blades)
      rotor.name = 'rotorL';
      rotor.position.set(0.0, 2.7, 0);
      for (const a of [0, Math.PI / 2]) {
        const blade = box(0.18, 0.05, 5.2, dark);
        blade.rotation.y = a;
        rotor.add(blade);
      }
      g.add(rotor);
      break;
    }
    case 'aatrack': {
      // LANCE — a low tracked box with a raised twin-rail launcher and a dish
      const hull = box(2.6, 0.65, 1.7, body);
      hull.position.y = 0.62;
      g.add(hull);
      for (const side of [1, -1]) {
        const track = box(2.7, 0.45, 0.42, dark);
        track.position.set(0, 0.28, side * 0.9);
        g.add(track);
      }
      // the search dish — the tell that this thing owns the sky
      const dish = cyl(0.5, 0.5, 0.08, mat(0x9aa4b0, { metal: 0.5, rough: 0.4 }), 10);
      dish.position.set(-0.85, 1.15, 0);
      dish.rotation.z = 0.45;
      dish.name = 'spin';
      g.add(dish);
      const turret = new THREE.Group();
      turret.name = 'turret';
      turret.position.set(0.35, 1.0, 0);
      const base = box(0.8, 0.3, 0.9, bodyDark);
      turret.add(base);
      const gunR = new THREE.Group();
      gunR.name = 'gunRecoil';
      // twin rails, canted UP — a launcher that is obviously pointed at the sky
      for (const dz of [-0.3, 0.3]) {
        const rail = box(1.5, 0.14, 0.18, dark);
        rail.position.set(0.35, 0.3, dz);
        rail.rotation.z = 0.42;
        gunR.add(rail);
        const missile = cyl(0.1, 0.1, 1.2, mat(0xc8c2b4, { rough: 0.6 }), 7);
        missile.rotation.z = Math.PI / 2 + 0.42;
        missile.position.set(0.35, 0.42, dz);
        gunR.add(missile);
      }
      turret.add(gunR);
      g.add(turret);
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
    case 'attackheli': {
      const fuselage = box(3.8, 0.75, 1.15, body);
      fuselage.position.y = 1.45;
      g.add(fuselage);
      const canopy = box(1.25, 0.52, 0.92, mat(0x13252b, { rough: 0.2, metal: 0.65 }));
      canopy.position.set(1.35, 1.78, 0);
      canopy.rotation.z = -0.08;
      g.add(canopy);
      const tail = box(2.4, 0.24, 0.3, bodyDark);
      tail.position.set(-2.55, 1.58, 0);
      g.add(tail);
      const fin = box(0.5, 0.85, 0.1, bodyDark);
      fin.position.set(-3.55, 1.98, 0);
      g.add(fin);
      for (const side of [1, -1]) {
        const wing = box(1.2, 0.12, 0.75, bodyDark);
        wing.position.set(0.15, 1.4, side * 0.95);
        g.add(wing);
        const pod = cyl(0.17, 0.17, 1.05, dark, 8);
        pod.rotation.z = Math.PI / 2;
        pod.position.set(0.25, 1.28, side * 1.28);
        g.add(pod);
      }
      for (const [name, y, phase] of [['rotorL', 2.35, 0], ['rotorR', 2.5, Math.PI / 4]] as const) {
        const rotor = new THREE.Group();
        rotor.name = name;
        rotor.position.set(-0.35, y, 0);
        rotor.rotation.y = phase;
        rotor.add(box(0.16, 0.04, 4.7, dark), box(4.7, 0.04, 0.16, dark));
        g.add(rotor);
      }
      const chin = box(1.2, 0.14, 0.14, dark);
      chin.position.set(0.6, 0, 0);
      recoil.add(chin);
      turret.position.set(1.25, 1.05, 0);
      break;
    }
    case 'transportheli': {
      const cabin = box(5.8, 1.25, 2.2, body);
      cabin.position.y = 1.55;
      g.add(cabin);
      const cockpit = box(1.25, 0.9, 1.9, mat(0x14262c, { rough: 0.22, metal: 0.6 }));
      cockpit.position.set(2.55, 1.85, 0);
      g.add(cockpit);
      for (const side of [1, -1]) {
        const sponson = box(2.2, 0.35, 0.55, bodyDark);
        sponson.position.set(-0.35, 1.12, side * 1.35);
        g.add(sponson);
        const skid = box(4.8, 0.12, 0.12, dark);
        skid.position.set(-0.1, 0.72, side * 1.25);
        g.add(skid);
      }
      for (const [name, x] of [['rotorL', 1.7], ['rotorR', -1.75]] as const) {
        const mast = cyl(0.09, 0.09, 0.75, dark, 8);
        mast.position.set(x, 2.75, 0);
        g.add(mast);
        const rotor = new THREE.Group();
        rotor.name = name;
        rotor.position.set(x, 3.15, 0);
        rotor.add(box(0.16, 0.05, 4.4, dark), box(4.4, 0.05, 0.16, dark));
        g.add(rotor);
      }
      const doorGun = box(1.35, 0.13, 0.13, dark);
      doorGun.position.set(0.45, 0, 0);
      recoil.add(doorGun);
      turret.position.set(0.2, 1.7, -1.3);
      const stripe = box(5.82, 0.11, 0.22, glow);
      stripe.position.set(0, 1.72, 1.11);
      g.add(stripe);
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
// THE CIVILIAN MOTOR POOL (THREE-GAMES-ONE-WAR appendix): one grammar per
// domain, a spec row per kind — the armory's family-builder idea on wheels.
// Civilian paint (never faction trim, never purple), the same +X facing,
// wheels in userData.wheels so the renderer rolls them, rotors named
// 'rotorL' so the blur hook winds them. Every hull stays inside the
// visual.test size law (0.45–3.2× radius) and far under the tri budget.
// ---------------------------------------------------------------------------
type CivTell = 'lightbar' | 'taxisign' | 'ladder' | 'tank' | 'boxback' | 'mixer'
  | 'blade' | 'forks' | 'bed' | 'bins' | 'canopy' | 'boom' | 'dish';
interface CivGroundSpec {
  len: number; wid: number; paint: number; accent?: number;
  cab: 'front' | 'full' | 'long' | 'none' | 'twowheel';
  tells?: CivTell[];
}
const CIV_GROUND: Partial<Record<VehicleKind, CivGroundSpec>> = {
  sedan:        { len: 2.9, wid: 1.3, paint: 0x9aa0a6, cab: 'front' },
  pickup:       { len: 3.1, wid: 1.4, paint: 0x7a4a2a, cab: 'front', tells: ['bed'] },
  suv:          { len: 3.1, wid: 1.5, paint: 0x3a4a3a, cab: 'full' },
  sportscar:    { len: 2.8, wid: 1.3, paint: 0xc22b2b, cab: 'front' },
  taxi:         { len: 2.9, wid: 1.3, paint: 0xe8c020, accent: 0x24241f, cab: 'front', tells: ['taxisign'] },
  schoolbus:    { len: 4.6, wid: 1.7, paint: 0xe8a020, cab: 'long' },
  scooter:      { len: 1.5, wid: 0.5, paint: 0x2a8a8a, cab: 'twowheel' },
  atv:          { len: 1.9, wid: 1.1, paint: 0x4a6a2a, cab: 'none' },
  garbagetruck: { len: 4.2, wid: 1.8, paint: 0x4a7a4a, cab: 'front', tells: ['bins'] },
  towtruck:     { len: 3.6, wid: 1.5, paint: 0x8a6a2a, cab: 'front', tells: ['boom'] },
  firetruck:    { len: 4.6, wid: 1.8, paint: 0xb02020, accent: 0xe8e0d0, cab: 'front', tells: ['ladder', 'lightbar'] },
  fueltanker:   { len: 4.6, wid: 1.7, paint: 0xb8bcc0, accent: 0xb02020, cab: 'front', tells: ['tank'] },
  movingtruck:  { len: 4.0, wid: 1.7, paint: 0xd8d0c0, cab: 'front', tells: ['boxback'] },
  foodtruck:    { len: 3.6, wid: 1.7, paint: 0xd88a30, accent: 0xe8e0d0, cab: 'front', tells: ['boxback', 'canopy'] },
  deliveryvan:  { len: 3.5, wid: 1.5, paint: 0x8a5a20, cab: 'full', tells: ['boxback'] },
  policecruiser:{ len: 3.0, wid: 1.4, paint: 0x1e2126, accent: 0xe8e8e8, cab: 'front', tells: ['lightbar'] },
  loader:       { len: 3.4, wid: 1.7, paint: 0xd8a020, cab: 'none', tells: ['blade'] },
  forklift:     { len: 2.2, wid: 1.1, paint: 0xd8a020, cab: 'none', tells: ['forks'] },
  bulldozer:    { len: 3.8, wid: 1.9, paint: 0xd8a020, cab: 'none', tells: ['blade'] },
  cementmixer:  { len: 4.2, wid: 1.8, paint: 0xb8bcc0, accent: 0xd8a020, cab: 'front', tells: ['mixer'] },
  golfcart:     { len: 2.0, wid: 1.1, paint: 0xe8e8e0, cab: 'full', tells: ['canopy'] },
  bicycle:      { len: 1.4, wid: 0.35, paint: 0xb02020, cab: 'twowheel' },
};

interface CivAirSpec {
  fuselage: number; paint: number; accent?: number;
  wing?: 'high' | 'low' | 'none'; rotor?: boolean; envelope?: 'sphere' | 'cigar';
  tells?: CivTell[];
}
const CIV_AIR: Partial<Record<VehicleKind, CivAirSpec>> = {
  passengerjet: { fuselage: 7.6, paint: 0xe8ecf0, accent: 0x2a6ab0, wing: 'low' },
  privatejet:   { fuselage: 5.2, paint: 0xf0f0ea, accent: 0xc8a030, wing: 'low' },
  cargoplane:   { fuselage: 7.8, paint: 0x9aa0a0, wing: 'high' },
  bushplane:    { fuselage: 4.2, paint: 0xc03030, accent: 0xe8e0d0, wing: 'high' },
  cropduster:   { fuselage: 3.8, paint: 0xe8c020, wing: 'low' },
  newsheli:     { fuselage: 3.8, paint: 0xe8ecf0, accent: 0x2a6ab0, rotor: true, tells: ['dish'] },
  medheli:      { fuselage: 4.0, paint: 0xf0f0ea, accent: 0xb02020, rotor: true },
  policeheli:   { fuselage: 3.8, paint: 0x1e2126, accent: 0xe8e8e8, rotor: true, tells: ['lightbar'] },
  skycrane:     { fuselage: 6.4, paint: 0xd87020, rotor: true, tells: ['boom'] },
  balloon:      { fuselage: 1.6, paint: 0xc03030, accent: 0xe8c020, envelope: 'sphere' },
  blimp:        { fuselage: 8.6, paint: 0xb8bcc0, accent: 0x2a6ab0, envelope: 'cigar' },
  ultralight:   { fuselage: 2.6, paint: 0xe8e0d0, accent: 0x2a8a8a, wing: 'high' },
  paraglider:   { fuselage: 1.2, paint: 0x2a8a8a, wing: 'none' },
  hangglider:   { fuselage: 1.4, paint: 0xc03030, wing: 'none' },
};

interface CivWaterSpec {
  len: number; wid: number; paint: number; accent?: number;
  deck: 'cabin' | 'flat' | 'yacht' | 'bridge' | 'open' | 'dome';
  tells?: CivTell[];
}
const CIV_WATER: Partial<Record<VehicleKind, CivWaterSpec>> = {
  fishingboat:  { len: 3.4, wid: 1.5, paint: 0x3a5a7a, accent: 0xe8e0d0, deck: 'cabin', tells: ['boom'] },
  yacht:        { len: 5.6, wid: 2.0, paint: 0xf0f0ea, accent: 0x2a6ab0, deck: 'yacht' },
  speedboat:    { len: 3.4, wid: 1.4, paint: 0xc03030, accent: 0xe8e0d0, deck: 'open' },
  ferry:        { len: 6.6, wid: 2.8, paint: 0xe8ecf0, accent: 0x2a6ab0, deck: 'bridge' },
  cargoship:    { len: 9.0, wid: 3.2, paint: 0x7a4a3a, accent: 0x9aa0a0, deck: 'bridge', tells: ['bins'] },
  patrolboat:   { len: 4.0, wid: 1.7, paint: 0x2a3a4a, accent: 0xe8e8e8, deck: 'cabin', tells: ['lightbar'] },
  jetski:       { len: 1.7, wid: 0.7, paint: 0xe8c020, deck: 'open' },
  hovercraft:   { len: 4.4, wid: 2.4, paint: 0x9aa0a0, accent: 0xd87020, deck: 'cabin' },
  riverbarge:   { len: 6.4, wid: 2.6, paint: 0x6a5a3a, deck: 'flat' },
  submersible:  { len: 3.2, wid: 1.5, paint: 0xe8c020, accent: 0x2a3a4a, deck: 'dome' },
};

function buildCivilianVehicle(kind: VehicleKind): THREE.Group {
  const g = new THREE.Group();
  const wheels: THREE.Group[] = [];
  const dark = mat(0x24241f, { rough: 0.55, metal: 0.35 });
  const glass = mat(0x30404a, { rough: 0.25, metal: 0.55 });
  const addWheel = (x: number, z: number, r: number, w: number) => {
    const axle = new THREE.Group();
    axle.position.set(x, r, z);
    const tire = cyl(r, r, w, dark, 10);
    tire.rotation.x = Math.PI / 2;
    axle.add(tire);
    g.add(axle);
    wheels.push(axle);
  };

  const ground = CIV_GROUND[kind];
  const air = CIV_AIR[kind];
  const water = CIV_WATER[kind];
  if (ground) {
    const { len, wid, paint, accent, cab, tells = [] } = ground;
    const body = mat(paint, { rough: 0.5, metal: 0.3 });
    const trim = mat(accent ?? 0x55554a, { rough: 0.55, metal: 0.3 });
    if (cab === 'twowheel') {
      // scooter / bicycle: two wheels on the spine, a thin frame between
      const frame = box(len * 0.72, 0.09, 0.09, body);
      frame.position.y = 0.5;
      g.add(frame);
      const bars = box(0.08, 0.42, 0.42, dark);
      bars.position.set(len * 0.36, 0.72, 0);
      g.add(bars);
      const seat = box(0.34, 0.08, 0.22, dark);
      seat.position.set(-len * 0.2, 0.68, 0);
      g.add(seat);
      addWheel(len * 0.4, 0, 0.3, 0.1);
      addWheel(-len * 0.4, 0, 0.3, 0.1);
    } else {
      const deckY = 0.62;
      const chassis = box(len, 0.52, wid, body);
      chassis.position.y = deckY;
      g.add(chassis);
      if (cab === 'front') {          // hood + rear cab (a car's step profile)
        const cabin = box(len * 0.45, 0.42, wid * 0.86, kind === 'sportscar' ? glass : body);
        cabin.position.set(-len * 0.08, deckY + 0.45, 0);
        g.add(cabin);
        const shield = box(0.06, 0.34, wid * 0.8, glass);
        shield.position.set(len * 0.16, deckY + 0.42, 0);
        shield.rotation.z = 0.35;
        g.add(shield);
      } else if (cab === 'full' || cab === 'long') { // van / bus: one tall body
        const cabin = box(len * (cab === 'long' ? 0.94 : 0.8), 0.66, wid * 0.94, body);
        cabin.position.set(0, deckY + 0.56, 0);
        g.add(cabin);
        for (let i = 0; i < (cab === 'long' ? 4 : 2); i++) {
          const win = box(len * 0.16, 0.24, wid * 0.98, glass);
          win.position.set(len * 0.3 - i * len * 0.22, deckY + 0.66, 0);
          g.add(win);
        }
      } else {                        // plant machinery: open frame + roll cage
        const cage = box(len * 0.32, 0.6, wid * 0.7, trim);
        cage.position.set(-len * 0.1, deckY + 0.52, 0);
        g.add(cage);
      }
      const wr = Math.max(0.26, wid * 0.22);
      addWheel(len * 0.32, wid * 0.5, wr, 0.2);
      addWheel(len * 0.32, -wid * 0.5, wr, 0.2);
      addWheel(-len * 0.32, wid * 0.5, wr, 0.2);
      addWheel(-len * 0.32, -wid * 0.5, wr, 0.2);
      // the tells — one readable prop each, the silhouette's whole idea
      for (const t of tells) {
        if (t === 'taxisign') { const s = box(0.4, 0.18, 0.14, trim); s.position.set(-len * 0.08, deckY + 0.75, 0); g.add(s); }
        if (t === 'lightbar') { const s = box(0.16, 0.12, wid * 0.7, mat(0xc03030, { emissive: 0x902020 })); s.position.set(-len * 0.08, deckY + 0.74, 0); g.add(s); }
        if (t === 'bed') { const b = box(len * 0.4, 0.3, wid * 0.9, trim); b.position.set(-len * 0.28, deckY + 0.3, 0); g.add(b); }
        if (t === 'boxback') { const b = box(len * 0.55, 0.95, wid, trim); b.position.set(-len * 0.2, deckY + 0.6, 0); g.add(b); }
        if (t === 'bins') { const b = box(len * 0.5, 0.8, wid * 0.94, trim); b.position.set(-len * 0.22, deckY + 0.55, 0); g.add(b); }
        if (t === 'tank') { const c = cyl(wid * 0.42, wid * 0.42, len * 0.55, trim, 12); c.rotation.z = Math.PI / 2; c.position.set(-len * 0.18, deckY + 0.5, 0); g.add(c); }
        if (t === 'mixer') { const c = cyl(wid * 0.34, wid * 0.48, len * 0.42, trim, 10); c.rotation.z = Math.PI / 2 - 0.18; c.position.set(-len * 0.2, deckY + 0.62, 0); g.add(c); }
        if (t === 'ladder') { const l = box(len * 0.6, 0.08, 0.4, trim); l.position.set(-len * 0.12, deckY + 0.66, 0); g.add(l); }
        if (t === 'blade') { const b = box(0.16, 0.7, wid * 1.1, dark); b.position.set(len * 0.56, 0.5, 0); g.add(b); }
        if (t === 'forks') { for (const side of [1, -1]) { const f = box(len * 0.45, 0.07, 0.12, dark); f.position.set(len * 0.6, 0.12, side * wid * 0.22); g.add(f); } }
        if (t === 'boom') { const b = box(len * 0.42, 0.1, 0.1, trim); b.position.set(-len * 0.3, deckY + 0.72, 0); b.rotation.z = 0.5; g.add(b); }
        if (t === 'canopy') { const c = box(len * 0.5, 0.05, wid * 1.15, trim); c.position.set(len * 0.05, deckY + 0.95, 0); g.add(c); }
      }
    }
  } else if (air) {
    const { fuselage, paint, accent, wing, rotor, envelope, tells = [] } = air;
    const body = mat(paint, { rough: 0.45, metal: 0.35 });
    const trim = mat(accent ?? 0x55554a, { rough: 0.5, metal: 0.3 });
    if (envelope) {
      // lighter-than-air: the bag IS the ship, a basket/gondola hangs low
      const bag = envelope === 'sphere'
        ? new THREE.Mesh(new THREE.SphereGeometry(fuselage, 14, 10), body)
        : cyl(fuselage * 0.17, fuselage * 0.17, fuselage, body, 12);
      if (envelope === 'cigar') { bag.rotation.z = Math.PI / 2; }
      bag.position.y = envelope === 'sphere' ? fuselage + 1.4 : 2.2;
      g.add(bag);
      if (envelope === 'sphere') { const band = cyl(fuselage * 1.01, fuselage * 1.01, 0.5, trim, 14); band.position.y = fuselage + 1.4; g.add(band); }
      const gondola = box(envelope === 'cigar' ? fuselage * 0.22 : 1.1, 0.6, 0.9, trim);
      gondola.position.y = envelope === 'cigar' ? 1.2 : 0.5;
      g.add(gondola);
      if (envelope === 'cigar') { for (const side of [1, -1]) { const fin = box(1.2, 0.1, 1.0, trim); fin.position.set(-fuselage * 0.48, 2.2, side * 0.5); g.add(fin); } }
    } else if (wing === 'none') {
      // the gliders: a canopy arc + a hanging pilot frame
      const canopy = cyl(0.16, 0.16, fuselage * 2.4, body, 8);
      canopy.rotation.x = Math.PI / 2;
      canopy.position.y = 1.9;
      canopy.scale.y = 0.4;
      g.add(canopy);
      const frame = box(fuselage * 0.8, 0.08, 0.08, dark);
      frame.position.y = 1.1;
      g.add(frame);
      for (const side of [1, -1]) {
        const line = box(0.04, 0.9, 0.04, dark);
        line.position.set(0, 1.5, side * fuselage * 0.7);
        line.rotation.x = side * 0.5;
        g.add(line);
      }
    } else {
      const tube = cyl(fuselage * 0.09, fuselage * 0.11, fuselage, body, 10);
      tube.rotation.z = Math.PI / 2;
      tube.position.y = 1.1;
      g.add(tube);
      const nose = cyl(0.02, fuselage * 0.09, fuselage * 0.16, trim, 10);
      nose.rotation.z = -Math.PI / 2;
      nose.position.set(fuselage * 0.57, 1.1, 0);
      g.add(nose);
      const tail = box(fuselage * 0.14, fuselage * 0.13, 0.08, body);
      tail.position.set(-fuselage * 0.46, 1.1 + fuselage * 0.07, 0);
      g.add(tail);
      if (rotor) {
        const mast = cyl(0.07, 0.07, 0.4, dark, 8);
        mast.position.set(0, 1.6, 0);
        g.add(mast);
        const rotorGrp = new THREE.Group();
        rotorGrp.name = 'rotorL';
        rotorGrp.position.set(0, 1.85, 0);
        rotorGrp.add(box(fuselage * 0.95, 0.05, 0.16, dark), box(0.16, 0.05, fuselage * 0.95, dark));
        g.add(rotorGrp);
        const skids = box(fuselage * 0.5, 0.06, 0.1, dark);
        for (const side of [1, -1]) { const s = skids.clone(); s.position.set(0, 0.25, side * 0.5); g.add(s); }
      } else {
        const wy = wing === 'high' ? 1.45 : 0.85;
        const wings = box(fuselage * 0.24, 0.07, fuselage * 0.95, body);
        wings.position.set(fuselage * 0.06, wy, 0);
        g.add(wings);
        const hstab = box(fuselage * 0.1, 0.05, fuselage * 0.3, body);
        hstab.position.set(-fuselage * 0.44, 1.15, 0);
        g.add(hstab);
        const prop = cyl(0.05, 0.05, 0.5, dark, 6);
        prop.rotation.x = Math.PI / 2;
        prop.position.set(fuselage * 0.6, 1.1, 0);
        g.add(prop);
        addWheel(fuselage * 0.2, fuselage * 0.14, 0.16, 0.1);
        addWheel(fuselage * 0.2, -fuselage * 0.14, 0.16, 0.1);
      }
      for (const t of tells) {
        if (t === 'dish') { const d = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), trim); d.position.set(fuselage * 0.3, 0.62, 0); g.add(d); }
        if (t === 'lightbar') { const s = box(0.14, 0.1, 0.6, mat(0xc03030, { emissive: 0x902020 })); s.position.set(0, 1.72, 0); g.add(s); }
        if (t === 'boom') { const b = box(fuselage * 0.7, 0.12, 0.12, trim); b.position.set(0, 0.55, 0); g.add(b); const hook = box(0.1, 0.4, 0.1, dark); hook.position.set(0, 0.25, 0); g.add(hook); }
      }
    }
  } else if (water) {
    const { len, wid, paint, accent, deck, tells = [] } = water;
    const body = mat(paint, { rough: 0.55, metal: 0.25 });
    const trim = mat(accent ?? 0xe8e0d0, { rough: 0.5, metal: 0.2 });
    const hull = box(len, 0.6, wid, body);
    hull.position.y = 0.5;
    g.add(hull);
    const bow = cyl(0.03, wid * 0.5, len * 0.18, body, 4);
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.x = Math.PI / 4;
    bow.position.set(len * 0.58, 0.5, 0);
    g.add(bow);
    if (deck === 'cabin') { const c = box(len * 0.3, 0.55, wid * 0.72, trim); c.position.set(-len * 0.08, 1.05, 0); g.add(c); }
    if (deck === 'yacht') {
      const lower = box(len * 0.55, 0.42, wid * 0.8, trim);
      lower.position.set(-len * 0.05, 1.0, 0);
      g.add(lower);
      const upper = box(len * 0.3, 0.36, wid * 0.6, body);
      upper.position.set(-len * 0.12, 1.4, 0);
      g.add(upper);
    }
    if (deck === 'bridge') { const b = box(len * 0.16, 1.0, wid * 0.8, trim); b.position.set(-len * 0.36, 1.3, 0); g.add(b); }
    if (deck === 'dome') { const d = new THREE.Mesh(new THREE.SphereGeometry(wid * 0.42, 12, 8), mat(0x30404a, { rough: 0.25, metal: 0.5 })); d.position.set(len * 0.1, 1.0, 0); g.add(d); }
    if (deck === 'open') { const shield = box(0.06, 0.3, wid * 0.6, mat(0x30404a, { rough: 0.3, metal: 0.5 })); shield.position.set(len * 0.2, 0.95, 0); shield.rotation.z = 0.4; g.add(shield); }
    for (const t of tells) {
      if (t === 'boom') { const m = cyl(0.05, 0.05, 1.6, dark, 6); m.position.set(-len * 0.05, 1.6, 0); g.add(m); const arm = box(len * 0.3, 0.06, 0.06, dark); arm.position.set(-len * 0.18, 2.1, 0); arm.rotation.z = 0.45; g.add(arm); }
      if (t === 'bins') { for (let i = 0; i < 3; i++) { const c = box(len * 0.18, 0.55, wid * 0.7, mat([0xb02020, 0x2a6ab0, 0x4a7a4a][i], { rough: 0.6 })); c.position.set(len * 0.28 - i * len * 0.22, 1.1, 0); g.add(c); } }
      if (t === 'lightbar') { const s = box(0.14, 0.1, wid * 0.5, mat(0xc03030, { emissive: 0x902020 })); s.position.set(-len * 0.08, 1.68, 0); g.add(s); }
    }
  }
  g.userData.wheels = wheels;
  return g;
}

// ---------------------------------------------------------------------------
// Sci-fi gadgets
// ---------------------------------------------------------------------------

