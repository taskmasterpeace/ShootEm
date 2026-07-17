// ---------------------------------------------------------------------------
// The deterministic visual test harness: 70+ table-driven cases that build
// every procedural model headlessly (Three.js scene-graph needs no WebGL)
// and assert the visual contract — named animation joints, forward-facing
// undead arms, per-vehicle named parts, sane bounding boxes, triangle
// budgets, collision-vs-mesh coverage, deterministic map generation, and
// the absolute no-purple rule.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { zombieArmRest } from '../src/client/animation';
import {
  buildFlag, buildGadget, buildGate, buildPad, buildPickup, buildProp,
  buildSoldier, buildTurretMesh, buildVehicle,
} from '../src/client/models';
import { CLASSES, THEMES, VEHICLES } from '../src/sim/data';
import { generateMap, isBlocked } from '../src/sim/map';
import type { ClassId, GadgetType, ModeId, Team, ThemeId, VehicleKind, ZedKind } from '../src/sim/types';

// ---- shared probes -------------------------------------------------------

function bbox(o: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
}

function triangles(o: THREE.Object3D): number {
  let tris = 0;
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const idx = m.geometry.index;
      const pos = m.geometry.attributes.position;
      tris += idx ? idx.count / 3 : pos ? pos.count / 3 : 0;
    }
  });
  return tris;
}

/** World-space direction a limb points (its local −Y), after updateMatrixWorld. */
function limbDir(root: THREE.Object3D, name: string): THREE.Vector3 | null {
  const joint = root.getObjectByName(name);
  if (!joint) return null;
  root.updateMatrixWorld(true);
  return new THREE.Vector3(0, -1, 0).applyQuaternion(joint.getWorldQuaternion(new THREE.Quaternion())).normalize();
}

/** The absolute rule: no purple, ever. */
function assertNoPurple(root: THREE.Object3D, label: string) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !m.color) return;
    for (const c of [m.color, (m as THREE.MeshStandardMaterial).emissive].filter(Boolean) as THREE.Color[]) {
      const r = c.r * 255, g = c.g * 255, b = c.b * 255;
      const purple = b > g + 40 && r > g + 20 && b > 90;
      expect(purple, `${label}: purple material rgb(${r | 0},${g | 0},${b | 0})`).toBe(false);
    }
  });
}

const SOLDIER_JOINTS = ['legL', 'legR', 'shinL', 'shinR', 'armL', 'armR', 'head', 'torso'];

// ---- 1. troopers: 8 classes × 2 teams (16 cases) --------------------------

describe('visual: troopers', () => {
  const classes = Object.keys(CLASSES) as ClassId[];
  const cases = classes.flatMap((c) => ([0, 1] as Team[]).map((t) => [c, t] as const));
  it.each(cases)('%s (team %i) has every animation joint, a gun, and a soldier-sized silhouette', (classId, team) => {
    const g = buildSoldier(team, classId, 'bot');
    for (const j of SOLDIER_JOINTS) expect(g.getObjectByName(j), j).toBeTruthy();
    expect(g.getObjectByName('gun'), 'gun').toBeTruthy();
    const s = bbox(g);
    expect(s.y).toBeGreaterThan(1.5);
    expect(s.y).toBeLessThan(2.6);
    expect(Math.max(s.x, s.z)).toBeLessThan(2.6);
    expect(triangles(g)).toBeLessThan(1200);
  });
});

// ---- 1b. faction identity: the two armies must READ differently -----------

describe('visual: faction identity', () => {
  const SKIN = 0xd0a67e;
  const hasSkin = (root: THREE.Object3D) => {
    let found = false;
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.color && (m.color.getHex() === SKIN)) found = true;
    });
    return found;
  };
  const emissiveCount = (root: THREE.Object3D) => {
    let n = 0;
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.emissive && m.emissive.getHex() !== 0) n++;
    });
    return n;
  };
  const hasSphere = (root: THREE.Object3D) => {
    let found = false;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry?.type === 'SphereGeometry') found = true;
    });
    return found;
  };

  it('the United Front shows a human face; the Collective is SEALED', () => {
    for (const c of ['infantry', 'heavy', 'medic', 'engineer'] as ClassId[]) {
      expect(hasSkin(buildSoldier(0, c, 'bot')), `UF ${c} has skin`).toBe(true);
      expect(hasSkin(buildSoldier(1, c, 'bot')), `Collective ${c} shows NO skin`).toBe(false);
    }
  });

  it('the Collective wears the dome (sphere helm); the Front wears the box helmet', () => {
    expect(hasSphere(buildSoldier(1, 'infantry', 'bot'))).toBe(true);
    expect(hasSphere(buildSoldier(0, 'infantry', 'bot'))).toBe(false);
  });

  it('both factions carry glowing team accents — the Collective glows MORE', () => {
    const ufGlow = emissiveCount(buildSoldier(0, 'infantry', 'bot'));
    const colGlow = emissiveCount(buildSoldier(1, 'infantry', 'bot'));
    expect(ufGlow).toBeGreaterThanOrEqual(1);
    expect(colGlow).toBeGreaterThan(ufGlow); // glow lines are their skin
  });
});

