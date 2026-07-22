// ---------------------------------------------------------------------------
// THE RETICLE FAMILY (Robert: "I wanna design like 8 or 9 of these"). A set of
// aim cursors. GROUND styles (wedge/circle) lie flat where you aim and live in
// the renderer's ground-ring code. STANDING styles are built HERE: flat 2D
// shapes in the XY plane (facing +Z), floated in front of the player and
// billboarded to the camera each frame, with a little ground shadow. Built at
// ~unit scale; the renderer scales + colours + places them.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import type { ReticleStyle } from './settings';

/** #79 THE RANGEFINDER: the laser's marched length, written by the renderer
 *  each frame it draws the beam, read by the HUD's range chip. -1 = no beam. */
export const rangeState = { len: -1 };

/** a thin bar centered at (cx,cy), `len` long on the given axis, `thick` wide */
function bar(cx: number, cy: number, len: number, thick: number, axis: 'x' | 'y', mat: THREE.Material): THREE.Mesh {
  const geo = axis === 'x' ? new THREE.PlaneGeometry(len, thick) : new THREE.PlaneGeometry(thick, len);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, cy, 0);
  return m;
}

/** Build a STANDING reticle in its own local space (facing +Z, ~1u tall). The
 *  renderer yaws it to FACE THE SHOOTER (the shot passes through the circle) and
 *  scales it. Robert's 07-22 rulings: soften it to a translucent overlay look
 *  ("make it opaque a little so it look like a overlay"), and it HIDES behind
 *  cover — depthTest ON, so a wall between you and the aim point eats it. */
export function buildStandingReticle(style: ReticleStyle, color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62, depthTest: true, depthWrite: false, side: THREE.DoubleSide });
  g.renderOrder = 999; // still late in the queue so its own translucency stacks clean
  const T = 0.05; // bar thickness
  const add = (m: THREE.Object3D) => { (m as THREE.Mesh).renderOrder = 999; g.add(m); };
  switch (style) {
    case 'dot':
      add(new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), mat));
      break;
    case 'cross': // a thin + with a center gap
      add(bar(0.32, 0, 0.34, T, 'x', mat)); add(bar(-0.32, 0, 0.34, T, 'x', mat));
      add(bar(0, 0.32, 0.34, T, 'y', mat)); add(bar(0, -0.32, 0.34, T, 'y', mat));
      break;
    case 'chevron': { // a V pointing up (the battle sight)
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.4, T), mat); l.position.set(-0.14, -0.1, 0); l.rotation.z = 0.9; add(l);
      const r = new THREE.Mesh(new THREE.PlaneGeometry(0.4, T), mat); r.position.set(0.14, -0.1, 0); r.rotation.z = -0.9; add(r);
      break;
    }
    case 'brackets': { // four corner brackets around the point
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
        add(bar(sx * 0.34, sy * 0.5, 0.22, T, 'x', mat)); // horizontal leg
        add(bar(sx * 0.5, sy * 0.34, 0.22, T, 'y', mat)); // vertical leg
      }
      break;
    }
    case 'ringdot': // a ring with a center dot
      add(new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 32), mat));
      add(new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), mat));
      break;
    case 'crosshair':
    default: { // the classic: a + with a center gap, wrapped in a thin ring + a dot
      add(bar(0.34, 0, 0.4, T, 'x', mat)); add(bar(-0.34, 0, 0.4, T, 'x', mat));
      add(bar(0, 0.34, 0.4, T, 'y', mat)); add(bar(0, -0.34, 0.4, T, 'y', mat));
      add(new THREE.Mesh(new THREE.RingGeometry(0.52, 0.58, 40), mat));
      add(new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), mat));
      break;
    }
  }
  return g;
}

/** A STANDING reticle floats out in front and its foot nearly meets the ground
 *  — so a soft shadow ellipse under it reads as "planted in the world" (Robert:
 *  "a part of the circle could be touching the ground… put a little shadow"). */
export function buildReticleShadow(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2; // flat on the ground
  return m;
}

/** GROUND styles lie flat; STANDING styles rise on the vertical plane. */
export function isStandingReticle(style: ReticleStyle): boolean {
  return style !== 'wedge' && style !== 'circle';
}

/** THE PERSONAL LASER (Robert: "put a little green laser on it… just for your
 *  character"). A thin green beam down the aim line + a bright dot at the far
 *  end. Built along +X (unit length); the renderer stretches/aims/places it. It
 *  renders ONLY for the local player, so lasers don't cover the screen. */
export function buildLaser(): THREE.Group {
  const g = new THREE.Group();
  const green = 0x37e83a;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1, 6),
    new THREE.MeshBasicMaterial({ color: green, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  beam.rotation.z = -Math.PI / 2; // cylinder is +Y; lay it along +X
  beam.position.x = 0.5;          // its base sits at the origin, reaching to +X=1
  beam.name = 'beam';
  g.add(beam);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: green, transparent: true, opacity: 0.9, depthWrite: false }));
  dot.name = 'dot';
  g.add(dot);
  return g;
}
