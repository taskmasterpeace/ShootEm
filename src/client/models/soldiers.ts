// Soldier-shaped things: troopers per class, the undead, Dr. Voss, the K9,
// and the riders that vehicles borrow.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TEAM_COLORS } from '../../sim/data';
import { zombieArmRest } from '../animation';
import { solveTwoHandedGrip } from './grip';
import { buildWeaponModel } from './weapons';
import type { ClassId, SoldierKind, Team } from '../../sim/types';
import { LSWS } from '../../sim/lsw';
import { box, cyl, limb, mat } from './shared';

// ---------------------------------------------------------------------------
// GLB BODIES (Robert's models, tools/add-soldier.mjs): every class probes
// /models/soldier_<class>.glb at boot — a file that exists wears in, a 404
// stays procedural, ZERO code wiring per model. Bodies are segmented into
// the SAME eight named joints the animator swings, so gait/ragdoll/melee
// never know the difference. United Front only (the faction law: Collective
// shows no skin), and only once the one cached download lands — until then,
// and forever in tests, the procedural trooper stands in. Never a pop
// mid-soldier: the choice is made per-build, not per-frame.
// ---------------------------------------------------------------------------
const GLB_CLASSES: ClassId[] = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];
const GLB_BODIES: Partial<Record<ClassId, string>> = Object.fromEntries(
  GLB_CLASSES.map((c) => [c, `/models/soldier_${c}.glb`]),
);
const glbBodies = new Map<string, THREE.Group>();
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  for (const url of Object.values(GLB_BODIES)) {
    try {
      new GLTFLoader().load(url, (gltf) => {
        repairGlbRig(gltf.scene); // welded-arm bodies get their joints back
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            const m = o.material as THREE.MeshStandardMaterial;
            m.vertexColors = true;
            // the baked colors wash out under the game sun — pull them down
            // toward the procedural UF olive so both bodies read as one army
            m.color.setRGB(0.62, 0.60, 0.52);
            m.roughness = 0.9;
          }
        });
        glbBodies.set(url, gltf.scene);
      }, undefined, () => { /* absent file = procedural forever; no drama */ });
    } catch { /* headless env */ }
  }
}

/**
 * RIG REPAIR (the character audit, Robert's "arms don't move with the arrow"):
 * a segmented body whose armL/armR nodes own NO geometry cannot swing its
 * arms — the joints animate (harness arrows track them) while the visible
 * arms stay welded into the torso mesh. soldier_infantry.glb shipped exactly
 * this way: the Blender bake created the arm joints (correct pivots and all)
 * but left the arm voxels inside the torso — and every United Front LSW rides
 * the infantry body, so half the roster punched with dead arms.
 *
 * The carve: a torso triangle belongs to an arm when its centroid sits below
 * the collar (y ≤ 1.45) and outside the chest wall (|z| ≥ 0.17) — measured
 * from the shipped bodies (chest+pauldrons reach the collar at |z| ≤ 0.16;
 * everything beyond caps at the shoulder, y ≤ 1.41). Each side becomes a new
 * mesh SHARING the torso's vertex attributes (only the index is new), hung
 * under its joint and offset by −pivot so the rest pose is world-identical —
 * rotation.z then swings the limb around the shoulder like every other body.
 * A correctly-segmented model (pathfinder) is left untouched.
 */
export function repairGlbRig(root: THREE.Object3D): void {
  const torso = root.getObjectByName('torso');
  if (!torso) return;
  let tm: THREE.Mesh | undefined;
  torso.traverse((o) => { if (!tm && (o as THREE.Mesh).isMesh) tm = o as THREE.Mesh; });
  if (!tm) return;
  const geo = tm.geometry;
  const index = geo.getIndex();
  const pos = geo.getAttribute('position');
  if (!index || !pos) return;

  // only sides whose joint exists but owns no mesh need the carve
  const bare = (['armL', 'armR'] as const).filter((n) => {
    const j = root.getObjectByName(n);
    if (!j) return false;
    let owns = false;
    j.traverse((o) => { if ((o as THREE.Mesh).isMesh) owns = true; });
    return !owns;
  });
  if (!bare.length) return;

  // classify every torso triangle by centroid (torso node sits at the origin,
  // so mesh-local IS model space for these bodies)
  const keep: number[] = [];
  const armIdx: Record<'armL' | 'armR', number[]> = { armL: [], armR: [] };
  for (let t = 0; t < index.count / 3; t++) {
    const a = index.getX(t * 3), b = index.getX(t * 3 + 1), c = index.getX(t * 3 + 2);
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const side = Math.abs(cz) >= 0.17 && cy <= 1.45 ? (cz > 0 ? 'armL' : 'armR') : null;
    if (side && bare.includes(side)) armIdx[side].push(a, b, c);
    else keep.push(a, b, c);
  }
  if (!armIdx.armL.length && !armIdx.armR.length) return; // nothing carvable

  // torso keeps its attributes, minus the carved triangles
  const keepGeo = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) keepGeo.setAttribute(name, geo.getAttribute(name));
  keepGeo.setIndex(keep);
  tm.geometry = keepGeo;

  for (const name of bare) {
    if (!armIdx[name].length) continue;
    const joint = root.getObjectByName(name)!;
    const armGeo = new THREE.BufferGeometry();
    for (const attr of Object.keys(geo.attributes)) armGeo.setAttribute(attr, geo.getAttribute(attr));
    armGeo.setIndex(armIdx[name]);
    const armMesh = new THREE.Mesh(armGeo, tm.material);
    armMesh.castShadow = true;
    // vertex data stays in torso space: parking the mesh at −pivot inside the
    // joint keeps the rest pose world-identical while the joint owns the swing
    armMesh.position.copy(joint.position).multiplyScalar(-1);
    joint.add(armMesh);
  }
}

export function buildSoldier(team: Team, classId: ClassId, kind: SoldierKind, weaponId?: string): THREE.Group {
  if (kind === 'scientist') return buildScientist();
  if (kind === 'dog') return buildDog(team);
  if (kind === 'scraprat' || kind === 'junkhound' || kind === 'weaver' || kind === 'ravager') return buildIronEater(kind);
  const isZed = kind !== 'human' && kind !== 'bot';
  if (isZed) return buildZombie(kind);
  const glbUrl = team === 0 ? GLB_BODIES[classId] : undefined;
  const body = glbUrl ? glbBodies.get(glbUrl) : undefined;
  const mesh = body ? buildGlbTrooper(body, classId, weaponId) : buildTrooper(team, classId, weaponId);
  // W3.8 BOTS LOOK LIKE ROBOTS (Robert: "chrome, subordinate"): a printed
  // machine-trooper reads as MACHINE at a glance — the body chromes toward
  // steel (high metal, low rough), so you always know which of your squad
  // is flesh. Class silhouette, rig, and team tint all stay put.
  if (kind === 'bot') chromeBody(mesh);
  // the renderer rebuilds the body when the CARRIED weapon changes family/brand/mark
  mesh.userData.weaponId = weaponId ?? '';
  return mesh;
}

/** W3.8: steel the body. Safe to mutate — the procedural path builds fresh
 *  materials per body and the GLB path clones per instance. The FACE PLATE
 *  (the exact skin tone) is exempt: faction identity law says the United
 *  Front shows a face (visual.test.ts), so their machines are ANDROIDS —
 *  a human face on a chrome chassis, machine at a glance either way. */
const CHROME = new THREE.Color(0xb8c4cc);
const SKIN_HEX = 0xd0a67e;
function chromeBody(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mm of Array.isArray(m.material) ? m.material : [m.material]) {
      const std = mm as THREE.MeshStandardMaterial;
      if (!std?.isMeshStandardMaterial) continue;
      if (std.color.getHex() === SKIN_HEX) continue; // the face stays — faction law
      std.color.lerp(CHROME, 0.55);
      std.metalness = Math.max(std.metalness, 0.85);
      std.roughness = Math.min(std.roughness, 0.35);
    }
  });
}

/** LSW palette (no purple — house law). One place both the renderer and the
 *  harness read, so a Firebrand looks the same wherever it's shown. */
