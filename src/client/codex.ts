// ---------------------------------------------------------------------------
// THE CODEX — the master sheet (Robert: "we need a master sheet… that has the
// speed, the armor, the damage they can take… all relevant statistics, and I
// want to be able to see the models and stuff. I want to be able to compare
// stuff, and I wanted to be on the game menu").
//
// ONE LAW: every number on this page is READ OR DERIVED FROM THE SIM'S OWN
// TABLES at render time. Nothing here is transcribed. If a designer nudges a
// buggy's hp in data.ts, the Codex says so on the next open — a stat sheet
// that can drift from the game is worse than no stat sheet, because people
// believe it.
//
// The derived numbers (shots-to-kill, effective HP) reproduce world.ts's real
// damage rules; tests/codex.test.ts drives the ACTUAL World.damageVehicle and
// asserts the Codex predicts it, so the mirror can't rot quietly.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { CLASSES, VEHICLES, WEAPONS, ZOMBIE_STATS, IRON_STATS, TEAM_NAMES } from '../sim/data';
import { LSWS, THREAT } from '../sim/lsw';
import { SYSTEM_IDS, type AscendantId, type ClassId, type SoldierKind, type VehicleDef, type VehicleKind, type WeaponDef, type WeaponId } from '../sim/types';
import { buildSoldier, dressAsLsw } from './models/soldiers';
import { buildVehicle } from './models/vehicles';

// ── reference weapons for shots-to-kill, and the zombie the numbers answer to ─
// Robert: "add the damage to kill a zombie for the weapons — a regular old
// zombie." One trigger pull is the unit; a shotgun's pellets count as one pull.
const REF: Record<'rifle' | 'shotgun' | 'pistol', WeaponId> = { rifle: 'ar606', shotgun: 'caw', pistol: 'pistol' };
const PLAIN_ZED_HP = ZOMBIE_STATS.zombie.hp; // 60 — "a regular old zombie"

/** Trigger pulls of `wid` to drop a pool of `hp` (pellets count once). */
function shotsToKill(hp: number, wid: WeaponId): number {
  const w = WEAPONS[wid];
  if (!w) return Infinity;
  const per = soldierDamagePerShot(w);
  return per > 0 ? Math.ceil(hp / per) : Infinity;
}

// ── the sim's damage rules, restated where the Codex can do arithmetic on ────
// them. Each is pinned to world.ts by a test.

/** world.damageVehicle: 65% of every hit reaches the hull; 35% chews a system. */
export const HULL_SHARE = 0.65;
/** The hand grenade is the GL round — the yardstick Robert reasons in. */
export const FRAG: WeaponId = 'gl';

/**
 * What ONE trigger pull of this weapon does to a hull it hits dead-on.
 * Mirrors world.ts: a weapon with splash resolves through explode() (splash +
 * half its direct damage, undiminished at zero range) and never also applies
 * its direct hit; a solid round applies damage once per pellet.
 */
export function vehicleDamagePerShot(def: WeaponDef): number {
  if (def.splash > 0) return def.splashDamage + def.damage * 0.5;
  return def.damage * Math.max(1, def.pellets);
}

/** What one trigger pull does to a man standing in the open. */
export function soldierDamagePerShot(def: WeaponDef): number {
  if (def.splash > 0) return def.splashDamage + def.damage;
  return def.damage * Math.max(1, def.pellets);
}

/**
 * Hits to wreck a hull — SIMULATED, not solved.
 *
 * The 35% that misses the hull lands on a RANDOM live subsystem, and anything
 * past that system's last point is LOST rather than passed on. So the answer
 * is a distribution, not a number, and the honest single figure is its median.
 * A fixed PRNG makes it reproducible: the Codex shows the same number twice.
 */
export function hitsToKill(def: VehicleDef, dmg: number, trials = 201): number {
  if (dmg <= 0) return Infinity;
  const sysMax = def.systemHp ?? 60;
  const out: number[] = [];
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let t = 0; t < trials; t++) {
    let hull = def.hp;
    const sys = SYSTEM_IDS.map(() => sysMax);
    let n = 0;
    while (hull > 0 && n < 400) {
      n++;
      const share = dmg * (1 - HULL_SHARE);
      hull -= dmg - share;
      const i = Math.min(sys.length - 1, Math.floor(rnd() * sys.length));
      if (sys[i] > 0) sys[i] = Math.max(0, sys[i] - share); // overflow is eaten
      else hull -= share;                                   // dead system passes it on
    }
    out.push(n);
  }
  out.sort((a, b) => a - b);
  return out[out.length >> 1];
}

