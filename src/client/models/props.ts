// The furniture of the war: jump gates, grav pads, rocks, trees, bunkers,
// crates, ruins, and the clone bay.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { box, cyl, mat } from './shared';

// ---------------------------------------------------------------------------
// THE MEMORIAL — the one GLTF in the match renderer, and it earns it: the
// City plaza's monument is Robert's own AI-generated soldier, remeshed to
// 958 voxel tris, bronze baked into vertex colors, 60 KB. The loading law:
// buildProp stays SYNCHRONOUS (the plinth renders instantly and carries the
// collision story); the statue mounts onto it when the fetch lands. One
// cached promise — a hundred memorials would still be one download.
// ---------------------------------------------------------------------------
let memorialStatue: Promise<THREE.Object3D | null> | null = null;
function loadMemorialStatue(): Promise<THREE.Object3D | null> {
  memorialStatue ??= new Promise((resolve) => {
    // vitest/node has no document and rejects relative URLs before the
    // loader's own error path can fire — the plinth stands alone there
    if (typeof window === 'undefined' || typeof document === 'undefined') return resolve(null);
    try {
      new GLTFLoader().load(
        '/models/memorial.glb',
        (gltf) => {
          const s = gltf.scene;
          s.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              // trust the baked patina: vertex colors ARE the material —
              // lifted ~25% because the war's sun is dimmer than Blender's
              const m = o.material as THREE.MeshStandardMaterial;
              m.vertexColors = true;
              m.color.setRGB(1.3, 1.25, 1.1);
              m.metalness = 0.5;
              m.roughness = 0.6;
            }
          });
          resolve(s);
        },
        undefined,
        () => resolve(null),
      );
    } catch { resolve(null); }
  });
  return memorialStatue;
}

// ---------------------------------------------------------------------------
// THE PROP LIBRARY (Quaternius, converted from .blend by tools/blend-to-glb.py).
// Flat vertex/material colours, no textures — which is exactly why they sit
// next to our procedural silhouettes instead of fighting them.
//
// Same loading law as the memorial above: buildProp stays SYNCHRONOUS, so the
// procedural body renders instantly AND carries the collision story; the GLB
// swaps in when the fetch lands, and if it 404s (or we're in vitest) the
// procedural one simply stays. One cached promise per FILE — a 200-tree forest
// is four downloads and every instance shares the loaded geometry.
//
// Models are auto-GROUNDED (several have their origin above the base — the
// Windmill sits 2.26u under it) and auto-FITTED to the size our generators
// already assume, so `scale` keeps meaning exactly what it meant before.
// ---------------------------------------------------------------------------
interface GlbProp { files: string[]; fit: 'h' | 'w'; target: number }
const GLB_PROPS: Record<string, GlbProp> = {
  // fit trees by HEIGHT to the procedural cone-tree they replace
  tree: { files: ['Tree1', 'Tree2', 'Tree3', 'Tree4'], fit: 'h', target: 5.4 },
  // rocks fit by WIDTH: the collision footprint is tile-quantised off the
  // radius, so matching the girth is what keeps the invisible walls honest
  rock: { files: ['Rock1', 'Rock2', 'Rock3'], fit: 'w', target: 2.9 },
  // §farm. Crops are decoration on walkable grass — corn keeps its native 2u
  // so a field stands taller than a man. The landmarks fit by WIDTH to the
  // tiles they claim (barn 2×2, the rest 1×1) so mesh and collision agree.
  // NB: TILE is 3u. The barn claims 2×2, so it fits to 6 across; the towers
  // claim a single tile, so they fit to 3 across (the windmill and water tower
  // fit by HEIGHT — their bases are narrow and the sails/tank overhang above
  // head height, which is a thing you walk under, not into).
  // CORN ONLY. Wheat_4 is a 0.95u stalk, and fitting it to the 2u a
  // concealment crop needs stretched one lonely wheat to twice a man's height.
  // Corn is natively 1.97u — it earns the target instead of being racked to it.
  crop: { files: ['Corn_4'], fit: 'h', target: 2.0 },
  barn: { files: ['Barn', 'BigBarn', 'SmallBarn'], fit: 'w', target: 6 },
  // A HOUSE THAT IS NOT A HOUSE YOU ENTER. The stamped houses are 30+ units
  // wide with doors and rooms; these are 4-unit models we scale to 7 and sit
  // on a solid 2x2 claim, so they read as a farmstead you fight AROUND. They
  // stay in the farm — the neighbourhood teaches "a house has a door," and one
  // that doesn't would make a liar of every other one on the map.
  farmhouse: { files: ['House1', 'House2', 'Building4'], fit: 'w', target: 7 },
  silo_farm: { files: ['Silo'], fit: 'w', target: 3 },
  windmill: { files: ['Windmill', 'TowerWindmill'], fit: 'h', target: 10 },
  watertower: { files: ['WaterTower'], fit: 'h', target: 7.5 },
};

