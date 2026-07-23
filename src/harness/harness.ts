import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CLASSES, MODE_INFO, TEAM_COLORS, THEMES, WEAPONS } from '../sim/data';
import { FAMILIES } from '../sim/arsenal';
import {
  CLIMB_H, DRILL_EATS, GRID, SURF_SOLDIER, SURF_TRACKS, SURF_WHEELS,
  F2_BALCONY, F2_DOOR_H, F2_DOOR_V, F2_RAIL_H, F2_RAIL_V, F2_SHUTTER,
  F2_STAIR_N, F2_STAIR_W, F2_THIN_WALL_H, F2_THIN_WALL_HV, F2_THIN_WALL_V,
  F2_VOID, F2_WALL, F2_WELL,
  S_DIRT, S_GRASS, S_GRIT, S_ICE, S_MUD, S_PLATE, S_WET,
  T_CLIMB, T_COVER, T_DEEP, T_DOOR, T_DOOR_OPEN, T_LADDER, T_METAL, T_OPEN, T_SECTION_SHUTTER,
  T_SLIT, T_STAIRS_N, T_STAIRS_W, T_THIN_DOOR_H, T_THIN_DOOR_V, T_THIN_WALL_H,
  T_THIN_WALL_HV, T_THIN_WALL_V, T_WALL, T_WATER,
  THIN_WALL, TILE, WORLD, blocksShot, isBlocked, isWindowTile, windowSpansX,
} from '../sim/map';
import { floorLayer } from '../sim/map-layers';
import { BUILDINGS, generateHouse, type BuildingDef, type DynHouseType } from '../sim/buildings';
import { FRONT_STENCILS } from '../sim/fronts';
import { Rng } from '../sim/rng';
import type { AscendantId, ClassId, ModeId, SoldierKind, Team, ThemeId, WeaponDef, WeaponId, ZedKind } from '../sim/types';
import { JOINT_NAMES, isUndead, poseSoldierJoints, stepYawSpring, throwArmCurve, FLIGHT_POSES, WEAPON_HOLDS, type GaitState, type Joints } from '../client/animation';
import {
  buildFlag, buildGadget, buildGate, buildPad, buildPickup, buildProp,
  buildSoldier, buildTurretMesh, buildVehicle, dressAsLsw,
} from '../client/models';
import { LSWS } from '../sim/lsw';
import { SOUND_NAMES, audio, type SoundName } from '../client/audio';
import { BIOME_AUDIO } from '../client/soundscape';
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

// ─────────────────────────────────────────────────────────────────────────────
// #125 THE MODELER'S QUAD — front / side / top / free, all at once (Robert:
// "we gonna be doing all kind of modeling… four views, inside the harness").
// Orthographic for the fixed three: silhouette truth, no perspective lies.
// The free pane keeps the orbit camera. The Body Shop's key-6 lesson made law.
// ─────────────────────────────────────────────────────────────────────────────
let quadZoom = 1;
const QUAD_DIST = 12;
const orthoFront = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60); // +X looking back — the face a body walks with
const orthoSide = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);  // +Z profile
const orthoTop = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);   // straight down — the game's truth
orthoTop.up.set(0, 0, -1); // top view: +X screen-right, +Z screen-down (DCC law)

function aimQuadCams() {
  const t = MODEL_TARGET;
  orthoFront.position.set(t.x + QUAD_DIST, t.y, t.z);
  orthoFront.lookAt(t.x, t.y, t.z);
  orthoSide.position.set(t.x, t.y, t.z + QUAD_DIST);
  orthoSide.lookAt(t.x, t.y, t.z);
  orthoTop.position.set(t.x, t.y + QUAD_DIST, t.z);
  orthoTop.lookAt(t.x, t.y, t.z);
}
aimQuadCams();

function frameOrtho(cam: THREE.OrthographicCamera, aspect: number) {
  const halfH = 2.1 * quadZoom;
  cam.top = halfH; cam.bottom = -halfH;
  cam.left = -halfH * aspect; cam.right = halfH * aspect;
  cam.updateProjectionMatrix();
}

const quadLabels = document.getElementById('quad-labels');
function syncQuadLabels() {
  if (quadLabels) quadLabels.style.display = opt.quad && stage.visible ? '' : 'none';
}