/** Everything a hull can absorb before it dies: armour plus its five systems. */
export function effectiveHp(def: VehicleDef): number {
  return def.hp + SYSTEM_IDS.length * (def.systemHp ?? 60);
}

/** Sustained damage per second — the clip, the reload, and the honest average. */
export function sustainedDps(def: WeaponDef, perShot: number): number {
  if (def.rof <= 0) return 0;
  if (!isFinite(def.clip) || def.clip <= 0) return perShot * def.rof;
  const cycle = def.clip / def.rof + def.reloadTime;
  return (def.clip * perShot) / cycle;
}

// ── the stat descriptor: ONE source of truth for both the sheet's columns ────
// and the compare tray's rows, so the two can never disagree about a number.

type Row = Record<string, unknown> & { id: string; name: string };
interface Stat {
  key: string;
  label: string;
  /** 1 = higher is better, -1 = lower is better, 0 = neither (a fact, not a score) */
  better: 1 | -1 | 0;
  /** shown in the dense master sheet (the rest live in the detail/compare only) */
  sheet?: boolean;
  fmt?: (v: unknown) => string;
}

const n0 = (v: unknown) => (typeof v === 'number' && isFinite(v) ? Math.round(v).toString() : '—');
const n1 = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v.toFixed(1) : '—');
const txt = (v: unknown) => (v == null || v === '' ? '—' : String(v));
const yn = (v: unknown) => (v ? '●' : '·');

const VEHICLE_STATS: Stat[] = [
  { key: 'hp', label: 'Hull', better: 1, sheet: true, fmt: n0 },
  { key: 'sysHp', label: 'Per system', better: 1, fmt: n0 },
  { key: 'ehp', label: 'Total damage taken', better: 1, sheet: true, fmt: n0 },
  { key: 'frags', label: 'Grenades to kill', better: 1, sheet: true, fmt: n0 },
  { key: 'speed', label: 'Speed (u/s)', better: 1, sheet: true, fmt: n1 },
  { key: 'turnDeg', label: 'Turn (°/s)', better: 1, sheet: true, fmt: n0 },
  { key: 'seats', label: 'Seats', better: 0, sheet: true, fmt: n0 },
  { key: 'weaponName', label: 'Armament', better: 0, sheet: true, fmt: txt },
  { key: 'dps', label: 'Sustained DPS', better: 1, sheet: true, fmt: n0 },
  { key: 'range', label: 'Weapon reach (u)', better: 1, fmt: n0 },
  { key: 'radius', label: 'Hull radius (u)', better: -1, fmt: n1 },
  { key: 'flies', label: 'Flies', better: 0, sheet: true, fmt: yn },
  { key: 'hover', label: 'Crosses water', better: 0, fmt: yn },
  { key: 'stall', label: 'Cannot hover (stall %)', better: 0, fmt: (v) => (typeof v === 'number' && v > 0 ? `${Math.round(v * 100)}%` : '·') },
  { key: 'antiAir', label: 'Anti-air', better: 0, sheet: true, fmt: yn },
  { key: 'bombs', label: 'Bomb load', better: 0, fmt: (v) => (v ? n0(v) : '·') },
  { key: 'mobileSpawn', label: 'Mobile spawn', better: 0, fmt: yn },
  { key: 'liftoff', label: 'Spool-up (s)', better: -1, fmt: (v) => (v ? n1(v) : '·') },
];

