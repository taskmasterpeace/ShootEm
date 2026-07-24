// ───────────────────────────────────────────────────────────────────────────
// THE CABINET YOU CAN SEE.
//
// Cabinets became usable last cycle — walk up, press E, play — but nothing
// stood there to walk up TO. The machine existed only as a radius on the floor,
// which is a strange kind of half-feature: the game would offer you a game at a
// spot where there was visibly nothing.
//
// The silhouette does the work: a tall box, a lit marquee, a screen under a
// hood, an angled control deck at the waist. That reads as "arcade machine"
// from across a room at any angle, which is the whole job — you should know
// what it is before you can read a word on it.
//
// And each one wears the LABEL OF THE GAME BOLTED INSIDE IT, so a row reads as
// five different machines rather than five identical boxes.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildArcadeCabinet } from '../src/client/renderer';
import { CARTRIDGES } from '../src/client/gonet/cartridges';

const hex = (css: string) => parseInt(css.replace('#', ''), 16);
const cab = (ink = 0xe8a33d, base = 0x1a1712) => buildArcadeCabinet(ink, base);

/** every colour anywhere in the group */
function colours(g: THREE.Object3D): number[] {
  const out: number[] = [];
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
    if (m?.color) out.push(m.color.getHex());
  });
  return out;
}

describe('a cabinet reads as a cabinet', () => {
  it('stands about as tall as the man playing it', () => {
    const box = new THREE.Box3().setFromObject(cab());
    const size = new THREE.Vector3();
    box.getSize(size);
    // a soldier is 1.8u; a machine you stand at should be near eye height
    expect(size.y).toBeGreaterThan(1.4);
    expect(size.y).toBeLessThan(2.2);
    // and it must be a CABINET, not a wardrobe or a post
    expect(size.x).toBeGreaterThan(0.6);
    expect(size.x).toBeLessThan(1.2);
    expect(size.z).toBeGreaterThan(0.5);
    expect(size.z).toBeLessThan(1.2);
  });

  it('sits ON the floor, never sunk into it or hovering', () => {
    const box = new THREE.Box3().setFromObject(cab());
    expect(box.min.y).toBeGreaterThan(-0.05);
    expect(box.min.y).toBeLessThan(0.05);
  });

  it('has the parts that make the silhouette — shell, marquee, screen, deck', () => {
    const g = cab();
    let meshes = 0;
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBeGreaterThanOrEqual(5);
  });

  it('the marquee is LIT — it is the one part that glows in a dark room', () => {
    const g = cab(0x6fbf73);
    let basic = 0;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && (m as THREE.MeshBasicMaterial).isMeshBasicMaterial) basic++;
    });
    expect(basic, 'nothing on this cabinet is unlit by the world').toBe(1);
  });

  it('is cheap enough to stand a row of them', () => {
    const g = cab();
    let tris = 0;
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const pos = mesh.geometry.getAttribute('position');
      tris += pos.count / 3;
    });
    expect(tris, 'a box with a sign on it should not cost a soldier').toBeLessThan(200);
  });
});

describe('every machine wears its own game', () => {
  it('the cartridge\'s ink actually reaches the cabinet', () => {
    for (const c of CARTRIDGES) {
      const g = cab(hex(c.label.ink), hex(c.label.base));
      expect(colours(g), `${c.title} does not wear its own ink`).toContain(hex(c.label.ink));
    }
  });

  it('so no two machines in the row look alike', () => {
    // the point of side art: you learn which one is DEEP SHAFT by its green
    const inks = new Set(CARTRIDGES.map((c) => c.label.ink));
    expect(inks.size).toBe(CARTRIDGES.length);
  });

  it('and NO PURPLE, on any machine, ever', () => {
    for (const c of CARTRIDGES) {
      const g = cab(hex(c.label.ink), hex(c.label.base));
      for (const col of colours(g)) {
        const hsl = { h: 0, s: 0, l: 0 };
        new THREE.Color(col).getHSL(hsl);
        const deg = hsl.h * 360;
        const purple = deg > 255 && deg < 330 && hsl.s > 0.15;
        expect(purple, `${c.title} has a purple part (${deg.toFixed(0)}°)`).toBe(false);
      }
    }
  });
});