/** The 2×2 scissor render — a 2px seam of background between panes. */
function renderQuad() {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  const pw = Math.floor(w / 2), ph = Math.floor(h / 2);
  const seam = 1;
  const paneAspect = pw / ph;
  for (const cam of [orthoFront, orthoSide, orthoTop]) frameOrtho(cam, paneAspect);
  renderer.setScissorTest(true);
  const panes: [number, number, THREE.Camera][] = [
    [0, ph, orthoFront],        // top-left
    [pw, ph, orthoSide],        // top-right
    [0, 0, orthoTop],           // bottom-left
    [pw, 0, camera],            // bottom-right — the free orbit
  ];
  for (const [px, py, cam] of panes) {
    renderer.setViewport(px + seam, py + seam, pw - seam * 2, ph - seam * 2);
    renderer.setScissor(px + seam, py + seam, pw - seam * 2, ph - seam * 2);
    if (cam === camera) {
      camera.aspect = paneAspect;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, cam);
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  // restore the full-screen aspect for the single-view frames that follow
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

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
  /** the built rest pose of arms/gun (the solved grip) — the hold layer's base */
  feelRest?: { armL: number; armR: number; gunY: number; gunZ: number; gunRotZ: number };
}
const current: Current = { root: null, label: '—', isSoldier: false, kind: 'zombie', id: 3, joints: {}, rest: new Map() };

let physY = 0, physV = 0, physActive = false; // stage vertical physics
let animTime = 0;
let audioReady = false;        // Sound Lab enabled → markers are audible
const stageGait: GaitState = {}; // continuous gait phase for the staged model

// projectiles / tracers / floating text live here and tick each frame
interface Proj {
  mesh: THREE.Mesh; vel: THREE.Vector3; arc: boolean; life: number;
  trail: THREE.Vector3[]; line: THREE.Line;
  /** Arsenal lane: detonate when this X is crossed (shows splash + damage). */
  detonateX?: number; splash?: number; dmgText?: string; color?: number;
}
const projectiles: Proj[] = [];
interface Fx { obj: THREE.Object3D; life: number; max: number; kind: 'tracer' | 'text'; }
const fx: Fx[] = [];
let dummy: THREE.Object3D | null = null;

// ── options bound to the panel checkboxes ────────────────────────────────────
const opt = {
  grid: true, axes: true, wire: false, bbox: false, joints: false, armvec: false,
  turntable: false, anim: true, airborne: false, speed: 0, quad: false,
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
  stageGait.phase = undefined; // fresh gait accumulator per model
  stageGait.swayPhase = undefined;
  current.joints = Object.fromEntries(JOINT_NAMES.map((n) => [n, root.getObjectByName(n)]));
  // the solved grip is the feel layer's base pose — snapshot it
  current.feelRest = {
    armL: current.joints.armL?.rotation.z ?? 0,
    armR: current.joints.armR?.rotation.z ?? 0,
    gunY: current.joints.gun?.position.y ?? 0,
    gunZ: current.joints.gun?.position.z ?? 0,
    gunRotZ: current.joints.gun?.rotation.z ?? 0,
  };
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
    showModel(() => buildSoldier(0, 'infantry', 'bot'), 'Infantry · United Front (shooter)', { soldier: true, kind: 'bot' });
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

// ── Feel Pass — the live iteration workbench (shared math from animation.ts) ─
const feel = {
  turn: false, yawState: { v: 0 }, turnAt: -10, yawTarget: 0,
  hold: null as string | null,
  throwAt: -1, cast: null as 'slam' | 'thrust' | 'channel' | null, castAt: -1,
  flight: null as 'inferno' | 'stormcaller' | 'gargoyle' | null, flightBlend: { v: 0 },
  runBlend: { v: 0 }, // the stage's run-carry (mirrors the game renderer)
};
const feelSay = (t: string) => { $('feel-status').textContent = t; };

$('feel-turn').onclick = () => {
  feel.turn = !feel.turn;
  $('feel-turn').classList.toggle('on', feel.turn);
  feel.yawState.v = feel.yawTarget = stage.rotation.y;
  feel.turnAt = animTime;
  feelSay(feel.turn ? 'turn test ON — 180° flip every 2s; the head leads the body' : 'idle');
};
{
  const holdsHost = $('feel-holds');
  for (const fam of ['rifle', 'pistol', 'shotgun', 'at_rocket', 'slugger', 'hmg']) {
    const b = chip(fam.replace('_', ' '), '', () => {
      feel.hold = feel.hold === fam ? null : fam;
      for (const x of Array.from(holdsHost.querySelectorAll('button'))) x.classList.remove('active');
      if (feel.hold) b.classList.add('active');
      feelSay(feel.hold ? `hold: ${fam} — additive over the solved grip` : 'idle');
    });
    holdsHost.appendChild(b);
  }
}
$('feel-throw').onclick = () => { feel.throwAt = animTime; feelSay('grenade throw: wind back, whip through, settle'); };
for (const id of ['slam', 'thrust', 'channel'] as const) {
  $(`feel-cast-${id}`).onclick = () => { feel.cast = id; feel.castAt = animTime; feelSay(`power-cast: ${id.toUpperCase()}`); };
}
for (const id of ['inferno', 'stormcaller', 'gargoyle'] as const) {
  $(`feel-fly-${id}`).onclick = () => {
    feel.flight = feel.flight === id ? null : id;
    for (const other of ['inferno', 'stormcaller', 'gargoyle'] as const) $(`feel-fly-${other}`).classList.remove('active');
    if (feel.flight) $(`feel-fly-${id}`).classList.add('active');
    feelSay(feel.flight ? `flight: ${id} — spring-blended over the gait` : 'idle');
  };
}

/** the feel layer, applied after the shared gait every frame */
function applyFeelLayer(dt: number) {
  const j = current.joints;
  const r = current.feelRest;
  // THE TURN test: the real spring drives the stage; the head leads
  if (feel.turn) {
    if (animTime - feel.turnAt > 2) { feel.turnAt = animTime; feel.yawTarget += Math.PI; }
    const diff = stepYawSpring(feel.yawState, feel.yawTarget, dt, opt.speed > 0.6);
    stage.rotation.y = feel.yawState.v;
    if (j.head) j.head.rotation.y = Math.max(-0.6, Math.min(0.6, diff));
  } else {
    stage.rotation.y = 0;
    if (j.head) j.head.rotation.y = 0;
  }
  // THE UNDEAD OWN THEIR ARMS (the character audit, Robert's screenshot):
  // the shared gait drives the zombie reach+sway every frame — but this
  // block used to overwrite the arms right after the arrows sampled them,
  // so the arm VECTORS animated while the MESH stayed frozen at the rest
  // snapshot. Everything below is the LIVING grip/carry emulation; zeds
  // stop here and keep the pose the gait just gave them.
  if (isUndead(current.kind)) return;
  // HOLDS + THE RUN CARRY (stage mirror of the game renderer): the base is
  // rest-pose eased off by the run blend, arms pump counter to the legs at
  // speed, and the family hold rides on top — the same formula animateSoldier
  // runs, so the workbench tells the game's truth. Without the pump the stage
  // showed scissoring legs under bolted arms ("the running is messed up").
  if (r) {
    const h = feel.hold ? WEAPON_HOLDS[feel.hold] : null;
    const running = opt.anim && opt.speed > 3.5 && !opt.airborne;
    feel.runBlend.v += ((running ? 1 : 0) - feel.runBlend.v) * Math.min(1, dt * 7);
    const b = feel.runBlend.v;
    const wgt = 1 - b * 0.8;
    const pump = Math.sin(stageGait.phase ?? 0) * 0.42 * Math.min(1, opt.speed / 6);
    if (j.armL) j.armL.rotation.z = r.armL * (1 - b * 0.7) + -pump * b + (h?.armL ?? 0) * wgt;
    if (j.armR) j.armR.rotation.z = r.armR * (1 - b * 0.7) + pump * b + (h?.armR ?? 0) * wgt;
    if (j.gun) {
      j.gun.position.y = r.gunY + (h?.gunY ?? 0) * wgt - 0.14 * b;
      j.gun.position.z = r.gunZ + (h?.gunZ ?? 0) * wgt;
      j.gun.rotation.z = r.gunRotZ + (h?.gunRotZ ?? 0) * wgt - 0.42 * b;
      j.gun.visible = !(h?.hideGun);
    }
    if (h?.torsoX && j.torso) j.torso.rotation.x += h.torsoX;
  }
  // THE THROW: wind back, whip through with overshoot, settle to rest
  if (feel.throwAt >= 0) {
    const k = (animTime - feel.throwAt) / 0.45;
    if (k >= 1) { feel.throwAt = -1; feelSay('idle'); }
    else {
      if (j.armR) j.armR.rotation.z = (r?.armR ?? 0) + throwArmCurve(k);
      if (j.gun) j.gun.position.y -= 0.08 * (1 - k);
    }
  }
  // POWER-CAST: slam / thrust / channel envelopes
  if (feel.cast && feel.castAt >= 0) {
    const k = (animTime - feel.castAt) / 0.6;
    if (k >= 1) { feel.cast = null; feelSay('idle'); }
    else {
      const env = Math.sin(k * Math.PI);
      if (feel.cast === 'slam') {
        const swing = k < 0.55 ? 2.4 * (k / 0.55) : 2.4 - 3.6 * ((k - 0.55) / 0.45);
        if (j.armL) j.armL.rotation.z = (r?.armL ?? 0) + swing;
        if (j.armR) j.armR.rotation.z = (r?.armR ?? 0) + swing;
      } else if (feel.cast === 'channel') {
        if (j.armR) j.armR.rotation.z = (r?.armR ?? 0) + 1.5 * env;
      } else {
        const punch = Math.min(1, k / 0.25) * (1 - Math.max(0, (k - 0.7) / 0.3));
        if (j.armL) j.armL.rotation.z = (r?.armL ?? 0) + 1.9 * punch;
        if (j.armR) j.armR.rotation.z = (r?.armR ?? 0) + 1.9 * punch;
      }
    }
  }
  // FLIGHT: spring-blend the silhouette over the gait
  const fb = feel.flightBlend;
  fb.v += ((feel.flight ? 1 : 0) - fb.v) * Math.min(1, dt / 0.3);
  if (fb.v > 0.01 && feel.flight) {
    const p = FLIGHT_POSES[feel.flight];
    if (j.armL) { j.armL.rotation.z += (p.armZ - j.armL.rotation.z) * fb.v; j.armL.rotation.x += (p.armX - j.armL.rotation.x) * fb.v; }
    if (j.armR) { j.armR.rotation.z += (p.armZ - j.armR.rotation.z) * fb.v; j.armR.rotation.x += (-p.armX - j.armR.rotation.x) * fb.v; }
    if (j.head) j.head.rotation.z += (p.headZ - j.head.rotation.z) * fb.v;
    stage.rotation.z = p.pitch * fb.v;
  } else stage.rotation.z = 0;
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

function loadEnvironment(
  mode: ModeId,
  seed: number,
  theme: ThemeId,
  mapOverride?: import('../sim/map').GameMap,
  scienceMission?: import('../sim/science').ScienceMissionSpec,
) {
  clearEnv();
  envMode = true;
  stage.visible = false;
  overlays.visible = false;
  worldAxes.visible = false;
  grid.visible = false;
  floor.visible = false;

  const world = new World({ seed: seed >>> 0, mode, difficulty: 'veteran', botsPerTeam: 0, matchMinutes: 15, theme, scienceMission });
  // the Map Maker previews its own document: same World shell, its map swapped in
  if (mapOverride) world.map = mapOverride;
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
  envLight = { sunHex: pal.sun, sunI: pal.sunIntensity, fog: scene.fog }; // for restore

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshStandardMaterial({ map: paintGround(world), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  envGroup.add(ground);

  // walls + cover — exclusion radii match actual prop footprints (see renderer)
  const propTiles = new Set<string>();
  for (const p of world.map.props) {
    const tx = Math.floor((p.pos.x + WORLD / 2) / TILE), tz = Math.floor((p.pos.z + WORLD / 2) / TILE);
    const r = p.type === 'rock' ? Math.max(1, Math.round(p.scale / 1.6)) : 0;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) propTiles.add(`${tx + dx},${tz + dz}`);
  }
  const walls: [number, number][] = [], covers: [number, number][] = [], climbs: [number, number][] = [];
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    const t = world.map.grid[z * GRID + x];
    if (t === T_WALL && !propTiles.has(`${x},${z}`)) walls.push([x, z]);
    if (t === T_COVER && !propTiles.has(`${x},${z}`)) covers.push([x, z]);
    if (t === T_CLIMB) climbs.push([x, z]); // §8.7 barricades — sampled live, like everything here
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
  // §8.7 CLIMB barricades — same look as the game renderer: 2.5u body a shade
  // lighter than masonry, plus the wider grab-lip that says "climbable"
  const climbColor = new THREE.Color(pal.wall).lerp(new THREE.Color(0xd8cfba), 0.28);
  const climbInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, CLIMB_H, TILE), new THREE.MeshStandardMaterial({ color: climbColor, roughness: 0.85 }), Math.max(climbs.length, 1));
  climbInst.castShadow = climbInst.receiveShadow = true;
  const lipColor = new THREE.Color(pal.wall).lerp(new THREE.Color(0xe8e0cc), 0.45);
  const climbLip = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE * 1.16, 0.18, TILE * 1.16), new THREE.MeshStandardMaterial({ color: lipColor, roughness: 0.7 }), Math.max(climbs.length, 1));
  climbLip.castShadow = true;
  climbs.forEach(([x, z], i) => {
    m4.setPosition((x + 0.5) * TILE - WORLD / 2, CLIMB_H / 2, (z + 0.5) * TILE - WORLD / 2);
    climbInst.setMatrixAt(i, m4);
    m4.setPosition((x + 0.5) * TILE - WORLD / 2, CLIMB_H - 0.09, (z + 0.5) * TILE - WORLD / 2);
    climbLip.setMatrixAt(i, m4);
  });
  envGroup.add(climbInst, climbLip);

  // Whole-building inspection vocabulary. The harness used to show only the
  // legacy full-tile walls, reducing a science mansion to its outer arena box.
  // These open-topped procedural meshes mirror collision data closely enough
  // to judge rooms, glazing, balconies, stairs, ladders, and all three floors.
  const meta = world.map.buildingMeta;
  envPreviewRadius = meta ? Math.max(meta.width ?? 15, meta.height ?? 15) * TILE * 1.25 : WORLD;
  if (meta) {
    const masonry = new THREE.MeshStandardMaterial({ color: 0xc48a45, roughness: 0.88 });
    const door = new THREE.MeshStandardMaterial({ color: 0x76502e, roughness: 0.72 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x56d6e7, transparent: true, opacity: 0.48, roughness: 0.16, metalness: 0.12 });
    const balcony = new THREE.MeshStandardMaterial({ color: 0xd8d0b7, roughness: 0.84 });
    const shutter = new THREE.MeshStandardMaterial({ color: 0xb74338, roughness: 0.7, metalness: 0.3 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5f625c, roughness: 0.96 });
    const addBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; envGroup.add(mesh);
    };
    for (let storey = 0; storey < meta.floors; storey++) {
      const layer = floorLayer(world.map, storey);
      const upper = storey > 0;
      const baseY = storey * 4;
      for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
        const tile = layer[z * GRID + x];
        if (upper && tile === F2_VOID) continue;
        const wx = (x + 0.5) * TILE - WORLD / 2, wz = (z + 0.5) * TILE - WORLD / 2;
        if (upper) addBox(wx, baseY - 0.08, wz, TILE, 0.16, TILE, tile === F2_BALCONY ? balcony : floorMat);
        if (upper && tile === F2_WALL) { addBox(wx, baseY + 2, wz, TILE, 4, TILE, masonry); continue; }
        const thin = upper
          ? tile === F2_THIN_WALL_H || tile === F2_THIN_WALL_V || tile === F2_THIN_WALL_HV
            || tile === F2_DOOR_H || tile === F2_DOOR_V || tile === F2_RAIL_H || tile === F2_RAIL_V
            || tile === F2_SHUTTER || isWindowTile(tile, true)
          : tile === T_THIN_WALL_H || tile === T_THIN_WALL_V || tile === T_THIN_WALL_HV
            || tile === T_THIN_DOOR_H || tile === T_THIN_DOOR_V || tile === T_SECTION_SHUTTER || isWindowTile(tile);
        if (thin) {
          const isGlass = isWindowTile(tile, upper);
          const isDoor = upper ? tile === F2_DOOR_H || tile === F2_DOOR_V : tile === T_THIN_DOOR_H || tile === T_THIN_DOOR_V;
          const isRail = upper && (tile === F2_RAIL_H || tile === F2_RAIL_V);
          const isShutter = upper ? tile === F2_SHUTTER : tile === T_SECTION_SHUTTER;
          const spansX = isGlass ? windowSpansX(tile, upper)
            : upper ? tile === F2_THIN_WALL_H || tile === F2_THIN_WALL_HV || tile === F2_DOOR_H || tile === F2_RAIL_H || tile === F2_SHUTTER
              : tile === T_THIN_WALL_H || tile === T_THIN_WALL_HV || tile === T_THIN_DOOR_H || tile === T_SECTION_SHUTTER;
          const height = isRail ? 1.05 : isGlass ? 2.7 : isDoor ? 3.35 : 3.7;
          const y = baseY + (isRail ? height / 2 : isGlass ? 2.05 : height / 2);
          addBox(wx, y, wz, spansX ? TILE : THIN_WALL, height, spansX ? THIN_WALL : TILE,
            isGlass ? glass : isDoor ? door : isShutter ? shutter : isRail ? balcony : masonry);
        }
        const stair = upper ? tile >= F2_STAIR_N && tile <= F2_STAIR_W : tile >= T_STAIRS_N && tile <= T_STAIRS_W;
        if (stair) for (let step = 0; step < 4; step++) {
          const rise = step * 0.48, offset = (step - 1.5) * TILE / 4;
          addBox(wx, baseY + rise / 2, wz + offset, TILE * 0.72, Math.max(0.14, rise), TILE / 4, balcony);
        }
        if ((upper && tile === F2_WELL) || (!upper && tile === T_LADDER)) {
          addBox(wx - 0.55, baseY + 2, wz, 0.12, 4, 0.12, door);
          addBox(wx + 0.55, baseY + 2, wz, 0.12, 4, 0.12, door);
          for (let rung = 0; rung < 6; rung++) addBox(wx, baseY + 0.45 + rung * 0.62, wz, 1.2, 0.1, 0.1, door);
        }
      }
    }
  }

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
  applyEnvCam(); // angled overview, or the top-down floor-plan read
  updateReadout();
}