const WEAPON_STATS: Stat[] = [
  { key: 'family', label: 'Family', better: 0, sheet: true, fmt: txt },
  { key: 'fireMode', label: 'Fire mode', better: 0, sheet: true, fmt: txt }, // 10.1: the trigger discipline
  { key: 'secondary', label: 'Secondary', better: 0, fmt: txt },             // RMB: the under-barrel surprise
  { key: 'damage', label: 'Damage / shot', better: 1, sheet: true, fmt: n1 },
  { key: 'pellets', label: 'Pellets', better: 0, fmt: n0 },
  { key: 'rof', label: 'Rounds / s', better: 1, sheet: true, fmt: n1 },
  { key: 'dps', label: 'Sustained DPS', better: 1, sheet: true, fmt: n0 },
  { key: 'burst', label: 'Burst DPS', better: 1, fmt: n0 },
  { key: 'ttk', label: 'Shots to drop a 100hp man', better: -1, sheet: true, fmt: n0 },
  { key: 'zed', label: 'Shots to drop a zombie', better: -1, sheet: true, fmt: n0 },
  { key: 'buggy', label: 'Shots to kill a buggy', better: -1, sheet: true, fmt: n0 },
  { key: 'clip', label: 'Clip', better: 1, sheet: true, fmt: (v) => (isFinite(v as number) ? n0(v) : '∞') },
  { key: 'reloadTime', label: 'Reload (s)', better: -1, fmt: n1 },
  { key: 'range', label: 'Range (u)', better: 1, sheet: true, fmt: n0 },
  { key: 'speed', label: 'Muzzle (u/s)', better: 1, fmt: (v) => ((v as number) >= 200 ? 'hitscan' : n0(v)) },
  { key: 'splash', label: 'Splash radius (u)', better: 1, fmt: (v) => (v ? n1(v) : '·') },
  { key: 'splashDamage', label: 'Splash damage', better: 1, fmt: (v) => (v ? n0(v) : '·') },
  { key: 'knockback', label: 'Knockback', better: 1, sheet: true, fmt: (v) => (v ? n0(v) : '·') },
  { key: 'ragdolls', label: 'Ragdolls on a clean hit', better: 0, fmt: yn },
];

const CLASS_STATS: Stat[] = [
  { key: 'hp', label: 'Health', better: 1, sheet: true, fmt: n0 },
  { key: 'speed', label: 'Speed (u/s)', better: 1, sheet: true, fmt: n1 },
  { key: 'regen', label: 'Stamina regen', better: 1, sheet: true, fmt: (v) => `${n1(v)}×` },
  { key: 'sprint', label: 'Sprint speed (u/s)', better: 1, sheet: true, fmt: n1 },
  { key: 'primaryName', label: 'Primary', better: 0, sheet: true, fmt: txt },
  { key: 'secondaryName', label: 'Sidearm', better: 0, sheet: true, fmt: txt },
  { key: 'abilityName', label: 'Ability', better: 0, sheet: true, fmt: txt },
  { key: 'pdps', label: 'Primary DPS', better: 1, sheet: true, fmt: n0 },
  { key: 'prange', label: 'Primary reach (u)', better: 1, fmt: n0 },
];

// ── the gods (Robert: "codex definitely needs the living super weapons"). Every
// figure derives from lsw.ts: HP off the THREAT table, arm off the signature
// weapon, and — the law that matters — HOW MANY RIFLE ROUNDS KILL IT, because
// "threat buys HP, never immunity" is only real if the sheet proves it.
const ASCENDANT_STATS: Stat[] = [
  { key: 'threatName', label: 'Threat', better: 0, sheet: true, fmt: txt },
  { key: 'hp', label: 'Health', better: 1, sheet: true, fmt: n0 },
  { key: 'faction', label: 'Stable', better: 0, sheet: true, fmt: txt },
  { key: 'armName', label: 'Signature arm', better: 0, sheet: true, fmt: txt },
  { key: 'armDps', label: 'Arm DPS', better: 1, sheet: true, fmt: n0 },
  { key: 'rifleShots', label: 'AR rounds to kill', better: -1, sheet: true, fmt: n0 },
  { key: 'tankShells', label: 'Tank shells to kill', better: -1, sheet: true, fmt: n0 },
  { key: 'movement', label: 'Movement', better: 0, sheet: true, fmt: txt },
  { key: 'ability', label: 'Signature power', better: 0, fmt: txt },
  { key: 'flies', label: 'Flies', better: 0, fmt: yn },
  { key: 'speed', label: 'Speed (u/s)', better: 1, fmt: n1 },
  { key: 'scale', label: 'Size (× a trooper)', better: 0, fmt: (v) => `${n1(v)}×` },
];

// ── the threats (Robert: "the damage to kill a regular old zombie… a THREATS
// section"). Undead + Iron Eaters, with the shots-to-kill by rifle / shotgun /
// pistol so a player knows what closes the distance and what does not.
const THREAT_STATS: Stat[] = [
  { key: 'family', label: 'Kind', better: 0, sheet: true, fmt: txt },
  { key: 'hp', label: 'Health', better: 1, sheet: true, fmt: n0 },
  { key: 'plate', label: 'Molt (armor)', better: 1, sheet: true, fmt: (v) => (v ? n0(v) : '·') },
  { key: 'speed', label: 'Speed (u/s)', better: 0, sheet: true, fmt: n1 },
  { key: 'rifleShots', label: 'AR rounds to kill', better: -1, sheet: true, fmt: n0 },
  { key: 'shotgunShots', label: 'Shotgun to kill', better: -1, sheet: true, fmt: n0 },
  { key: 'pistolShots', label: 'Pistol to kill', better: -1, sheet: true, fmt: n0 },
  { key: 'score', label: 'Kill score', better: 0, sheet: true, fmt: n0 },
];

