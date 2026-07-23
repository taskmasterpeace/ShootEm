// ---------------------------------------------------------------------------
// The one line between WHERE YOU ARE FROM and WHAT YOU CAN DO.
//
// Kept in its own file so `hometown.ts` stays a pure derivation over the
// nations register (no storage, no identity) and the sim's entry point stays
// one import deep.
// ---------------------------------------------------------------------------
import type { SkillId } from '../sim/types';
import { archetypeFor, startingSkills } from './hometown';
import { loadIdentity, nationOf } from './identity';
import countryCulture from '../data/country-culture.json';

/** The two skills your hometown put in your hands, ready for WorldOptions. */
export function hometownSkills(): Partial<Record<SkillId, number>> | undefined {
  const id = loadIdentity();
  if (!id) return undefined;
  const nation = nationOf(id);
  if (!nation) return undefined;
  return startingSkills(archetypeFor(nation, id.cityIndex ?? 0));
}


// THE CULTURE CODE of the player's enlisted nation — so a Nigerian recruit's
// deploys carry West African street VO and a Jamaican's carry Kingston's.
// The lookup (country code → culture code) is generated from map-cities.json.

export function playerCultureCode(): number | undefined {
  const id = loadIdentity();
  if (!id) return undefined;
  const map = countryCulture as Record<string, number>;
  return map[String(id.nationCode)];
}