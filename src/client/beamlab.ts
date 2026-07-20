// ---------------------------------------------------------------------------
// THE BEAM LAB (/beams.html) — Robert: "we still don't have that continuous
// beam… like a water hose almost, but it's energy making sparks… the
// flamethrower should be continuous… think Goku's Kamehameha… Superman's
// heat vision. I need to see all of it inside of a harness."
//
// Four continuous weapons, all tracking the mouse on the ground:
//   HOSE   — an energy stream with LAG: sweep the mouse and the beam whips
//            behind it like water under pressure, sparking where it lands
//   KAME   — the Kamehameha: a charge orb that gathers, then a thick
//            two-shell beam with a pulsing core and a blast point that
//            scorches the ground
//   HEAT   — heat vision: two thin instant lines from the EYES, converging,
//            leaving a burn trail wherever you drag them
//   FLAMER — the continuous stream the gun should have: a cone of fire
//            particles that ride the aim, lick the ground, and smoke out
//
// Mouse moves the target. Leave the mouse alone two seconds and the bench
// sweeps itself so the page is alive the moment it opens.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type BeamMode = 'hose' | 'kame' | 'heat' | 'flamer';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x232a31); // dusk — beams own the frame

const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.5, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x8fa0b4, 0x3a382f, 0.55));
const moon = new THREE.DirectionalLight(0xcfd8e6, 0.4);
moon.position.set(20, 40, 12);
moon.castShadow = true;
scene.add(moon);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 100),
  new THREE.MeshStandardMaterial({ color: 0x3d4438, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(160, 40, 0x4a5248, 0x46504a);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.35;
grid.position.y = 0.02;
scene.add(grid);

const M = (c: number, rough = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });

// ---------------------------------------------------------------------------
// THE SHOOTER — a papercraft stand-in aimed by yawing the whole body
// ---------------------------------------------------------------------------
const shooter = new THREE.Group();
{
  const box = (w: number, h: number, d: number, c: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
    m.castShadow = true;
    return m;
  };
  const torso = box(0.36, 0.52, 0.46, 0x687a34); torso.position.y = 1.22; shooter.add(torso);
  const head = box(0.3, 0.3, 0.3, 0xc9835f); head.position.y = 1.68; shooter.add(head);
  const belt = box(0.38, 0.07, 0.48, 0x24262a); belt.position.y = 0.94; shooter.add(belt);
  for (const dz of [-0.14, 0.14]) {
    const leg = box(0.17, 0.68, 0.19, 0x5c4a30); leg.position.set(0, 0.58, dz); shooter.add(leg);
    const boot = box(0.26, 0.12, 0.13, 0x24262a); boot.position.set(0.06, 0.06, dz); shooter.add(boot);
  }
  for (const dz of [-0.26, 0.26]) {
    const arm = box(0.12, 0.26, 0.13, 0x687a34);
    arm.position.set(0.28, 1.3, dz * 0.8);
    arm.rotation.z = -1.2;
    shooter.add(arm);
  }
}
scene.add(shooter);

/** where beams leave the body */
const MUZZLE_Y = 1.26;
const EYES_Y = 1.7;

camera.position.set(-6, 7.5, 12);
camera.lookAt(4, 1, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(4, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;

// ---------------------------------------------------------------------------
// TARGET — the mouse on the ground, or the autopilot's slow figure-eight
// ---------------------------------------------------------------------------
const target = new THREE.Vector3(8, 0.3, 0);
const mouseNDC = new THREE.Vector2();
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
let lastMouseMove = 0;
let aimLocked = false; // __beams.aim() pins the target — autopilot keeps its hands off
renderer.domElement.addEventListener('pointermove', (e) => {
  mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouseNDC, camera);
  const p = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, p)) {
    target.copy(p);
    lastMouseMove = performance.now();
    aimLocked = false;
  }
});

