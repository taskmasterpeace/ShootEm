// ---------------------------------------------------------------------------
// VANESSA'S PAINTBALL (/vanessas.html) — the pro shop, walkable by camera.
// Robert (2026-07-22): "you go to a paintball store. Call it Vanessa's
// paintball… you could choose your gun. Or rent a gun… go to the different
// booths — you should be able to see it."
//
// The stock is REAL: every booth shows the arsenal's actual marker model
// (buildWeaponModel — hopper and all) over live stats read from WEAPONS.
// TAKE writes st.marker through the same onboarding store the yard deploys
// from (paintballConfig reads it) — the shop is wired, not a mock.
// Vanessa runs the counter: the game's own soldier body, the game's own
// idle gait, and a word for every booth you stop at.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { poseSoldierJoints, type GaitState, type Joints } from './animation';
import { buildSoldier } from './models/soldiers';
import { buildWeaponModel } from './models/weapons';
import { loadOnboarding, saveOnboarding } from './onboarding';
import { STOCK, boothStats } from './vanessas-stock';

// ---------------------------------------------------------------------------
// SCENE — a warm little shop, not a warehouse
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14120e);
scene.fog = new THREE.Fog(0x14120e, 16, 34);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd8cfc0, 0x2a251c, 1.0));
const key = new THREE.DirectionalLight(0xffe2b8, 1.1);
key.position.set(6, 9, 3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -9; key.shadow.camera.right = 9;
key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
scene.add(key);

function mat(color: number, o: { rough?: number; metal?: number; emissive?: number } = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0.1,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissive ? 0.7 : 0,
  });
}

// floor — worn shop concrete with a painted center lane
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat(0x211e18, { rough: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const lane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 14), mat(0x2a2620, { rough: 0.9 }));
lane.rotation.x = -Math.PI / 2;
lane.position.set(1.2, 0.005, 0);
scene.add(lane);

// the back wall — pegboard-dark, carries the sign and the splats
const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 5.4), mat(0x2a2620, { rough: 0.9 }));
wall.rotation.y = Math.PI / 2; // faces +X, the shop's open side
wall.position.set(-3.4, 2.7, 0);
wall.receiveShadow = true;
scene.add(wall);

// canvas helper — the sign and the splats are PAINT, not geometry
function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  draw(cvs.getContext('2d')!);
  return new THREE.CanvasTexture(cvs);
}

// THE SIGN — hand-painted board over the counter
const signTex = canvasTex(1024, 256, (ctx) => {
  ctx.fillStyle = '#191611';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#e8632c';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 996, 228);
  ctx.font = '700 108px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8632c';
  ctx.fillText("VANESSA'S", 512, 118);
  ctx.font = '700 62px "Courier New", monospace';
  ctx.fillStyle = '#e8a33d';
  ctx.letterSpacing = '28px';
  ctx.fillText('PAINTBALL', 526, 204);
});
const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: signTex }));
sign.rotation.y = Math.PI / 2;
sign.position.set(-3.35, 3.6, 0);
scene.add(sign);

// a paint splat — irregular blob + satellite drips, per booth color
function splat(color: number): THREE.CanvasTexture {
  const c = `#${color.toString(16).padStart(6, '0')}`;
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    // deterministic petals — no RNG on a page that reloads (same splat every visit)
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const r = 58 + 30 * Math.abs(Math.sin(a * 2.7 + color % 7));
      ctx.ellipse(128 + Math.cos(ang) * 18, 128 + Math.sin(ang) * 18, r, r * 0.82, ang, 0, Math.PI * 2);
    }
    ctx.fill();
    for (let d = 0; d < 7; d++) {
      const ang = (d / 7) * Math.PI * 2 + 0.4;
      const dist = 92 + 22 * ((d * 37 + color) % 5);
      ctx.beginPath();
      ctx.arc(128 + Math.cos(ang) * dist, 128 + Math.sin(ang) * dist, 7 + ((d * 13) % 9), 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ---------------------------------------------------------------------------
// THE COUNTER + VANESSA — she faces the booths, the shop faces you
// ---------------------------------------------------------------------------
const counter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 3.6), mat(0x3a2f22, { rough: 0.6 }));
counter.position.set(-2.0, 0.5, 0);
counter.castShadow = true;
counter.receiveShadow = true;
scene.add(counter);
const counterTop = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 3.8), mat(0x4a3d2c, { rough: 0.4, metal: 0.2 }));
counterTop.position.set(-2.0, 1.03, 0);
counterTop.castShadow = true;
scene.add(counterTop);

const vanessa = buildSoldier(0, 'infantry', 'human');
vanessa.position.set(-2.75, 0, 0);
scene.add(vanessa);
const vJoints: Joints = {};
for (const n of ['legL', 'legR', 'shinL', 'shinR', 'armL', 'armR', 'elbowL', 'elbowR', 'head', 'torso']) {
  vJoints[n] = vanessa.getObjectByName(n) ?? undefined;
}
const vGait: GaitState = {};

// ---------------------------------------------------------------------------
// THE BOOTHS — one per marker in shelf order, walked left to right
// ---------------------------------------------------------------------------
const BOOTH_Z = [4.5, 1.5, -1.5, -4.5];

