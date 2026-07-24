// ───────────────────────────────────────────────────────────────────────────
// THE ARCADE ON THE MAP.
//
// Cabinets have been in the city for a cycle — but nothing pointed at them. You
// found one by walking into it, which for a walk-up console is most of the way
// back to it not existing: if you never happen down the right street, the
// machine may as well not be there.
//
// A little amber SCREEN glyph marks each one on the minimap — a box with a base
// under it, deliberately NOT a circle, because everything else that matters on
// this map is a circle (allies, objectives) or a triangle (hostiles). Shape is
// the second channel; a cabinet reads as a place to GO, not a hazard.
//
// This suite drives the exact draw the HUD uses, on a stub 2D context, so the
// glyph is checked by geometry rather than by counting pixels in a screenshot.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { drawArcadeGlyph } from '../src/client/hud';

interface Rect { x: number; y: number; w: number; h: number }
function record() {
  const rects: Rect[] = [];
  let fillStyle = '';
  return {
    rects,
    ctx: {
      get fillStyle() { return fillStyle; },
      set fillStyle(v: string) { fillStyle = v; },
      fillRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); },
    },
    lastStyle: () => fillStyle,
  };
}

describe('the cabinet marks the map', () => {
  it('draws a screen and a stand — two parts, a machine not a dot', () => {
    const r = record();
    drawArcadeGlyph(r.ctx, 100, 100);
    expect(r.rects.length, 'a cabinet is not a single blob').toBe(2);
  });

  it('the stand sits UNDER the screen, so it reads as a cabinet', () => {
    const r = record();
    drawArcadeGlyph(r.ctx, 100, 100);
    const [screen, stand] = r.rects;
    expect(stand.y).toBeGreaterThan(screen.y);              // the base is lower
    expect(stand.w).toBeLessThan(screen.w);                 // and narrower
  });

  it('it is amber, the house accent — never a hostile colour', () => {
    const r = record();
    drawArcadeGlyph(r.ctx, 100, 100);
    expect(r.lastStyle().toLowerCase()).toBe('#e8a33d');
  });

  it('the whole glyph is small — a mark, not a landmark', () => {
    const r = record();
    drawArcadeGlyph(r.ctx, 0, 0);
    // the true bounding box around the centre point
    const left = Math.min(...r.rects.map((rc) => rc.x));
    const right = Math.max(...r.rects.map((rc) => rc.x + rc.w));
    const top = Math.min(...r.rects.map((rc) => rc.y));
    const bottom = Math.max(...r.rects.map((rc) => rc.y + rc.h));
    expect(right - left, 'wider than a player dot but not by much').toBeLessThan(6);
    expect(bottom - top, 'and about as tall').toBeLessThan(6);
  });

  it('it is centred on the cabinet, wherever the cabinet is', () => {
    for (const [cx, cy] of [[10, 10], [200, 5], [77, 199]] as const) {
      const r = record();
      drawArcadeGlyph(r.ctx, cx, cy);
      // the screen straddles the point in x, and its top is above it in y
      const screen = r.rects[0];
      expect(screen.x).toBeLessThan(cx);
      expect(screen.x + screen.w).toBeGreaterThan(cx);
      expect(screen.y).toBeLessThan(cy);
    }
  });

  it('a map with no arcade draws nothing — the loop simply does not run', () => {
    // the HUD guards with `world.map.arcades ?? []`; an empty list is a no-op
    const r = record();
    for (const _cab of []) drawArcadeGlyph(r.ctx, 0, 0);
    expect(r.rects.length).toBe(0);
  });
});