// M1: the sprint multiplier and the ragdoll threshold, restated from world.ts.
const SPRINT_MULT = 1.35;
const RAGDOLL_AT = 16;

// ── building the rows ───────────────────────────────────────────────────────

function vehicleRows(): Row[] {
  const frag = vehicleDamagePerShot(WEAPONS[FRAG]);
  return (Object.keys(VEHICLES) as VehicleKind[]).map((kind) => {
    const d = VEHICLES[kind];
    const w = d.weapon ? WEAPONS[d.weapon] : undefined;
    return {
      id: kind,
      name: d.name,
      hp: d.hp,
      sysHp: d.systemHp ?? 60,
      ehp: effectiveHp(d),
      frags: hitsToKill(d, frag),
      speed: d.speed,
      turnDeg: (d.turnRate * 180) / Math.PI,
      seats: d.seats,
      weaponName: w ? w.name : 'Unarmed',
      dps: w ? sustainedDps(w, vehicleDamagePerShot(w)) : 0,
      range: w ? w.range : 0,
      radius: d.radius,
      flies: !!d.flies,
      hover: !!d.hover,
      stall: d.minAirspeed ?? 0,
      antiAir: !!d.antiAir,
      bombs: d.bombs ?? 0,
      mobileSpawn: d.mobileSpawn,
      liftoff: d.liftoffTime ?? 0,
    };
  });
}

function weaponRows(): Row[] {
  const buggy = VEHICLES.buggy;
  return (Object.keys(WEAPONS) as WeaponId[]).map((id) => {
    const d = WEAPONS[id];
    const perMan = soldierDamagePerShot(d);
    const perHull = vehicleDamagePerShot(d);
    return {
      id,
      name: d.name,
      family: d.family ? `${d.family}${d.tier ? ` mk${d.tier}` : ''}` : '—',
      fireMode: d.charge ? 'charge' : (d.fireMode ?? 'auto'),
      secondary: d.alt ? d.alt.kind : '—',
      damage: perMan,
      pellets: Math.max(1, d.pellets),
      rof: d.rof,
      dps: sustainedDps(d, perMan),
      burst: perMan * d.rof,
      ttk: perMan > 0 ? Math.ceil(100 / perMan) : Infinity,
      zed: perMan > 0 ? Math.ceil(PLAIN_ZED_HP / perMan) : Infinity,
      buggy: perHull > 0 ? hitsToKill(buggy, perHull) : Infinity,
      clip: d.clip,
      reloadTime: d.reloadTime,
      range: d.range,
      speed: d.speed,
      splash: d.splash,
      splashDamage: d.splashDamage,
      knockback: d.knockback,
      ragdolls: d.knockback >= RAGDOLL_AT,
    };
  });
}

function classRows(): Row[] {
  return (Object.keys(CLASSES) as ClassId[]).map((id) => {
    const c = CLASSES[id];
    const p = WEAPONS[c.primary];
    const s = WEAPONS[c.secondary];
    return {
      id,
      name: c.name,
      hp: c.hp,
      speed: c.speed,
      regen: c.energyRegen ?? 1,
      sprint: c.speed * SPRINT_MULT,
      primaryName: p.name,
      secondaryName: s.name,
      abilityName: c.abilityName,
      pdps: sustainedDps(p, soldierDamagePerShot(p)),
      prange: p.range,
      desc: c.desc,
    };
  });
}

const MOVE_LABEL: Record<string, string> = { leap: 'Leaps', blinkwalk: 'Blink-walks' };