export const LSW_TINT: Record<string, { tint: number; scale: number }> = {
  firebrand: { tint: 0xff6a1a, scale: 1.25 },
  plaguebearer: { tint: 0x7fa83c, scale: 1.3 },
  frostbite: { tint: 0x8fd4e8, scale: 1.3 },  // pale ice-blue glow
  ragebeast: { tint: 0xb23030, scale: 1.45 }, // blood-iron
  titan: { tint: 0x9a8466, scale: 1.6 },      // weathered stone — the biggest silhouette now
  voltstriker: { tint: 0xf5f06a, scale: 1.25 }, // high-voltage yellow-white
  sniperhawk: { tint: 0x5fb3c9, scale: 1.2 },   // scope steel-cyan
  barrier: { tint: 0x3fd9a0, scale: 1.3 },       // emerald shield-energy
  reactor: { tint: 0xffb020, scale: 1.3 },       // radiant reactor gold
  oblivion: { tint: 0xe6ecf2, scale: 1.3 },      // void-white rim (black & white, no purple)
  tremor: { tint: 0xa05a2a, scale: 1.5 },        // rusty earth-and-clay
  magnetar: { tint: 0x707886, scale: 1.3 },      // gunmetal-steel, magnetic sheen
  wraith: { tint: 0x8fd0b0, scale: 1.3 },        // spectral ghost-green
  eclipse: { tint: 0x3d5566, scale: 1.35 },      // deep shadow-slate
  dominator: { tint: 0xd83a5a, scale: 1.4 },     // commanding crimson-rose (no purple)
  riptide: { tint: 0x2fa8c8, scale: 1.3 },       // sea-teal, whitecap trim
  gravwarden: { tint: 0x9fc4e8, scale: 1.35 },   // pale updraft blue
  chronos: { tint: 0xc8a24b, scale: 1.3 },       // clockwork brass
  venatrix: { tint: 0x8f9e3a, scale: 1.2 },      // huntress olive-brass
  vanguard: { tint: 0xc9b458, scale: 1.35 },     // breacher brass-and-drab
  pyroclasm: { tint: 0xff8c2a, scale: 1.35 },    // magma orange
  voidwalker: { tint: 0x2a2f38, scale: 1.2 },    // void slate (black, never purple)
  crimson: { tint: 0xa11d2e, scale: 1.3 },       // arterial red
  mirage: { tint: 0xd8b84a, scale: 1.2 },        // heat-shimmer gold
  blitz: { tint: 0xe8e2d0, scale: 1.2 },         // afterimage white
  shadowstep: { tint: 0x4a5a4a, scale: 1.2 },    // gunmetal moss
  specter: { tint: 0xbcc7cf, scale: 1.25 },      // mirror-fog silver
  pulse: { tint: 0x5adfd0, scale: 1.3 },         // sonar teal
  venom: { tint: 0x7fd43a, scale: 1.25 },        // toxin green
  nightmare: { tint: 0x1e2430, scale: 1.25 },    // a darkness with edges
  reaper: { tint: 0x8a8f98, scale: 1.35 },       // scythe-steel grey
  crusher: { tint: 0xb0783a, scale: 1.45 },      // quarry ochre
  steelweaver: { tint: 0x9aa4b0, scale: 1.4 },   // worked steel
  overload: { tint: 0xffd23a, scale: 1.25 },     // live-wire amber
  phantom: { tint: 0xd9e4e6, scale: 1.2 },       // pale spectral bone
  inferno: { tint: 0xff6a2a, scale: 1.35 },      // flame orange
  stormcaller: { tint: 0x9fd8ff, scale: 1.35 },  // storm-sky pale blue
  gargoyle: { tint: 0x8d8578, scale: 1.4 },      // weathered stone
  leviathan: { tint: 0x3f6e6a, scale: 1.7 },     // deep-sea iron
  cataclysm: { tint: 0x7a4a30, scale: 1.65 },    // magma-cracked basalt
};

/**
 * M6 THE SILHOUETTE TABLE (Robert: "get our entire visual look for our LSWs…
 * pay more attention to detail, and remember that we're going to be ZOOMED
 * OUT"). At command zoom a god is ~40 pixels tall: tint and scale are nearly
 * invisible, and fine surface detail is wasted entirely. What survives is
 * OUTLINE — what breaks the body's rectangle against the sky.
 *
 * So every god that isn't already distinct gets ONE bold shape change,
 * readable as a black cutout:
 *   crown  — a ring/halo above the head (mystics, commanders)
 *   horns  — a wide V off the skull (brutes, beasts)
 *   spikes — a back rack (bruisers, siege)
 *   ridge  — a hunched dorsal fin (the deep-sea heavies)
 *   pauldr — hard shoulder slabs, doubling apparent width (armored)
 *   wings  — swept back-plates (fliers, levitators)
 *   coat   — a long hanging tail (skirmishers)
 * Each is a couple of boxes on a named joint, guarded so per-frame dressing
 * never multiplies them. Cheap, and the whole roster stops reading as one
 * body at three sizes.
 */
type SilhouetteKind = 'crown' | 'horns' | 'spikes' | 'ridge' | 'pauldr' | 'wings' | 'coat';
export const LSW_SILHOUETTE: Record<string, SilhouetteKind> = {
  // the brutes stop being one body at three sizes
  titan: 'pauldr', crusher: 'spikes', leviathan: 'ridge', cataclysm: 'spikes',
  tremor: 'pauldr', ragebeast: 'horns',
  // fliers + levitators wear the sky
  inferno: 'wings', stormcaller: 'wings', gargoyle: 'wings',
  wraith: 'wings', gravwarden: 'crown',
  // mystics and commanders take the crown
  chronos: 'crown', dominator: 'crown', oblivion: 'crown', nightmare: 'crown',
  magnetar: 'crown', eclipse: 'crown', reactor: 'crown', pulse: 'crown',
  // armored line
  vanguard: 'pauldr', steelweaver: 'pauldr', barrier: 'pauldr', reaper: 'coat',
  // skirmishers get the coat tail
  blitz: 'coat', shadowstep: 'coat', specter: 'coat', voidwalker: 'coat',
  mirage: 'coat', phantom: 'coat', venatrix: 'coat', sniperhawk: 'coat',
  // the rest — beasts and elementals
  crimson: 'horns', venom: 'horns', plaguebearer: 'horns', pyroclasm: 'spikes',
  firebrand: 'spikes', voltstriker: 'spikes', overload: 'spikes',
  frostbite: 'crown', riptide: 'ridge',
};

/** Build one silhouette breaker. Boxes only — at command zoom the shape is
 *  the entire message, so every piece is chosen to survive as a cutout. */
function makeSilhouette(kind: SilhouetteKind, tint: number): THREE.Group {
  const g = new THREE.Group();
  const solid = (c: number, rough = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.25 });
  const box = (w: number, h: number, d: number, c: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), solid(c));
    m.castShadow = true;
    return m;
  };
  const dark = 0x22262b;
  switch (kind) {
    case 'crown': {
      // a floating ring — the most legible "this one is a caster" at distance
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p2 = box(0.07, 0.26, 0.07, tint);
        p2.position.set(Math.cos(a) * 0.32, 0.62, Math.sin(a) * 0.32);
        p2.rotation.y = -a;
        g.add(p2);
      }
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 5, 12), solid(tint, 0.5));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.52;
      g.add(band);
      break;
    }
    case 'horns': {
      for (const side of [-1, 1]) {
        const h = box(0.1, 0.44, 0.1, dark);
        h.position.set(0.02, 0.5, side * 0.22);
        h.rotation.x = side * 0.55;
        g.add(h);
        const tip = box(0.07, 0.2, 0.07, tint);
        tip.position.set(0.04, 0.72, side * 0.34);
        tip.rotation.x = side * 0.8;
        g.add(tip);
      }
      break;
    }
    case 'spikes': {
      for (let i = 0; i < 4; i++) {
        const sp = box(0.09, 0.3 + i * 0.06, 0.09, i % 2 ? tint : dark);
        sp.position.set(-0.26, 0.28 + i * 0.02, -0.3 + i * 0.2);
        sp.rotation.z = 0.5;
        g.add(sp);
      }
      break;
    }
    case 'ridge': {
      for (let i = 0; i < 5; i++) {
        const f = box(0.06, 0.16 + Math.sin((i / 4) * Math.PI) * 0.34, 0.2, tint);
        f.position.set(-0.22, 0.36, -0.36 + i * 0.18);
        g.add(f);
      }
      break;
    }
    case 'pauldr': {
      for (const side of [-1, 1]) {
        const pl = box(0.42, 0.2, 0.34, dark);
        pl.position.set(0, 0.34, side * 0.36);
        pl.rotation.x = side * 0.18;
        g.add(pl);
        const trim = box(0.44, 0.06, 0.36, tint);
        trim.position.set(0, 0.45, side * 0.36);
        trim.rotation.x = side * 0.18;
        g.add(trim);
      }
      break;
    }
    case 'wings': {
      for (const side of [-1, 1]) {
        const wg = box(0.08, 0.62, 0.5, tint);
        wg.position.set(-0.24, 0.3, side * 0.3);
        wg.rotation.set(side * 0.35, 0, 0.45);
        g.add(wg);
      }
      break;
    }
    case 'coat': {
      const geo = new THREE.BoxGeometry(0.07, 0.95, 0.56);
      geo.translate(0, -0.45, 0); // top pivot — it hangs and sways
      const tail = new THREE.Mesh(geo, solid(tint, 0.95));
      tail.name = 'cape'; // the renderer's cape wave already drives this name
      tail.position.set(-0.26, 0.3, 0);
      tail.castShadow = true;
      g.add(tail);
      break;
    }
  }
  return g;
}

