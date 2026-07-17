// ---------------------------------------------------------------------------
// §14 — the profile the yard writes. The recommendation rules are deliberately
// legible: a player should be able to guess WHY the yard called them what it
// did. These tests are those sentences, verified.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { PAINT_COLORS, SIGNATURE_GEAR, paintColorFor, recommendClass, type OnboardingState, type SkirmishStats } from '../src/client/onboarding';
import { CLASSES, EQUIPMENT } from '../src/sim/data';
import type { ClassId } from '../src/sim/types';

const round = (over: Partial<SkirmishStats>): SkirmishStats => ({
  role: 'hunter', kills: 0, longestKill: 0, tags: 0, survived: true, won: false, ...over,
});

describe('the yard reads your file', () => {
  it('long splats make a marksman — Infiltrator', () => {
    expect(recommendClass([round({ kills: 2, longestKill: 31 }), round({ role: 'prey' })])).toBe('infiltrator');
  });

  it('running the tag circuit makes a runner — Pathfinder', () => {
    expect(recommendClass([round({}), round({ role: 'prey', tags: 3, survived: true, won: true })])).toBe('pathfinder');
  });

  it('a pile of close splats makes a brawler — Jump Trooper', () => {
    expect(recommendClass([round({ kills: 4, longestKill: 9 }), round({ role: 'prey', survived: false })])).toBe('jump');
  });

  it('a pile of splats at range makes an anchor — Heavy', () => {
    expect(recommendClass([round({ kills: 4, longestKill: 20 }), round({ role: 'prey', survived: false })])).toBe('heavy');
  });

  it('surviving as prey without fighting makes a phantom — Ghost', () => {
    expect(recommendClass([round({ kills: 1 }), round({ role: 'prey', survived: true })])).toBe('ghost');
  });

  it('steady middle work reads as Infantry', () => {
    expect(recommendClass([round({ kills: 2, longestKill: 18 }), round({ role: 'prey', survived: false })])).toBe('infantry');
  });

  it('caught early with low aggression reads as Medic — someone should have had your back', () => {
    expect(recommendClass([round({ kills: 0 }), round({ role: 'prey', survived: false })])).toBe('medic');
  });

  it('every class has a real signature item, and every item exists', () => {
    for (const cls of Object.keys(CLASSES) as ClassId[]) {
      const gear = SIGNATURE_GEAR[cls];
      expect(gear, `class ${cls} has no signature gear`).toBeTruthy();
      expect(EQUIPMENT[gear], `gear ${gear} does not exist`).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// The paint rack (§14): picking a shade is identity, so it has to hold up on a
// crowded field — nobody else may wear it, and a given player keeps theirs.
// ---------------------------------------------------------------------------
describe('the paint rack', () => {
  /** a recruit who has picked a shade and nothing else */
  const picked = (paint: string): OnboardingState => ({
    stage: 'skirmish', marker: 'marker_blitz', fieldId: 'kopje', rounds: [], warMatches: 0, paint,
  });

  it('no purple on the rack — house law', () => {
    for (const c of PAINT_COLORS) {
      const r = (c.hex >> 16) & 0xff, g = (c.hex >> 8) & 0xff, b = c.hex & 0xff;
      // purple/violet/magenta: blue high, green starved, red keeping blue company
      expect(b > 120 && g < b - 40 && r > b - 60, `${c.name} reads purple`).toBe(false);
    }
  });

  it('you get the shade you picked', () => {
    for (const c of PAINT_COLORS) {
      expect(paintColorFor(1, 1, picked(c.name))).toBe(c.hex);
    }
  });

  it('nobody else is ever dealt YOUR shade — whichever one you claim', () => {
    for (const mine of PAINT_COLORS) {
      const st = picked(mine.name);
      for (let id = 0; id < 60; id++) {
        if (id === 1) continue; // that's me
        expect(paintColorFor(id, 1, st), `soldier ${id} stole ${mine.name}`).not.toBe(mine.hex);
      }
    }
  });

  it('a rival keeps the same shade all match — paint is how you know them', () => {
    const st = picked('Cyan Burst');
    for (const id of [2, 3, 4, 17]) {
      expect(paintColorFor(id, 1, st)).toBe(paintColorFor(id, 1, st));
    }
  });
});