function ascendantRows(): Row[] {
  return (Object.keys(LSWS) as AscendantId[]).map((id) => {
    const g = LSWS[id];
    const arm = WEAPONS[g.weapon];
    const hp = THREAT[g.threat].hp;
    return {
      id,
      name: g.name,
      threatName: THREAT[g.threat].name,
      hp,
      faction: TEAM_NAMES[g.faction],
      armName: arm ? arm.name : '—',
      armDps: arm ? sustainedDps(arm, soldierDamagePerShot(arm)) : 0,
      // "threat buys HP, never immunity" — the sheet's job is to prove it
      rifleShots: shotsToKill(hp, REF.rifle),
      tankShells: shotsToKill(hp, 'tank_cannon'),
      movement: g.flies ? 'Flies' : MOVE_LABEL[g.moves ?? ''] ?? 'Grounded',
      ability: g.activeLabel,
      flies: !!g.flies,
      speed: g.speed,
      scale: g.scale,
      desc: `Threat ${THREAT[g.threat].name} · ${TEAM_NAMES[g.faction]}. Signature power: ${g.activeLabel}.`,
    };
  });
}

function threatRows(): Row[] {
  const zed = (Object.keys(ZOMBIE_STATS) as (keyof typeof ZOMBIE_STATS)[]).map((k) => {
    const z = ZOMBIE_STATS[k];
    const cap = k.charAt(0).toUpperCase() + k.slice(1);
    return {
      id: k, name: cap, family: 'Undead', hp: z.hp, plate: 0, speed: z.speed,
      rifleShots: shotsToKill(z.hp, REF.rifle),
      shotgunShots: shotsToKill(z.hp, REF.shotgun),
      pistolShots: shotsToKill(z.hp, REF.pistol),
      score: z.score,
      desc: `The undead. ${z.hp} HP, moves ${z.speed} u/s.`,
    };
  });
  const iron = (Object.keys(IRON_STATS) as (keyof typeof IRON_STATS)[]).map((k) => {
    const i = IRON_STATS[k];
    const pool = i.hp + i.plate; // the molt sheds first, then the frame is EXPOSED
    const cap = k.charAt(0).toUpperCase() + k.slice(1);
    return {
      id: k, name: cap, family: 'Iron Eater', hp: i.hp, plate: i.plate, speed: i.speed,
      rifleShots: shotsToKill(pool, REF.rifle),
      shotgunShots: shotsToKill(pool, REF.shotgun),
      pistolShots: shotsToKill(pool, REF.pistol),
      score: i.score,
      desc: `Scrap given hunger. ${i.plate} molt over ${i.hp} frame — strip the plate and the frame takes DOUBLE.`,
    };
  });
  return [...zed, ...iron];
}

// ── the model bench: one renderer, thumbnails baked once, live turntable ─────

type ModelKind = 'vehicle' | 'class' | 'ascendant' | 'threat';

let bench: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  holder: THREE.Group;
} | null = null;

const thumbs = new Map<string, string>(); // "vehicle:tank" → data URL, baked once

function makeBench() {
  if (bench) return bench;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  // the same two-light rig the game uses, so a hull reads here the way it
  // reads on the field — a codex lit differently is a codex that lies
  scene.add(new THREE.HemisphereLight(0xdfe9f2, 0x53514a, 1.15));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
  sun.position.set(6, 12, 8);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const holder = new THREE.Group();
  scene.add(holder);
  bench = { renderer, scene, camera, holder };
  return bench;
}

function buildModel(kind: ModelKind, id: string): THREE.Object3D {
  if (kind === 'vehicle') return buildVehicle(id as VehicleKind, 0);
  if (kind === 'threat') {
    // the id IS the SoldierKind for zeds/iron — buildSoldier routes on kind
    return buildSoldier(0, 'infantry', id as SoldierKind);
  }
  if (kind === 'ascendant') {
    // a god is a dressed trooper: build the faction body, then the god's shell
    const g = LSWS[id as AscendantId];
    const mesh = buildSoldier(g.faction, 'infantry', 'human');
    dressAsLsw(mesh, id as AscendantId);
    return mesh;
  }
  return buildSoldier(0, id as ClassId, 'human');
}

/**
 * Frame the camera on whatever was just mounted. The roster runs from a 1.8u
 * soldier to a 4.4u bomber, so this solves the fit rather than guessing at a
 * multiplier: back off far enough to clear the box in BOTH axes, using the
 * rotating silhouette's radius for width so the model never clips as it turns.
 */
function frame(b: NonNullable<typeof bench>, obj: THREE.Object3D, spin: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const mid = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.2, Math.hypot(size.x, size.z) / 2);
  const halfH = Math.max(0.2, size.y / 2);
  const vFov = (b.camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * b.camera.aspect);
  // clear the tallest dimension AND the widest sweep, then stand off by the
  // near half of the model itself plus a small breathing margin
  const dist = Math.max(halfH / Math.tan(vFov / 2), radius / Math.tan(hFov / 2)) * 1.12 + radius;
  b.camera.position.set(Math.cos(spin) * dist, mid.y + halfH * 0.55, Math.sin(spin) * dist);
  b.camera.lookAt(mid.x, mid.y, mid.z);
}

