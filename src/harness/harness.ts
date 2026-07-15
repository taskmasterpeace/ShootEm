import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CLASSES, MODE_INFO, TEAM_COLORS, THEMES, WEAPONS } from '../sim/data';
import { GRID, T_COVER, T_WALL, T_WATER, TILE, WORLD } from '../sim/map';
import type { ClassId, ModeId, SoldierKind, Team, ThemeId, WeaponId, ZedKind } from '../sim/types';
import { JOINT_NAMES, isUndead, poseSoldierJoints, type Joints } from '../client/animation';
import {
  buildFlag, buildGadget, buildGate, buildPad, buildPickup, buildProp,
  buildSoldier, buildTurretMesh, buildVehicle,
} from '../client/models';
import { THEME_PALETTES } from '../client/renderer';
import { World } from '../sim/world';

// ── sim constants mirrored from src/sim/world.ts so the sandbox matches ──────
const GRAVITY = 22;
const HOP_V = 7;
const JET_V = 9.5;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ─────────────────────────────────────────────────────────────────────────────
// Scene, camera, renderer, lights — matched to the in-game renderer so the
// models read exactly as they do in a live match.
// ─────────────────────────────────────────────────────────────────────────────
const canvas = $<HTMLCanvasElement>('harness-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1f26);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 800);
const MODEL_CAM = new THREE.Vector3(4.5, 3.2, 6.5);
const MODEL_TARGET = new THREE.Vector3(0, 1.1, 0);
camera.position.copy(MODEL_CAM);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.copy(MODEL_TARGET);

const hemi = new THREE.HemisphereLight(0xcfe0ee, 0x5a5648, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe8c0, 1.7);
sun.position.set(12, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
sun.shadow.camera.right = sun.shadow.camera.top = 30;
sun.shadow.camera.far = 120;
scene.add(sun);

// shadow-catcher floor for the model stage
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(60, 48),
  new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ── world-space helpers: grid, axes, a bold +X FORWARD arrow ─────────────────
const grid = new THREE.GridHelper(40, 40, 0x3a4250, 0x272d36);
scene.add(grid);

const worldAxes = new THREE.Group();
worldAxes.add(new THREE.AxesHelper(2.2));
const fwdArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.02, 0), 3.4, 0xff4444, 0.6, 0.34);
worldAxes.add(fwdArrow);
worldAxes.add(makeLabel('FORWARD  +X', 0xff6a6a, new THREE.Vector3(3.7, 0.35, 0), 0.9));
scene.add(worldAxes);

// ─────────────────────────────────────────────────────────────────────────────
// The model stage — one procedurally-built object under inspection at a time.
// ─────────────────────────────────────────────────────────────────────────────
const stage = new THREE.Group();
scene.add(stage);

const overlays = new THREE.Group(); // bbox / joints / arm vectors — rebuilt per model
scene.add(overlays);

interface Current {
  root: THREE.Object3D | null;
  label: string;
  isSoldier: boolean;
  kind: SoldierKind;
  id: number;
  joints: Joints;
  rest: Map<THREE.Object3D, { rot: THREE.Euler; scale: THREE.Vector3 }>;
}
const current: Current = { root: null, label: '—', isSoldier: false, kind: 'zombie', id: 3, joints: {}, rest: new Map() };

let physY = 0, physV = 0, physActive = false; // stage vertical physics
let animTime = 0;

// projectiles / tracers / floating text live here and tick each frame
interface Proj { mesh: THREE.Mesh; vel: THREE.Vector3; arc: boolean; life: number; trail: THREE.Vector3[]; line: THREE.Line; }
const projectiles: Proj[] = [];
interface Fx { obj: THREE.Object3D; life: number; max: number; kind: 'tracer' | 'text'; }
const fx: Fx[] = [];
let dummy: THREE.Object3D | null = null;

// ── options bound to the panel checkboxes ────────────────────────────────────
const opt = {
  grid: true, axes: true, wire: false, bbox: false, joints: false, armvec: false,
  turntable: false, anim: true, airborne: false, speed: 0,
};
let team: Team = 0;
let envMode = false;
const envGroup = new THREE.Group();
scene.add(envGroup);