const glbCache = new Map<string, Promise<THREE.Object3D | null>>();
function loadGlbProp(name: string): Promise<THREE.Object3D | null> {
  let p = glbCache.get(name);
  if (p) return p;
  p = new Promise<THREE.Object3D | null>((resolve) => {
    // vitest/node has no document and rejects relative URLs before the
    // loader's own error path can fire — the procedural body stands alone there
    if (typeof window === 'undefined' || typeof document === 'undefined') return resolve(null);
    try {
      new GLTFLoader().load(`/models/props/${name}.glb`, (gltf) => {
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        resolve(gltf.scene);
      }, undefined, () => resolve(null));
    } catch { resolve(null); }
  });
  glbCache.set(name, p);
  return p;
}

/** A prop group: the procedural `fallback` now, the real model when it lands. */
function glbProp(kind: string, scale: number, seed: number, fallback: THREE.Object3D): THREE.Object3D {
  const def = GLB_PROPS[kind];
  const g = new THREE.Group();
  g.add(fallback);
  if (!def) return g;
  // deterministic variant pick — the same prop always wears the same model
  const name = def.files[Math.abs(Math.round(seed * 997)) % def.files.length];
  void loadGlbProp(name).then((src) => {
    if (!src) return; // 404 or headless — keep the procedural body
    const m = src.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const native = def.fit === 'h' ? size.y : Math.max(size.x, size.z);
    if (native > 0.001) m.scale.setScalar((def.target * scale) / native);
    // sit it ON the ground: re-measure after scaling and lift by the base
    const grounded = new THREE.Box3().setFromObject(m);
    m.position.y -= grounded.min.y;
    g.remove(fallback);
    g.add(m);
  });
  return g;
}