/** Bake a still of every entry once, so the sheet can show what it is talking about. */
function bakeThumbs(kind: ModelKind, ids: string[]) {
  const b = makeBench();
  const W = 132, H = 88;
  b.renderer.setSize(W, H, false);
  b.camera.aspect = W / H;
  for (const id of ids) {
    const key = `${kind}:${id}`;
    if (thumbs.has(key)) continue;
    b.holder.clear();
    let obj: THREE.Object3D;
    try {
      obj = buildModel(kind, id);
    } catch {
      continue; // a model that won't build must not take the whole sheet down
    }
    b.holder.add(obj);
    b.camera.updateProjectionMatrix();
    frame(b, obj, 0.9);
    b.renderer.render(b.scene, b.camera);
    thumbs.set(key, b.renderer.domElement.toDataURL('image/png'));
  }
  b.holder.clear();
}

// ── the page ────────────────────────────────────────────────────────────────

type SectionId = 'vehicles' | 'weapons' | 'infantry' | 'ascendants' | 'threats';
interface Section { id: SectionId; label: string; stats: Stat[]; rows: () => Row[]; model?: ModelKind }

const SECTIONS: Section[] = [
  { id: 'vehicles', label: 'Vehicles', stats: VEHICLE_STATS, rows: vehicleRows, model: 'vehicle' },
  { id: 'weapons', label: 'Weapons', stats: WEAPON_STATS, rows: weaponRows },
  { id: 'infantry', label: 'Infantry', stats: CLASS_STATS, rows: classRows, model: 'class' },
  { id: 'ascendants', label: 'Ascendants', stats: ASCENDANT_STATS, rows: ascendantRows, model: 'ascendant' },
  { id: 'threats', label: 'Threats', stats: THREAT_STATS, rows: threatRows, model: 'threat' },
];

let section: SectionId = 'vehicles';
let sortKey = 'name';
let sortDir: 1 | -1 = 1;
let query = '';
let selected: string | null = null;
const pinned = new Map<SectionId, string[]>(); // compare tray, per section
let raf = 0;
let spin = 0;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function cur(): Section { return SECTIONS.find((s) => s.id === section)!; }
function pins(): string[] { return pinned.get(section) ?? []; }

// Built once per section and kept. The weapon sheet runs a kill simulation for
// every one of ~300 entries; recomputing that on each keystroke of the filter
// would make typing feel like wading.
const rowCache = new Map<SectionId, Row[]>();
function rowsFor(sec: Section): Row[] {
  let r = rowCache.get(sec.id);
  if (!r) { r = sec.rows(); rowCache.set(sec.id, r); }
  return r;
}

/**
 * The arsenal generates family variants, so the weapon sheet is ~300 rows
 * long. Completeness is right — a master sheet that hides entries is not a
 * master sheet — but it has to be searchable to be readable. Matches name,
 * id and family, so "laser", "mk3" and "ar606" all land.
 */
function filtered(rows: Row[]): Row[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    r.name.toLowerCase().includes(q)
    || r.id.toLowerCase().includes(q)
    || String(r.family ?? '').toLowerCase().includes(q));
}

function sorted(rows: Row[]): Row[] {
  const s = [...rows];
  s.sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    if (typeof x === 'number' && typeof y === 'number') {
      // Infinity sorts last whichever way you are facing — "never" is not "best"
      const ax = isFinite(x) ? x : Number.MAX_VALUE, by = isFinite(y) ? y : Number.MAX_VALUE;
      return (ax - by) * sortDir;
    }
    if (typeof x === 'boolean' && typeof y === 'boolean') return (Number(y) - Number(x)) * sortDir;
    return String(x ?? '').localeCompare(String(y ?? '')) * sortDir;
  });
  return s;
}