/** The World tab's two camera framings: the 45° overview, and a near-
 *  orthographic straight-down TOP-DOWN plan (fov 30 from high up) that reads
 *  an interior map's rooms, hallway spine, and corridors at a glance — the
 *  view the compound/interior authoring wanted and the orbit couldn't hold.
 *  The env render is open-topped (no roofs), so the plan needs no cutaway. */
let topDown = false;
let envPreviewRadius = WORLD;
let envLight: { sunHex: number; sunI: number; fog: THREE.Scene['fog'] } | null = null;
function applyEnvCam() {
  camera.fov = topDown ? 30 : 50;
  camera.updateProjectionMatrix();
  // a hair off vertical (≈15°) so the low hull walls show their FACES and read
  // as structure, instead of vanishing to thin lines under a pure plan view
  const distance = envPreviewRadius < WORLD ? Math.max(34, envPreviewRadius * 1.25) : 150;
  camera.position.set(0, topDown ? distance * 2.2 : distance, topDown ? distance * 0.45 : distance);
  controls.target.set(0, envPreviewRadius < WORLD ? 3.5 : 0, 0);
  // a floor PLAN wants flat, bright, fogless light; the angled overview wears
  // the theme's own mood back
  if (topDown) {
    sun.color.setHex(0xffffff); sun.intensity = 2.6; scene.fog = null;
  } else if (envLight) {
    sun.color.setHex(envLight.sunHex); sun.intensity = envLight.sunI; scene.fog = envLight.fog;
  }
}

function clearEnv() {
  if (!envMode && envGroup.children.length === 0) return;
  for (const c of [...envGroup.children]) { envGroup.remove(c); disposeGroup(c); }
  envMode = false;
  envPreviewRadius = WORLD;
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
  showModel(() => buildSoldier(team, cid, 'bot'), `${CLASSES[cid].name} · ${team === 0 ? 'United Front' : 'Collective'}`, { soldier: true, kind: 'bot' });
};
$('spawn-scientist').onclick = () => showModel(() => buildSoldier(0, 'infantry', 'scientist'), 'Dr. Voss (scientist)', { soldier: true, kind: 'scientist' });

// undead
const ZEDS: ZedKind[] = ['zombie', 'spitter', 'brute', 'sprinter', 'bomber', 'stalker'];
const zedGrid = $('zed-grid');
for (const k of ZEDS) zedGrid.appendChild(chip(k, 'zed', () => showModel(() => buildSoldier(0, 'infantry', k), `Zombie · ${k}`, { soldier: true, kind: k })));

// Living Super Weapons — the harness adjusts to them (Robert): same rig,
// dressed as the LSW so the Stage judges the real in-game body.
const LSW_STABLE: { id: AscendantId; team: 0 | 1 }[] = [
  { id: 'firebrand', team: 0 }, { id: 'plaguebearer', team: 1 },
  { id: 'frostbite', team: 0 }, { id: 'ragebeast', team: 1 },
];
const lswGrid = $('lsw-grid');
for (const { id, team } of LSW_STABLE) {
  lswGrid.appendChild(chip(LSWS[id].name, 'lsw', () =>
    showModel(() => dressAsLsw(buildSoldier(team, 'infantry', 'bot'), id),
      `LSW · ${LSWS[id].name}`, { soldier: true, kind: 'bot' })));
}