export function buildGate(): THREE.Group {
  const g = new THREE.Group();
  const frame = mat(0x3a3f44, { metal: 0.6, rough: 0.3 });
  const portal = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.16, 10, 28),
    mat(0x66e8ff, { emissive: 0x44ccee }),
  );
  portal.position.y = 1.9;
  portal.name = 'spin';
  g.add(portal);
  const film = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 24),
    new THREE.MeshStandardMaterial({
      color: 0x66e8ff, emissive: 0x44ccee, emissiveIntensity: 0.5,
      transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  film.position.y = 1.9;
  g.add(film);
  for (const side of [1, -1]) {
    const post = box(0.3, 2.2, 0.3, frame);
    post.position.set(0, 1.1, side * 1.8);
    g.add(post);
  }
  return g;
}

/** Grav-lift pad. */
export function buildPad(): THREE.Group {
  const g = new THREE.Group();
  const disc = cyl(1.3, 1.5, 0.18, mat(0x30363c, { metal: 0.5, rough: 0.4 }), 16);
  disc.position.y = 0.09;
  g.add(disc);
  const lens = cyl(1.0, 1.0, 0.1, mat(0x30d0c0, { emissive: 0x18a894 }), 16); // grav-lift energy: teal (no purple)
  lens.position.y = 0.2;
  lens.name = 'pulse';
  g.add(lens);
  return g;
}


export function buildProp(type: string, scale: number): THREE.Object3D {
  switch (type) {
    case 'rock': {
      // The collision footprint is a tile-quantized PLUS shape (map.ts rock
      // blobs: r=round(scale/1.6) tiles on the axes, less on diagonals), so
      // no sphere matches it exactly. ×1.45 is the compromise: it closes most
      // of the axis-direction invisible-wall gap (the reported bug) while
      // keeping the diagonal overhang — where the mesh pokes past collision —
      // under one world unit.
      // Two-tone boulder instead of the old single flat-grey blob: a dark
      // base, a lighter weathered cap sitting INSIDE the same footprint (no
      // collision change), and a scale-seeded tumble so no two read alike.
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.IcosahedronGeometry(scale * 1.45, 0), mat(0x655f52, { rough: 0.95 }));
      base.position.y = scale * 0.5;
      base.rotation.y = scale * 7.3; // seed-stable variety, free
      base.castShadow = true;
      const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(scale * 0.85, 0), mat(0x837b6b, { rough: 0.9 }));
      cap.position.set(scale * 0.2, scale * 1.05, -scale * 0.12);
      cap.rotation.set(0.5, scale * 3.1, 0.3);
      cap.castShadow = true;
      g.add(base, cap);
      return glbProp('rock', scale, scale, g);
    }
    case 'tree': {
      const g = new THREE.Group();
      const trunk = cyl(0.18 * scale, 0.28 * scale, 2.2 * scale, mat(0x5a4632), 6);
      trunk.position.y = 1.1 * scale;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.5 * scale, 3 * scale, 7), mat(0x40613c, { rough: 0.9 }));
      crown.position.y = 3.4 * scale;
      crown.castShadow = true;
      const crown2 = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 2.2 * scale, 7), mat(0x4a6f44, { rough: 0.9 }));
      crown2.position.y = 4.3 * scale;
      crown2.castShadow = true;
      g.add(trunk, crown, crown2);
      // the cone-tree is the instant body; a real trunk swaps in when it lands
      return glbProp('tree', scale, scale, g);
    }
    case 'crate': {
      const g = new THREE.Group();
      const c = box(1.7, 1.1, 1.7, mat(0x7c6a44, { rough: 0.9 }));
      c.position.y = 0.55;
      const band = box(1.75, 0.15, 1.75, mat(0x4c4436));
      band.position.y = 0.55;
      g.add(c, band);
      return g;
    }
    case 'bunker': {
      const g = new THREE.Group();
      const wall = box(3, 2.4, 5, mat(0x5c5c50, { rough: 0.95 }));
      wall.position.y = 1.2;
      const roof = box(3.6, 0.3, 5.6, mat(0x4a4a40));
      roof.position.y = 2.55;
      g.add(wall, roof);
      return g;
    }
    case 'silo': {
      // the farm and fuel skyline (§8.2 Plains/Airbase/Refinery): a fat
      // drum, a dome cap, and a fill pipe down the flank. At refinery scale
      // (~2.1) it reads as a storage tank; at farm scale (~1) it's grain.
      const g = new THREE.Group();
      const drum = cyl(1.5 * scale, 1.6 * scale, 4.2 * scale, mat(0x8a8578, { metal: 0.35, rough: 0.6 }), 10);
      drum.position.y = 2.1 * scale;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.5 * scale, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
        mat(0x77725f, { metal: 0.4, rough: 0.55 }),
      );
      dome.position.y = 4.2 * scale;
      dome.castShadow = true;
      const band = cyl(1.62 * scale, 1.62 * scale, 0.22 * scale, mat(0x5c5748, { metal: 0.4, rough: 0.5 }), 10);
      band.position.y = 1.4 * scale;
      const pipe = cyl(0.12 * scale, 0.12 * scale, 4.0 * scale, mat(0x4c4a40, { metal: 0.5, rough: 0.4 }), 6);
      pipe.position.set(1.55 * scale, 2.0 * scale, 0);
      g.add(drum, dome, band, pipe);
      return g;
    }
    case 'flare_stack': {
      // the refinery's pilot light (and, small, the blacksite's antenna):
      // a guyed mast with an amber-hot tip — visible across the front, on
      // purpose. The tip is the only glow; no purple, no exceptions.
      const g = new THREE.Group();
      const mast = cyl(0.16 * scale, 0.3 * scale, 7.5 * scale, mat(0x5a5a52, { metal: 0.55, rough: 0.4 }), 8);
      mast.position.y = 3.75 * scale;
      const cage = box(0.7 * scale, 1.1 * scale, 0.7 * scale, mat(0x4a4a44, { metal: 0.5, rough: 0.5 }));
      cage.position.y = 6.4 * scale;
      const tip = cyl(0.24 * scale, 0.18 * scale, 0.5 * scale, mat(0xffa030, { emissive: 0xe86818 }), 8);
      tip.position.y = 7.6 * scale;
      tip.name = 'pulse';
      for (const side of [-1, 1]) {
        const guy = box(0.05 * scale, 4.6 * scale, 0.05 * scale, mat(0x3c3c38, { metal: 0.6, rough: 0.3 }));
        guy.position.set(side * 0.9 * scale, 2.3 * scale, -side * 0.5 * scale);
        guy.rotation.z = side * 0.32;
        g.add(guy);
      }
      g.add(mast, cage, tip);
      return g;
    }
    case 'crane': {
      // harbor iron (§8.2 Port/Mine headframe): a portal gantry straddling
      // a container lane — two legs, a beam, a trolley, and the hook.
      const g = new THREE.Group();
      const legMat = mat(0xa06a28, { metal: 0.45, rough: 0.55 }); // work-rust amber
      for (const side of [-1, 1]) {
        const leg = box(0.5 * scale, 6.5 * scale, 0.5 * scale, legMat);
        leg.position.set(0, 3.25 * scale, side * 3.4 * scale);
        const foot = box(1.4 * scale, 0.4 * scale, 0.9 * scale, mat(0x55534c, { metal: 0.5, rough: 0.5 }));
        foot.position.set(0, 0.2 * scale, side * 3.4 * scale);
        const brace = box(0.28 * scale, 2.6 * scale, 0.28 * scale, legMat);
        brace.position.set(0, 1.8 * scale, side * 2.5 * scale);
        brace.rotation.x = side * 0.5;
        g.add(leg, foot, brace);
      }
      const beam = box(0.7 * scale, 0.6 * scale, 7.6 * scale, legMat);
      beam.position.y = 6.6 * scale;
      const cab = box(1.1 * scale, 0.9 * scale, 1.1 * scale, mat(0x55534c, { metal: 0.4, rough: 0.5 }));
      cab.position.set(0, 6.0 * scale, 1.2 * scale);
      const trolley = box(0.9 * scale, 0.35 * scale, 0.8 * scale, mat(0x3f3d38, { metal: 0.6, rough: 0.35 }));
      trolley.position.y = 6.2 * scale;
      const cable = box(0.06 * scale, 2.6 * scale, 0.06 * scale, mat(0x2e2c28, { metal: 0.5, rough: 0.4 }));
      cable.position.y = 4.8 * scale;
      const hook = box(0.5 * scale, 0.4 * scale, 0.5 * scale, mat(0xd9a13a, { metal: 0.5, rough: 0.4 }));
      hook.position.y = 3.4 * scale;
      g.add(beam, cab, trolley, cable, hook);
      return g;
    }
    case 'wreck': {
      // a burned-out hull — §8.2's connective tissue: the Plains' no-man's
      // lane, the City's dead intersections, the Span's stalled convoy.
      // Charcoal steel, a thrown track, the turret knocked askew. The scar
      // system will one day PLACE these where battles died (§8.5); until
      // then the fronts author their own histories.
      const g = new THREE.Group();
      const char = mat(0x35322e, { rough: 0.95 });
      const rust = mat(0x6b4a30, { rough: 0.85 });
      const hull = box(3.4 * scale, 1.0 * scale, 1.9 * scale, char);
      hull.position.y = 0.62 * scale;
      hull.rotation.z = 0.05;
      const glacis = box(1.0 * scale, 0.7 * scale, 1.7 * scale, rust);
      glacis.position.set(1.5 * scale, 0.75 * scale, 0);
      glacis.rotation.z = -0.4;
      const turret = box(1.5 * scale, 0.6 * scale, 1.3 * scale, char);
      turret.position.set(-0.5 * scale, 1.35 * scale, 0.25 * scale);
      turret.rotation.y = 0.7; // knocked off its ring
      turret.rotation.x = 0.12;
      const tube = cyl(0.11 * scale, 0.13 * scale, 2.2 * scale, rust, 6);
      tube.rotation.z = Math.PI / 2 - 0.35; // gun frozen skyward
      tube.position.set(0.7 * scale, 1.75 * scale, 0.25 * scale);
      const track = box(2.6 * scale, 0.3 * scale, 0.4 * scale, char);
      track.position.set(-0.7 * scale, 0.15 * scale, 1.35 * scale); // the thrown track
      track.rotation.y = 0.25;
      g.add(hull, glacis, turret, tube, track);
      return g;
    }
    case 'memorial': {
      // the plinth is procedural stone — instant, collision-honest, and the
      // fallback if the statue never arrives (tests, offline dev)
      const g = new THREE.Group();
      const stone = mat(0x565452, { rough: 0.9 });
      const baseStep = box(2.6 * scale, 0.35 * scale, 2.6 * scale, stone);
      baseStep.position.y = 0.175 * scale;
      const plinth = box(1.7 * scale, 0.85 * scale, 1.7 * scale, mat(0x4a4846, { rough: 0.85 }));
      plinth.position.y = 0.35 * scale + 0.425 * scale;
      const cap = box(1.9 * scale, 0.12 * scale, 1.9 * scale, stone);
      cap.position.y = 1.26 * scale;
      // the plaque: one amber line on the front face — the game's accent
      const plaque = box(0.02 * scale, 0.3 * scale, 0.75 * scale, mat(0xd9a13a, { metal: 0.7, rough: 0.35, emissive: 0x6b4a10 }));
      plaque.position.set(0.86 * scale, 0.78 * scale, 0);
      g.add(baseStep, plinth, cap, plaque);
      const top = 1.32 * scale;
      void loadMemorialStatue().then((statue) => {
        if (!statue) return;
        const s = statue.clone();
        const statueScale = 2.4 * scale; // 1.116u figure → ~2.7u of bronze presence
        s.scale.setScalar(statueScale);
        // the GLB is authored clean: feet at origin, +Y up, facing +X
        // (tools/fix-memorial-axis.mjs bakes that in — never rotate here,
        // the gltf root's own transform makes mount-time rotations lie)
        s.position.y = top;
        g.add(s);
      });
      return g;
    }
    case 'clone_bay': {
      // §21 The Reprint: the machine you come back from. A glass pod on a
      // steel collar, ~3u tall. PropSpec carries no team, so the core glows
      // neutral printer-amber — the bay serves whoever's base it stands in.
      // NO purple, ever.
      const g = new THREE.Group();
      const collar = cyl(1.0, 1.15, 0.3, mat(0x3a3f3c, { metal: 0.55, rough: 0.4 }), 12);
      collar.position.y = 0.15;
      const core = cyl(0.3, 0.3, 1.9, mat(0xf0b040, { emissive: 0xd88a18 }), 8);
      core.position.y = 1.35;
      core.name = 'core';
      // the glass is hand-rolled (not cyl()): transparent, no depth write, no
      // cast shadow — a pod that shades its own printer floor reads as solid
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, 2.3, 12, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0xbfe3e8, transparent: true, opacity: 0.22,
          roughness: 0.12, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      glass.position.y = 1.55;
      const cap = cyl(0.95, 0.8, 0.35, mat(0x3a3f3c, { metal: 0.55, rough: 0.4 }), 12);
      cap.position.y = 2.85;
      g.add(collar, core, glass, cap);
      return g;
    }
    // §farm — each carries a cheap procedural body so the silhouette and the
    // collision story exist on frame one; the real model swaps in on load.
    case 'crop': {
      // A FIELD, NOT A FLAGPOLE. Corn stands taller than a man and conceals
      // like the tall grass it grows on (walkable — this claims no tile), but
      // ONE stalk on a 3u tile reads as bare dirt with a twig in it. A crop
      // tile is a CLUMP. It's cheap to do honestly: a map grows at most ~70
      // crop props, so a handful of stalks each costs nothing, and the GLB
      // itself is fetched once and cloned.
      const g = new THREE.Group();
      // jitter derived from the prop's own scale, so a given stalk stands in
      // the same place every time the map is drawn
      let h = Math.abs(Math.sin(scale * 127.1) * 43758.5453) % 1;
      const rnd = () => (h = Math.abs(Math.sin(h * 127.1 + 311.7) * 43758.5453) % 1);
      for (let i = 0; i < 5; i++) {
        const s = scale * (0.85 + rnd() * 0.3);
        const one = new THREE.Group();
        const stalk = cyl(0.06 * s, 0.09 * s, 1.9 * s, mat(0x7c8a3a, { rough: 1 }), 4);
        stalk.position.y = 0.95 * s;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.5 * s, 5), mat(0xb8a94a, { rough: 1 }));
        head.position.y = 1.95 * s;
        one.add(stalk, head);
        const plant = glbProp('crop', s, s + i, one);
        plant.position.set((rnd() - 0.5) * 1.9, 0, (rnd() - 0.5) * 1.9);
        plant.rotation.y = rnd() * Math.PI * 2;
        g.add(plant);
      }
      return g;
    }
    case 'barn': {
      const g = new THREE.Group();
      const body = box(5.4 * scale, 3.4 * scale, 5.6 * scale, mat(0x8c4b3a, { rough: 0.95 }));
      body.position.y = 1.7 * scale; body.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3 * scale, 2.1 * scale, 4), mat(0x5b3b30, { rough: 0.95 }));
      roof.position.y = 4.4 * scale; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
      g.add(body, roof);
      return glbProp('barn', scale, scale, g);
    }
    case 'farmhouse': {
      const g = new THREE.Group();
      const body = box(5.6 * scale, 3.6 * scale, 4.6 * scale, mat(0xd8cdb4, { rough: 0.95 }));
      body.position.y = 1.8 * scale; body.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2 * scale, 2.2 * scale, 4), mat(0x7a4436, { rough: 0.95 }));
      roof.position.y = 4.7 * scale; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
      const stack = box(0.5 * scale, 1.4 * scale, 0.5 * scale, mat(0x6d6560, { rough: 0.95 }));
      stack.position.set(1.5 * scale, 5.1 * scale, 1.1 * scale); stack.castShadow = true;
      g.add(body, roof, stack);
      return glbProp('farmhouse', scale, scale, g);
    }
    case 'silo_farm': {
      const g = new THREE.Group();
      const drum = cyl(1.4 * scale, 1.4 * scale, 6 * scale, mat(0xb9bcc0, { metal: 0.35, rough: 0.7 }), 12);
      drum.position.y = 3 * scale; drum.castShadow = true;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4 * scale, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8f9398, { metal: 0.4, rough: 0.6 }));
      dome.position.y = 6 * scale; dome.castShadow = true;
      g.add(drum, dome);
      return glbProp('silo_farm', scale, scale, g);
    }
    case 'windmill': {
      const g = new THREE.Group();
      const tower = cyl(0.7 * scale, 1.2 * scale, 7.5 * scale, mat(0xa89a83, { rough: 0.95 }), 8);
      tower.position.y = 3.75 * scale; tower.castShadow = true;
      const sail = box(0.3 * scale, 5.5 * scale, 0.15 * scale, mat(0x6a5a48, { rough: 0.95 }));
      sail.position.y = 7.8 * scale; sail.castShadow = true;
      g.add(tower, sail);
      return glbProp('windmill', scale, scale, g);
    }
    case 'watertower': {
      const g = new THREE.Group();
      const tank = cyl(1.25 * scale, 1.25 * scale, 3 * scale, mat(0x7d8a72, { metal: 0.3, rough: 0.8 }), 10);
      tank.position.y = 6.4 * scale; tank.castShadow = true;
      for (const [lx, lz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const leg = cyl(0.12 * scale, 0.12 * scale, 5 * scale, mat(0x5c6355, { metal: 0.3, rough: 0.8 }), 5);
        leg.position.set(lx * 0.85 * scale, 2.5 * scale, lz * 0.85 * scale);
        g.add(leg);
      }
      g.add(tank);
      return glbProp('watertower', scale, scale, g);
    }
    default:
      return new THREE.Group();
  }
}