/** For a compare row: which pinned entries hold the best value? */
function winners(stat: Stat, vals: unknown[]): boolean[] {
  if (!stat.better) return vals.map(() => false);
  const fmt = stat.fmt ?? txt;
  const nums = vals.map((v) => {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    // A cell that PRINTS as absent cannot win. Spool-up 0 means "this thing
    // has no rotors", not "it spools instantly" — and lower-is-better would
    // otherwise hand the crown to every vehicle that never had the stat.
    const s = fmt(v);
    return s === '·' || s === '—' ? null : v;
  });
  const live = nums.filter((v): v is number => v !== null);
  if (live.length < 2) return vals.map(() => false);
  const best = stat.better === 1 ? Math.max(...live) : Math.min(...live);
  // a tie across every pin is not a win — nothing is highlighted
  if (live.every((v) => v === best)) return vals.map(() => false);
  return nums.map((v) => v !== null && v === best);
}

function renderSheet(root: HTMLElement) {
  const sec = cur();
  const rows = sorted(filtered(rowsFor(sec)));
  const cols = sec.stats.filter((s) => s.sheet);
  if (!rows.length) {
    root.innerHTML = `<p class="cx-hint" style="padding:0.8rem">Nothing in the ${esc(sec.label.toLowerCase())} matches “${esc(query)}”.</p>`;
    return;
  }
  const head = `<th class="cx-th-name">Designation</th>` + cols.map((c) =>
    `<th data-k="${c.key}" class="${sortKey === c.key ? 'cx-sorted' : ''}">${esc(c.label)}${sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}</th>`).join('');
  const body = rows.map((r) => {
    const th = sec.model ? thumbs.get(`${sec.model}:${r.id}`) : undefined;
    const pin = pins().includes(r.id);
    return `<tr data-id="${r.id}" class="${selected === r.id ? 'cx-on' : ''}${pin ? ' cx-pin' : ''}">
      <td class="cx-td-name">${th ? `<img src="${th}" alt="" loading="lazy">` : '<span class="cx-nomodel"></span>'}<b>${esc(r.name)}</b></td>
      ${cols.map((c) => `<td class="cx-num">${esc((c.fmt ?? txt)(r[c.key]))}</td>`).join('')}
    </tr>`;
  }).join('');
  root.innerHTML = `<table class="cx-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

  root.querySelectorAll<HTMLTableCellElement>('th[data-k]').forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.k!;
      if (sortKey === k) sortDir = sortDir === 1 ? -1 : 1;
      else { sortKey = k; sortDir = k === 'name' ? 1 : -1; } // numbers open biggest-first
      draw();
    };
  });
  root.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
    tr.onclick = () => { selected = tr.dataset.id!; draw(); };
  });
}

function renderDetail(root: HTMLElement) {
  const sec = cur();
  // the detail follows the FILTER: with a search live, it lands on something
  // the sheet is actually showing rather than a row scrolled out of existence
  const rows = sorted(filtered(rowsFor(sec)));
  const row = rows.find((r) => r.id === selected) ?? rows[0];
  if (!row) { root.innerHTML = ''; return; }
  selected = row.id;
  const pin = pins().includes(row.id);
  const stats = sec.stats.map((s) =>
    `<div class="cx-stat"><span>${esc(s.label)}</span><b>${esc((s.fmt ?? txt)(row[s.key]))}</b></div>`).join('');
  root.innerHTML = `
    <div class="cx-bench" id="cx-bench">${sec.model ? '' : '<span class="cx-nobench">No model — this is a weapon system, carried</span>'}</div>
    <h4 class="cx-dname">${esc(row.name)}</h4>
    ${typeof row.desc === 'string' ? `<p class="cx-desc">${esc(row.desc)}</p>` : ''}
    <div class="cx-stats">${stats}</div>
    <button class="cx-pinbtn${pin ? ' on' : ''}" id="cx-pin">${pin ? '✕ Unpin' : '⊕ Pin to compare'}</button>`;

  const btn = root.querySelector<HTMLButtonElement>('#cx-pin')!;
  btn.onclick = () => {
    const list = pins().slice();
    const i = list.indexOf(row.id);
    if (i >= 0) list.splice(i, 1);
    else { list.push(row.id); if (list.length > 3) list.shift(); } // three columns fit; the oldest falls off
    pinned.set(section, list);
    draw();
  };

  const host = root.querySelector<HTMLElement>('#cx-bench')!;
  if (sec.model) mountTurntable(host, sec.model, row.id);
}

function mountTurntable(host: HTMLElement, kind: ModelKind, id: string) {
  const b = makeBench();
  host.appendChild(b.renderer.domElement);
  b.holder.clear();
  let obj: THREE.Object3D | null;
  try { obj = buildModel(kind, id); } catch { obj = null; }
  if (!obj) { host.innerHTML = '<span class="cx-nobench">Model unavailable</span>'; return; }
  b.holder.add(obj);
  const model = obj;
  cancelAnimationFrame(raf);
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const w = host.clientWidth || 300, h = host.clientHeight || 200;
    if (w < 2 || h < 2) return;
    b.renderer.setSize(w, h, false);
    b.camera.aspect = w / h;
    b.camera.updateProjectionMatrix();
    spin += 0.006;
    frame(b, model, spin);
    b.renderer.render(b.scene, b.camera);
  };
  tick();
}

function renderCompare(root: HTMLElement) {
  const sec = cur();
  const list = pins();
  if (list.length < 2) {
    root.innerHTML = `<p class="cx-hint">Pin two or three to compare them side by side${list.length ? ` — ${list.length} pinned` : ''}.</p>`;
    return;
  }
  const rows = rowsFor(sec); // pins survive the filter — that is the point of pinning
  const picked = list.map((id) => rows.find((r) => r.id === id)).filter((r): r is Row => !!r);
  const head = picked.map((r) => {
    const th = sec.model ? thumbs.get(`${sec.model}:${r.id}`) : undefined;
    return `<th>${th ? `<img src="${th}" alt="">` : ''}<span>${esc(r.name)}</span></th>`;
  }).join('');
  const body = sec.stats.map((s) => {
    const vals = picked.map((r) => r[s.key]);
    const win = winners(s, vals);
    return `<tr><th class="cx-crow">${esc(s.label)}</th>${vals.map((v, i) =>
      `<td class="cx-num${win[i] ? ' cx-best' : ''}">${esc((s.fmt ?? txt)(v))}</td>`).join('')}</tr>`;
  }).join('');
  root.innerHTML = `<table class="cx-compare"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
    <button class="cx-clear" id="cx-clear">Clear comparison</button>`;
  root.querySelector<HTMLButtonElement>('#cx-clear')!.onclick = () => { pinned.set(section, []); draw(); };
}

let host: HTMLElement | null = null;

function draw() {
  if (!host) return;
  const sec = cur();
  const all = rowsFor(sec);
  if (sec.model) bakeThumbs(sec.model, all.map((r) => r.id));
  host.querySelectorAll<HTMLButtonElement>('.cx-tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.sec === section));
  const shown = filtered(all).length;
  const count = host.querySelector<HTMLElement>('#cx-count');
  if (count) count.textContent = shown === all.length
    ? `${all.length} on file — every figure read live from the sim's own tables.`
    : `${shown} of ${all.length} shown.`;
  renderSheet(host.querySelector<HTMLElement>('#cx-sheet')!);
  renderDetail(host.querySelector<HTMLElement>('#cx-detail')!);
  renderCompare(host.querySelector<HTMLElement>('#cx-cmp')!);
}