/** Turn a built trooper body INTO an LSW body: scale up past a trooper,
 *  glow its faction shade, and tag it so the frame loop feeds the aura.
 *  Robert: "make sure visually the LSWs look different." */
/** A hand-prop for melee LSWs whose rig hides the gun — claws, talons, a blade,
 *  a hammer. Procedural + tiny; attached to the right-hand joint so it swings
 *  with the arm. */
function makeProp(kind?: string): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.3 });
  if (kind === 'claws' || kind === 'talons') {
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55, 5), steel);
      claw.position.set(i * 0.12, -0.55, 0.22); claw.rotation.x = -0.5; g.add(claw);
    }
  } else if (kind === 'hammer') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.22), steel);
    head.position.set(0, -0.75, 0.1); g.add(head);
  } else if (kind === 'hose') {
    // THE IGNITER WAND. Five gods have declared `prop: 'hose'` since the
    // embodiment pass and none of them ever grew one: makeProp only ran for
    // blade rigs, so Firebrand and his cousins stood there holding an
    // infantry rifle. (Robert: "he still has a gun. I don't know if he's
    // supposed to have it.") He is not. A stubby nozzle with a hot mouth.
    const dark = new THREE.MeshStandardMaterial({ color: 0x3f4348, metalness: 0.5, roughness: 0.6 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.62, 7), dark);
    barrel.position.set(0, -0.5, 0.16); barrel.rotation.x = -1.35; g.add(barrel);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 7), steel);
    bell.position.set(0, -0.6, 0.48); bell.rotation.x = Math.PI / 2 - 0.2; g.add(bell);
    const pilot = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffa02a }),
    );
    pilot.position.set(0, -0.6, 0.58); g.add(pilot); // the pilot light, always lit
  } else if (kind === 'shield') {
    // VANGUARD'S TOWER PLATE — the VO says "follow the shield"; now there is
    // one to follow. A forearm slab with a vision slit, faction-neutral steel.
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.55), new THREE.MeshStandardMaterial({ color: 0x6a7076, metalness: 0.55, roughness: 0.45 }));
    plate.position.set(0.06, -0.5, 0.2); g.add(plate);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.08), steel);
    rim.position.set(0.06, -0.5, 0.46); g.add(rim);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: 0x14171b }));
    slit.position.set(0.06, -0.22, 0.2); g.add(slit);
  } else if (kind === 'chain') {
    // REAPER'S CHAIN — hanging links and the hook the aura keeps promising
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.75, roughness: 0.35 });
    for (let i = 0; i < 5; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 5, 8), dark);
      link.position.set(0, -0.35 - i * 0.13, 0.18 + Math.sin(i * 1.2) * 0.03);
      link.rotation.y = i % 2 ? Math.PI / 2 : 0;
      g.add(link);
    }
    const hook = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), steel);
    hook.position.set(0, -1.06, 0.2); hook.rotation.x = Math.PI; g.add(hook);
  } else if (kind === 'harpoon') {
    // VENATRIX'S HARPOON — a spear with a barbed head, held down the forearm
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6), new THREE.MeshStandardMaterial({ color: 0x5c5248, roughness: 0.7 }));
    shaft.position.set(0, -0.55, 0.22); shaft.rotation.x = -0.35; g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), steel);
    tip.position.set(0, -0.05, 0.42); tip.rotation.x = -0.35; g.add(tip);
    for (const dz of [-0.07, 0.07]) {
      const barb = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 5), steel);
      barb.position.set(0, -0.2, 0.38 + dz); barb.rotation.x = Math.PI - 0.5; g.add(barb);
    }
  } else if (kind === 'driver') {
    // STEEL WEAVER'S RIVET DRIVER — a piston tool, not a knife
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.18), new THREE.MeshStandardMaterial({ color: 0x8a6a30, metalness: 0.5, roughness: 0.5 }));
    bodyM.position.set(0, -0.55, 0.2); g.add(bodyM);
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 7), steel);
    piston.position.set(0, -0.78, 0.2); g.add(piston);
    const bit = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), steel);
    bit.position.set(0, -0.96, 0.2); bit.rotation.x = Math.PI; g.add(bit);
  } else if (kind === 'blade' || kind === 'knives') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.03), steel);
    blade.position.set(0, -0.6, 0.18); g.add(blade);
  }
  // an UNDECLARED prop yields an empty hand on purpose — the old default
  // handed a stray knife to every flamethrower god
  return g;
}

export function dressAsLsw(mesh: THREE.Group, id: string): THREE.Group {
  const look = LSW_TINT[id] ?? { tint: 0xffffff, scale: 1.25 };
  mesh.scale.setScalar(look.scale);
  mesh.userData.lsw = id;
  mesh.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && 'emissive' in m) { m.emissive = new THREE.Color(look.tint); m.emissiveIntensity = 0.18; }
  });
  // EMBODIMENT (kill the guns): melee schools (rig fists/blade) hide the rifle;
  // 'thrower' joins them — a flame god holds its own igniter, not standard issue.
  const def = LSWS[id as keyof typeof LSWS];
  const rig = def?.rig;
  if (rig === 'fists' || rig === 'blade' || rig === 'thrower') {
    mesh.traverse((o) => { if (o.name === 'gun') o.visible = false; });
  }
  // A DECLARED PROP RENDERS, PERIOD. The old gate only mounted props for
  // blade/thrower rigs, so four gods' signatures silently vanished for an
  // era: Vanguard's shield ("follow the shield" — there was none), Reaper's
  // chain, Venatrix's harpoon, Steel Weaver's driver. The launcher/sidearm
  // rigs keep their guns AND wear the prop on the off arm.
  if (def?.prop && !mesh.userData.lswProp) {
    const arm = (rig === 'blade' || rig === 'thrower' || rig === 'fists')
      ? mesh.getObjectByName('armR')     // melee schools: the weapon hand
      : mesh.getObjectByName('armL');    // armed schools: the off arm carries it
    (arm ?? mesh).add(makeProp(def.prop));
    mesh.userData.lswProp = true; // once — dressAsLsw can run per-frame
  }
  // thrower gods with NO declared prop get the igniter anyway — venom's acid
  // sprayer and plaguebearer's gas wand are the same silhouette promise
  if (rig === 'thrower' && !def?.prop && !mesh.userData.lswProp) {
    (mesh.getObjectByName('armR') ?? mesh).add(makeProp('hose'));
    mesh.userData.lswProp = true;
  }
  // THE CAPE (Robert: "you can give them capes") — the commander tier wears
  // cloth. Top-pivoted thin slab hanging from the shoulders, waved by the
  // renderer exactly like the CTF flag's cloth. No purple, per the law.
  const CAPES: Record<string, number> = { chronos: 0x8a6a3a, dominator: 0x8a2a22, reaper: 0x23262b, eclipse: 0x1d2b33 };
  const capeColor = CAPES[id];
  if (capeColor !== undefined && !mesh.userData.lswCape) {
    const torso = mesh.getObjectByName('torso');
    if (torso) {
      const geo = new THREE.BoxGeometry(0.06, 1.05, 0.62);
      geo.translate(0, -0.5, 0); // top pivot — rotation.x sweeps it back
      const cape = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: capeColor, roughness: 0.95 }));
      cape.name = 'cape';
      cape.position.set(-0.26, 0.34, 0);
      cape.rotation.x = 0; cape.rotation.z = -0.08;
      cape.castShadow = true;
      torso.add(cape);
      mesh.userData.lswCape = true;
    }
  }
  // M6: the silhouette breaker. Head-mounted shapes ride the head joint so
  // they follow the look; body shapes ride the torso. Guarded — dressAsLsw
  // runs per-frame and this must mount exactly once.
  const sil = LSW_SILHOUETTE[id];
  if (sil && !mesh.userData.lswSil) {
    const head = mesh.getObjectByName('head');
    const torso = mesh.getObjectByName('torso');
    const host = (sil === 'crown' || sil === 'horns') ? head : torso;
    if (host) {
      const piece = makeSilhouette(sil, look.tint);
      piece.name = 'silhouette';
      host.add(piece);
      mesh.userData.lswSil = true;
    }
  }

  // CHRONOS' CLOCK — a slow brass disc on the back, because the highest
  // threat tier must never read as a recolored rifleman
  if (id === 'chronos' && !mesh.userData.lswDial) {
    const torso = mesh.getObjectByName('torso');
    if (torso) {
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xb99248, metalness: 0.6, roughness: 0.35 }));
      dial.name = 'clockdial';
      dial.rotation.z = Math.PI / 2;
      dial.position.set(-0.34, 0.3, 0);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.22), new THREE.MeshStandardMaterial({ color: 0x2c2620 }));
      hand.position.set(-0.03, 0, 0.08);
      dial.add(hand);
      torso.add(dial);
      mesh.userData.lswDial = true;
    }
  }
  return mesh;
}

