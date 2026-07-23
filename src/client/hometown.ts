// ---------------------------------------------------------------------------
// YOUR HOMETOWN — the city you are from, and what it put in your hands.
//
// Robert: *"I don't know what stats are important to your home city or
// whatever, but we need to figure that out, because I want onboarding to have
// more weight to it."*
//
// The answer this file implements:
//
//     THE COUNTRY DECIDES WHAT YOUR ARMY IS.
//     THE CITY DECIDES WHAT YOU ARE.
//
// The country already sets your faction and colours the war (its doctrine
// stats drive what it fields). The city was pure flavour — a string on a
// dossier that nothing downstream ever read, which is exactly why picking one
// felt weightless.
//
// Now every city resolves to an ARCHETYPE, and the archetype hands you two of
// the twenty-two secondary skills to start with. Grow up in a port and you
// know boats; grow up in a mining town and you know charges. It is a head
// start, never a wall: the bands are small and everything is still levelled
// through use (src/sim/skills.ts).
//
// DERIVED, never hand-authored. There are ~800 cities in the register and
// nobody is writing 800 entries: the archetype falls out of the nation's own
// doctrine stats, the city's place in its country's list, and a stable hash of
// the name. Same city, same origin, every time.
// ---------------------------------------------------------------------------
import { hash01 } from '../sim/rng';
import type { SkillId } from '../sim/types';
import type { Nation } from '../data/nations';

export type ArchetypeId =
  | 'port' | 'industrial' | 'capital' | 'garrison' | 'frontier'
  | 'university' | 'mining' | 'farm' | 'transport';

export interface Archetype {
  id: ArchetypeId;
  name: string;
  /** what you grew up around — the line the intake screen prints */
  raisedOn: string;
  /** the two skills the place put in your hands */
  skills: [SkillId, SkillId];
}

