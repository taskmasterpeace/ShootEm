// ---------------------------------------------------------------------------
// §14 — the profile the yard writes. The recommendation rules are deliberately
// legible: a player should be able to guess WHY the yard called them what it
// did. These tests are those sentences, verified.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { SIGNATURE_GEAR, recommendClass, type SkirmishStats } from '../src/client/onboarding';
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