// vehicles + structures — the full motor pool
const vehGrid = $('veh-grid');
const VEH_KINDS = [
  'buggy', 'tank', 'apc', 'skiff', 'hoverboard', 'bike', 'flyer',
  'attackheli', 'transportheli', 'strikejet', 'interceptor', 'bomber',
  'gunship', 'airsuperiority', 'stealthbomber', 'gunheli', 'aatrack',
  'transport', 'ambulance', 'tunneler', 'emplacement', 'mech', 'boat', 'submarine',
] as const;
for (const v of VEH_KINDS) vehGrid.appendChild(chip(v, '', () => showModel(() => buildVehicle(v, team), `Vehicle · ${v}`)));
const structGrid = $('struct-grid');
structGrid.appendChild(chip('turret', '', () => showModel(() => buildTurretMesh(team), 'Sentry turret')));
structGrid.appendChild(chip('flag', '', () => showModel(() => buildFlag(team), 'Flag')));
structGrid.appendChild(chip('gate', '', () => showModel(() => buildGate(), 'Jump gate')));
structGrid.appendChild(chip('lift pad', '', () => showModel(() => buildPad(), 'Grav-lift pad')));

// gadgets / pickups / props
const gadgetGrid = $('gadget-grid');
for (const g of ['warpA', 'warpB', 'target_beacon', 'orbital', 'shield', 'drone', 'supply_pod', 'camera', 'smoke_field', 'fire_field', 'flare'] as const)
  gadgetGrid.appendChild(chip(g.replace('_', ' '), '', () => showModel(() => buildGadget(g, team), `Gadget · ${g}`)));
const pickupGrid = $('pickup-grid');
for (const p of ['medkit', 'ammo', 'energy', 'flamer'] as const)
  pickupGrid.appendChild(chip(p, '', () => showModel(() => buildPickup(p), `Pickup · ${p}`)));
const propGrid = $('prop-grid');
for (const p of ['rock', 'tree', 'crate', 'bunker', 'clone_bay'] as const)
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
bindCheck('opt-quad', 'quad', syncQuadLabels);

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

// ---------------------------------------------------------------------------
// Sound Lab — audition, tune, and replace every sound in the game.
// Volume/pitch prefs persist in localStorage; uploaded sounds in IndexedDB.
// The game's AudioEngine reads both on every launch.
// ---------------------------------------------------------------------------
$('snd-init').onclick = async () => {
  const btn = $('snd-init') as HTMLButtonElement;
  btn.textContent = 'Loading sounds…';
  btn.disabled = true;
  await audio.init();
  audio.resume();
  audioReady = true;
  btn.style.display = 'none';
  buildSoundLab();
};

function buildSoundLab() {
  const list = $('sound-list');
  list.classList.add('ready');
  list.innerHTML = '';
  for (const name of SOUND_NAMES) {
    const row = document.createElement('div');
    row.className = `snd-row${audio.hasCustom(name) ? ' custom' : ''}`;
    const pref = audio.getPref(name);
    row.innerHTML = `
      <button class="snd-play" title="play">▶</button>
      <span class="snd-name" title="${name}">${name}</span>
      <input type="range" class="vol" min="0" max="2" step="0.05" value="${pref.vol}" title="volume ×${pref.vol.toFixed(2)}">
      <input type="range" class="rate" min="0.5" max="2" step="0.05" value="${pref.rate}" title="pitch ×${pref.rate.toFixed(2)}">
      <button class="snd-upload" title="replace with your own sound file">📁</button>
      <button class="snd-reset" title="restore stock sound + settings">↺</button>
    `;
    const play = () => audio.play(name, { volume: 1 });
    (row.querySelector('.snd-play') as HTMLButtonElement).onclick = play;
    const vol = row.querySelector('.vol') as HTMLInputElement;
    vol.oninput = () => {
      audio.setPref(name, { vol: Number(vol.value) });
      vol.title = `volume ×${Number(vol.value).toFixed(2)}`;
    };
    vol.onchange = play; // hear the new level when you let go
    const rate = row.querySelector('.rate') as HTMLInputElement;
    rate.oninput = () => {
      audio.setPref(name, { rate: Number(rate.value) });
      rate.title = `pitch ×${Number(rate.value).toFixed(2)}`;
    };
    rate.onchange = play;
    (row.querySelector('.snd-upload') as HTMLButtonElement).onclick = () => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = 'audio/*,.wav,.mp3,.ogg';
      picker.onchange = async () => {
        const file = picker.files?.[0];
        if (!file) return;
        const ok = await audio.setCustom(name, await file.arrayBuffer());
        if (ok) {
          row.classList.add('custom');
          audio.play(name, { volume: 1 });
        } else {
          alert(`Couldn't decode "${file.name}" as audio.`);
        }
      };
      picker.click();
    };
    (row.querySelector('.snd-reset') as HTMLButtonElement).onclick = async () => {
      await audio.clearCustom(name);
      audio.setPref(name, { vol: 1, rate: 1 });
      row.classList.remove('custom');
      vol.value = '1';
      rate.value = '1';
      audio.play(name, { volume: 1 });
    };
    list.appendChild(row);
  }
}

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
$('env-topdown').onclick = () => {
  topDown = !topDown;
  $('env-topdown').textContent = `⬒ Top-down plan: ${topDown ? 'ON' : 'OFF'}`;
  if (envMode) applyEnvCam();
};
$('env-clear').onclick = () => {
  clearEnv();
  camera.fov = 50; camera.updateProjectionMatrix();
  camera.position.copy(MODEL_CAM); controls.target.copy(MODEL_TARGET);
  updateReadout();
};

// reset camera
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    if (envMode) { applyEnvCam(); }
    else { camera.fov = 50; camera.updateProjectionMatrix(); camera.position.copy(MODEL_CAM); controls.target.copy(MODEL_TARGET); }
  }
  // #125 the quad: Q toggles, [ ] breathe the ortho frame in and out
  if (e.key === 'q' || e.key === 'Q') {
    opt.quad = !opt.quad;
    const box = document.getElementById('opt-quad') as HTMLInputElement | null;
    if (box) box.checked = opt.quad;
    syncQuadLabels();
  }
  if (e.key === '[') quadZoom = Math.min(3, quadZoom * 1.15);
  if (e.key === ']') quadZoom = Math.max(0.35, quadZoom / 1.15);
});

// size the renderer to the canvas's ACTUAL CSS box (differs by mode: full
// screen on Stage/World, a top firing-lane strip in Arsenal). updateStyle=false
// so three doesn't fight the CSS that positions the canvas per mode.
function onResize() {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

// ─────────────────────────────────────────────────────────────────────────────
// Main loop.
// ─────────────────────────────────────────────────────────────────────────────
let last = performance.now();
let fps = 0, fpsAcc = 0, fpsFrames = 0, overlayAcc = 0;

// ═══════════════════════════════════════════════════════════════════════════
// Global time scale — slow everything (projectiles, gaits, physics) so a
// hypervelocity round is legible. The frame loop multiplies dt by this.
// ═══════════════════════════════════════════════════════════════════════════
let timeScale = 1;
let frozen = false;
const timeSlider = $<HTMLInputElement>('time-scale');
function setTimeScale(v: number) {
  timeScale = v; frozen = false;
  timeSlider.value = String(v);
  $('time-val').textContent = v.toFixed(2) + '×';
  $('time-freeze').classList.remove('on');
}
timeSlider.oninput = () => setTimeScale(Number(timeSlider.value));
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('.snap[data-time]')))
  b.onclick = () => setTimeScale(Number(b.dataset.time));
$('time-freeze').onclick = () => { frozen = !frozen; $('time-freeze').classList.toggle('on', frozen); };

// ═══════════════════════════════════════════════════════════════════════════
// Mode switching — Stage (models) · Arsenal Lab · World (environment).
// ═══════════════════════════════════════════════════════════════════════════
const laneGroup = new THREE.Group();
laneGroup.visible = false;
scene.add(laneGroup);