/** The head start, in raw practice. Band 1 ("Familiar") is 25 — see skills.ts. */
export const HEAD_START = 30;

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  port: {
    id: 'port', name: 'PORT TOWN',
    raisedOn: 'Water, cranes and salt. You were on boats before you could drive.',
    skills: ['boat', 'navigator'],
  },
  industrial: {
    id: 'industrial', name: 'INDUSTRIAL CITY',
    raisedOn: 'Shift horns and machine shops. You have had your hands in an engine since school.',
    skills: ['mechanic', 'engineer'],
  },
  capital: {
    id: 'capital', name: 'THE CAPITAL',
    raisedOn: 'Offices, parades and paperwork. You learned early how orders travel.',
    skills: ['commander', 'radio_operator'],
  },
  garrison: {
    id: 'garrison', name: 'GARRISON TOWN',
    raisedOn: 'A base at the edge of town. You grew up with the range in earshot.',
    skills: ['rifle', 'scout'],
  },
  frontier: {
    id: 'frontier', name: 'FRONTIER',
    raisedOn: 'Distance and weather. Nobody was coming to help, so you learned the ground.',
    skills: ['scout', 'navigator'],
  },
  university: {
    id: 'university', name: 'UNIVERSITY CITY',
    raisedOn: 'Labs and lecture halls. You know what the machines are actually doing.',
    skills: ['engineer', 'medic'],
  },
  mining: {
    id: 'mining', name: 'MINING TOWN',
    raisedOn: 'Charges, dust and the dark. You were taught what a shaped charge does.',
    skills: ['explosives', 'mechanic'],
  },
  farm: {
    id: 'farm', name: 'FARM COUNTRY',
    raisedOn: 'Rifles, engines and patience. You could shoot before you could vote.',
    skills: ['rifle', 'mechanic'],
  },
  transport: {
    id: 'transport', name: 'TRANSPORT HUB',
    raisedOn: 'Depots, yards and long hauls. Something heavy was always moving.',
    skills: ['tank_driver', 'mechanic'],
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

/**
 * Which kind of place is this?
 *
 * The weights are the nation reading its own character onto its cities: a
 * science-heavy country has university and industrial towns, a military-heavy
 * one has garrisons, a small-population one has frontier and farm country. The
 * name's hash breaks the tie, so two cities in the same nation are rarely the
 * same kind of place.
 */
export function archetypeFor(nation: Nation, cityIndex: number): Archetype {
  // THE FIRST CITY LISTED IS THE SEAT. The register puts the capital first for
  // most nations, and a country's own capital should read as one.
  if (cityIndex === 0 && nation.cities.length > 1) return ARCHETYPES.capital;

  const sci = nation.science / 100;
  const mil = nation.military / 100;
  const intel = nation.intel / 100;
  // a small country is mostly not cities
  const small = nation.population < 12_000_000 ? 1 : nation.population < 60_000_000 ? 0.55 : 0.25;

  const weights: Array<[ArchetypeId, number]> = [
    ['port', 0.7 + intel * 0.5],
    ['industrial', 0.5 + sci * 1.3],
    ['university', 0.25 + sci * 1.6],
    ['garrison', 0.4 + mil * 1.5],
    ['frontier', 0.3 + small * 1.2],
    ['farm', 0.4 + small * 1.1],
    ['mining', 0.35 + (1 - sci) * 0.9],
    ['transport', 0.5 + mil * 0.4 + sci * 0.4],
    ['capital', 0.15], // a second city can still be a seat of something
  ];

  const total = weights.reduce((n, [, w]) => n + w, 0);
  // a STABLE roll: the nation's code, the city's index, and its name. Same
  // city, same origin, forever — no rng, nothing to re-seed.
  const city = nation.cities[cityIndex] ?? '';
  let h = nation.code * 7.31 + cityIndex * 19.7;
  for (let i = 0; i < city.length; i++) h += city.charCodeAt(i) * (i + 1) * 0.37;
  let roll = hash01(h) * total;
  for (const [id, w] of weights) {
    roll -= w;
    if (roll <= 0) return ARCHETYPES[id];
  }
  return ARCHETYPES.transport;
}

/** The head-start skills a hometown grants, ready to hand to the sim. */
export function startingSkills(a: Archetype): Partial<Record<SkillId, number>> {
  return { [a.skills[0]]: HEAD_START, [a.skills[1]]: HEAD_START };
}

// ── THE COUNTRY, READ OUT LOUD ─────────────────────────────────────────────

/** A 0-100 doctrine stat as a word, so the bar has a meaning beside it. */
export function band(n: number): string {
  if (n >= 75) return 'FORMIDABLE';
  if (n >= 60) return 'STRONG';
  if (n >= 45) return 'CAPABLE';
  if (n >= 30) return 'MODEST';
  return 'THIN';
}

/** What this nation's doctrine actually means for the war you are joining. */
export function doctrineLine(n: Nation): string {
  const top = Math.max(n.military, n.intel, n.science);
  if (top === n.science && n.science >= 55) return 'Fields the better kit. Your side arrives well equipped.';
  if (top === n.military && n.military >= 55) return 'Fields armour and men. Your side arrives heavy.';
  if (top === n.intel && n.intel >= 50) return 'Fights on information. Your side sees first.';
  if (top < 40) return 'A small army. You will be outgunned and expected to manage.';
  return 'A balanced army — no advantage handed to you, and none owed.';
}

/** The LSW line: how often gods walk where you are from. */
export function lswLine(n: Nation): string {
  if (n.lswActivity >= 65) return 'Gods walk here often. You grew up watching the sky.';
  if (n.lswActivity >= 45) return 'The stables are active. Everyone has seen one.';
  if (n.lswActivity >= 25) return 'Rare sightings. Mostly a story on the news.';
  return 'Almost never. Most people here think they are exaggerated.';
}

/**
 * The cloning law, which in a game about PRINTS is the most personal fact a
 * country carries: it says what your own existence is worth at home.
 */
export function cloningLine(n: Nation): string {
  switch (n.cloning) {
    case 'Banned': return 'Cloning is BANNED at home. Your print is illegal where you were born.';
    case 'Regulated': return 'Cloning is regulated. Your print is licensed, logged and inspected.';
    default: return 'Cloning is legal. Prints are ordinary where you are from.';
  }
}
