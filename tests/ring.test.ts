// ---------------------------------------------------------------------------
// THE RING'S LAWS — the tiers divide exactly as specified, the chunks never
// lie, and nobody ever sees a different glyph, just a finer one.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { chunkCount, ringTier, RING_COLORS } from '../src/client/ring';

const viewer = (o: Partial<Parameters<typeof ringTier>[0]> = {}): Parameters<typeof ringTier>[0] => ({
  viewerRecon: false, viewerMedic: false, viewerOptics: false, viewerCommissioned: false, squadmate: false, ...o,
});

describe('the tier arithmetic', () => {
  it('a grunt reads T0 chunks — default, no kit', () => {
    expect(ringTier(viewer())).toBe(0);
    expect(ringTier(viewer({ squadmate: false }))).toBe(0);
  });

  it('recon reads the grade (T1) — ghost, infiltrator, pathfinder', () => {
    expect(ringTier(viewer({ viewerRecon: true }))).toBe(1);
  });

  it('squadmates always read each other at least at grade', () => {
    expect(ringTier(viewer({ squadmate: true }))).toBe(1);
    expect(ringTier(viewer({ squadmate: true, viewerRecon: false }))).toBe(1);
  });

  it('a medic on teammates reads the exact number (T2) — the diagnostic eye', () => {
    expect(ringTier(viewer({ squadmate: true, viewerMedic: true }))).toBe(2);
  });

  it('optics and commission each buy +1, capped at T2', () => {
    expect(ringTier(viewer({ viewerOptics: true }))).toBe(1);
    expect(ringTier(viewer({ viewerOptics: true, viewerCommissioned: true }))).toBe(2);
    expect(ringTier(viewer({ viewerRecon: true, viewerOptics: true, viewerCommissioned: true }))).toBe(2); // capped, not 4
  });

  it('an infiltrator with optics reads exact numbers on enemies', () => {
    expect(ringTier(viewer({ viewerRecon: true, viewerOptics: true, squadmate: false }))).toBe(2);
  });

  it('a rifleman reads chunks even on squadmates — no, wait, squadmates read the grade', () => {
    expect(ringTier(viewer({ squadmate: true }))).toBe(1);
  });
});

describe('the chunks never lie (floor boundaries)', () => {
  it('a sliver of the top third still shows 3 chunks', () => {
    expect(chunkCount(2 / 3 + 0.001)).toBe(3);
    expect(chunkCount(1)).toBe(3);
  });
  it('the middle third shows 2, the bottom shows 1', () => {
    expect(chunkCount(0.5)).toBe(2);
    expect(chunkCount(1 / 3 + 0.001)).toBe(2);
    expect(chunkCount(0.2)).toBe(1);
    expect(chunkCount(0.01)).toBe(1); // dying but not dead
  });
  it('zero is gone — no phantom chunk', () => {
    expect(chunkCount(0)).toBe(0);
    expect(chunkCount(-0.5)).toBe(0);
  });
});

describe('the palette law', () => {
  it('no purple anywhere near the ring', () => {
    const palette = [RING_COLORS.hostile, RING_COLORS.plate, RING_COLORS.energy, RING_COLORS.number,
      RING_COLORS.hp(0.2), RING_COLORS.hp(0.5), RING_COLORS.hp(1)];
    for (const c of palette) expect(c.toLowerCase()).not.toContain('purple');
  });
});
