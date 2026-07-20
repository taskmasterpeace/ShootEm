// ---------------------------------------------------------------------------
// M6 THE SILHOUETTE PASS (Robert: "get our entire visual look for our LSWs…
// pay more attention to detail, and remember that we're going to be ZOOMED
// OUT"). At command zoom a god is ~40px tall — tint and scale barely register
// and surface detail is wasted. OUTLINE is the only channel that survives.
//
// This suite is the law for that: every god breaks its rectangle somehow, the
// breakers mount exactly once (dressAsLsw runs per-frame), and none of them
// smuggles in purple.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LSWS } from '../src/sim/lsw';
import { LSW_SILHOUETTE, LSW_TINT, buildSoldier, dressAsLsw } from '../src/client/models/soldiers';
import type { AscendantId } from '../src/sim/types';

const ids = Object.keys(LSWS) as AscendantId[];
const dress = (id: AscendantId) => dressAsLsw(buildSoldier(LSWS[id].faction, 'infantry', 'bot'), id);
const countMeshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) n++; });
  return n;
};

describe('M6 — every god breaks its own rectangle', () => {
  it('EVERY LSW gets a silhouette breaker or an equivalent bespoke shape', () => {
    // the exempt list is exempt because it ALREADY has a distinct outline
    // (a hand prop, a cape, or a body-scale that reads on its own)
    const bespoke = new Set(['chronos', 'dominator', 'reaper', 'eclipse']); // caped
    const missing = ids.filter((id) => !LSW_SILHOUETTE[id] && !bespoke.has(id) && !LSWS[id].prop);
    expect(missing, `these gods still read as a recolored trooper: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('the breaker actually adds geometry, and lands on a real joint', () => {
    for (const id of ids) {
      if (!LSW_SILHOUETTE[id]) continue;
      const body = dress(id);
      const sil = body.getObjectByName('silhouette');
      expect(sil, `${id} has no silhouette node`).toBeDefined();
      expect(countMeshes(sil!), `${id}'s breaker is empty`).toBeGreaterThan(0);
      // it must hang off a NAMED joint — a free-floating breaker won't follow
      // the body through the gait, and the rig contract owns those joints
      const host = sil!.parent!;
      expect(['head', 'torso'], `${id} mounted on ${host.name}`).toContain(host.name);
    }
  });

  it('IDEMPOTENT: dressAsLsw runs per-frame and must never stack breakers', () => {
    for (const id of ids.slice(0, 12)) {
      const body = buildSoldier(LSWS[id].faction, 'infantry', 'bot');
      dressAsLsw(body, id);
      const once = countMeshes(body);
      for (let f = 0; f < 30; f++) dressAsLsw(body, id); // 30 frames of dressing
      expect(countMeshes(body), `${id} grew extra geometry across frames`).toBe(once);
    }
  });

  it('NO PURPLE, still — the house law survives the visual pass', () => {
    for (const id of ids) {
      const body = dress(id);
      body.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!m?.color) return;
        const hsl = { h: 0, s: 0, l: 0 };
        m.color.getHSL(hsl);
        const hue = hsl.h * 360;
        const purple = hue > 260 && hue < 330 && hsl.s > 0.15;
        expect(purple, `${id} wears a purple part (hue ${hue.toFixed(0)})`).toBe(false);
      });
    }
  });

  it('the tint table and the silhouette table agree on who exists', () => {
    for (const id of Object.keys(LSW_SILHOUETTE)) {
      expect(LSWS[id as AscendantId], `${id} has a silhouette but is not a god`).toBeDefined();
      expect(LSW_TINT[id], `${id} has a silhouette but no tint`).toBeDefined();
    }
  });
});