/** Robert's body + the game's rifle: clone the named-joint rig, give every
 *  part its own material instance (cloak alpha must never bleed across
 *  soldiers), and hang the class rifle exactly where buildTrooper does. */
function buildGlbTrooper(src: THREE.Group, classId: ClassId, weaponId?: string): THREE.Group {
  const g = new THREE.Group();
  const body = src.clone(true);
  body.traverse((o) => {
    if (o instanceof THREE.Mesh) o.material = (o.material as THREE.Material).clone();
  });
  g.add(body);
  // rifle-hold rest pose — the run cycle swings around these bases. (The
  // chain solver is NOT for these bodies: the segmented arms are rigid
  // single parts, and the unconstrained solve parked the gun somewhere a
  // rigid arm could never reach. The authored pose was tuned by eye.)
  const armR = body.getObjectByName('armR');
  const armL = body.getObjectByName('armL');
  if (armR) armR.rotation.z = -0.5;
  if (armL) armL.rotation.z = -0.75;
  // the faction band: one amber stripe over the left shoulder — the GLB
  // body is Robert's art, the stripe is the army it fights for
  const trim = mat(TEAM_COLORS[0], { emissive: TEAM_COLORS[0] });
  const band = box(0.3, 0.05, 0.14, trim);
  band.position.set(0.02, 1.52, 0.3);
  g.add(band);
  const gun = weaponId ? buildWeaponModel(weaponId) : buildRifle(classId);
  gun.position.set(0.42, 1.28, -0.16);
  gun.userData.baseX = gun.position.x;
  g.add(gun);
  return g;
}

/**
 * §5.3 Military working dog — a German-Shepherd silhouette on four named leg
 * joints (legFL/FR/RL/RR) so the trot cycle can swing them, plus a tail and a
 * team-colored K9 harness so you know whose dog is eating your infiltrator.
 * Root faces +X like every soldier.
 */
function buildDog(team: Team): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const coat = mat(0x8a6b42, { rough: 0.95 });   // tan working coat
  const saddle = mat(0x2b2620, { rough: 0.95 }); // black saddle + mask
  const dark = mat(0x1c1915, { rough: 0.9 });
  const vest = mat(0x3a3630, { rough: 0.7 });
  const trim = mat(teamCol, { emissive: teamCol });

  // ---- body: deep chest forward, hips a touch lower (the shepherd slope) ----
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.62;
  g.add(torso);
  const chest = box(0.5, 0.34, 0.3, coat);
  chest.position.set(0.18, 0.04, 0);
  torso.add(chest);
  const hind = box(0.42, 0.3, 0.27, coat);
  hind.position.set(-0.22, -0.02, 0);
  hind.rotation.z = -0.08; // sloped croup
  torso.add(hind);
  const back = box(0.55, 0.08, 0.31, saddle); // the black saddle marking
  back.position.set(0, 0.18, 0);
  torso.add(back);
  // K9 service harness: vest wrap over the shoulders + team stripe
  const wrap = box(0.26, 0.4, 0.36, vest);
  wrap.position.set(0.16, 0.02, 0);
  torso.add(wrap);
  const stripe = box(0.27, 0.09, 0.37, trim);
  stripe.position.set(0.16, 0.1, 0);
  torso.add(stripe);

  // ---- head: skull, dark snout, pricked ears ----
  const headGrp = new THREE.Group();
  headGrp.name = 'head';
  headGrp.position.set(0.48, 0.86, 0);
  g.add(headGrp);
  const neck = box(0.2, 0.26, 0.18, coat);
  neck.position.set(-0.1, -0.14, 0);
  neck.rotation.z = 0.5;
  headGrp.add(neck);
  const skull = box(0.24, 0.2, 0.2, coat);
  headGrp.add(skull);
  const snout = box(0.2, 0.12, 0.12, saddle);
  snout.position.set(0.2, -0.03, 0);
  headGrp.add(snout);
  const nose = box(0.05, 0.06, 0.07, dark);
  nose.position.set(0.31, -0.01, 0);
  headGrp.add(nose);
  for (const side of [1, -1]) {
    const ear = box(0.06, 0.14, 0.07, saddle);
    ear.position.set(-0.06, 0.16, side * 0.07);
    ear.rotation.x = side * -0.12;
    headGrp.add(ear);
  }

  // ---- four legs, named so the renderer can drive the trot ----
  const legSpots: [string, number, number][] = [
    ['legFL', 0.32, 0.12], ['legFR', 0.32, -0.12],
    ['legRL', -0.3, 0.12], ['legRR', -0.3, -0.12],
  ];
  for (const [name, lx, lz] of legSpots) {
    const hip = new THREE.Group();
    hip.name = name;
    hip.position.set(lx, 0.52, lz);
    hip.add(limb(0.1, 0.46, 0.1, coat));
    const paw = box(0.14, 0.07, 0.1, dark);
    paw.position.set(0.03, -0.46, 0);
    hip.add(paw);
    g.add(hip);
  }

  // ---- tail: swept back and down, wagged by the animator ----
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-0.42, 0.68, 0);
  tail.add(limb(0.08, 0.34, 0.08, saddle));
  tail.rotation.z = -0.9;
  g.add(tail);

  return g;
}

/** Dr. Voss: lab coat, spectacles, no weapon. The whole point of safehouse mode. */
function buildScientist(): THREE.Group {
  const g = new THREE.Group();
  const coat = mat(0xe4e2d8, { rough: 0.9 });
  const slacks = mat(0x4a4a52, { rough: 0.9 });
  const skin = mat(0xd0a67e, { rough: 0.8 });
  const dark = mat(0x26241f, { rough: 0.8 });

  for (const side of [1, -1]) {
    const hip = new THREE.Group();
    hip.name = side === 1 ? 'legL' : 'legR';
    hip.position.set(0, 0.96, side * 0.13);
    hip.add(limb(0.18, 0.44, 0.19, slacks));
    const knee = new THREE.Group();
    knee.name = side === 1 ? 'shinL' : 'shinR';
    knee.position.y = -0.44;
    knee.add(limb(0.15, 0.42, 0.16, slacks));
    const shoe = box(0.28, 0.1, 0.16, dark);
    shoe.position.set(0.05, -0.45, 0);
    knee.add(shoe);
    hip.add(knee);
    g.add(hip);
  }

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.98;
  g.add(torso);
  const chest = box(0.46, 0.52, 0.6, coat);
  chest.position.y = 0.28;
  torso.add(chest);
  // coat tails
  const tail = box(0.4, 0.3, 0.62, coat);
  tail.position.set(-0.06, -0.1, 0);
  torso.add(tail);
  // clipboard under one arm
  const clipboard = box(0.04, 0.26, 0.2, mat(0xc8a86a, { rough: 0.9 }));
  clipboard.position.set(0.2, 0.24, 0.34);
  torso.add(clipboard);

  // arms hang at his sides (he's not a fighter)
  for (const side of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.name = side === 1 ? 'armL' : 'armR';
    shoulder.position.set(0, 1.48, side * 0.3);
    shoulder.add(limb(0.13, 0.32, 0.13, coat));
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    elbow.add(limb(0.11, 0.28, 0.11, coat));
    const hand = box(0.09, 0.09, 0.09, skin);
    hand.position.y = -0.3;
    elbow.add(hand);
    elbow.rotation.z = -0.15;
    shoulder.add(elbow);
    shoulder.rotation.z = side === 1 ? 0.08 : -0.05;
    g.add(shoulder);
  }

  const headGrp = new THREE.Group();
  headGrp.name = 'head';
  headGrp.position.y = 1.62;
  g.add(headGrp);
  const face = box(0.26, 0.28, 0.28, skin);
  face.position.y = 0.14;
  headGrp.add(face);
  const hair = box(0.24, 0.08, 0.3, mat(0xbfbfb8, { rough: 0.95 })); // gray hair
  hair.position.y = 0.3;
  headGrp.add(hair);
  // spectacles
  for (const side of [1, -1]) {
    const lens = box(0.03, 0.08, 0.09, mat(0x333333, { rough: 0.3, metal: 0.5 }));
    lens.position.set(0.15, 0.16, side * 0.07);
    headGrp.add(lens);
  }
  return g;
}