// ---- 2. the undead: 6 kinds, arms reach FORWARD (6 cases) ------------------

describe('visual: the undead reach forward', () => {
  const zeds: ZedKind[] = ['zombie', 'spitter', 'brute', 'sprinter', 'bomber', 'stalker'];
  it.each(zeds)('%s: both arms point toward +X at rest', (kind) => {
    const g = buildSoldier(0, 'infantry', kind);
    for (const arm of ['armL', 'armR']) {
      const d = limbDir(g, arm);
      expect(d, arm).toBeTruthy();
      expect(d!.x, `${kind}.${arm} x-component`).toBeGreaterThan(0.5);
    }
    expect(zombieArmRest(kind, true)).toBeGreaterThan(0);
    expect(g.getObjectByName('gun')).toBeFalsy(); // the dead don't shoot
  });
});

// ---- 3. Dr. Voss (1 case) --------------------------------------------------

describe('visual: the scientist', () => {
  it('Dr. Voss is jointed, unarmed, and person-sized', () => {
    const g = buildSoldier(0, 'medic', 'scientist');
    for (const j of SOLDIER_JOINTS) expect(g.getObjectByName(j), j).toBeTruthy();
    expect(g.getObjectByName('gun')).toBeFalsy();
    expect(bbox(g).y).toBeGreaterThan(1.5);
  });
});

// ---- 4. vehicles: 11 kinds with their named working parts (11 cases) -------

const VEHICLE_PARTS: Record<VehicleKind, string[]> = {
  buggy: ['turret', 'gunRecoil'],
  tank: ['turret', 'gunRecoil'],
  apc: ['turret', 'gunRecoil'],
  skiff: ['turret', 'gunRecoil', 'thrustL', 'thrustR'],
  hoverboard: ['rider', 'thrustL'],
  bike: ['rider', 'turret', 'gunRecoil'],
  flyer: ['turret', 'gunRecoil', 'rotorL', 'rotorR'],
  transport: ['turret', 'gunRecoil', 'spin'],
  ambulance: ['pulse', 'healRing'],
  tunneler: ['drill', 'pulse'],
  emplacement: ['turret', 'gunRecoil'],
  mech: ['legL', 'legR', 'turret', 'gunRecoil', 'pulse'],
  boat: ['turret', 'gunRecoil'],
};

describe('visual: vehicles', () => {
  it.each(Object.keys(VEHICLE_PARTS) as VehicleKind[])('%s has its working parts and fits its collision radius', (kind) => {
    const g = buildVehicle(kind, 0);
    for (const part of VEHICLE_PARTS[kind]) expect(g.getObjectByName(part), part).toBeTruthy();
    // ground-aura overlays (heal radius etc.) are HUD-like, not hull — any
    // node marked userData.aura is excluded from the body measurement
    const auras: THREE.Object3D[] = [];
    g.traverse((o) => { if (o.userData.aura) auras.push(o); });
    for (const a of auras) a.removeFromParent();
    const s = bbox(g);
    const r = VEHICLES[kind].radius;
    // the mesh should be in the same size class as its collision circle
    expect(Math.max(s.x, s.z) / 2, 'extent vs radius').toBeGreaterThan(r * 0.45);
    expect(Math.max(s.x, s.z) / 2, 'extent vs radius').toBeLessThan(r * 3.2);
    expect(triangles(g)).toBeLessThan(1500);
    // wheeled kinds expose their axles to the renderer
    if (['buggy', 'apc', 'bike', 'transport', 'ambulance'].includes(kind)) {
      expect((g.userData.wheels as unknown[]).length).toBeGreaterThan(0);
    }
  });
});

// ---- 5. gadgets: 10 types (10 cases) ---------------------------------------

describe('visual: gadgets', () => {
  const gadgets: GadgetType[] = ['warpA', 'warpB', 'target_beacon', 'orbital', 'shield', 'drone', 'supply_pod', 'camera', 'smoke_field', 'fire_field'];
  it.each(gadgets)('%s builds a visible, bounded gadget', (type) => {
    const g = buildGadget(type, 0);
    expect(g.children.length).toBeGreaterThan(0);
    const s = bbox(g);
    expect(Math.max(s.x, s.y, s.z)).toBeGreaterThan(0.1);
    expect(Math.max(s.x, s.y, s.z)).toBeLessThan(12);
  });
});

// ---- 6. pickups: 4 types (4 cases) -----------------------------------------

describe('visual: pickups', () => {
  it.each(['medkit', 'ammo', 'energy', 'flamer'])('%s pickup is a small readable token', (type) => {
    const g = buildPickup(type);
    expect(g.children.length).toBeGreaterThan(0);
    expect(Math.max(...bbox(g).toArray())).toBeLessThan(2);
  });
});

