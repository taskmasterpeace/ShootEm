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
import { buildSoldier } from './models/soldiers';

type ActionId = 'run' | 'dash' | 'slash' | 'fly';
type GunId = 'rifle' | 'shotgun';

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

function capsuleRig(label: string, shapes: 1 | 4 | 12): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // THE PILL. One capsule IS the soldier. Radius/length tuned so the whole
  // body stands ~1.7u — same read as a trooper at command zoom.
  const capGeo = new THREE.CapsuleGeometry(0.42, 0.72, 6, 12);
  const cap = new THREE.Mesh(capGeo, M(TEAM));
  cap.castShadow = true;
  cap.position.y = 0.86;
  body.add(cap);

  const gun = new THREE.Group();
  gun.add(makeRifle());
  // THE GUN ON THE RIGHT SIDE — hip height, slightly toed forward
  gun.position.set(0.18, 0.78, 0.5);
  gun.rotation.y = -0.06;
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
    const mittR = new THREE.Mesh(mittGeo, M(0xd8cdb4));
    mittR.position.set(0.2, 0.86, 0.62); mittR.castShadow = true;
    const mittL = new THREE.Mesh(mittGeo, M(0xd8cdb4));
    mittL.position.set(0.1, 0.9, -0.6); mittL.castShadow = true;
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
// THE LINEUP
// ---------------------------------------------------------------------------
const PITCH = 6.5;
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

// baseline: the current soldier, as shipped
const current = buildSoldier(0, 'infantry', 'bot');
current.position.set(-1.5 * PITCH, 0, 0);
current.rotation.y = Math.PI / 2; // face +Z so the lineup reads in profile
scene.add(current);
addLabel('CURRENT (baseline)', -1.5 * PITCH);

const specs: [string, 1 | 4 | 12][] = [['PILL — 1 shape', 1], ['PILL — 4 shapes', 4], ['PILL — 12 shapes', 12]];
specs.forEach(([label, n], i) => {
  const rig = capsuleRig(label, n);
  rig.root.position.set((i - 0.5) * PITCH, 0, 0);
  scene.add(rig.root);
  rigs.push(rig);
  addLabel(label, (i - 0.5) * PITCH);
});

camera.position.set(0, 7.2, 21);
camera.lookAt(0, 1.2, 0);

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

function setGun(kind: GunId) {
  gunKind = kind;
  for (const r of rigs) {
    r.gun.clear();
    r.gun.add(kind === 'rifle' ? makeRifle() : makeShotgun());
  }
  document.getElementById('btn-gun')!.textContent = `GUN: ${kind.toUpperCase()}`;
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

  for (const r of rigs) {
    const b = r.body;
    // rest pose every frame; actions layer on top
    b.position.set(0, 0, 0);
    b.rotation.set(0, 0, 0);
    b.scale.set(1, 1, 1);
    r.gun.position.copy(r.gunHome.pos);
    r.gun.rotation.copy(r.gunHome.rot);
    r.blade.visible = false;
    if (r.jet) (r.jet.material as THREE.MeshBasicMaterial).opacity = 0;
    for (const g of r.ghosts) (g.material as THREE.MeshBasicMaterial).opacity = 0;

    if (action === 'run') {
      // THE BOP — |sin| bounce, forward lean, a breath of roll. The whole ask.
      const phase = t * 9 + r.root.position.x;
      b.position.y = Math.abs(Math.sin(phase)) * 0.16;
      b.rotation.z = -0.16;                      // lean INTO the run (travel = +X, the profile read)
      b.rotation.x = Math.sin(phase) * 0.055;    // the waddle that sells weight
      if (r.mittR) {
        r.mittR.position.x = 0.2 + Math.sin(phase) * 0.12;       // gun hand rides near the grip
        r.mittL!.position.x = 0.1 - Math.sin(phase) * 0.26;      // off hand pumps the stride
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
      if (actionT > 2.2 && !frozen) play('run');
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
document.getElementById('btn-gun')!.addEventListener('click', () => setGun(gunKind === 'rifle' ? 'shotgun' : 'rifle'));
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
