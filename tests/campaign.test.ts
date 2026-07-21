// ---------------------------------------------------------------------------
// The Living Campaign v1 (§8.5): banded control (22B), mode/importance
// weighting, scars on deep holds — and W3.1's law: the war only moves while
// you play (the 27B simulated time-skip is dead; absence changes nothing).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  BAND_EDGE, CLONE_RECOVER, FRONTS, SEASON_FRONTS_TO_WIN, applyResult, bandOf, checkSeasonEnd,
  cloneSeedFor, freshCampaign, holdTheLine,
} from '../src/client/campaign';

describe('the Living Campaign', () => {
  it('ten fronts, every recipe on a real theme + mode', () => {
    expect(FRONTS.length).toBe(10);
    for (const f of FRONTS) {
      expect(f.importance).toBeGreaterThan(0);
      expect(f.scar).toBeTruthy();
    }
  });

  it('wins push control, losses pull it, weights matter, clamps hold (22B)', () => {
    const c = freshCampaign(1000);
    applyResult(c, 'airbase', true, 1000);      // importance 1.3 × conquest 1.25
    applyResult(c, 'the_mine', true, 1000);     // importance 0.9 × tdm 0.8
    expect(c.fronts.airbase.control).toBeGreaterThan(c.fronts.the_mine.control);
    applyResult(c, 'the_mine', false, 1000);
    expect(c.fronts.the_mine.control).toBe(0);
    // clamp: hammer one front far past the rail
    for (let i = 0; i < 40; i++) applyResult(c, 'airbase', true, 1000);
    expect(c.fronts.airbase.control).toBe(100);
  });

  it('bands change at the edge and write dispatches; deep holds scar the front (22B/§8.5)', () => {
    const c = freshCampaign(1000);
    expect(bandOf(0)).toBe('contested');
    expect(bandOf(BAND_EDGE)).toBe('coalition');
    expect(bandOf(-BAND_EDGE)).toBe('collective');
    let flipped = false, scarred = false;
    for (let i = 0; i < 20; i++) {
      const lines = applyResult(c, 'refinery', true, 1000);
      if (lines.some((l) => l.includes('United Front ground'))) flipped = true;
      if (lines.some((l) => l.includes('scar'))) scarred = true;
    }
    expect(flipped).toBe(true);
    expect(scarred).toBe(true);
    expect(c.fronts.refinery.scarActive).toBe(true);
    expect(c.dispatch.length).toBeGreaterThan(0);
    // losing it back to contested clears the scar (stop there — pushing
    // further would hand the Collective a DEEP hold and re-scar it, correctly)
    let cleared = false;
    for (let i = 0; i < 20 && !cleared; i++) {
      const lines = applyResult(c, 'refinery', false, 1000);
      if (lines.some((l) => l.includes('scar fades'))) cleared = true;
    }
    expect(cleared).toBe(true);
    expect(c.fronts.refinery.scarActive).toBe(false);
  });

  it('the Armistice: six held fronts end the season, the theatre resets (§13)', () => {
    const c = freshCampaign(1000);
    // push five fronts deep coalition — not enough
    const five = FRONTS.slice(0, 5);
    for (const f of five) for (let i = 0; i < 8; i++) applyResult(c, f.id, true, 1000);
    expect(checkSeasonEnd(c, 1000)).toBeNull();
    expect(c.season).toBe(1);
    // the sixth front closes the war
    for (let i = 0; i < 8; i++) applyResult(c, FRONTS[5].id, true, 1000);
    const a = checkSeasonEnd(c, 1000)!;
    expect(a).not.toBeNull();
    expect(a.winner).toBe('coalition');
    expect(a.frontsHeld).toBeGreaterThanOrEqual(SEASON_FRONTS_TO_WIN);
    expect(a.season).toBe(1);
    // the dossier persists, the WAR resets
    expect(c.season).toBe(2);
    for (const f of FRONTS) {
      expect(c.fronts[f.id].control).toBe(0);
      expect(c.fronts[f.id].scarActive).toBe(false);
    }
    expect(c.dispatch[0].text).toContain('ARMISTICE');
    expect(c.dispatch[0].simulated).toBe(false);
  });

  it('W3.3: clones are the currency — deaths spend, wins convoy, ZERO loses the front', () => {
    const f = FRONTS[0];
    const seed = cloneSeedFor(f);
    const c = freshCampaign(1_700_000_000_000);
    expect(c.fronts[f.id].clones).toBe(seed);
    // a bloody WIN: deaths spend the vat, the convoy pays some back
    applyResult(c, f.id, true, 1_700_000_100_000, 100);
    expect(c.fronts[f.id].clones).toBe(seed - 100 + CLONE_RECOVER);
    // grind it near the floor, then one more bloody day EMPTIES the vats
    c.fronts[f.id].clones = 30;
    const lines = applyResult(c, f.id, true, 1_700_000_200_000, 30);
    expect(c.fronts[f.id].clones, 'the vats stand empty').toBe(0);
    expect(c.fronts[f.id].control, 'no bodies to hold it — the front is LOST').toBe(-100);
    expect(lines.some((l) => l.includes('run DRY')), 'the dispatch says so').toBe(true);
  });

  it('W3.3: the CRITICAL warning fires once as the reserve crosses a quarter', () => {
    const f = FRONTS[0];
    const seed = cloneSeedFor(f);
    const c = freshCampaign(1_700_000_000_000);
    c.fronts[f.id].clones = seed * 0.3;
    const lines = applyResult(c, f.id, false, 1_700_000_100_000, Math.ceil(seed * 0.07));
    expect(lines.some((l) => l.includes('CRITICAL')), 'the quartermaster warns').toBe(true);
  });

  it('W3.4: every battle digs the front one PASS deeper, capping at three', () => {
    const f = FRONTS[0];
    const c = freshCampaign(1_700_000_000_000);
    expect(c.fronts[f.id].pass, 'the war starts asleep').toBe(1);
    const l1 = applyResult(c, f.id, true, 1_700_000_100_000, 0);
    expect(c.fronts[f.id].pass).toBe(2);
    expect(l1.some((l) => l.includes('PASS 2')), 'their stable is awake').toBe(true);
    const l2 = applyResult(c, f.id, false, 1_700_000_200_000, 0);
    expect(c.fronts[f.id].pass).toBe(3);
    expect(l2.some((l) => l.includes('PASS 3')), 'both stables are loose').toBe(true);
    applyResult(c, f.id, true, 1_700_000_300_000, 0);
    expect(c.fronts[f.id].pass, 'three is the ceiling').toBe(3);
  });

  it('W3.1: the war only moves while you play — an absence changes NOTHING', () => {
    const HOUR = 3600_000;
    const t0 = 1_700_000_000_000;
    const a = freshCampaign(t0);
    const before = JSON.parse(JSON.stringify(a.fronts));
    // a month away: every front holds exactly where you left it
    const lines = holdTheLine(a, t0 + 30 * 24 * HOUR);
    expect(a.fronts).toEqual(before);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('HELD');
    expect(a.dispatch[0].simulated, 'the held line is TRUE, not simulated').toBe(false);
    // under an hour away: not even the line — you barely left
    const b = freshCampaign(t0);
    expect(holdTheLine(b, t0 + HOUR / 2)).toEqual([]);
    expect(b.fronts).toEqual(before);
  });
});
