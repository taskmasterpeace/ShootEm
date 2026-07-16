// ---------------------------------------------------------------------------
// The Living Campaign v1 (§8.5): banded control (22B), mode/importance
// weighting, scars on deep holds, and the honest deterministic time-skip (27B).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  BAND_EDGE, FRONTS, SEASON_FRONTS_TO_WIN, applyResult, bandOf, checkSeasonEnd,
  freshCampaign, simulateTimeSkip,
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

  it('the time-skip is deterministic, capped, and labeled simulated (27B)', () => {
    const HOUR = 3600_000;
    const t0 = 1_700_000_000_000;
    const away = t0 + 26 * HOUR;
    const a = freshCampaign(t0);
    const b = freshCampaign(t0);
    const linesA = simulateTimeSkip(a, away);
    const linesB = simulateTimeSkip(b, away);
    // same absence → identical simulated history on both "machines"
    expect(a.fronts).toEqual(b.fronts);
    expect(linesA).toEqual(linesB);
    for (const d of a.dispatch) expect(d.simulated).toBe(true);
    // capped: a month away drifts no front more than 4 blocks × 4 × importance
    const c = freshCampaign(t0);
    simulateTimeSkip(c, t0 + 30 * 24 * HOUR);
    for (const f of FRONTS) {
      expect(Math.abs(c.fronts[f.id].control)).toBeLessThanOrEqual(4 * 4 * f.importance + 0.001);
    }
    // under an hour away: nothing happens
    const d = freshCampaign(t0);
    expect(simulateTimeSkip(d, t0 + HOUR / 2)).toEqual([]);
  });
});
