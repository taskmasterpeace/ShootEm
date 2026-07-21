// ---------------------------------------------------------------------------
// W3.9 — RANK INSIGNIA in the HUD's mono vocabulary (no emoji): enlisted wear
// chevrons, senior NCOs a diamond over chevrons, officers wear bars, and a
// Private wears the dot. All fourteen ranks read distinct at a glance.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { RANKS, rankFor, rankInsignia } from '../src/client/record';

describe('W3.9 — the insignia ladder', () => {
  it('all fourteen ranks wear distinct marks', () => {
    const marks = RANKS.map((_, i) => rankInsignia(i));
    expect(new Set(marks).size).toBe(RANKS.length);
  });

  it('the grammar: dot → chevrons → diamond → bars', () => {
    expect(rankInsignia(0), 'a Private wears the dot').toBe('·');
    expect(rankInsignia(3), 'a Sergeant wears three chevrons').toBe('▴▴▴');
    expect(rankInsignia(7), 'a First Sergeant wears the diamond').toContain('◆');
    expect(rankInsignia(9), 'a Lieutenant wears one bar').toBe('▮');
    expect(rankInsignia(13), 'a Colonel wears five bars').toBe('▮▮▮▮▮');
  });

  it('rankFor and the insignia agree across the whole ladder', () => {
    for (const [i, r] of RANKS.entries()) {
      const at = rankFor(r.at);
      expect(at.index).toBe(i);
      expect(rankInsignia(at.index).length).toBeGreaterThan(0);
    }
  });
});