// ─────────────────────────────────────────────────────────────────────────────
// Small builders for overlay bits (labels, joint dots, arm arrows).
// ─────────────────────────────────────────────────────────────────────────────
function makeLabel(text: string, color: number, pos: THREE.Vector3, scale = 1): THREE.Sprite {
  const cvs = document.createElement('canvas');
  cvs.width = 256; cvs.height = 64;
  const ctx = cvs.getContext('2d')!;
  ctx.font = '700 34px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.position.copy(pos);
  spr.scale.set(2.4 * scale, 0.6 * scale, 1);
  spr.renderOrder = 999;
  return spr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Showing a model: clear the stage, add the new root, snapshot its rest pose,
// rebuild overlays, reframe the readout.
// ─────────────────────────────────────────────────────────────────────────────
function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

function showModel(build: () => THREE.Object3D, label: string, opts: { soldier?: boolean; kind?: SoldierKind } = {}) {
  clearEnv();
  // clear stage
  for (const c of [...stage.children]) { stage.remove(c); disposeGroup(c); }
  clearDummy();
  physActive = false; physY = 0; physV = 0; stage.position.set(0, 0, 0); stage.rotation.set(0, 0, 0);

  const root = build();
  stage.add(root);

  current.root = root;
  current.label = label;
  current.isSoldier = !!opts.soldier;
  current.kind = opts.kind ?? 'zombie';
  current.id = 3;
  current.joints = Object.fromEntries(JOINT_NAMES.map((n) => [n, root.getObjectByName(n)]));
  // snapshot the built rest pose so we can restore it when animation is off
  current.rest = new Map();
  for (const n of JOINT_NAMES) {
    const o = current.joints[n];
    if (o) current.rest.set(o, { rot: o.rotation.clone(), scale: o.scale.clone() });
  }

  applyWireframe();
  rebuildOverlays();
  updateReadout();
}

function restoreRest() {
  for (const [o, r] of current.rest) { o.rotation.copy(r.rot); o.scale.copy(r.scale); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlays: bounding box, joint markers, and the arm forward-vectors that make
// the "arms face +X" fix verifiable at a glance.
// ─────────────────────────────────────────────────────────────────────────────
function rebuildOverlays() {
  for (const c of [...overlays.children]) { overlays.remove(c); disposeGroup(c); }
  if (!current.root) return;

  if (opt.bbox) {
    const box = new THREE.Box3().setFromObject(current.root);
    overlays.add(new THREE.Box3Helper(box, new THREE.Color(0x3dbde8)));
  }

  if ((opt.joints || opt.armvec) && current.isSoldier) {
    const dotGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xe8a33d });
    for (const n of JOINT_NAMES) {
      const o = current.joints[n];
      if (!o) continue;
      const world = o.getWorldPosition(new THREE.Vector3());
      if (opt.joints) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(world);
        overlays.add(dot);
        overlays.add(makeLabel(n, 0xffd890, world.clone().add(new THREE.Vector3(0, 0.18, 0)), 0.5));
      }
      // arm forward vector: the direction the limb actually points (its local −Y,
      // i.e. down the limb, transformed to world). For the reach to read as
      // "forward", these arrows must lean toward +X (the red world arrow).
      if (opt.armvec && (n === 'armL' || n === 'armR')) {
        const dir = new THREE.Vector3(0, -1, 0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).normalize();
        overlays.add(new THREE.ArrowHelper(dir, world, 1.5, n === 'armL' ? 0x6fcf72 : 0x9be86f, 0.34, 0.2));
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Readout (top-right): tri/mesh counts + measured size.
// ─────────────────────────────────────────────────────────────────────────────
function updateReadout() {
  $('ro-name').textContent = current.label;
  let tris = 0, meshes = 0;
  const target = envMode ? envGroup : current.root;
  target?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      meshes++;
      const idx = m.geometry.index;
      const pos = m.geometry.attributes.position;
      tris += idx ? idx.count / 3 : pos ? pos.count / 3 : 0;
      const inst = (m as THREE.InstancedMesh).count;
      if (inst && (m as THREE.InstancedMesh).isInstancedMesh) { tris *= 1; meshes += inst - 1; }
    }
  });
  $('ro-tris').textContent = Math.round(tris).toLocaleString();
  $('ro-meshes').textContent = String(meshes);
  if (current.root && !envMode) {
    const s = new THREE.Box3().setFromObject(current.root).getSize(new THREE.Vector3());
    $('ro-size').textContent = `${s.x.toFixed(1)}·${s.y.toFixed(1)}·${s.z.toFixed(1)}`;
  } else {
    $('ro-size').textContent = envMode ? 'map 200²' : '—';
  }
}

function applyWireframe() {
  const roots = envMode ? [envGroup] : current.root ? [current.root] : [];
  for (const r of roots) r.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
    if (Array.isArray(m)) m.forEach((x) => ('wireframe' in x) && (x.wireframe = opt.wire));
    else if (m && 'wireframe' in m) m.wireframe = opt.wire;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Physics sandbox — drop / hop / jetpack burst, integrated at sim gravity.
// ─────────────────────────────────────────────────────────────────────────────
function physDrop() { if (envMode) return; physActive = true; physY = 8; physV = 0; }
function physImpulse(v: number) { if (envMode) return; physActive = true; if (physY <= 0.001) physY = 0; physV = v; }

// ── projectile / ballistics sandbox ──────────────────────────────────────────
function muzzle(): THREE.Vector3 {
  // trooper muzzle sits ~1.0 forward, ~1.35 up, on the −Z gun line; a fine
  // generic launch point for any model on the stage.
  return new THREE.Vector3(1.0, 1.35 + physY, -0.16);
}

function fireProjectile(weapon: WeaponId) {
  const def = WEAPONS[weapon];
  const from = muzzle();
  const speed = Math.min(def.speed, 120) * 0.25 + 6; // scale hypervelocity down to a watchable arc
  const dir = new THREE.Vector3(1, 0, 0);
  const vel = dir.clone().multiplyScalar(speed);
  if (def.arc) vel.y = speed * 0.55; // lob
  const color = tracerColor(def.tracer);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(def.arc ? 0.35 : 0.9, 0.12, 0.12),
    new THREE.MeshBasicMaterial({ color }),
  );
  head.position.copy(from);
  stage.add(head);
  const lineGeo = new THREE.BufferGeometry();
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
  stage.add(line);
  projectiles.push({ mesh: head, vel, arc: def.arc, life: 4, trail: [from.clone()], line });
}

function tracerColor(t: string): number {
  return ({ bullet: 0xffd890, shell: 0xffb060, rocket: 0xff8840, plasma: 0x60c8ff, rail: 0x9bd0ff, flame: 0xff7020, beam: 0x70ffb0, acid: 0xa0e040 } as Record<string, number>)[t] ?? 0xffcc88;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combat sandbox — a target dummy at +X, a tracer from the muzzle, a floating
// damage number. Exercises muzzle origin + facing.
// ─────────────────────────────────────────────────────────────────────────────
function clearDummy() { if (dummy) { stage.remove(dummy); disposeGroup(dummy); dummy = null; } }

function ensureShooter() {
  if (!current.isSoldier) {
    showModel(() => buildSoldier(0, 'infantry', 'bot'), 'Infantry · Titan (shooter)', { soldier: true, kind: 'bot' });
  }
}

function fireCombat(weapon: WeaponId, range: number) {
  ensureShooter();
  // (re)place the dummy at +X * range, facing back at the shooter
  clearDummy();
  const d = buildSoldier(1, 'infantry', 'zombie');
  d.position.set(range, 0, 0);
  d.rotation.y = Math.PI; // face −X toward the shooter
  stage.add(d);
  dummy = d;

  const def = WEAPONS[weapon];
  const from = muzzle();
  const to = new THREE.Vector3(range, 1.2, 0);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const len = from.distanceTo(to);
  const tracer = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.06, 0.06),
    new THREE.MeshBasicMaterial({ color: tracerColor(def.tracer === 'none' ? 'bullet' : def.tracer), transparent: true, opacity: 0.95 }),
  );
  tracer.position.copy(mid);
  tracer.rotation.z = Math.atan2(to.y - from.y, to.x - from.x);
  stage.add(tracer);
  fx.push({ obj: tracer, life: 0.12, max: 0.12, kind: 'tracer' });

  // impact flash
  const flash = new THREE.PointLight(0xffcc66, 6, 6);
  flash.position.copy(to);
  stage.add(flash);
  fx.push({ obj: flash, life: 0.12, max: 0.12, kind: 'tracer' });

  // floating damage number
  const dmg = def.heals ? `+${def.damage}` : `-${def.damage * def.pellets}`;
  const label = makeLabel(dmg, def.heals ? 0x6fcf72 : 0xff6a6a, to.clone().add(new THREE.Vector3(0, 1.2, 0)), 0.8);
  stage.add(label);
  fx.push({ obj: label, life: 1.1, max: 1.1, kind: 'text' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment preview — build a real generated map into the scene.
// ─────────────────────────────────────────────────────────────────────────────
function paintGround(world: World): THREE.Texture {
  const pal = THEME_PALETTES[world.map.theme] ?? THEME_PALETTES.savanna;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = 1024;
  const ctx = cvs.getContext('2d')!;
  const px = 1024 / GRID;
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    const t = world.map.grid[z * GRID + x];
    const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    const r = n - Math.floor(n);
    ctx.fillStyle = t === T_WATER ? pal.water(r) : pal.open(r);
    ctx.fillRect(x * px, z * px, px + 1, px + 1);
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function loadEnvironment(mode: ModeId, seed: number, theme: ThemeId) {
  clearEnv();
  envMode = true;
  stage.visible = false;
  overlays.visible = false;
  worldAxes.visible = false;
  grid.visible = false;
  floor.visible = false;

  const world = new World({ seed: seed >>> 0, mode, difficulty: 'veteran', botsPerTeam: 0, matchMinutes: 15, theme });
  const pal = THEME_PALETTES[world.map.theme] ?? THEME_PALETTES.savanna;
  // the preview breathes the same air as the game: sky, fog, sun.
  // Fog distances stretch ×3 — the aerial inspection camera sits far beyond
  // the gameplay camera, and true distances would drown the map in haze.
  scene.background = new THREE.Color(pal.sky);
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear * 3, pal.fogFar * 3);
  sun.color.setHex(pal.sun);
  sun.intensity = pal.sunIntensity;
  hemi.color.setHex(pal.hemiSky);
  hemi.groundColor.setHex(pal.hemiGround);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshStandardMaterial({ map: paintGround(world), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  envGroup.add(ground);

  // walls + cover (skip prop-covered tiles as the game does)
  const propTiles = new Set<string>();
  for (const p of world.map.props) {
    const tx = Math.floor((p.pos.x + WORLD / 2) / TILE), tz = Math.floor((p.pos.z + WORLD / 2) / TILE);
    const r = p.type === 'rock' ? 2 : p.type === 'bunker' ? 3 : 1;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) propTiles.add(`${tx + dx},${tz + dz}`);
  }
  const walls: [number, number][] = [], covers: [number, number][] = [];
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    const t = world.map.grid[z * GRID + x];
    if (t === T_WALL && !propTiles.has(`${x},${z}`)) walls.push([x, z]);
    if (t === T_COVER && !propTiles.has(`${x},${z}`)) covers.push([x, z]);
  }
  const m4 = new THREE.Matrix4();
  const wallInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 4, TILE), new THREE.MeshStandardMaterial({ color: pal.wall, roughness: 0.9 }), walls.length);
  wallInst.castShadow = wallInst.receiveShadow = true;
  walls.forEach(([x, z], i) => { m4.setPosition((x + 0.5) * TILE - WORLD / 2, 2, (z + 0.5) * TILE - WORLD / 2); wallInst.setMatrixAt(i, m4); });
  envGroup.add(wallInst);
  const coverInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE * 0.95, 1.2, TILE * 0.95), new THREE.MeshStandardMaterial({ color: pal.cover, roughness: 0.9 }), Math.max(covers.length, 1));
  coverInst.castShadow = true;
  covers.forEach(([x, z], i) => { m4.setPosition((x + 0.5) * TILE - WORLD / 2, 0.6, (z + 0.5) * TILE - WORLD / 2); coverInst.setMatrixAt(i, m4); });
  envGroup.add(coverInst);

  for (const p of world.map.props) {
    if (p.type === 'crate') continue;
    const mesh = buildProp(p.type, p.scale);
    mesh.position.set(p.pos.x, 0, p.pos.z); mesh.rotation.y = p.rot;
    envGroup.add(mesh);
  }
  for (const gate of world.map.gates) for (const end of [gate.a, gate.b]) { const a = buildGate(); a.position.set(end.x, 0, end.z); envGroup.add(a); }
  for (const pad of world.map.pads) { const d = buildPad(); d.position.set(pad.pos.x, 0, pad.pos.z); envGroup.add(d); }
  for (const pad of world.map.vehiclePads) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.8, 24), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[pad.team], transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(pad.pos.x, 0.03, pad.pos.z); envGroup.add(ring);
  }

  applyWireframe();
  // frame the whole map from above
  camera.position.set(0, 150, 150);
  controls.target.set(0, 0, 0);
  updateReadout();
}