/**
 * Mount the Codex into a menu pane. Safe to call every time the tab opens —
 * models and thumbnails are cached module-wide, so the second open is instant.
 */
export function renderCodex(root: HTMLElement) {
  host = root;
  root.innerHTML = `
    <div class="cx">
      <div class="cx-head">
        <nav class="cx-tabs">${SECTIONS.map((s) =>
          `<button class="cx-tab" data-sec="${s.id}">${esc(s.label)}</button>`).join('')}</nav>
        <input id="cx-q" class="cx-q" type="search" placeholder="Filter by name, family or id…" autocomplete="off">
        <span class="cx-note" id="cx-count"></span>
      </div>
      <div class="cx-body">
        <div class="cx-sheet-wrap"><div id="cx-sheet"></div></div>
        <aside id="cx-detail" class="cx-detail"></aside>
      </div>
      <div id="cx-cmp" class="cx-cmp"></div>
    </div>`;
  root.querySelectorAll<HTMLButtonElement>('.cx-tab').forEach((t) => {
    t.onclick = () => {
      section = t.dataset.sec as SectionId;
      sortKey = 'name'; sortDir = 1; selected = null; query = '';
      const q = root.querySelector<HTMLInputElement>('#cx-q');
      if (q) q.value = '';
      draw();
    };
  });
  const q = root.querySelector<HTMLInputElement>('#cx-q')!;
  q.oninput = () => { query = q.value; selected = null; draw(); };
  draw();
}

/** Stop the turntable when the Codex tab loses the floor. */
export function pauseCodex() {
  cancelAnimationFrame(raf);
  raf = 0;
}