// the impact marker — a faint ring that says "this is where you're pointing"
const aimRing = new THREE.Mesh(
  new THREE.RingGeometry(0.32, 0.4, 24),
  new THREE.MeshBasicMaterial({ color: 0xd8e0ea, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
);
aimRing.rotation.x = -Math.PI / 2;
scene.add(aimRing);

// ---------------------------------------------------------------------------
// SPARKS — one pool serves every mode
// ---------------------------------------------------------------------------
const SPARKS = 90;
const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
const sparks: { m: THREE.Mesh; vel: THREE.Vector3; life: number; max: number }[] = [];
for (let i = 0; i < SPARKS; i++) {
  const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({
    color: 0xffd890, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(m);
  sparks.push({ m, vel: new THREE.Vector3(), life: 0, max: 0.4 });
}
let sparkCursor = 0;
function spark(at: THREE.Vector3, color: number, speed = 4, up = 2.5) {
  const s = sparks[sparkCursor];
  sparkCursor = (sparkCursor + 1) % SPARKS;
  s.m.position.copy(at);
  (s.m.material as THREE.MeshBasicMaterial).color.setHex(color);
  const a = Math.random() * Math.PI * 2;
  s.vel.set(Math.cos(a) * speed * Math.random(), up * (0.4 + Math.random()), Math.sin(a) * speed * Math.random());
  s.life = s.max = 0.25 + Math.random() * 0.3;
}

// ---------------------------------------------------------------------------
// SCORCH — the ground remembers where the beam has been (heat vision's trail,
// the kamehameha's blast ring)
// ---------------------------------------------------------------------------
const SCORCH = 40;
const scorches: { m: THREE.Mesh; life: number; max: number }[] = [];
const scorchGeo = new THREE.CircleGeometry(0.32, 12);
for (let i = 0; i < SCORCH; i++) {
  const m = new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({
    color: 0x14100c, transparent: true, opacity: 0, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  scene.add(m);
  scorches.push({ m, life: 0, max: 6 });
}
let scorchCursor = 0;
const lastScorchAt = new THREE.Vector3(1e9, 0, 1e9);
function scorch(at: THREE.Vector3, scale = 1) {
  if (at.distanceTo(lastScorchAt) < 0.3 * scale) return; // don't stack on one spot
  lastScorchAt.copy(at);
  const s = scorches[scorchCursor];
  scorchCursor = (scorchCursor + 1) % SCORCH;
  s.m.position.set(at.x, 0.03 + scorchCursor * 0.0004, at.z); // micro y-offsets kill z-fighting
  s.m.scale.setScalar(scale * (0.8 + Math.random() * 0.4));
  s.life = s.max = 6;
}

// ---------------------------------------------------------------------------
// MODE: HOSE — the lagging energy stream
// ---------------------------------------------------------------------------
const HOSE_N = 22;
const hosePts: THREE.Vector3[] = [];
for (let i = 0; i < HOSE_N; i++) hosePts.push(new THREE.Vector3());
const hoseTip = new THREE.Vector3(8, 0.3, 0);
const hoseVel = new THREE.Vector3();
let hoseMesh: THREE.Mesh | null = null;
let hoseCore: THREE.Mesh | null = null;
const hoseMat = new THREE.MeshBasicMaterial({ color: 0x54c8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
const hoseCoreMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const hoseGlow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8ad8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(hoseGlow);

function stepHose(dt: number, muzzle: THREE.Vector3, t: number) {
  // the TIP chases the target on a spring — this is the water-hose whip
  hoseVel.addScaledVector(new THREE.Vector3().subVectors(target, hoseTip), dt * 26);
  hoseVel.multiplyScalar(Math.exp(-dt * 6));
  hoseTip.addScaledVector(hoseVel, dt);
  // the chain relaxes toward the muzzle→tip line, tail lagging hardest
  hosePts[0].copy(muzzle);
  for (let i = 1; i < HOSE_N; i++) {
    const k = i / (HOSE_N - 1);
    const desired = new THREE.Vector3().lerpVectors(muzzle, hoseTip, k);
    // pressure wobble rides the stream
    const wob = Math.sin(t * 18 - i * 0.9) * 0.06 * Math.sin(k * Math.PI);
    desired.y += wob;
    hosePts[i].lerp(desired, 1 - Math.pow(0.0001, dt * (1.6 - k)));
  }
  // rebuild the tube (two shells: glow + core)
  if (hoseMesh) { hoseMesh.geometry.dispose(); scene.remove(hoseMesh); }
  if (hoseCore) { hoseCore.geometry.dispose(); scene.remove(hoseCore); }
  const curve = new THREE.CatmullRomCurve3(hosePts);
  hoseMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.14, 7, false), hoseMat);
  hoseCore = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.055, 6, false), hoseCoreMat);
  scene.add(hoseMesh, hoseCore);
  // the landing point sparks and glows
  const tip = hosePts[HOSE_N - 1];
  hoseGlow.position.copy(tip);
  (hoseGlow.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 40) * 0.15;
  for (let i = 0; i < 2; i++) spark(tip, 0x8ad8ff, 5, 3);
}
function hideHose() {
  if (hoseMesh) { hoseMesh.geometry.dispose(); scene.remove(hoseMesh); hoseMesh = null; }
  if (hoseCore) { hoseCore.geometry.dispose(); scene.remove(hoseCore); hoseCore = null; }
  (hoseGlow.material as THREE.MeshBasicMaterial).opacity = 0;
}

// ---------------------------------------------------------------------------
// MODE: KAMEHAMEHA — charge, then the thick beam
// ---------------------------------------------------------------------------
let kameT = 0; // seconds in mode; charge completes at CHARGE
const KAME_CHARGE = 1.15;
const kameTarget = new THREE.Vector3(8, 0.3, 0);
const kameOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(kameOrb);
const kameCore = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
const kameShell = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x54a8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
// beams keep the cylinder's native Y axis; a quaternion points it (the
// lookAt+rotate dance shipped a beam pointing at the SKY — never again)
const kameBeam = new THREE.Group();
kameBeam.add(kameCore, kameShell);
scene.add(kameBeam);
const kameBlast = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(kameBlast);

function stepKame(dt: number, muzzle: THREE.Vector3, t: number) {
  kameT += dt;
  const charging = kameT < KAME_CHARGE;
  if (charging) {
    const k = kameT / KAME_CHARGE;
    kameOrb.position.copy(muzzle).add(new THREE.Vector3(Math.cos(shooter.rotation.y) * 0.7, 0, Math.sin(-shooter.rotation.y) * 0.7));
    kameOrb.scale.setScalar(0.1 + k * 0.5 + Math.sin(t * 30) * 0.03);
    (kameOrb.material as THREE.MeshBasicMaterial).opacity = 0.35 + k * 0.5;
    // energy gathers IN — sparks with reversed intent
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const from = kameOrb.position.clone().add(new THREE.Vector3(Math.cos(a) * 1.6, (Math.random() - 0.4) * 1.4, Math.sin(a) * 1.6));
      const s = sparks[sparkCursor];
      sparkCursor = (sparkCursor + 1) % SPARKS;
      s.m.position.copy(from);
      (s.m.material as THREE.MeshBasicMaterial).color.setHex(0xbfe8ff);
      s.vel.subVectors(kameOrb.position, from).multiplyScalar(3.2);
      s.life = s.max = 0.3;
    }
    (kameCore.material as THREE.MeshBasicMaterial).opacity = 0;
    (kameShell.material as THREE.MeshBasicMaterial).opacity = 0;
    (kameBlast.material as THREE.MeshBasicMaterial).opacity = 0;
    return;
  }
  // FIRING — a heavy beam that tracks the mouse SLOWLY (mass has opinions)
  (kameOrb.material as THREE.MeshBasicMaterial).opacity = 0;
  kameTarget.lerp(target, 1 - Math.exp(-dt * 2.2));
  const from = muzzle;
  const dir = new THREE.Vector3().subVectors(kameTarget, from);
  const len = dir.length();
  dir.normalize();
  const mid = new THREE.Vector3().addVectors(from, kameTarget).multiplyScalar(0.5);
  kameBeam.position.copy(mid);
  kameBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const pulse = 1 + Math.sin(t * 26) * 0.08;
  kameCore.scale.set(0.34 * pulse, len, 0.34 * pulse);
  kameShell.scale.set(0.62 * pulse, len, 0.62 * pulse);
  (kameCore.material as THREE.MeshBasicMaterial).opacity = 0.95;
  (kameShell.material as THREE.MeshBasicMaterial).opacity = 0.4;
  kameBlast.position.copy(kameTarget);
  kameBlast.scale.setScalar(0.9 + Math.sin(t * 32) * 0.18);
  (kameBlast.material as THREE.MeshBasicMaterial).opacity = 0.75;
  for (let i = 0; i < 3; i++) spark(kameTarget, 0xbfe8ff, 7, 5);
  scorch(new THREE.Vector3(kameTarget.x, 0, kameTarget.z), 2.2);
}
function hideKame() {
  (kameOrb.material as THREE.MeshBasicMaterial).opacity = 0;
  (kameCore.material as THREE.MeshBasicMaterial).opacity = 0;
  (kameShell.material as THREE.MeshBasicMaterial).opacity = 0;
  (kameBlast.material as THREE.MeshBasicMaterial).opacity = 0;
  kameT = 0;
}

// ---------------------------------------------------------------------------
// MODE: HEAT VISION — two thin instant lines from the eyes
// ---------------------------------------------------------------------------
const heatBeams: THREE.Mesh[] = [];
const heatCores: THREE.Mesh[] = [];
for (let i = 0; i < 2; i++) {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3d2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const g = new THREE.Group();
  g.add(b);
  scene.add(g);
  heatBeams.push(b);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd8c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const g2 = new THREE.Group();
  g2.add(c);
  scene.add(g2);
  heatCores.push(c);
}
const UP = new THREE.Vector3(0, 1, 0);
function placeBeam(m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, r: number) {
  const g = m.parent!;
  g.position.addVectors(from, to).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = Math.max(0.01, dir.length());
  g.quaternion.setFromUnitVectors(UP, dir.normalize());
  m.scale.set(r, len, r);
}
function stepHeat(dt: number, t: number) {
  for (let i = 0; i < 2; i++) {
    const eye = new THREE.Vector3(
      shooter.position.x + Math.cos(shooter.rotation.y) * 0.16 - Math.sin(shooter.rotation.y) * (i === 0 ? -0.07 : 0.07),
      EYES_Y,
      shooter.position.z - Math.sin(shooter.rotation.y) * 0.16 - Math.cos(shooter.rotation.y) * (i === 0 ? -0.07 : 0.07),
    );
    placeBeam(heatBeams[i], eye, target, 0.045 + Math.sin(t * 60 + i) * 0.008);
    placeBeam(heatCores[i], eye, target, 0.018);
    (heatBeams[i].material as THREE.MeshBasicMaterial).opacity = 0.8;
    (heatCores[i].material as THREE.MeshBasicMaterial).opacity = 0.95;
  }
  spark(target, 0xff8a5c, 3.5, 2.4);
  if (Math.random() < 0.6) spark(target, 0x2c2620, 1.2, 1.6); // smoke chips
  scorch(new THREE.Vector3(target.x, 0, target.z), 0.9); // THE TRAIL — drag it and the ground remembers
}
function hideHeat() {
  for (const b of heatBeams) (b.material as THREE.MeshBasicMaterial).opacity = 0;
  for (const c of heatCores) (c.material as THREE.MeshBasicMaterial).opacity = 0;
}

// ---------------------------------------------------------------------------
// MODE: FLAMER — the continuous stream (not the repeated puffs the gun has)
// ---------------------------------------------------------------------------
// pool sized so a particle DIES before the cursor laps it — 12-per-frame into
// 260 recycled mid-flight at 60fps (and at 144Hz collapsed the whole stream
// into a blob at the muzzle: higher fps = faster laps = shorter flames)
const FLAME_N = 640;
const flamePos = new Float32Array(FLAME_N * 3);
const flameCol = new Float32Array(FLAME_N * 3);
const flameVel: THREE.Vector3[] = [];
const flameLife = new Float32Array(FLAME_N);
const flameMax = new Float32Array(FLAME_N);
for (let i = 0; i < FLAME_N; i++) { flameVel.push(new THREE.Vector3()); flamePos[i * 3 + 1] = -100; }
const flameGeo = new THREE.BufferGeometry();
flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
flameGeo.setAttribute('color', new THREE.BufferAttribute(flameCol, 3));
const flamePoints = new THREE.Points(flameGeo, new THREE.PointsMaterial({
  size: 0.55, vertexColors: true, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
}));
flamePoints.frustumCulled = false;
scene.add(flamePoints);
let flameCursor = 0;
const flameAim = new THREE.Vector3(8, 0.3, 0);

function stepFlamer(dt: number, muzzle: THREE.Vector3) {
  // the stream follows the mouse fast but not instantly — hose momentum
  flameAim.lerp(target, 1 - Math.exp(-dt * 9));
  const dir = new THREE.Vector3().subVectors(flameAim, muzzle).normalize();
  const emit = Math.max(1, Math.round(700 * dt)); // per SECOND, not per frame
  for (let n = 0; n < emit; n++) {
    const i = flameCursor;
    flameCursor = (flameCursor + 1) % FLAME_N;
    flamePos[i * 3] = muzzle.x + dir.x * 0.5;
    flamePos[i * 3 + 1] = muzzle.y + (Math.random() - 0.5) * 0.1;
    flamePos[i * 3 + 2] = muzzle.z + dir.z * 0.5;
    const spread = 0.14;
    flameVel[i].set(
      dir.x * (11 + Math.random() * 4) + (Math.random() - 0.5) * spread * 8,
      dir.y * 8 + (Math.random() - 0.5) * 1.2,
      dir.z * (11 + Math.random() * 4) + (Math.random() - 0.5) * spread * 8,
    );
    flameLife[i] = flameMax[i] = 0.5 + Math.random() * 0.25;
  }
  for (let i = 0; i < FLAME_N; i++) {
    if (flameLife[i] <= 0) continue;
    flameLife[i] -= dt;
    if (flameLife[i] <= 0) { flamePos[i * 3 + 1] = -100; continue; }
    const k = 1 - flameLife[i] / flameMax[i]; // 0 young → 1 old
    flameVel[i].multiplyScalar(Math.exp(-dt * 2.6)); // drag
    flameVel[i].y += (k > 0.45 ? 3.2 : -0.6) * dt;   // young flame droops, old flame RISES
    flamePos[i * 3] += flameVel[i].x * dt;
    flamePos[i * 3 + 1] += flameVel[i].y * dt;
    flamePos[i * 3 + 2] += flameVel[i].z * dt;
    if (flamePos[i * 3 + 1] < 0.12) { // the ground lick
      flamePos[i * 3 + 1] = 0.12;
      flameVel[i].y = Math.abs(flameVel[i].y) * 0.15;
    }
    // colour ride: white-yellow → orange → ember → smoke
    const r = k < 0.25 ? 1 : k < 0.6 ? 1 : 0.35;
    const g = k < 0.25 ? 0.85 : k < 0.6 ? 0.42 : 0.3;
    const b = k < 0.25 ? 0.5 : k < 0.6 ? 0.1 : 0.28;
    const fade = 1 - k * 0.6;
    flameCol[i * 3] = r * fade;
    flameCol[i * 3 + 1] = g * fade;
    flameCol[i * 3 + 2] = b * fade;
  }
  flameGeo.attributes.position.needsUpdate = true;
  flameGeo.attributes.color.needsUpdate = true;
  if (Math.random() < 0.5) scorch(new THREE.Vector3(flameAim.x, 0, flameAim.z), 1.1);
}
function hideFlamer() {
  for (let i = 0; i < FLAME_N; i++) { flameLife[i] = 0; flamePos[i * 3 + 1] = -100; }
  flameGeo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// THE LOOP
// ---------------------------------------------------------------------------
let mode: BeamMode = 'hose';
function setMode(m: BeamMode) {
  mode = m;
  hideHose(); hideKame(); hideHeat(); hideFlamer();
  kameTarget.copy(target); // the beam opens pointed where you point, not at a stale spot
  for (const b of document.querySelectorAll('.mode')) b.classList.toggle('on', (b as HTMLElement).dataset.m === m);
}
for (const btn of document.querySelectorAll<HTMLElement>('.mode')) {
  btn.addEventListener('click', () => setMode(btn.dataset.m as BeamMode));
}

let frames = 0;
let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  frames++;
  controls.update();

  // autopilot: an untouched mouse sweeps a lazy figure-eight
  if (!aimLocked && now - lastMouseMove > 2000) {
    target.set(8 + Math.sin(t * 0.7) * 5.5, 0.3, Math.sin(t * 1.16) * 4.5);
  }
  aimRing.position.set(target.x, 0.04, target.z);

  // the shooter faces the work
  shooter.rotation.y = -Math.atan2(target.z - shooter.position.z, target.x - shooter.position.x);
  const muzzle = new THREE.Vector3(
    shooter.position.x + Math.cos(shooter.rotation.y) * 0.55,
    MUZZLE_Y,
    shooter.position.z - Math.sin(shooter.rotation.y) * 0.55,
  );

  if (mode === 'hose') stepHose(dt, muzzle, t);
  else if (mode === 'kame') stepKame(dt, muzzle, t);
  else if (mode === 'heat') stepHeat(dt, t);
  else stepFlamer(dt, muzzle);

  // sparks decay
  for (const s of sparks) {
    if (s.life <= 0) continue;
    s.life -= dt;
    s.vel.y -= 7 * dt;
    s.m.position.addScaledVector(s.vel, dt);
    (s.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / s.max);
    if (s.life <= 0) (s.m.material as THREE.MeshBasicMaterial).opacity = 0;
  }
  // scorch fades
  for (const s of scorches) {
    if (s.life <= 0) continue;
    s.life -= dt;
    (s.m.material as THREE.MeshBasicMaterial).opacity = Math.min(0.55, (s.life / s.max) * 0.7);
    if (s.life <= 0) (s.m.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
setMode('hose');
loop();

interface BeamHandle {
  frames: () => number;
  mode: (m: BeamMode) => void;
  /** deterministic capture: park the target and (for kame) skip the charge */
  aim: (x: number, z: number) => void;
  skipCharge: () => void;
}
(window as unknown as { __beams: BeamHandle }).__beams = {
  frames: () => frames,
  mode: setMode,
  aim: (x, z) => { target.set(x, 0.3, z); lastMouseMove = performance.now(); aimLocked = true; },
  skipCharge: () => { kameT = KAME_CHARGE + 0.1; },
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