// ---- 7. props: 4 types, rocks cover their collision (4 cases) --------------

describe('visual: props', () => {
  it.each(['rock', 'tree', 'crate', 'bunker', 'clone_bay', 'silo', 'flare_stack', 'crane', 'wreck'])('%s prop builds visibly', (type) => {
    const p = buildProp(type, 1.6);
    expect(Math.max(...bbox(p).toArray())).toBeGreaterThan(0.5);
    if (type === 'rock') {
      // what blocks you is what you see: mesh radius ≥ 90% of the blocked disc
      const scale = 1.6;
      const blockedRadius = Math.max(1, Math.round(scale / 1.6)) * 2; // tiles → world units
      expect(bbox(p).x / 2).toBeGreaterThan(blockedRadius * 0.9);
    }
  });
});

// ---- 8. structures: turret, flag, gate, lift pad (4 cases) ------------------

describe('visual: structures', () => {
  it('sentry turret has a named head and eye', () => {
    const t = buildTurretMesh(0);
    expect(t.getObjectByName('head')).toBeTruthy();
    expect(t.getObjectByName('eye')).toBeTruthy();
  });
  it('flag has a cloth the renderer waves', () => {
    expect(buildFlag(1).getObjectByName('cloth')).toBeTruthy();
  });
  it('jump gate has a spinning portal ring', () => {
    expect(buildGate().getObjectByName('spin')).toBeTruthy();
  });
  it('grav-lift pad has a pulsing lens', () => {
    expect(buildPad().getObjectByName('pulse')).toBeTruthy();
  });
});

// ---- 9. map determinism per theme (6 cases) ---------------------------------

describe('visual: deterministic maps per theme', () => {
  it.each(Object.keys(THEMES) as ThemeId[])('%s generates identical grids for identical seeds', (theme) => {
    const a = generateMap(4242, 'conquest', theme);
    const b = generateMap(4242, 'conquest', theme);
    expect(a.grid).toEqual(b.grid);
    expect(a.props.length).toBe(b.props.length);
    expect(a.theme).toBe(theme);
  });
});

// ---- 10. map integrity per mode (7 cases) -----------------------------------

describe('visual: map integrity per mode', () => {
  it.each(['tdm', 'ctf', 'koth', 'conquest', 'survival', 'horde', 'safehouse'] as ModeId[])(
    '%s keeps spawns, pads, and objectives on open ground', (mode) => {
      const m = generateMap(1337, mode);
      for (const team of [0, 1] as const) {
        for (const sp of m.spawns[team]) expect(isBlocked(m.grid, sp.x, sp.z), 'spawn').toBe(false);
      }
      for (const pad of m.vehiclePads) expect(isBlocked(m.grid, pad.pos.x, pad.pos.z), `pad ${pad.kind}`).toBe(false);
      for (const cp of m.controlPoints) expect(isBlocked(m.grid, cp.pos.x, cp.pos.z), 'cp').toBe(false);
      expect(isBlocked(m.grid, m.hillPos.x, m.hillPos.z), 'hill').toBe(false);
    },
  );
});

// ---- 11. the no-purple rule, everywhere (3 cases) ---------------------------

describe('visual: no purple, ever', () => {
  it('no soldier or undead material is purple', () => {
    for (const c of Object.keys(CLASSES) as ClassId[]) assertNoPurple(buildSoldier(0, c, 'bot'), c);
    for (const z of ['zombie', 'spitter', 'brute', 'sprinter', 'bomber', 'stalker'] as ZedKind[]) {
      assertNoPurple(buildSoldier(0, 'infantry', z), z);
    }
  });
  it('no vehicle material is purple', () => {
    for (const k of Object.keys(VEHICLES) as VehicleKind[]) {
      assertNoPurple(buildVehicle(k, 0), k);
      assertNoPurple(buildVehicle(k, 1), k);
    }
  });
  it('no gadget, pickup, prop, or structure material is purple', () => {
    for (const t of ['warpA', 'warpB', 'target_beacon', 'orbital', 'shield', 'drone', 'supply_pod', 'camera', 'smoke_field', 'fire_field'] as GadgetType[]) {
      assertNoPurple(buildGadget(t, 0), t);
    }
    for (const p of ['medkit', 'ammo', 'energy', 'flamer']) assertNoPurple(buildPickup(p), p);
    for (const p of ['rock', 'tree', 'crate', 'bunker', 'clone_bay', 'silo', 'flare_stack', 'crane', 'wreck']) assertNoPurple(buildProp(p, 1.2), p);
    assertNoPurple(buildTurretMesh(0), 'turret');
    assertNoPurple(buildGate(), 'gate');
    assertNoPurple(buildPad(), 'pad');
    assertNoPurple(buildFlag(0), 'flag');
  });
});