function setMode(mode: string) {
  document.body.dataset.mode = mode;
  // the Style Lab tab is /style.html in a frame — lazy-loaded on first open
  // so the harness pays nothing for it until asked
  if (mode === 'style') {
    const frame = document.getElementById('style-frame') as HTMLIFrameElement | null;
    if (frame && !frame.src) frame.src = '/style.html';
  }
  if (mode === 'beams') {
    const frame = document.getElementById('beams-frame') as HTMLIFrameElement | null;
    if (frame && !frame.src) frame.src = '/beams.html';
  }
  if (mode === 'instruments') {
    const frame = document.getElementById('instrument-frame') as HTMLIFrameElement | null;
    if (frame && !frame.src) frame.src = '/instruments.html';
  }
  // THE UI LAB (/uilab.html) — the real HUD corners with the size knobs live.
  // Same localStorage as the game, so what you dial here is what you play with.
  if (mode === 'uilab') {
    const frame = document.getElementById('uilab-frame') as HTMLIFrameElement | null;
    if (frame && !frame.src) frame.src = '/uilab.html';
  }
  matchupCtl?.setActive(mode === 'matchup');
  for (const t of Array.from(document.querySelectorAll<HTMLButtonElement>('.tab')))
    t.classList.toggle('active', t.dataset.mode === mode);
  const arsenal = mode === 'arsenal';
  laneGroup.visible = arsenal;
  stage.visible = !arsenal;
  overlays.visible = !arsenal;
  syncQuadLabels(); // the quad nameplates follow the stage
  grid.visible = opt.grid && !arsenal && !envMode;
  worldAxes.visible = opt.axes && !arsenal && !envMode;
  if (arsenal) {
    buildLane();
    camera.position.set(laneRange * 0.5, 9, laneRange * 0.75 + 8);
    controls.target.set(laneRange * 0.5, 1, 0);
  } else {
    camera.position.copy(MODEL_CAM); controls.target.copy(MODEL_TARGET);
  }
  requestAnimationFrame(onResize); // let the CSS box settle first
}
for (const t of Array.from(document.querySelectorAll<HTMLButtonElement>('.tab')))
  t.onclick = () => setMode(t.dataset.mode!);

// ═══════════════════════════════════════════════════════════════════════════
// Arsenal Lab — every weapon, side by side, editable, fired down a live lane.
// ═══════════════════════════════════════════════════════════════════════════
const ALL_WEAPONS = Object.keys(WEAPONS) as WeaponId[];
// pristine snapshot for revert + delta export
const origWeapons: Record<string, WeaponDef> = {};
for (const id of ALL_WEAPONS) origWeapons[id] = { ...WEAPONS[id] };

const famOf = (id: WeaponId): string => WEAPONS[id].family ?? 'core';
/** sustained damage/sec ignoring reload — the honest "how hard it hits" number */
const dpsOf = (id: WeaponId) => {
  const w = WEAPONS[id];
  return Math.round((w.heals ? w.damage : w.damage * w.pellets) * w.rof);
};

let selWeapon: WeaponId = 'ar606';
let famFilter = 'all';
let sortKey: string = 'dps';
let sortDir = -1;
let laneRange = 40;

// ── the sortable comparison table ──
interface Col { key: string; label: string; get: (id: WeaponId) => number | string; bar?: boolean; }
const COLS: Col[] = [
  { key: 'name', label: 'Weapon', get: (id) => `${WEAPONS[id].icon ?? ''} ${WEAPONS[id].name}` },
  { key: 'fam', label: 'Family', get: (id) => famOf(id) },
  { key: 'tier', label: 'Mk', get: (id) => WEAPONS[id].tier ?? 0 },
  { key: 'damage', label: 'DMG', get: (id) => WEAPONS[id].damage, bar: true },
  { key: 'rof', label: 'ROF', get: (id) => WEAPONS[id].rof },
  { key: 'dps', label: 'DPS', get: (id) => dpsOf(id), bar: true },
  { key: 'range', label: 'RANGE', get: (id) => WEAPONS[id].range, bar: true },
  { key: 'speed', label: 'SPEED', get: (id) => WEAPONS[id].speed, bar: true },
  { key: 'clip', label: 'CLIP', get: (id) => WEAPONS[id].clip },
  { key: 'reloadTime', label: 'RLD', get: (id) => WEAPONS[id].reloadTime },
  { key: 'splash', label: 'SPL', get: (id) => WEAPONS[id].splash },
  { key: 'knockback', label: 'KB', get: (id) => WEAPONS[id].knockback },
  { key: 'tracer', label: 'ROUND', get: (id) => WEAPONS[id].tracer },
  { key: 'alt', label: 'ALT (RMB)', get: (id) => WEAPONS[id].alt?.kind ?? '' },
];
const colBy = Object.fromEntries(COLS.map((c) => [c.key, c]));

function visibleWeapons(): WeaponId[] {
  const q = ($<HTMLInputElement>('arsenal-search').value || '').toLowerCase();
  let list = ALL_WEAPONS.filter((id) => famFilter === 'all' || famOf(id) === famFilter);
  if (q) list = list.filter((id) => WEAPONS[id].name.toLowerCase().includes(q) || id.includes(q));
  const g = colBy[sortKey].get;
  return list.sort((a, b) => {
    const va = g(a), vb = g(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
    return String(va).localeCompare(String(vb)) * sortDir;
  });
}

function buildFamChips() {
  const host = $('arsenal-fam');
  const fams = ['all', 'core', ...FAMILIES.map((f) => f.family)];
  host.innerHTML = '';
  for (const f of fams) {
    const b = document.createElement('button');
    b.className = 'fam-chip' + (f === famFilter ? ' active' : '');
    b.textContent = f === 'all' ? 'All' : f;
    b.onclick = () => { famFilter = f; buildFamChips(); renderTable(); };
    host.appendChild(b);
  }
}

function renderTable() {
  const list = visibleWeapons();
  // column maxima for the inline comparison bars
  const maxes: Record<string, number> = {};
  for (const c of COLS) if (c.bar) maxes[c.key] = Math.max(1, ...ALL_WEAPONS.map((id) => Number(c.get(id))));
  const head = '<thead><tr>' + COLS.map((c) =>
    `<th data-k="${c.key}" class="${c.key === sortKey ? 'sorted' : ''}">${c.label}${c.key === sortKey ? (sortDir < 0 ? ' ▾' : ' ▴') : ''}</th>`).join('') + '</tr></thead>';
  const rows = list.map((id) => {
    const edited = COLS.some((c) => typeof origWeapons[id][c.key as keyof WeaponDef] === 'number'
      && origWeapons[id][c.key as keyof WeaponDef] !== WEAPONS[id][c.key as keyof WeaponDef]);
    const cells = COLS.map((c) => {
      const v = c.get(id);
      if (c.key === 'name') return `<td>${v}</td>`;
      if (c.key === 'tracer') return `<td><span class="trace-dot" style="background:#${tracerColor(String(v)).toString(16).padStart(6, '0')}"></span> ${v}</td>`;
      if (c.bar) {
        const pct = Math.round((Number(v) / maxes[c.key]) * 100);
        return `<td class="bar-cell"><div class="b" style="width:${pct}%"></div><span>${v}</span></td>`;
      }
      return `<td>${v}</td>`;
    }).join('');
    return `<tr data-id="${id}" class="${id === selWeapon ? 'sel' : ''} ${edited ? 'edited' : ''}">${cells}</tr>`;
  }).join('');
  const table = $<HTMLTableElement>('wtable');
  table.innerHTML = head + '<tbody>' + rows + '</tbody>';
  for (const th of Array.from(table.querySelectorAll('th')))
    (th as HTMLElement).onclick = () => {
      const k = (th as HTMLElement).dataset.k!;
      if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = k === 'name' || k === 'fam' ? 1 : -1; }
      renderTable();
    };
  for (const tr of Array.from(table.querySelectorAll('tbody tr')))
    (tr as HTMLElement).onclick = () => selectWeapon((tr as HTMLElement).dataset.id as WeaponId);
}

// ── the live stat editor ──
interface EdField { key: keyof WeaponDef; label: string; min: number; max: number; step: number; }
const ED_FIELDS: EdField[] = [
  { key: 'damage', label: 'Damage', min: 1, max: 300, step: 1 },
  { key: 'rof', label: 'ROF', min: 0.2, max: 20, step: 0.1 },
  { key: 'speed', label: 'Speed', min: 20, max: 400, step: 5 },
  { key: 'range', label: 'Range', min: 8, max: 160, step: 2 },
  { key: 'pellets', label: 'Pellets', min: 1, max: 16, step: 1 },
  { key: 'clip', label: 'Clip', min: 1, max: 120, step: 1 },
  { key: 'reloadTime', label: 'Reload', min: 0.3, max: 5, step: 0.1 },
  { key: 'spread', label: 'Spread', min: 0, max: 0.3, step: 0.005 },
  { key: 'splash', label: 'Splash', min: 0, max: 10, step: 0.5 },
  { key: 'splashDamage', label: 'Spl.Dmg', min: 0, max: 120, step: 2 },
  { key: 'knockback', label: 'Knockbk', min: 0, max: 30, step: 0.5 },
];

