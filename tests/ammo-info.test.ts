// ---------------------------------------------------------------------------
// OUTBREAK-SPEC §11.2 — the weapon-HUD ammo readout. AMMO_INFO is the single
// source of truth for the loaded round's role + PEN/NOISE/FIRE/CORPSE ratings
// (the HUD renders it; the B-cycle toast reuses its label). These pin the table
// to the spec's intent so a future edit can't silently mislabel a round.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { AMMO_INFO } from '../src/sim/data';

// the full §11.1 roster, in B-cycle order (ball is the undefined default)
const ROSTER = ['ball', 'ap', 'inc', 'trc', 'sub', 'exp', 'bnr'];

describe('AMMO_INFO — the §11.2 tactical readout table', () => {
  it('covers exactly the 7-type roster, each fully specified', () => {
    expect(Object.keys(AMMO_INFO).sort()).toEqual([...ROSTER].sort());
    for (const key of ROSTER) {
      const ai = AMMO_INFO[key];
      expect(ai.label, `${key} label`).toBeTruthy();
      expect(ai.role, `${key} role`).toBeTruthy();
      for (const r of ['pen', 'noise', 'fire', 'corpse'] as const) {
        expect(ai[r], `${key}.${r} in 0..3`).toBeGreaterThanOrEqual(0);
        expect(ai[r], `${key}.${r} in 0..3`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('encodes the spec intent: AP pierces, SUB is quiet, INC/BNR deny corpses', () => {
    // Armor-Piercing has the top penetration of the roster
    const maxPen = Math.max(...ROSTER.map((k) => AMMO_INFO[k].pen));
    expect(AMMO_INFO.ap.pen).toBe(maxPen);
    // Subsonic is the quietest round
    const minNoise = Math.min(...ROSTER.map((k) => AMMO_INFO[k].noise));
    expect(AMMO_INFO.sub.noise).toBe(minNoise);
    // corpse denial belongs to fire (INC) and chemistry (BNR) only
    expect(AMMO_INFO.inc.corpse).toBeGreaterThan(0);
    expect(AMMO_INFO.bnr.corpse).toBeGreaterThan(0);
    for (const k of ['ball', 'ap', 'trc', 'sub', 'exp']) expect(AMMO_INFO[k].corpse).toBe(0);
    // only Incendiary carries a fire hazard; BNR denies WITHOUT fire (§6.2)
    expect(AMMO_INFO.inc.fire).toBeGreaterThan(0);
    expect(AMMO_INFO.bnr.fire).toBe(0);
    // Tracer is loud (it gives the shooter away / attracts infected)
    expect(AMMO_INFO.trc.noise).toBeGreaterThanOrEqual(AMMO_INFO.ball.noise);
  });
});