function buildRifle(classId: ClassId): THREE.Group {
  const gun = new THREE.Group();
  gun.name = 'gun';
  const gunmetal = mat(0x23231f, { metal: 0.55, rough: 0.35 });
  const furniture = mat(0x3a352b, { rough: 0.7 });
  const heavy = classId === 'heavy';
  const sniper = classId === 'infiltrator';

  const rw = heavy ? 0.85 : sniper ? 0.75 : 0.68; // receiver length
  const rh = heavy ? 0.17 : 0.11;
  const receiver = box(rw, rh, heavy ? 0.13 : 0.09, gunmetal);
  gun.add(receiver);
  const barrel = box(sniper ? 0.62 : heavy ? 0.35 : 0.42, 0.055, 0.055, gunmetal);
  barrel.position.set(rw / 2 + barrel.geometry.parameters.width / 2 - 0.02, heavy ? 0.03 : 0.015, 0);
  gun.add(barrel);
  const stock = box(0.2, 0.13, 0.07, furniture);
  stock.position.set(-rw / 2 - 0.08, -0.02, 0);
  gun.add(stock);
  const mag = box(0.08, 0.18, 0.06, furniture);
  mag.position.set(0.05, -rh / 2 - 0.08, 0);
  mag.rotation.z = 0.25;
  gun.add(mag);
  const grip = box(0.06, 0.12, 0.06, furniture);
  grip.position.set(-0.15, -rh / 2 - 0.05, 0);
  gun.add(grip);
  if (heavy) {
    const drum = cyl(0.09, 0.09, 0.1, furniture, 10);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0.12, -0.14, 0);
    gun.add(drum);
    const brake = box(0.08, 0.09, 0.09, gunmetal);
    brake.position.set(rw / 2 + 0.32, 0.03, 0);
    gun.add(brake);
  }
  if (sniper) {
    const scope = cyl(0.035, 0.035, 0.2, gunmetal, 8);
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0.05, rh / 2 + 0.05, 0);
    gun.add(scope);
    const lens = cyl(0.03, 0.03, 0.01, mat(0x66ccff, { emissive: 0x3388cc }), 8);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.155, rh / 2 + 0.05, 0);
    gun.add(lens);
  }
  return gun;
}