function selectWeapon(id: WeaponId) {
  selWeapon = id;
  const w = WEAPONS[id];
  const host = $('weditor');
  const orig = origWeapons[id];
  const rows = ED_FIELDS.map((f) => {
    const v = w[f.key] as number;
    const dirty = v !== (orig[f.key] as number);
    return `<div class="ed-row" data-k="${f.key}">
      <label>${f.label}</label>
      <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
      <span class="ev ${dirty ? 'dirty' : ''}">${f.step < 1 ? v.toFixed(3) : v}</span>
    </div>`;
  }).join('');
  host.innerHTML = `<h3>${w.name}</h3>
    <div class="wsub">${famOf(id)}${w.tier ? ` · Mk ${w.tier}` : ''} · ${w.tracer} round · id <code>${id}</code></div>
    ${rows}
    <div class="ed-actions">
      <button class="btn-wide primary" id="ed-fire">▶ Fire</button>
      <button class="btn-wide" id="ed-revert">Revert</button>
      <button class="btn-wide" id="ed-copy">Copy Δ</button>
    </div>
    <div class="hint" id="ed-copied" style="margin-top:6px"></div>`;
  for (const row of Array.from(host.querySelectorAll('.ed-row'))) {
    const key = (row as HTMLElement).dataset.k as keyof WeaponDef;
    const f = ED_FIELDS.find((x) => x.key === key)!;
    const slider = row.querySelector('input') as HTMLInputElement;
    const ev = row.querySelector('.ev') as HTMLElement;
    slider.oninput = () => {
      const val = Number(slider.value);
      (WEAPONS[id][key] as number) = val;
      ev.textContent = f.step < 1 ? val.toFixed(3) : String(val);
      ev.classList.toggle('dirty', val !== (origWeapons[id][key] as number));
      renderTable();
    };
  }
  $('ed-fire').onclick = () => fireInLane(id);
  $('ed-revert').onclick = () => { WEAPONS[id] = { ...origWeapons[id] }; selectWeapon(id); renderTable(); };
  $('ed-copy').onclick = () => {
    const diffs = ED_FIELDS.filter((f) => WEAPONS[id][f.key] !== origWeapons[id][f.key])
      .map((f) => `${f.key}: ${WEAPONS[id][f.key]}  (was ${origWeapons[id][f.key]})`);
    const text = diffs.length ? `${id} (${WEAPONS[id].name})\n  ${diffs.join('\n  ')}` : `${id}: no changes`;
    navigator.clipboard?.writeText(text);
    $('ed-copied').textContent = diffs.length ? `Copied ${diffs.length} change(s) — paste to me.` : 'No changes to copy.';
  };
  renderTable();
}

// ── the firing lane: shooter at origin, dummy at range, distance rings ──
function buildLane() {
  for (const c of [...laneGroup.children]) { laneGroup.remove(c); disposeGroup(c); }
  const shooter = buildSoldier(0, 'infantry', 'bot');
  shooter.rotation.y = Math.PI / 2; // face +X, down the lane
  laneGroup.add(shooter);
  const target = buildSoldier(1, 'infantry', 'zombie');
  target.position.set(laneRange, 0, 0);
  target.rotation.y = -Math.PI / 2;
  laneGroup.add(target);
  // distance rings + labels every 10u
  for (let d = 10; d <= laneRange + 0.1; d += 10) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.28, 32),
      new THREE.MeshBasicMaterial({ color: 0x3a4657, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.set(d, 0.02, 0); ring.scale.setScalar(6);
    laneGroup.add(ring);
    laneGroup.add(makeLabel(`${d}u`, 0x6a7686, new THREE.Vector3(d, 0.1, 3.4), 0.6));
  }
}

function detonate(p: Proj) {
  const at = p.mesh.position.clone();
  if (p.splash && p.splash > 0) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.35, 40),
      new THREE.MeshBasicMaterial({ color: p.color ?? 0xff8840, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.set(at.x, 0.05, at.z);
    ring.scale.setScalar(p.splash * 2.4);
    laneGroup.add(ring);
    fx.push({ obj: ring, life: 0.5, max: 0.5, kind: 'tracer' });
  }
  const flash = new THREE.PointLight(p.color ?? 0xffcc66, 8, 8);
  flash.position.copy(at); laneGroup.add(flash);
  fx.push({ obj: flash, life: 0.16, max: 0.16, kind: 'tracer' });
  if (p.dmgText) {
    const lab = makeLabel(p.dmgText, 0xff6a6a, at.clone().add(new THREE.Vector3(0, 1.4, 0)), 0.9);
    laneGroup.add(lab); fx.push({ obj: lab, life: 1.2, max: 1.2, kind: 'text' });
  }
}

function fireInLane(id: WeaponId) {
  const def = WEAPONS[id];
  const from = new THREE.Vector3(0.9, 1.35, 0);
  const to = new THREE.Vector3(laneRange, 1.2, 0);
  const color = tracerColor(def.tracer === 'none' ? 'bullet' : def.tracer);
  const dmgText = def.heals ? `+${def.damage}` : `-${def.damage * def.pellets}`;
  // instant-tracer weapons (rail/beam/plasma, speed >= 200) read as hitscan
  if (def.speed >= 200) {
    const len = from.distanceTo(to);
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.09, 0.09),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    beam.position.copy(from.clone().add(to).multiplyScalar(0.5));
    beam.rotation.z = Math.atan2(to.y - from.y, to.x - from.x);
    laneGroup.add(beam); fx.push({ obj: beam, life: 0.14, max: 0.14, kind: 'tracer' });
    detonate({ mesh: { position: to } as THREE.Mesh, splash: def.splash, dmgText, color } as Proj);
    return;
  }
  // real velocity — you SEE how fast it flies; slow time to study it
  const vel = new THREE.Vector3(def.speed, def.arc ? def.speed * 0.5 : 0, 0);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(def.arc ? 0.4 : Math.min(1.4, 0.5 + def.speed / 120), 0.14, 0.14),
    new THREE.MeshBasicMaterial({ color }),
  );
  head.position.copy(from);
  laneGroup.add(head);
  const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }));
  laneGroup.add(line);
  projectiles.push({ mesh: head, vel, arc: def.arc, life: 6, trail: [from.clone()], line,
    detonateX: laneRange, splash: def.splash, dmgText, color });
}

// lane range slider
const laneSlider = $<HTMLInputElement>('lane-range');
laneSlider.oninput = () => {
  laneRange = Number(laneSlider.value);
  $('lane-val').textContent = String(laneRange);
  if (document.body.dataset.mode === 'arsenal') buildLane();
};
$('arsenal-fire').onclick = () => fireInLane(selWeapon);
$<HTMLInputElement>('arsenal-search').oninput = () => renderTable();

buildFamChips();
selectWeapon('ar606');