interface Booth { z: number; marker: THREE.Group; stand: THREE.Group }
const booths: Booth[] = STOCK.map((stock, i) => {
  const z = BOOTH_Z[i];
  const stand = new THREE.Group();
  stand.position.set(0, 0, z);
  scene.add(stand);
  // the pedestal — counter-height display block with the booth's paint stripe
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.98, 0.62), mat(0x2c2820, { rough: 0.8 }));
  block.position.y = 0.49;
  block.castShadow = true;
  block.receiveShadow = true;
  stand.add(block);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.64), mat(stock.paint, { emissive: stock.paint, rough: 0.5 }));
  stripe.position.y = 0.88;
  stand.add(stripe);
  // the splat on the wall behind the booth — the shop wears its stock
  const sp = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: splat(stock.paint), transparent: true, opacity: 0.85 }),
  );
  sp.rotation.y = Math.PI / 2;
  sp.position.set(-3.37, 1.9 + (i % 2) * 0.7, z + (i % 2 ? 0.35 : -0.3));
  scene.add(sp);
  // the marker itself — the arsenal's real model, hopper and all
  const marker = buildWeaponModel(stock.id);
  marker.position.set(0, 1.28, z);
  marker.castShadow = true;
  scene.add(marker);
  // a booth spot lamp in the paint color — cheap warmth
  const lamp = new THREE.PointLight(stock.paint, 0.55, 4.5);
  lamp.position.set(0.8, 2.2, z);
  scene.add(lamp);
  return { z, marker, stand };
});

// ---------------------------------------------------------------------------
// THE GLIDE — the camera walks the shop; keys/buttons pick the booth
// ---------------------------------------------------------------------------
let focus = -1; // -1 = the doorway overview
const camGoal = new THREE.Vector3(6.2, 2.7, 0);
const lookGoal = new THREE.Vector3(-1.5, 1.2, 0);
const camPos = camGoal.clone();
const lookPos = lookGoal.clone();

const st = loadOnboarding();
const cardEl = document.getElementById('card')!;
const saysEl = document.getElementById('vanessa-says')!;
const takeBtn = document.getElementById('take') as HTMLButtonElement;
const boothBtns = [...document.querySelectorAll<HTMLButtonElement>('#bar button[data-booth]')];

function setFocus(i: number) {
  focus = i;
  const stock = STOCK[i];
  if (stock) {
    camGoal.set(2.5, 1.55, booths[i].z);
    lookGoal.set(0, 1.2, booths[i].z);
  } else {
    camGoal.set(6.2, 2.7, 0); // back to the doorway — the whole shop in view
    lookGoal.set(-1.5, 1.2, 0);
  }
  for (const b of boothBtns) b.classList.toggle('on', Number(b.dataset.booth) === i);
  if (!stock) { cardEl.classList.remove('on'); saysEl.classList.remove('on'); return; }
  // the card reads the arsenal live
  const s = boothStats(stock.id);
  document.getElementById('card-tag')!.textContent = stock.tag;
  document.getElementById('card-name')!.textContent = s.name;
  document.getElementById('card-pitch')!.textContent = stock.pitch;
  document.getElementById('card-rate')!.textContent = s.rate;
  document.getElementById('card-reach')!.textContent = s.reach;
  document.getElementById('card-hopper')!.textContent = s.hopper;
  document.getElementById('card-pods')!.textContent = s.pods;
  cardEl.classList.add('on');
  // Vanessa has a word
  document.getElementById('vanessa-line')!.textContent = stock.vanessa;
  saysEl.classList.add('on');
  // the take button knows what you already carry
  const mine = st.marker === stock.id;
  takeBtn.textContent = mine ? 'Already on your belt' : 'Take it to the yard';
  takeBtn.classList.toggle('taken', mine);
}

takeBtn.onclick = () => {
  if (focus < 0) return;
  st.marker = STOCK[focus].id;
  saveOnboarding(st);
  takeBtn.textContent = '✓ On your belt — see you in the yard';
  takeBtn.classList.add('taken');
  document.getElementById('vanessa-line')!.textContent = 'Good pick. Paint washes out — losing doesn’t.';
  saysEl.classList.add('on');
};

for (const b of boothBtns) b.addEventListener('click', () => setFocus(Number(b.dataset.booth)));
addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '4') setFocus(Number(e.key) - 1);
  if (e.key === 'Enter') takeBtn.click();
  if (e.key === 'Escape') setFocus(-1);
});

// ---------------------------------------------------------------------------
// FRAME — markers turn on their stands, Vanessa breathes, the camera glides
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let t = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  for (const b of booths) {
    b.marker.rotation.y = t * 0.55 + b.z; // each booth turns on its own beat
    b.marker.position.y = 1.28 + Math.sin(t * 1.4 + b.z) * 0.03;
  }
  // Vanessa idles with the game's own gait, facing the floor she runs
  for (const n of Object.keys(vJoints)) { const o = vJoints[n]; if (o) o.rotation.set(0, 0, 0); }
  poseSoldierJoints(vJoints, { kind: 'human', time: t, id: 7, speed: 0, airborne: false, dt, state: vGait });
  // the glide — critically damped enough for a shop, no lurch
  camPos.lerp(camGoal, Math.min(1, dt * 3.2));
  lookPos.lerp(lookGoal, Math.min(1, dt * 3.6));
  camera.position.copy(camPos);
  camera.lookAt(lookPos);
  renderer.render(scene, camera);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// live-verify handle
(window as unknown as Record<string, unknown>).__vanessas = { scene, camera, booths, setFocus, stock: STOCK, state: st };