function buildTrooper(team: Team, classId: ClassId, weaponId?: string): THREE.Group {
  const g = new THREE.Group();
  const teamCol = TEAM_COLORS[team];
  const inf = classId === 'infiltrator';
  const uf = team === 0; // United Front: veteran steel. Collective: synthetic glass.

  // ---- faction palettes ----
  // UF reads as WORN MILITARY: olive fatigues, layered tan-steel plates,
  // amber trim, exposed chin — humans in a long war.
  // Collective reads as SYNTHETIC: graphite bodysuit, smooth blue-steel
  // shell, cyan glow lines, a sealed dome — nobody home behind the visor.
  const uniformCol = inf ? (uf ? 0x2e2c26 : 0x232b33) : uf ? 0x5c5236 : 0x2c3840;
  const armorCol = inf ? (uf ? 0x211f1a : 0x1b232b) : uf ? 0x46422e : 0x415663;
  const edgeCol = uf ? 0x8a7a4a : 0x5e7886;
  const uniform = mat(uniformCol, { rough: 0.92 });
  const armor = mat(armorCol, { rough: uf ? 0.72 : 0.45, metal: uf ? 0.22 : 0.5 });
  const edge = mat(edgeCol, { rough: 0.55, metal: 0.35 });
  const dark = mat(0x26241f, { rough: 0.8 });
  const skin = mat(0xd0a67e, { rough: 0.8 });
  const trim = mat(teamCol, { emissive: teamCol });
  const glow = mat(teamCol, { emissive: teamCol, rough: 0.3 });

  // ---- legs (jointed: thigh -> shin+boot), armored per faction ----
  for (const side of [1, -1]) {
    const hip = new THREE.Group();
    hip.name = side === 1 ? 'legL' : 'legR';
    hip.position.set(0, 0.96, side * 0.15);
    const thigh = limb(0.21, 0.44, 0.22, uniform);
    hip.add(thigh);
    // thigh plate (UF: strapped slab · C: molded shell with a glow seam)
    const thighPlate = limb(0.1, 0.3, 0.2, armor);
    thighPlate.position.set(0.09, -0.04, 0);
    hip.add(thighPlate);
    if (!uf) {
      const seam = limb(0.04, 0.26, 0.04, glow);
      seam.position.set(0.13, -0.06, 0.07 * side);
      hip.add(seam);
    }
    const knee = new THREE.Group();
    knee.name = side === 1 ? 'shinL' : 'shinR';
    knee.position.y = -0.44;
    const shin = limb(0.17, 0.42, 0.18, uniform);
    knee.add(shin);
    const pad = box(0.14, 0.14, 0.17, uf ? edge : armor);
    pad.position.set(0.08, -0.06, 0);
    knee.add(pad);
    const greave = limb(0.07, 0.3, 0.15, armor);
    greave.position.set(0.1, -0.1, 0);
    knee.add(greave);
    const boot = box(0.32, 0.12, 0.19, dark);
    boot.position.set(0.06, -0.46, 0);
    knee.add(boot);
    const sole = box(0.34, 0.04, 0.21, mat(0x14120f, { rough: 0.95 }));
    sole.position.set(0.06, -0.52, 0);
    knee.add(sole);
    hip.add(knee);
    g.add(hip);
  }
  // hip skirt plates hang from the belt line
  for (const side of [1, -1]) {
    const skirt = box(0.16, 0.2, 0.12, armor);
    skirt.position.set(0.12, 0.9, side * 0.24);
    skirt.rotation.z = -0.12;
    g.add(skirt);
  }

  // ---- torso ----
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.98;
  g.add(torso);
  const chest = box(0.5, 0.52, 0.66, uniform);
  chest.position.y = 0.28;
  torso.add(chest);
  const belt = box(0.52, 0.09, 0.68, dark);
  belt.position.y = 0.02;
  torso.add(belt);

  if (uf) {
    // layered angular carrier: two stacked front plates, canted
    const plateHi = box(0.14, 0.24, 0.52, armor);
    plateHi.position.set(0.26, 0.42, 0);
    plateHi.rotation.z = -0.08;
    const plateLo = box(0.13, 0.22, 0.48, armor);
    plateLo.position.set(0.28, 0.18, 0);
    plateLo.rotation.z = 0.06;
    torso.add(plateHi, plateLo);
    const plateEdge = box(0.03, 0.05, 0.5, edge);
    plateEdge.position.set(0.33, 0.31, 0);
    torso.add(plateEdge);
    for (const pz of [-0.17, 0.0, 0.17]) {
      const pouch = box(0.09, 0.14, 0.13, dark);
      pouch.position.set(0.3, 0.08, pz);
      torso.add(pouch);
      const flap = box(0.1, 0.05, 0.14, uniform);
      flap.position.set(0.3, 0.16, pz);
      torso.add(flap);
    }
    const canteen = cyl(0.06, 0.06, 0.14, edge, 8);
    canteen.position.set(-0.05, 0.02, 0.36);
    torso.add(canteen);
  } else {
    // molded shell with a glowing power core line down the sternum
    const shell = box(0.13, 0.44, 0.54, armor);
    shell.position.set(0.27, 0.3, 0);
    torso.add(shell);
    const core = box(0.04, 0.34, 0.06, glow);
    core.position.set(0.34, 0.3, 0);
    torso.add(core);
    for (const side of [1, -1]) {
      const rib = box(0.05, 0.02, 0.2, glow);
      rib.position.set(0.33, 0.18, side * 0.15);
      torso.add(rib);
    }
    for (let i = 0; i < 2; i++) {
      const seg = box(0.1, 0.07, 0.5, mat(armorCol, { rough: 0.5, metal: 0.45 }));
      seg.position.set(0.28, 0.02 + i * 0.09, 0);
      torso.add(seg);
    }
  }

  // back gear
  const pack = box(0.2, 0.34, 0.44, classId === 'medic' ? mat(0xd8d8d2, { rough: 0.8 }) : armor);
  pack.position.set(-0.32, 0.3, 0);
  torso.add(pack);
  if (uf) {
    const bedroll = cyl(0.07, 0.07, 0.4, uniform, 8);
    bedroll.rotation.x = Math.PI / 2;
    bedroll.position.set(-0.3, 0.54, 0);
    torso.add(bedroll);
    const antenna = cyl(0.015, 0.015, 0.5, dark, 4);
    antenna.position.set(-0.42, 0.62, -0.16);
    torso.add(antenna);
  } else {
    for (const side of [1, -1]) {
      const cell = box(0.06, 0.2, 0.08, glow);
      cell.position.set(-0.44, 0.32, side * 0.12);
      torso.add(cell);
    }
  }

  if (classId === 'medic') {
    const crossV = box(0.05, 0.22, 0.07, mat(0xd8453a, { emissive: 0xd8453a }));
    const crossH = box(0.05, 0.07, 0.22, mat(0xd8453a, { emissive: 0xd8453a }));
    crossV.position.set(-0.44, 0.3, 0);
    crossH.position.set(-0.44, 0.3, 0);
    torso.add(crossV, crossH);
  }
  if (classId === 'engineer') {
    const wrench = box(0.06, 0.3, 0.08, mat(0xb8b0a0, { metal: 0.7, rough: 0.3 }));
    wrench.position.set(-0.45, 0.28, 0.12);
    wrench.rotation.x = 0.3;
    torso.add(wrench);
    for (const side of [1, -1]) {
      const satchel = box(0.12, 0.12, 0.1, dark);
      satchel.position.set(0.05, 0.0, side * 0.37);
      torso.add(satchel);
    }
  }
  if (classId === 'jump') {
    const packL = cyl(0.09, 0.11, 0.42, mat(0x555a60, { metal: 0.5, rough: 0.4 }), 8);
    packL.position.set(-0.38, 0.3, 0.13);
    const packR = packL.clone();
    packR.position.z = -0.13;
    torso.add(packL, packR);
    for (const side of [1, -1]) {
      const nozzle = cyl(0.05, 0.08, 0.1, dark, 8);
      nozzle.position.set(-0.38, 0.03, side * 0.13);
      torso.add(nozzle);
      const fin = box(0.02, 0.24, 0.1, armor);
      fin.position.set(-0.5, 0.34, side * 0.22);
      torso.add(fin);
    }
  }
  if (classId === 'heavy') {
    const bandolier = box(0.08, 0.5, 0.1, dark);
    bandolier.position.set(0.28, 0.28, 0.1);
    bandolier.rotation.x = 0.5;
    torso.add(bandolier);
    for (let i = 0; i < 4; i++) {
      const round = box(0.03, 0.07, 0.03, edge);
      round.position.set(0.33, 0.14 + i * 0.1, 0.16 - i * 0.04);
      round.rotation.x = 0.5;
      torso.add(round);
    }
  }
  if (classId === 'pathfinder') {
    for (const side of [1, -1]) {
      const pylon = cyl(0.05, 0.07, 0.4, mat(0x5ac8b0, { emissive: 0x2e8a76, metal: 0.4 }), 6);
      pylon.position.set(-0.44, 0.42, side * 0.14);
      torso.add(pylon);
    }
  }
  if (classId === 'ghost') {
    const mast = cyl(0.02, 0.02, 0.7, dark, 4);
    mast.position.set(-0.4, 0.7, -0.15);
    torso.add(mast);
    const dish = cyl(0.1, 0.02, 0.06, mat(0x7a90a8, { emissive: 0x4a6078, metal: 0.5 }), 8);
    dish.position.set(-0.4, 1.06, -0.15);
    torso.add(dish);
  }
  if (classId === 'infantry') {
    for (const pz of [-0.3, 0.3]) {
      const frag = cyl(0.045, 0.045, 0.1, mat(0x3d4a2e, { rough: 0.6 }), 6);
      frag.position.set(0.18, 0.0, pz);
      torso.add(frag);
    }
  }

  // shoulder pauldrons — the faction reads from across the map
  for (const side of [1, -1]) {
    if (uf) {
      const padHi = box(0.26, 0.09, 0.22, armor);
      padHi.position.set(0, 0.6, side * 0.38);
      const padLo = box(0.24, 0.08, 0.2, armor);
      padLo.position.set(0.02, 0.52, side * 0.4);
      padLo.rotation.x = side * 0.2;
      torso.add(padHi, padLo);
      const stripe = box(0.27, 0.035, 0.23, trim);
      stripe.position.set(0, 0.66, side * 0.38);
      torso.add(stripe);
    } else {
      const disc = cyl(0.16, 0.18, 0.1, armor, 8);
      disc.position.set(0, 0.58, side * 0.38);
      disc.rotation.x = side * 0.25;
      torso.add(disc);
      const ring = cyl(0.17, 0.17, 0.025, glow, 8);
      ring.position.set(0, 0.63, side * 0.38);
      ring.rotation.x = side * 0.25;
      torso.add(ring);
    }
  }

  // ---- arms: posed holding the rifle two-handed (rig unchanged) ----
  const armMat = uniform;
  const gloveMat = dark;
  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(0.05, 1.5, -0.34);
  const upperR = limb(0.15, 0.3, 0.15, armMat);
  armR.add(upperR);
  const elbowPadR = box(0.1, 0.09, 0.13, uf ? edge : armor);
  elbowPadR.position.set(0.04, -0.3, 0);
  armR.add(elbowPadR);
  const foreR = new THREE.Group();
  foreR.position.y = -0.3;
  const lowerR = limb(0.12, 0.28, 0.12, armMat);
  foreR.add(lowerR);
  if (!uf) {
    const armSeam = limb(0.03, 0.2, 0.03, glow);
    armSeam.position.set(0.06, -0.02, 0.05);
    foreR.add(armSeam);
  }
  const handR = box(0.1, 0.1, 0.1, gloveMat);
  handR.name = 'handR';
  handR.position.y = -0.32;
  foreR.add(handR);
  foreR.rotation.z = -1.15;
  armR.add(foreR);
  armR.rotation.z = -0.5;
  g.add(armR);
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.05, 1.5, 0.34);
  const upperL = limb(0.15, 0.3, 0.15, armMat);
  armL.add(upperL);
  const elbowPadL = box(0.1, 0.09, 0.13, uf ? edge : armor);
  elbowPadL.position.set(0.04, -0.3, 0);
  armL.add(elbowPadL);
  const foreL = new THREE.Group();
  foreL.position.y = -0.3;
  const lowerL = limb(0.12, 0.28, 0.12, armMat);
  foreL.add(lowerL);
  const handL = box(0.1, 0.1, 0.1, gloveMat);
  handL.name = 'handL';
  handL.position.y = -0.32;
  foreL.add(handL);
  foreL.rotation.z = -1.3;
  foreL.rotation.x = -0.55;
  armL.add(foreL);
  armL.rotation.z = -0.75;
  armL.rotation.x = -0.35;
  g.add(armL);

  // ---- head: the faction's face ----
  const headGrp = new THREE.Group();
  headGrp.name = 'head';
  headGrp.position.y = 1.62;
  g.add(headGrp);
  if (inf) {
    // hooded infiltrator, both factions — the job hides the flag
    const neck = cyl(0.08, 0.09, 0.1, uf ? skin : armor, 8);
    neck.position.y = -0.04;
    headGrp.add(neck);
    const face = box(0.26, 0.26, 0.28, uf ? skin : armor);
    face.position.y = 0.14;
    headGrp.add(face);
    const hood = box(0.34, 0.3, 0.36, mat(0x1c1a22, { rough: 0.95 }));
    hood.position.y = 0.2;
    headGrp.add(hood);
    for (const side of [1, -1]) {
      const eye = box(0.05, 0.05, 0.08, glow);
      eye.position.set(0.17, 0.16, side * 0.07);
      headGrp.add(eye);
    }
  } else if (uf) {
    // combat helmet, dark goggles, HUMAN chin — a person under the steel
    const neck = cyl(0.08, 0.09, 0.1, skin, 8);
    neck.position.y = -0.04;
    headGrp.add(neck);
    const face = box(0.26, 0.26, 0.28, skin);
    face.position.y = 0.14;
    headGrp.add(face);
    const goggles = box(0.07, 0.08, 0.26, mat(0x141414, { rough: 0.25, metal: 0.65 }));
    goggles.position.set(0.15, 0.19, 0);
    headGrp.add(goggles);
    const helmet = box(0.36, 0.18, 0.4, armor);
    helmet.position.y = 0.33;
    headGrp.add(helmet);
    const brim = box(0.44, 0.05, 0.44, armor);
    brim.position.set(0.02, 0.25, 0);
    headGrp.add(brim);
    for (const side of [1, -1]) {
      const rail = box(0.3, 0.05, 0.03, edge);
      rail.position.set(0.02, 0.32, side * 0.21);
      headGrp.add(rail);
    }
    const band = box(0.37, 0.045, 0.41, trim);
    band.position.y = 0.28;
    headGrp.add(band);
  } else {
    // the Collective dome: sealed, smooth, a single glowing visor band —
    // no skin anywhere. Nobody is sure there is a face in there.
    const neck = cyl(0.09, 0.1, 0.1, armor, 8);
    neck.position.y = -0.04;
    headGrp.add(neck);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), armor.clone());
    dome.castShadow = true;
    dome.position.y = 0.2;
    dome.scale.set(1.05, 1.15, 1);
    headGrp.add(dome);
    const jaw = box(0.2, 0.12, 0.24, armor);
    jaw.position.set(0.05, 0.04, 0);
    headGrp.add(jaw);
    const visor = box(0.1, 0.06, 0.3, glow);
    visor.position.set(0.16, 0.2, 0);
    headGrp.add(visor);
    const crest = box(0.28, 0.03, 0.06, glow);
    crest.position.set(-0.02, 0.4, 0);
    headGrp.add(crest);
  }

  // ---- the carried weapon, at the shoulder line — the REAL family model
  // when the sim tells us what's equipped, the class rifle otherwise ----
  const gun = weaponId ? buildWeaponModel(weaponId) : buildRifle(classId);
  gun.position.set(0.42, 1.28, -0.16);
  g.add(gun);
  // the SOLVED grip (models/grip.ts): both hands close on the rifle — the
  // authored arm angles above are the solve's starting point, and the
  // rifle comes to the chest if the support hand can't reach the guard
  solveTwoHandedGrip(g,
    { shoulder: armR, elbow: foreR, hand: handR },
    { shoulder: armL, elbow: foreL, hand: handL },
    gun);
  gun.userData.baseX = gun.position.x;

  return g;
}

