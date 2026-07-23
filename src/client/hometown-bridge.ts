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

/** The two skills your hometown put in your hands, ready for WorldOptions. */
export function hometownSkills(): Partial<Record<SkillId, number>> | undefined {
  const id = loadIdentity();
  if (!id) return undefined;
  const nation = nationOf(id);
  if (!nation) return undefined;
  return startingSkills(archetypeFor(nation, id.cityIndex ?? 0));
}
