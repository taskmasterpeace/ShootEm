import { describe, expect, it } from 'vitest';
import { NATIONS, NATIONS_BY_CODE } from '../src/data/nations';
import { factionDoctrine, factionLabel, factionTeam } from '../src/client/identity';

// The enlistment identity layer: the Country Master Sheet → typed nations with
// an emoji flag and a DERIVED faction. These lock the data's shape and the
// balance of the split so a regenerate can't silently break onboarding.
describe('nations — the enlistment roster', () => {
  it('carries the full canonical roster', () => {
    expect(NATIONS.length).toBe(168);
  });

  it('every nation is complete: name, ISO2, flag, demonym, faction', () => {
    for (const n of NATIONS) {
      expect(n.name, `${n.code} name`).toBeTruthy();
      expect(n.iso2, `${n.name} iso2`).toMatch(/^[A-Z]{2}$/);
      expect(n.nationality, `${n.name} nationality`).toBeTruthy();
      expect(n.faction === 'collective' || n.faction === 'united_front', `${n.name} faction`).toBe(true);
    }
  });

  it('every flag is a regional-indicator pair matching its ISO2', () => {
    for (const n of NATIONS) {
      const expected = [...n.iso2].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
      expect(n.flag, `${n.name} flag`).toBe(expected);
    }
  });

  it('splits the roster near-evenly so both factions field a full stable', () => {
    const collective = NATIONS.filter((n) => n.faction === 'collective').length;
    const front = NATIONS.length - collective;
    // median split — neither side should ever collapse below a third
    expect(Math.min(collective, front)).toBeGreaterThanOrEqual(NATIONS.length / 3);
  });

  it('indexes by code and codes are unique', () => {
    const codes = new Set(NATIONS.map((n) => n.code));
    expect(codes.size).toBe(NATIONS.length);
    for (const n of NATIONS) expect(NATIONS_BY_CODE[n.code]).toBe(n);
  });

  it('maps faction → the sim team of the same name (data.ts TEAM_NAMES order)', () => {
    expect(factionTeam('united_front')).toBe(0);
    expect(factionTeam('collective')).toBe(1);
  });

  it('labels and doctrine read in the faction voice', () => {
    expect(factionLabel('collective')).toBe('The Collective');
    expect(factionLabel('united_front')).toBe('The United Front');
    expect(factionDoctrine('collective')).toMatch(/machine|unmanned/i);
    expect(factionDoctrine('united_front')).toMatch(/combined arms|K9/i);
  });
});