// ---------------------------------------------------------------------------
// The undead
// ---------------------------------------------------------------------------

function buildZombie(kind: SoldierKind): THREE.Group {
  const g = new THREE.Group();
  const scale = kind === 'brute' ? 1.65 : kind === 'bomber' ? 1.2 : kind === 'sprinter' ? 0.92 : kind === 'stalker' ? 1.05 : 1;
  const skinCol = kind === 'sprinter' ? 0xb07050 : kind === 'bomber' ? 0x97b26a : kind === 'stalker' ? 0x3d4a48 : 0x8fa86a;
  const ragCol = kind === 'sprinter' ? 0x53291f : kind === 'stalker' ? 0x1c2622 : 0x3d4a2e;
  const skin = mat(skinCol, { rough: 0.9 });
  const rags = mat(ragCol, { rough: 0.98 });
  const dark = mat(0x22261c, { rough: 0.95 });

  // legs (jointed like troopers so the shamble reads)
  for (const side of [1, -1]) {
    const hip = new THREE.Group();
    hip.name = side === 1 ? 'legL' : 'legR';
    hip.position.set(0, 0.92, side * 0.15);
    hip.add(limb(0.2, 0.44, 0.2, rags));
    const knee = new THREE.Group();
    knee.name = side === 1 ? 'shinL' : 'shinR';
    knee.position.y = -0.44;
    knee.add(limb(0.16, 0.42, 0.16, skin));
    const foot = box(0.26, 0.1, 0.16, dark);
    foot.position.set(0.05, -0.45, 0);
    knee.add(foot);
    hip.add(knee);
    g.add(hip);
  }

  // torso — torn shirt, hunched
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.94;
  g.add(torso);
  const chestW = kind === 'brute' ? 0.72 : 0.5;
  const chest = box(0.46, 0.5, chestW, rags);
  chest.position.y = 0.27;
  torso.add(chest);
  const gutRip = box(0.1, 0.2, chestW * 0.5, skin); // exposed midriff
  gutRip.position.set(0.2, 0.1, 0.05);
  torso.add(gutRip);
  if (kind === 'brute') {
    for (const side of [1, -1]) {
      const hump = box(0.4, 0.28, 0.26, skin);
      hump.position.set(-0.05, 0.55, side * 0.32);
      torso.add(hump);
    }
  }
  if (kind === 'bomber') {
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(0x9adf3a, { emissive: 0x9adf3a, rough: 0.45 }));
    belly.position.set(0.22, 0.12, 0);
    belly.castShadow = true;
    belly.name = 'belly';
    torso.add(belly);
  }
  if (kind === 'spitter') {
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xa0e040, { emissive: 0x7fae2a, rough: 0.5 }));
    sac.position.set(0.16, 0.52, 0);
    torso.add(sac);
  }

  // arms — reaching, asymmetric
  for (const side of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.name = side === 1 ? 'armL' : 'armR';
    shoulder.position.set(0.02, 1.44, side * (kind === 'brute' ? 0.44 : 0.32));
    const upper = limb(0.13, 0.3, 0.13, kind === 'brute' ? skin : rags);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    elbow.add(limb(0.11, 0.3, 0.11, skin));
    // claws
    for (const c of [-0.03, 0.03]) {
      const claw = box(0.1, 0.04, 0.03, dark);
      claw.position.set(0.05, -0.32, c);
      elbow.add(claw);
    }
    elbow.rotation.z = -0.25;
    shoulder.add(elbow);
    // reach FORWARD (+X) at the prey, one arm higher than the other.
    // Shared with the runtime animator so the rest pose and the sway agree.
    shoulder.rotation.z = zombieArmRest(kind, side === 1);
    g.add(shoulder);
  }

  // head — bare, tilted, glowing eyes
  const headGrp = new THREE.Group();
  headGrp.name = 'head';
  headGrp.position.y = 1.56;
  headGrp.rotation.x = kind === 'sprinter' ? 0 : 0.18; // sickly tilt
  g.add(headGrp);
  const skull = box(0.28, 0.28, kind === 'brute' ? 0.26 : 0.3, skin);
  skull.position.y = 0.12;
  headGrp.add(skull);
  const jaw = box(0.1, 0.08, 0.2, dark);
  jaw.position.set(0.12, 0.0, 0);
  headGrp.add(jaw);
  const eyeCol = kind === 'stalker' ? 0x3fe0c8 : 0xcc3322; // stalker: spectral teal (no purple)
  for (const side of [1, -1]) {
    const eye = box(0.05, 0.05, 0.06, mat(eyeCol, { emissive: eyeCol }));
    eye.position.set(0.14, 0.16, side * 0.08);
    headGrp.add(eye);
  }
  if (kind === 'stalker') {
    // phase shroud: tattered hood + drifting wisps (spectral teal — no purple)
    const hood = box(0.34, 0.24, 0.34, mat(0x14201e, { rough: 0.98 }));
    hood.position.y = 0.26;
    headGrp.add(hood);
    for (const side of [1, -1]) {
      const wisp = box(0.05, 0.4, 0.05, mat(0x3aa892, { emissive: 0x1f6a5c }));
      wisp.position.set(-0.25, 0.95, side * 0.3);
      wisp.rotation.x = side * 0.3;
      g.add(wisp);
    }
  }

  // sprinters run low
  if (kind === 'sprinter') {
    torso.rotation.z = -0.35;
    headGrp.position.x = 0.18;
    headGrp.position.y = 1.42;
  }

  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------------------
