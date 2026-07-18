// ---------------------------------------------------------------------------
// VISION FADE (§11 row 6, Robert): "when you look away they should fade over
// 5s; different classes see longer; the MAX is 5." The linger is per-VIEWER;
// the renderer dissolves the ghost across the window instead of popping it.
// These pin the LINGER MATH — the sim side of the law.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { MAX_LINGER, classLinger } from '../src/sim/perception';

describe('per-class vision linger', () => {
  it('recon classes hold a lost contact longer than the line classes', () => {
    expect(classLinger('ghost', false)).toBeGreaterThan(classLinger('infantry', false));
    expect(classLinger('infiltrator', false)).toBeGreaterThan(classLinger('heavy', false));
  });

  it('tracking optics buys more linger', () => {
    expect(classLinger('infantry', true)).toBeGreaterThan(classLinger('infantry', false));
  });

  it('NOTHING exceeds the 5-second law — not even recon with optics', () => {
    for (const c of ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost']) {
      expect(classLinger(c, true), `${c} with optics broke the 5s law`).toBeLessThanOrEqual(MAX_LINGER);
      expect(classLinger(c, false)).toBeLessThanOrEqual(MAX_LINGER);
    }
    expect(classLinger('ghost', true)).toBe(MAX_LINGER); // the cap is reachable, never passable
  });
});