function clearEnv() {
  if (!envMode && envGroup.children.length === 0) return;
  for (const c of [...envGroup.children]) { envGroup.remove(c); disposeGroup(c); }
  envMode = false;
  stage.visible = true; overlays.visible = true;
  worldAxes.visible = opt.axes; grid.visible = opt.grid; floor.visible = true;
  // restore the model stage's studio lighting
  scene.background = new THREE.Color(0x1a1f26);
  scene.fog = null;
  sun.color.setHex(0xffe8c0);
  sun.intensity = 1.7;
  hemi.color.setHex(0xcfe0ee);
  hemi.groundColor.setHex(0x5a5648);
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel wiring.
// ─────────────────────────────────────────────────────────────────────────────
function chip(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `chip ${cls}`; b.textContent = label; b.onclick = onClick;
  return b;
}

// collapsible sections
document.querySelectorAll<HTMLElement>('.sec > h2').forEach((h) => {
  h.onclick = () => h.parentElement!.classList.toggle('collapsed');
});

// troopers
const classSel = $<HTMLSelectElement>('class-sel');
for (const id of Object.keys(CLASSES) as ClassId[]) {
  const o = document.createElement('option'); o.value = id; o.textContent = CLASSES[id].name; classSel.appendChild(o);
}
$('team-toggle').querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
  b.onclick = () => {
    team = Number(b.dataset.team) as Team;
    $('team-toggle').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
  };
});
$('spawn-trooper').onclick = () => {
  const cid = classSel.value as ClassId;
  showModel(() => buildSoldier(team, cid, 'bot'), `${CLASSES[cid].name} · ${team === 0 ? 'Titan' : 'Collective'}`, { soldier: true, kind: 'bot' });
};
$('spawn-scientist').onclick = () => showModel(() => buildSoldier(0, 'infantry', 'scientist'), 'Dr. Voss (scientist)', { soldier: true, kind: 'scientist' });

