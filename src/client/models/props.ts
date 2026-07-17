// The furniture of the war: jump gates, grav pads, rocks, trees, bunkers,
// crates, ruins, and the clone bay.
import * as THREE from 'three';
import { box, cyl, mat } from './shared';

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
      const geo = new THREE.IcosahedronGeometry(scale * 1.45, 0);
      const mesh = new THREE.Mesh(geo, mat(0x6e685c, { rough: 0.95 }));
      mesh.position.y = scale * 0.5;
      mesh.castShadow = true;
      return mesh;
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

