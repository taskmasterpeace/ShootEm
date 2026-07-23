// ---------------------------------------------------------------------------
// THE LICENCES (docs/THREE-GAMES-ONE-WAR.md — "Don't lock them behind XP.
// Make them certifications… You don't fly the bomber because you're level 20,
// you passed flight school"). The register's laws: every hull in the fleet
// names a licence, the ladder is a chain not a level, and holding the top
// paper without its prerequisites clears nothing.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import { LICENCES, hullsUnder, licenceChain, licenceFor, licenceHeld } from '../src/sim/licenses';
import type { LicenceId } from '../src/sim/licenses';
import type { VehicleKind } from '../src/sim/types';

const ALL = Object.keys(VEHICLES) as VehicleKind[];

describe('the licence register', () => {
  it('every hull in the fleet names a licence that exists', () => {
    for (const kind of ALL) {
      const id = licenceFor(kind);
      expect(LICENCES[id], `${kind} → ${id}`).toBeTruthy();
      expect(LICENCES[id].name.length).toBeGreaterThan(2);
    }
  });

  it('the canon twelve are all on the books, each with a school', () => {
    const canon: LicenceId[] = ['basic_driver', 'heavy_truck', 'apc', 'tank', 'hovercraft',
      'boat', 'helicopter', 'fixed_wing', 'bomber', 'transport', 'drone_pilot', 'dropship'];
    for (const id of canon) {
      expect(LICENCES[id], id).toBeTruthy();
      expect(LICENCES[id].school, `${id} has no school`).not.toBe('—');
    }
  });

  it('the shape of a hull picks its paper: wings fly, hulls float, tracks are armour', () => {
    expect(licenceFor('tank')).toBe('tank');
    expect(licenceFor('apc')).toBe('apc');
    expect(licenceFor('strikejet')).toBe('fixed_wing');
    expect(licenceFor('attackheli')).toBe('helicopter');
    expect(licenceFor('boat')).toBe('boat');
    expect(licenceFor('sedan')).toBe('basic_driver');
    expect(licenceFor('schoolbus')).toBe('heavy_truck');
    expect(licenceFor('bomber')).toBe('bomber');
  });

  it('a soldier straps into a board or a bike without paperwork', () => {
    for (const kind of ['hoverboard', 'bicycle', 'scooter'] as VehicleKind[]) {
      expect(licenceFor(kind)).toBe('none');
      expect(licenceHeld([], kind), `${kind} needs no licence`).toBe(true);
    }
  });

  it('the ladder is a CHAIN — the bomber seat needs flight school first', () => {
    expect(licenceChain('bomber')).toEqual(['fixed_wing', 'bomber']);
    expect(licenceChain('tank')).toEqual(['basic_driver', 'heavy_truck', 'apc', 'tank']);
    // holding the top paper alone clears nothing — you passed the school, or you didn't
    expect(licenceHeld(['bomber'], 'bomber')).toBe(false);
    expect(licenceHeld(['fixed_wing', 'bomber'], 'bomber')).toBe(true);
  });

  it('a licence clears every hull on its syllabus and none off it', () => {
    const held: LicenceId[] = ['basic_driver'];
    expect(licenceHeld(held, 'sedan')).toBe(true);
    expect(licenceHeld(held, 'tank')).toBe(false);
    expect(licenceHeld(held, 'strikejet')).toBe(false);
    for (const kind of hullsUnder('boat')) {
      expect(licenceHeld(['boat'], kind), `${kind} rides the boat licence`).toBe(true);
    }
  });

  it('the civilian roster is fully covered — no hull left unlicensed', () => {
    const civ = ALL.filter((k) => VEHICLES[k].civilian);
    expect(civ.length).toBeGreaterThanOrEqual(48);
    for (const kind of civ) expect(licenceFor(kind)).toBeTruthy();
  });
});