// ═══════════════════════════════════════════════════════════════════════════
// Terrain Truth — what the ground does, read LIVE from the sim's own tables.
// Sight/walk cells are sampled through the real blocksShot/isBlocked at real
// heights on a scratch grid, and the drill column is the sim's DRILL_EATS —
// this card is incapable of drifting from the game.
// ═══════════════════════════════════════════════════════════════════════════
{
  const host = $('terrain-tables');
  // scratch grid: one tile of each type under the probe point
  const scratch = new Uint8Array(GRID * GRID);
  const px = (50 + 0.5) * TILE - WORLD / 2, pz = (50 + 0.5) * TILE - WORLD / 2;
  const probe = (t: number) => {
    scratch[50 * GRID + 50] = t;
    return {
      walk: !isBlocked(scratch, px, pz),
      eye: !blocksShot(scratch, px, pz, 1.4),   // the window band — soldier eyes/muzzle
      high: !blocksShot(scratch, px, pz, 2.5),  // above the band, below wall tops
      sky: !blocksShot(scratch, px, pz, 5),     // second-storey / skyline height
    };
  };
  const TILES: [number, string, string][] = [
    [T_OPEN, 'Open ground', 'the neutral tile'],
    [T_WALL, 'Wall', '4u tall; the drill’s favorite meal'],
    [T_COVER, 'Low cover', 'crates/sandbags — shoot over, not through'],
    [T_SLIT, 'Window slit', 'sight & fire pass ONLY in the 1.2–1.8 eye band'],
    [T_DOOR, 'Door (closed)', 'E opens; stops rounds and eyes'],
    [T_DOOR_OPEN, 'Door (open)', 'a doorway — walk and shoot through'],
    [T_METAL, 'Metal wall', 'the drill screams and sparks — ZERO progress'],
    [T_CLIMB, 'Climb barricade', '2.5u — jump troopers jet over it; everyone else walks around (§8.7)'],
    [T_LADDER, 'Ladder foot', 'E climbs to the second storey'],
    [T_WATER, 'Shallow water', 'everyone wades (slow); wheels ford'],
    [T_DEEP, 'Deep water', 'soldiers swim (no shooting); boats/hover only'],
  ];
  const y = (ok: boolean) => ok ? '<span style="color:#7fc97f">✔</span>' : '<span style="color:#e05555">✘</span>';
  const drill = (t: number) => DRILL_EATS.has(t) ? '🍽 eats' : t === T_METAL ? '⚡ sparks' : '—';
  let html = `<table class="mini-table"><thead><tr>
    <th style="text-align:left">Tile</th><th title="soldier boots">walk</th>
    <th title="sight/fire at eye height 1.4">eye 1.4</th>
    <th title="sight/fire at 2.5 — above the window band">2.5</th>
    <th title="sight/fire at second-storey height">5.0</th>
    <th title="what the breacher's drill does to it">drill</th></tr></thead><tbody>`;
  for (const [t, name, note] of TILES) {
    const p = probe(t);
    html += `<tr title="${note}"><td style="text-align:left">${name}</td>
      <td>${y(p.walk)}</td><td>${y(p.eye)}</td><td>${y(p.high)}</td><td>${y(p.sky)}</td>
      <td>${drill(t)}</td></tr>`;
  }
  html += '</tbody></table>';

  // the SURFACE layer (§8.6): what the ground IS, orthogonal to blocking
  const SURFACES: [number, string, string][] = [
    [S_DIRT, 'Dirt/rock', 'the neutral surface'],
    [S_GRASS, 'Grass', 'savanna fields'],
    [S_ICE, 'Ice', 'triton — slick under wheels'],
    [S_GRIT, 'Colony grit', 'titan — drags everything'],
    [S_PLATE, 'Deck plate', 'starship floors — wheels love it'],
    [S_WET, 'Wet floor', 'europa dome'],
    [S_MUD, 'Mud', 'water margins — wheels hate it'],
  ];
  const mult = (v: number) => v === 1 ? '1' : `<b>${v}</b>`;
  html += `<div class="hint" style="margin-top:8px">Surface speed multipliers (§8.6) — boots/striders · wheels · tracks. Hover ignores all of it.</div>
    <table class="mini-table"><thead><tr><th style="text-align:left">Surface</th><th>🥾</th><th>🛞</th><th>⛓</th></tr></thead><tbody>`;
  for (const [sf, name, note] of SURFACES) {
    html += `<tr title="${note}"><td style="text-align:left">${name}</td>
      <td>${mult(SURF_SOLDIER[sf] ?? 1)}</td><td>${mult(SURF_WHEELS[sf] ?? 1)}</td><td>${mult(SURF_TRACKS[sf] ?? 1)}</td></tr>`;
  }
  html += `</tbody></table>
    <div class="hint" style="margin-top:8px">Second storey: upstairs walls block 4–8u; upper windows fire in the 5.2–5.8 band; step onto VOID and you fall. The skyline rule: anything standing above 3u is silhouetted — ground walls don't hide it.</div>`;
  host.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════
// Biome Audio — the soundscape designation table, auditionable in place.
// ═══════════════════════════════════════════════════════════════════════════
{
  const host = $('biome-audio-list');
  for (const id of Object.keys(BIOME_AUDIO) as ThemeId[]) {
    const b = BIOME_AUDIO[id];
    const row = document.createElement('div');
    row.className = 'snd-row';
    row.style.gridTemplateColumns = '20px 74px 1fr 20px';
    const filled = (n: string) => audio.getBuffer(n as SoundName) ? '' : ' style="opacity:0.45" title="slot empty — universal fallback"';
    row.innerHTML = `
      <span>${THEMES[id].icon}</span>
      <span class="snd-name">${id}</span>
      <span class="hint"${filled(b.footstep)}>${b.surface} · <code>${b.footstep}</code> / <code>${b.ambience}</code></span>
      <button title="toggle ambience bed">∿</button>`;
    const [, , , ambBtn] = Array.from(row.children) as HTMLElement[];
    const stepBtn = document.createElement('button');
    stepBtn.textContent = '▶'; stepBtn.title = 'audition footstep';
    row.insertBefore(stepBtn, row.children[3]);
    row.style.gridTemplateColumns = '20px 74px 1fr 20px 20px';
    stepBtn.onclick = async () => {
      if (!audioReady) { await audio.init(); audio.resume(); audioReady = true; }
      if (!audio.play(b.footstep, { volume: 0.8 })) audio.play('footstep', { volume: 0.8 });
    };
    (ambBtn as HTMLButtonElement).onclick = async () => {
      if (!audioReady) { await audio.init(); audio.resume(); audioReady = true; }
      if (audio.looping(b.ambience)) { audio.stopLoop(b.ambience); ambBtn.style.color = ''; }
      else if (audio.loop(b.ambience, b.ambVol * 2)) ambBtn.style.color = 'var(--cyan)';
      else ambBtn.style.color = 'var(--bad)'; // slot empty — nothing to loop yet
    };
    host.appendChild(row);
  }
}

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
(window as unknown as Record<string, unknown>).__h = {
  THREE, scene, stage, current, poseSoldierJoints, armDirs, audio,
  WEAPONS, projectiles, laneGroup, fireInLane, setMode,
  get timeScale() { return timeScale; },
};

function frame(now: number) {
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // global time scale: slow everything down (or freeze) to study fast rounds
  const dt = frozen ? 0 : realDt * timeScale;
  animTime += dt;

  // fps (measured on real wall-clock time, not the scaled sim time)
  fpsAcc += realDt; fpsFrames++;
  if (fpsAcc >= 0.5) { fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; $('ro-fps').textContent = fps.toFixed(0); }

  // soldier animation (shared with the game renderer, markers included)
  if (current.isSoldier && current.root && !envMode) {
    if (opt.anim) {
      const markers = poseSoldierJoints(current.joints, {
        kind: current.kind, time: animTime, id: current.id,
        speed: opt.speed, airborne: opt.airborne,
        dt, state: stageGait,
      });
      // with the Sound Lab enabled, the stage plays its animation markers —
      // audition footsteps and growls exactly as the game fires them
      if (audioReady) {
        if (markers.footstep) audio.play('footstep', { volume: 0.6 });
        if (markers.growl) audio.play('growl', { volume: 0.6 });
      }
      // arrows/markers track the moving joints — throttled so we don't rebuild
      // canvas sprites every single frame
      if (opt.armvec || opt.joints) {
        overlayAcc += dt;
        if (overlayAcc >= 0.08) { overlayAcc = 0; rebuildOverlays(); }
      }
      // THE FEEL LAYER — the live iteration knobs (turn/holds/throw/cast/flight)
      applyFeelLayer(dt);
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
    const crossed = p.detonateX !== undefined && p.mesh.position.x >= p.detonateX;
    const grounded = p.mesh.position.y <= 0.02 && p.vel.y < 0;
    if (p.life <= 0 || grounded || crossed || p.mesh.position.length() > 300) {
      if (p.detonateX !== undefined && (crossed || grounded)) detonate(p);
      (p.mesh.parent ?? stage).remove(p.mesh); (p.line.parent ?? stage).remove(p.line);
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
      (f.obj.parent ?? stage).remove(f.obj);
      if (f.obj instanceof THREE.Mesh) { f.obj.geometry.dispose(); (f.obj.material as THREE.Material).dispose(); }
      fx.splice(i, 1);
    }
  }

  if (opt.turntable && current.root && !envMode && !feel.turn) stage.rotation.y += dt * 0.6;

  if (matchupCtl?.active) matchupCtl.tick(dt); // the street fight runs on the SAME clock the Time slider owns

  controls.update();
  if (opt.quad && stage.visible && !envMode) renderQuad();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// boot: show a zombie first — it's the model this harness was built to fix.
showModel(() => buildSoldier(0, 'infantry', 'zombie'), 'Zombie · zombie', { soldier: true, kind: 'zombie' });
$<HTMLInputElement>('opt-armvec').checked = true; opt.armvec = true; rebuildOverlays();
onResize(); // match the renderer to the canvas's real CSS box
requestAnimationFrame(frame);


// ═══════════════════════════════════════════════════════════════════════════
// Building Lab — grow a blueprint from a seed and walk around it. The place
// to EXPERIMENT with floor plans and the second storey before they ship.
// ═══════════════════════════════════════════════════════════════════════════

/** Build a 3D preview straight from a stencil — both storeys, no sim needed. */
function buildStencilGroup(def: BuildingDef, showUpper: boolean, showRoof: boolean): THREE.Group {
  const g = new THREE.Group();
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const ox = (-w * TILE) / 2, oz = (-h * TILE) / 2;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.75, roughness: 0.35 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x7a6f52, roughness: 0.85 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xd9a53f, roughness: 0.6 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.95 });
  const put = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
    mesh.position.set(ox + (x + 0.5) * TILE, y, oz + (z + 0.5) * TILE);
    mesh.castShadow = true;
    g.add(mesh);
  };
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const ch = (def.rows[z] ?? '')[x] ?? ' ';
      if (ch === '#') put(new THREE.Mesh(new THREE.BoxGeometry(TILE, 4, TILE), wallMat), x, 2, z);
      else if (ch === 'M') put(new THREE.Mesh(new THREE.BoxGeometry(TILE, 4, TILE), metalMat), x, 2, z);
      else if (ch === 'S') {
        put(new THREE.Mesh(new THREE.BoxGeometry(TILE, 1.2, TILE), wallMat), x, 0.6, z);
        put(new THREE.Mesh(new THREE.BoxGeometry(TILE, 2.2, TILE), wallMat), x, 2.9, z);
      } else if (ch === 'D') {
        // doors sit IN their wall's plane (the game renderer got this right;
        // the preview showed Robert a sideways slab): solid left/right in the
        // stencil means the wall runs X, so the door spans X too
        const solidCh = (c?: string) => c === '#' || c === 'M' || c === 'S' || c === 'D';
        const row = def.rows[z] ?? '';
        const spansX = solidCh(row[x - 1]) || solidCh(row[x + 1]);
        put(new THREE.Mesh(new THREE.BoxGeometry(spansX ? TILE : 0.35, 2.2, spansX ? 0.35 : TILE), doorMat), x, 1.1, z);
      } else if (ch === 'C') put(new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.9, 1.2, TILE * 0.9), crateMat), x, 0.6, z);
      else if (ch === 'L') {
        // the staircase (matches the game renderer): treads to the storey,
        // stringers on the slope — ascending toward the nearest stencil wall
        const cx = ox + (x + 0.5) * TILE, cz = oz + (z + 0.5) * TILE;
        const stair = new THREE.Group();
        const STEPS = 7;
        const runSpan = TILE * 0.8;
        for (let i = 0; i < STEPS; i++) {
          const tread = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.62, 0.14, 0.5), railMat);
          tread.position.set(0, ((i + 1) / STEPS) * 4 - 0.07, TILE * 0.36 - (i + 0.5) * (runSpan / STEPS));
          stair.add(tread);
        }
        const rise = 4 * ((STEPS - 1) / STEPS);
        const run = runSpan * ((STEPS - 1) / STEPS);
        for (const side of [-TILE * 0.28, TILE * 0.28]) {
          const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.1, Math.hypot(rise, run) + 0.6, 0.14), railMat);
          stringer.position.set(side, (4 + 0.57) / 2 - 0.07, TILE * 0.36 - runSpan / 2);
          stringer.rotation.x = Math.atan2(run, rise);
          stair.add(stringer);
        }
        const solidCh = (c?: string) => c === '#' || c === 'M' || c === 'S';
        const row = def.rows[z] ?? '';
        const above = def.rows[z - 1] ?? '', below = def.rows[z + 1] ?? '';
        if (solidCh(row[x - 1])) stair.rotation.y = Math.PI / 2;
        else if (solidCh(row[x + 1])) stair.rotation.y = -Math.PI / 2;
        else if (solidCh(above[x])) stair.rotation.y = 0;
        else if (solidCh(below[x])) stair.rotation.y = Math.PI;
        stair.position.set(cx, 0, cz);
        g.add(stair);
      }
    }
  }
  if (def.rows2 && showUpper) {
    for (let z = 0; z < def.rows2.length; z++) {
      for (let x = 0; x < w; x++) {
        const ch = (def.rows2[z] ?? '')[x] ?? ' ';
        if (ch === ' ') continue;
        if (ch !== 'L') put(new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.25, TILE), floorMat), x, 4.1, z);
        if (ch === '#') put(new THREE.Mesh(new THREE.BoxGeometry(TILE, 3.75, TILE), wallMat), x, 6.1, z);
        else if (ch === 'S') {
          put(new THREE.Mesh(new THREE.BoxGeometry(TILE, 1.0, TILE), wallMat), x, 4.72, z);
          put(new THREE.Mesh(new THREE.BoxGeometry(TILE, 2.2, TILE), wallMat), x, 6.9, z);
        }
      }
    }
  }
  if (showRoof) {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w * TILE, 0.3, h * TILE),
      new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.85, transparent: true, opacity: 0.92 }),
    );
    roof.position.set(0, def.floors === 2 ? 8.15 : 4.15, 0);
    g.add(roof);
  }
  return g;
}