// undead
const ZEDS: ZedKind[] = ['zombie', 'spitter', 'brute', 'sprinter', 'bomber', 'stalker'];
const zedGrid = $('zed-grid');
for (const k of ZEDS) zedGrid.appendChild(chip(k, 'zed', () => showModel(() => buildSoldier(0, 'infantry', k), `Zombie · ${k}`, { soldier: true, kind: k })));

// vehicles + structures — the full motor pool
const vehGrid = $('veh-grid');
const VEH_KINDS = ['buggy', 'tank', 'apc', 'skiff', 'hoverboard', 'bike', 'flyer', 'transport', 'ambulance', 'tunneler', 'emplacement'] as const;
for (const v of VEH_KINDS) vehGrid.appendChild(chip(v, '', () => showModel(() => buildVehicle(v, team), `Vehicle · ${v}`)));
const structGrid = $('struct-grid');
structGrid.appendChild(chip('turret', '', () => showModel(() => buildTurretMesh(team), 'Sentry turret')));
structGrid.appendChild(chip('flag', '', () => showModel(() => buildFlag(team), 'Flag')));
structGrid.appendChild(chip('gate', '', () => showModel(() => buildGate(), 'Jump gate')));
structGrid.appendChild(chip('lift pad', '', () => showModel(() => buildPad(), 'Grav-lift pad')));