// Vehicles. Face +X. Wheels live in named axle groups so the renderer can
// spin them; the turret barrel sits in 'gunRecoil' for firing kick.
// Open vehicles (bike, hoverboard) carry a 'rider' figure the renderer shows
// only while the driver seat is occupied — no more haunted ghost-rides.
// ---------------------------------------------------------------------------

/** A compact posed rider for open vehicles. Named 'rider' for the renderer. */
/** THE IRON EATERS (DD SS20.1, D4): junk that learned a body plan --
 *  PROCEDURAL scrap composition from the prop vocabulary, seed-varied so no
 *  two beasts are alike. Rust, gunmetal, and the nanite glow underneath. */
function buildIronEater(kind: 'scraprat' | 'junkhound' | 'weaver' | 'ravager'): THREE.Group {
  const g = new THREE.Group();
  const rust = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.95, metalness: 0.4 });
  const gun = new THREE.MeshStandardMaterial({ color: 0x5a5e63, roughness: 0.8, metalness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xff5a1a, emissive: 0xcc3300, emissiveIntensity: 0.9, roughness: 0.5 });
  const jitter = () => (Math.random() - 0.5) * 0.12; // no two beasts alike (D4)
  const bx = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const cy = (r: number, h: number, m: THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), m);
  if (kind === 'scraprat') {
    const body = bx(0.7, 0.28, 0.36, rust); body.position.set(jitter(), 0.22, jitter()); g.add(body);
    const head = bx(0.24, 0.18, 0.24, gun); head.position.set(0.42, 0.26, 0); g.add(head);
    const tail = cy(0.045, 0.5, gun); tail.rotation.z = Math.PI / 2 + 0.4 + jitter(); tail.position.set(-0.5, 0.3, 0); g.add(tail);
    const core = bx(0.16, 0.1, 0.16, glow); core.position.set(0, 0.24, 0); g.add(core);
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const leg = cy(0.035, 0.2, gun); leg.position.set(sx * 0.24 + jitter(), 0.1, sz * 0.16); g.add(leg);
    }
  } else if (kind === 'junkhound') {
    const torso = bx(0.95, 0.42, 0.4, rust); torso.position.set(jitter(), 0.72, jitter()); g.add(torso);
    const head = bx(0.4, 0.3, 0.3, gun); head.position.set(0.62, 0.86, 0); head.rotation.y = jitter(); g.add(head);
    const jaw = bx(0.32, 0.08, 0.24, glow); jaw.position.set(0.68, 0.7, 0); g.add(jaw);
    for (const sx of [0.34, -0.34]) for (const sz of [0.18, -0.18]) {
      const spring = cy(0.05, 0.62, gun); spring.position.set(sx + jitter(), 0.34, sz); g.add(spring);
    }
    const plate = bx(0.5, 0.1, 0.46, rust); plate.position.set(-0.1, 0.98, 0); plate.rotation.z = 0.15 + jitter(); g.add(plate);
  } else if (kind === 'weaver') {
    const disc = cy(0.5, 0.22, rust); disc.position.set(0, 0.8, 0); g.add(disc);
    const eye = bx(0.2, 0.12, 0.2, glow); eye.position.set(0.3, 0.94, 0); g.add(eye);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + jitter();
      const leg = cy(0.04, 1.15, gun);
      leg.position.set(Math.cos(a) * 0.62, 0.5, Math.sin(a) * 0.62);
      leg.rotation.z = Math.cos(a) * 0.7; leg.rotation.x = -Math.sin(a) * 0.7;
      g.add(leg);
    }
  } else {
    // ravager: your own armor's silhouette, wrong
    const hull = bx(1.9, 0.85, 1.2, rust); hull.position.set(jitter(), 1.0, jitter()); g.add(hull);
    const upper = bx(1.2, 0.5, 0.9, gun); upper.position.set(-0.2, 1.6, 0); upper.rotation.y = jitter() * 2; g.add(upper);
    const maw = bx(0.5, 0.35, 0.7, glow); maw.position.set(0.95, 1.0, 0); g.add(maw);
    for (const sx of [0.7, -0.7]) for (const sz of [0.45, -0.45]) {
      const leg = bx(0.34, 0.7, 0.34, gun); leg.position.set(sx + jitter(), 0.35, sz); g.add(leg);
    }
    for (let i = 0; i < 3; i++) {
      const plate = bx(0.6 + Math.random() * 0.3, 0.1, 0.5, rust);
      plate.position.set(-0.6 + i * 0.5 + jitter(), 1.5 + i * 0.06, (Math.random() - 0.5) * 0.5);
      plate.rotation.y = jitter() * 3; g.add(plate);
    }
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

export function buildRider(team: Team, pose: 'surf' | 'straddle'): THREE.Group {
  const rider = new THREE.Group();
  rider.name = 'rider';
  const uniform = mat(team === 0 ? 0x6b5c38 : 0x3a5a66, { rough: 0.9 });
  const armor = mat(team === 0 ? 0x4e4228 : 0x27414c, { rough: 0.7, metal: 0.2 });
  const dark = mat(0x26241f, { rough: 0.8 });
  const trim = mat(TEAM_COLORS[team], { emissive: TEAM_COLORS[team] });

  const torso = box(0.34, 0.44, 0.4, uniform);
  const head = box(0.24, 0.24, 0.26, armor);
  const band = box(0.25, 0.05, 0.27, trim);

  if (pose === 'surf') {
    // feet spread along the deck, knees bent, arms out for balance
    rider.position.set(0, 0.51, 0);
    for (const [x, lean] of [[0.38, -0.25], [-0.34, 0.3]] as const) {
      const leg = box(0.14, 0.5, 0.15, uniform);
      leg.position.set(x, 0.24, 0);
      leg.rotation.z = lean;
      rider.add(leg);
      const boot = box(0.3, 0.09, 0.16, dark);
      boot.position.set(x, 0.05, 0);
      rider.add(boot);
    }
    torso.position.set(0.02, 0.68, 0);
    torso.rotation.z = -0.18; // leaning into the ride
    rider.add(torso);
    for (const side of [1, -1]) {
      // arms thrown wide for balance — the classic surf silhouette
      const arm = box(0.11, 0.11, 0.52, uniform);
      arm.position.set(0.04, 0.86, side * 0.45);
      arm.rotation.x = side * -0.35; // slight upward sweep
      rider.add(arm);
      const glove = box(0.1, 0.1, 0.1, mat(0x26241f, { rough: 0.8 }));
      glove.position.set(0.04, 0.94, side * 0.68);
      rider.add(glove);
    }
    head.position.set(0.08, 1.05, 0);
    rider.add(head);
    band.position.set(0.08, 1.14, 0);
    rider.add(band);
  } else {
    // straddling the saddle, crouched over the handlebars
    rider.position.set(-0.35, 0.95, 0);
    for (const side of [1, -1]) {
      const thigh = box(0.4, 0.14, 0.13, uniform);
      thigh.position.set(0.1, 0.05, side * 0.24);
      thigh.rotation.y = side * -0.15;
      rider.add(thigh);
      const shin = box(0.13, 0.4, 0.12, uniform);
      shin.position.set(0.28, -0.18, side * 0.3);
      rider.add(shin);
      const boot = box(0.26, 0.08, 0.13, dark);
      boot.position.set(0.32, -0.4, side * 0.3);
      rider.add(boot);
    }
    torso.position.set(0.28, 0.32, 0);
    torso.rotation.z = -0.85; // hunched racing tuck
    rider.add(torso);
    for (const side of [1, -1]) {
      const arm = box(0.48, 0.11, 0.11, uniform);
      arm.position.set(0.62, 0.38, side * 0.2);
      arm.rotation.z = -0.35;
      rider.add(arm);
    }
    head.position.set(0.62, 0.56, 0);
    rider.add(head);
    band.position.set(0.62, 0.66, 0);
    rider.add(band);
  }
  return rider;
}