function blDef(): BuildingDef {
  const typeSel = $<HTMLSelectElement>('bl-type').value;
  const seed = Number($<HTMLInputElement>('bl-seed').value) || 1;
  const lib = $<HTMLSelectElement>('bl-lib').value;
  if (lib) return [...BUILDINGS, ...FRONT_STENCILS].find((b) => b.id === lib)!;
  if (typeSel === 'manor2') {
    // reroll until the manor grows its loft (the 45% roll) — capped
    const rng = new Rng(seed);
    for (let i = 0; i < 40; i++) {
      const def = generateHouse(rng, 'manor');
      if (def.floors === 2) return def;
    }
    return generateHouse(new Rng(seed), 'manor');
  }
  return generateHouse(new Rng(seed), typeSel as DynHouseType);
}

function blBuild() {
  const def = blDef();
  const showUpper = $<HTMLInputElement>('bl-upper').checked;
  const showRoof = $<HTMLInputElement>('bl-roof').checked;
  showModel(() => buildStencilGroup(def, showUpper, showRoof), `${def.name} — ${def.floors === 2 ? 'two storeys' : 'one storey'}`);
  const nl = String.fromCharCode(10);
  const ascii = def.rows.join(nl) + (def.rows2 ? nl + '──── upstairs ────' + nl + def.rows2.join(nl) : '');
  $('bl-ascii').textContent = ascii;
  const w = Math.max(...def.rows.map((r) => r.length)) * TILE;
  camera.position.set(w * 0.75, w * 0.85, w * 1.05);
  controls.target.set(0, 2.5, 0);
}

{
  const libSel = $<HTMLSelectElement>('bl-lib');
  // the category shelf: function-axis chips filter the library; biome-fit
  // rides the option labels so a builder can see where each piece belongs
  let cat: BuildingDef['kind'] | 'all' = 'all';
  const fillLib = () => {
    libSel.innerHTML = '<option value="">— pick one —</option>';
    // shelf stock + the authored front/compound stock (the Keep, the XL
    // barracks…) — the Lab previews everything the game can stamp
    for (const b of [...BUILDINGS, ...FRONT_STENCILS]) {
      if (cat !== 'all' && b.kind !== cat) continue;
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = `${b.name} (${b.kind})${b.biomes ? ' · ' + b.biomes.join(',') : ''}`;
      libSel.appendChild(o);
    }
  };
  const catRow = $('bl-cats');
  for (const c of [{ kind: 'all' as const, label: 'All' },
    { kind: 'house' as const, label: 'Houses' },
    { kind: 'commercial' as const, label: 'Commercial' },
    { kind: 'industrial' as const, label: 'Industrial' },
    { kind: 'military' as const, label: 'Military' },
    { kind: 'ruin' as const, label: 'Ruins' }]) {
    const b = chip(c.label, '', () => {
      cat = c.kind;
      catRow.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      fillLib();
    });
    if (c.kind === 'all') b.classList.add('active');
    catRow.appendChild(b);
  }
  fillLib();
  libSel.onchange = blBuild;
  $<HTMLSelectElement>('bl-type').onchange = () => { libSel.value = ''; blBuild(); };
  $('bl-build').onclick = blBuild;
  $('bl-dice').onclick = () => {
    $<HTMLInputElement>('bl-seed').value = String(1 + Math.floor(Math.random() * 99999));
    blBuild();
  };
  $<HTMLInputElement>('bl-upper').onchange = blBuild;
  $<HTMLInputElement>('bl-roof').onchange = blBuild;
}


// ── the default-footstep picker: three candidates, one throne ───────────────
{
  const sel = $<HTMLSelectElement>('footstep-default');
  sel.value = audio.getDefaultFootstep();
  sel.onchange = () => {
    audio.setDefaultFootstep(sel.value as SoundName);
    audio.play('footstep');
  };
  $('footstep-try').onclick = async () => {
    await audio.init();
    audio.resume();
    audio.play('footstep');
  };
}

// ── Matchup — any UF vs any Collective LSW, in a street, until one drops ────
let matchupCtl: import('./matchup').MatchupCtl | undefined;
{
  const { mountMatchup } = await import('./matchup');
  matchupCtl = mountMatchup($('matchup'));
}

// ── Map Maker — the AAA editor tab (engine: src/sim/mapedit.ts) ─────────────
{
  const { mountMaker } = await import('./mapmaker');
  mountMaker($('maker'), {
    preview3D: (map) => {
      setMode('world');
      loadEnvironment('tdm', 1, 'savanna', map);
    },
    launchScience: (spec) => {
      setMode('world');
      loadEnvironment('science', spec.seed, spec.theme, undefined, spec);
    },
  });
}