// gadgets / pickups / props
const gadgetGrid = $('gadget-grid');
for (const g of ['warpA', 'warpB', 'target_beacon', 'orbital', 'shield', 'drone', 'supply_pod', 'camera', 'smoke_field', 'fire_field'] as const)
  gadgetGrid.appendChild(chip(g.replace('_', ' '), '', () => showModel(() => buildGadget(g, team), `Gadget · ${g}`)));
const pickupGrid = $('pickup-grid');
for (const p of ['medkit', 'ammo', 'energy', 'flamer'] as const)
  pickupGrid.appendChild(chip(p, '', () => showModel(() => buildPickup(p), `Pickup · ${p}`)));
const propGrid = $('prop-grid');
for (const p of ['rock', 'tree', 'crate', 'bunker'] as const)
  propGrid.appendChild(chip(p, '', () => showModel(() => buildProp(p, 1.2), `Prop · ${p}`)));

// inspect toggles
const bindCheck = (id: string, key: keyof typeof opt, after?: () => void) => {
  const el = $<HTMLInputElement>(id);
  el.onchange = () => { (opt[key] as boolean) = el.checked; after?.(); };
};
bindCheck('opt-grid', 'grid', () => (grid.visible = opt.grid && !envMode));
bindCheck('opt-axes', 'axes', () => (worldAxes.visible = opt.axes && !envMode));
bindCheck('opt-wire', 'wire', applyWireframe);
bindCheck('opt-bbox', 'bbox', rebuildOverlays);
bindCheck('opt-joints', 'joints', rebuildOverlays);
bindCheck('opt-armvec', 'armvec', rebuildOverlays);
bindCheck('opt-turntable', 'turntable');

