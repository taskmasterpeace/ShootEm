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
      return g;
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
      return g;
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
    default:
      return new THREE.Group();
  }
}

