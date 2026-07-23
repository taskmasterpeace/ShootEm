// ═══════════════════════════════════════════════════════════════════════════
// THE CULTURE CODES — what a place sounds like.
//
// Robert: *"do vigilante and pedestrian audio. Different cities sound like the
// CULTURE CODE. Use the culture codes."*
//
// The culture code already exists — every city in `src/data/map-cities.json`
// carries one, and `src/sim/city-profile.ts` already reads it for architecture
// (courtyards, balconies, glass). It has never driven a VOICE. This file is the
// legend that lets it: culture code → a region, the languages that colour its
// English, and a street demeanour. The street-VO layer (streetvo.ts) reads it
// so a pedestrian in a code-6 city does not sound like one in a code-13 city.
//
// THE LEGEND IS REVERSE-ENGINEERED FROM THE DATA, not invented: each code is
// defined by the countries that actually carry it in map-cities.json (e.g.
// code 1 = Algeria/Egypt/Morocco/Libya → the Maghreb). It is deliberately
// broad and dignified — a cadence and a place, never a caricature, which is
// the same rule the map-maker spec set for the architecture.
//
// Pure data. streetvo.ts turns it into lines; the TTS generator turns those
// into voices.
// ═══════════════════════════════════════════════════════════════════════════

export interface Culture {
  code: number;
  /** the region, as the world would name it */
  region: string;
  /** the languages that colour the local English — for the TTS persona */
  tongues: string[];
  /** a couple of the countries that anchor this code, for reference */
  anchors: string[];
  /** how the street carries itself — feeds the performance direction */
  demeanour: string;
}

/**
 * The fourteen. Codes are the real values in map-cities.json; the groupings
 * are the countries that share each one.
 */
export const CULTURES: Record<number, Culture> = {
  1: {
    code: 1, region: 'The Maghreb', tongues: ['Arabic', 'French'],
    anchors: ['Algeria', 'Egypt', 'Morocco', 'Libya', 'Tunisia'],
    demeanour: 'measured and formal, quick to invoke God, slow to raise the voice',
  },
  2: {
    code: 2, region: 'West Africa', tongues: ['Nigerian English', 'Yoruba', 'Twi', 'French'],
    anchors: ['Nigeria', 'Ghana', 'Ivory Coast', 'Congo', 'Benin'],
    demeanour: 'bright, rhythmic, and unbothered — trades a joke as fast as an insult',
  },
  3: {
    code: 3, region: 'Southern Africa', tongues: ['South African English', 'Zulu', 'Portuguese'],
    anchors: ['South Africa', 'Angola', 'Mozambique', 'Zimbabwe', 'Zambia'],
    demeanour: 'dry, level, understated — says the alarming thing very calmly',
  },
  4: {
    code: 4, region: 'The Steppe', tongues: ['Kazakh', 'Uzbek', 'Russian'],
    anchors: ['Kazakhstan', 'Uzbekistan', 'Tajikistan', 'Turkmenistan'],
    demeanour: 'flat, hardy, and terse — wastes no words on weather or war',
  },
  5: {
    code: 5, region: 'South Asia', tongues: ['Indian English', 'Hindi', 'Bengali', 'Tamil'],
    anchors: ['India', 'Bangladesh', 'Sri Lanka'],
    demeanour: 'fast, musical, and emphatic — repeats itself louder when ignored',
  },
  6: {
    code: 6, region: 'East Asia', tongues: ['Mandarin', 'Japanese', 'Korean', 'Tagalog'],
    anchors: ['China', 'Japan', 'South Korea', 'Philippines', 'Indonesia'],
    demeanour: 'clipped and orderly, then suddenly urgent when the order breaks',
  },
  8: {
    code: 8, region: 'Central America & the Caribbean', tongues: ['Caribbean Spanish', 'Haitian Creole'],
    anchors: ['Mexico', 'Cuba', 'Honduras', 'Haiti', 'Costa Rica'],
    demeanour: 'warm and loud, hands and voice moving together, family first',
  },
  9: {
    code: 9, region: 'Western Europe', tongues: ['French', 'German', 'Italian', 'Spanish'],
    anchors: ['France', 'Germany', 'Italy', 'Spain', 'Belgium'],
    demeanour: 'cool, precise, faintly exasperated — has seen this before',
  },
  10: {
    code: 10, region: 'Eastern Europe', tongues: ['Russian', 'Ukrainian', 'Greek', 'Croatian'],
    anchors: ['Russia', 'Ukraine', 'Belarus', 'Greece', 'Armenia'],
    demeanour: 'blunt, weary, darkly funny — expects the worst and is rarely wrong',
  },
  11: {
    code: 11, region: 'Oceania', tongues: ['Australian English', 'New Zealand English'],
    anchors: ['Australia', 'New Zealand'],
    demeanour: 'laconic and cheeky — understates the danger and swears at it',
  },
  12: {
    code: 12, region: 'South America', tongues: ['Brazilian Portuguese', 'Rioplatense Spanish'],
    anchors: ['Brazil', 'Argentina', 'Colombia', 'Peru', 'Chile'],
    demeanour: 'expressive and quick-tempered, passionate on the way up and down',
  },
  13: {
    code: 13, region: 'Jamaica', tongues: ['Jamaican Patois', 'English'],
    anchors: ['Jamaica'],
    demeanour: 'lilting, unhurried, and sharp — a threat delivered like a lyric',
  },
  14: {
    code: 14, region: 'The Middle East', tongues: ['Persian', 'Arabic', 'Hebrew', 'Urdu'],
    anchors: ['Iran', 'Iraq', 'Israel', 'Saudi Arabia', 'Pakistan'],
    demeanour: 'formal and proud, ornate even in anger, never careless with words',
  },
};

/** The fallback for a city with no culture code (map-cities `null`). */
export const NEUTRAL_CULTURE: Culture = {
  code: -1, region: 'Nowhere in particular', tongues: ['English'],
  anchors: [], demeanour: 'plain and unplaceable — a voice from no fixed street',
};

export const CULTURE_CODES = Object.keys(CULTURES).map(Number);

/** The culture for a code, always resolving to something speakable. */
export function cultureFor(code: number | null | undefined): Culture {
  if (code == null) return NEUTRAL_CULTURE;
  return CULTURES[code] ?? NEUTRAL_CULTURE;
}

/** A short slug for filenames / sound slots — `maghreb`, `west_africa`. */
export function cultureSlug(code: number | null | undefined): string {
  const c = cultureFor(code);
  if (c === NEUTRAL_CULTURE) return 'neutral';
  return c.region.toLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