// animation
bindCheck('opt-anim', 'anim', () => { if (!opt.anim) restoreRest(); });
bindCheck('opt-airborne', 'airborne');
const speedSlider = $<HTMLInputElement>('speed-slider');
speedSlider.oninput = () => { opt.speed = Number(speedSlider.value); $('speed-val').textContent = opt.speed.toFixed(1); };

// physics
$('phys-drop').onclick = physDrop;
$('phys-hop').onclick = () => physImpulse(HOP_V);
$('phys-jet').onclick = () => physImpulse(JET_V);
const projWeapon = $<HTMLSelectElement>('proj-weapon');
for (const w of ['ar606', 'gl', 'mml', 'tank_cannon', 'rg2', 'plasma', 'impulse', 'spitter_acid'] as WeaponId[]) {
  const o = document.createElement('option'); o.value = w; o.textContent = WEAPONS[w].name; projWeapon.appendChild(o);
}
$('phys-fire-arc').onclick = () => fireProjectile(projWeapon.value as WeaponId);

// combat
const combatWeapon = $<HTMLSelectElement>('combat-weapon');
for (const w of Object.keys(WEAPONS) as WeaponId[]) {
  const o = document.createElement('option'); o.value = w; o.textContent = WEAPONS[w].name; combatWeapon.appendChild(o);
}
combatWeapon.value = 'ar606';
const rangeSlider = $<HTMLInputElement>('range-slider');
let combatRange = 14;
rangeSlider.oninput = () => { combatRange = Number(rangeSlider.value); $('range-val').textContent = String(combatRange); };
$('combat-fire').onclick = () => fireCombat(combatWeapon.value as WeaponId, combatRange);

// environment
const envModeSel = $<HTMLSelectElement>('env-mode');
for (const id of Object.keys(MODE_INFO) as ModeId[]) {
  const o = document.createElement('option'); o.value = id; o.textContent = MODE_INFO[id].name; envModeSel.appendChild(o);
}
envModeSel.value = 'ctf';
const envThemeSel = $<HTMLSelectElement>('env-theme');
for (const id of Object.keys(THEMES) as ThemeId[]) {
  const o = document.createElement('option'); o.value = id; o.textContent = `${THEMES[id].icon} ${THEMES[id].name}`; envThemeSel.appendChild(o);
}
const envSeed = $<HTMLInputElement>('env-seed');
$('env-reseed').onclick = () => (envSeed.value = String(Math.floor(Math.random() * 99999)));
$('env-load').onclick = () => loadEnvironment(envModeSel.value as ModeId, Number(envSeed.value), envThemeSel.value as ThemeId);
$('env-clear').onclick = () => { clearEnv(); camera.position.copy(MODEL_CAM); controls.target.copy(MODEL_TARGET); updateReadout(); };

// reset camera
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    if (envMode) { camera.position.set(0, 150, 150); controls.target.set(0, 0, 0); }
    else { camera.position.copy(MODEL_CAM); controls.target.copy(MODEL_TARGET); }
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─────────────────────────────────────────────────────────────────────────────
// Main loop.
// ─────────────────────────────────────────────────────────────────────────────
let last = performance.now();
let fps = 0, fpsAcc = 0, fpsFrames = 0, overlayAcc = 0;

/**
 * Debug handle for the model harness — lets tooling introspect the live scene.
 * `armDirs()` returns the world-space direction each zombie arm points; the X
 * component must be POSITIVE for the arms to read as reaching forward (+X).
 */
function armDirs() {
  const out: Record<string, { x: number; y: number; z: number; forward: boolean }> = {};
  for (const n of ['armL', 'armR'] as const) {
    const o = current.joints[n];
    if (!o) continue;
    const d = new THREE.Vector3(0, -1, 0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).normalize();
    out[n] = { x: +d.x.toFixed(3), y: +d.y.toFixed(3), z: +d.z.toFixed(3), forward: d.x > 0 };
  }
  return out;
}
(window as unknown as Record<string, unknown>).__h = { THREE, scene, stage, current, poseSoldierJoints, armDirs };

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  animTime += dt;

  // fps
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 0.5) { fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; $('ro-fps').textContent = fps.toFixed(0); }

  // soldier animation (shared with the game renderer)
  if (current.isSoldier && current.root && !envMode) {
    if (opt.anim) {
      poseSoldierJoints(current.joints, {
        kind: current.kind, time: animTime, id: current.id,
        speed: opt.speed, airborne: opt.airborne,
      });
      // arrows/markers track the moving joints — throttled so we don't rebuild
      // canvas sprites every single frame
      if (opt.armvec || opt.joints) {
        overlayAcc += dt;
        if (overlayAcc >= 0.08) { overlayAcc = 0; rebuildOverlays(); }
      }
    }
  }

  // vertical physics on the stage
  if (physActive && !envMode) {
    physV -= GRAVITY * dt;
    physY = Math.max(0, physY + physV * dt);
    if (physY === 0 && physV < 0) { physV = 0; if (Math.abs(physV) < 0.01) physActive = false; }
    stage.position.y = physY;
    $('ro-phys-line').style.display = 'flex';
    $('ro-phys').textContent = physY.toFixed(2);
  } else {
    $('ro-phys-line').style.display = 'none';
  }

  // projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.arc) p.vel.y -= GRAVITY * 0.7 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.z = Math.atan2(p.vel.y, p.vel.x);
    p.trail.push(p.mesh.position.clone());
    if (p.trail.length > 60) p.trail.shift();
    p.line.geometry.setFromPoints(p.trail);
    p.life -= dt;
    const grounded = p.mesh.position.y <= 0.02 && p.vel.y < 0;
    if (p.life <= 0 || grounded || p.mesh.position.length() > 200) {
      stage.remove(p.mesh); stage.remove(p.line);
      p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); p.line.geometry.dispose();
      projectiles.splice(i, 1);
    }
  }

  // transient fx (tracers, floating text)
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    const k = Math.max(0, f.life / f.max);
    if (f.kind === 'text') { f.obj.position.y += dt * 1.2; (f.obj as THREE.Sprite).material.opacity = k; }
    else if (f.obj instanceof THREE.Mesh) ((f.obj.material as THREE.MeshBasicMaterial).opacity = k);
    else if (f.obj instanceof THREE.PointLight) f.obj.intensity = 6 * k;
    if (f.life <= 0) {
      stage.remove(f.obj);
      if (f.obj instanceof THREE.Mesh) { f.obj.geometry.dispose(); (f.obj.material as THREE.Material).dispose(); }
      fx.splice(i, 1);
    }
  }

  if (opt.turntable && current.root && !envMode) stage.rotation.y += dt * 0.6;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// boot: show a zombie first — it's the model this harness was built to fix.
showModel(() => buildSoldier(0, 'infantry', 'zombie'), 'Zombie · zombie', { soldier: true, kind: 'zombie' });
$<HTMLInputElement>('opt-armvec').checked = true; opt.armvec = true; rebuildOverlays();
requestAnimationFrame(frame);
