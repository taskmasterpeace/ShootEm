import countryRows from '../data/map-countries.json';
import cityRows from '../data/map-cities.json';
import { Rng } from './rng';

export type CityMapTag =
  | 'Company'
  | 'Educational'
  | 'Industrial'
  | 'Military'
  | 'Mining'
  | 'Political'
  | 'Resort'
  | 'Seaport'
  | 'Temple';

export interface CountryMapProfile {
  code: string;
  name: string;
  government: string;
  governmentPerception: string;
  corruption: number;
  military: number;
  militaryBudget: number;
  lawEnforcement: number;
  lawEnforcementBudget: number;
  science: number;
  digital: number;
  cloning: string;
  lswActivity: number;
  lswRegulations: string;
  lifestyle: number;
  leaderTitle: string;
}

export interface CityMapProfile {
  id: string;
  sector: string;
  countryCode: string;
  cultureCode: number | null;
  name: string;
  country: string;
  population: number;
  populationRating: number;
  populationType: string;
  tags: CityMapTag[];
  crime: number;
  safety: number;
}

export type FacadeLanguage =
  | 'courtyard'
  | 'veranda'
  | 'arcade'
  | 'row-street'
  | 'terrace'
  | 'tower-block'
  | 'compound';

export interface DistrictWeights {
  residential: number;
  commercial: number;
  industrial: number;
  civic: number;
  military: number;
}

export interface CityArchitectureProfile {
  cityId: string;
  facade: FacadeLanguage;
  courtyardWeight: number;
  balconyWeight: number;
  glassWeight: number;
  security: number;
  guardDiscipline: number;
  dogWeight: number;
  districtWeights: DistrictWeights;
}

export const COUNTRY_MAP_PROFILES = countryRows as CountryMapProfile[];
export const CITY_MAP_PROFILES = cityRows as CityMapProfile[];

const countryByCode = new Map(COUNTRY_MAP_PROFILES.map((country) => [country.code, country]));
const cityById = new Map(CITY_MAP_PROFILES.map((city) => [city.id, city]));
const citiesByCountry = new Map<string, CityMapProfile[]>();
for (const city of CITY_MAP_PROFILES) {
  const group = citiesByCountry.get(city.countryCode) ?? [];
  group.push(city);
  citiesByCountry.set(city.countryCode, group);
}
for (const group of citiesByCountry.values()) group.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

export function cityProfile(id: string): CityMapProfile {
  const city = cityById.get(id);
  if (!city) throw new Error(`unknown map city '${id}'`);
  return city;
}

export function citiesForCountry(countryCode: string): readonly CityMapProfile[] {
  return citiesByCountry.get(countryCode) ?? [];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const rating = (value: number) => clamp01(value / 100);
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;

interface CultureArchitecture {
  facade: FacadeLanguage;
  courtyard: number;
  balcony: number;
  glass: number;
}

const CULTURE_ARCHITECTURE: Record<number, CultureArchitecture> = {
  1: { facade: 'courtyard', courtyard: 0.82, balcony: 0.38, glass: 0.28 },
  2: { facade: 'veranda', courtyard: 0.52, balcony: 0.55, glass: 0.24 },
  3: { facade: 'veranda', courtyard: 0.38, balcony: 0.62, glass: 0.34 },
  4: { facade: 'compound', courtyard: 0.7, balcony: 0.32, glass: 0.24 },
  5: { facade: 'courtyard', courtyard: 0.68, balcony: 0.58, glass: 0.35 },
  6: { facade: 'tower-block', courtyard: 0.34, balcony: 0.7, glass: 0.58 },
  7: { facade: 'veranda', courtyard: 0.42, balcony: 0.82, glass: 0.46 },
  8: { facade: 'arcade', courtyard: 0.62, balcony: 0.74, glass: 0.42 },
  9: { facade: 'row-street', courtyard: 0.28, balcony: 0.64, glass: 0.72 },
  10: { facade: 'tower-block', courtyard: 0.32, balcony: 0.7, glass: 0.55 },
  11: { facade: 'veranda', courtyard: 0.3, balcony: 0.78, glass: 0.64 },
  12: { facade: 'terrace', courtyard: 0.56, balcony: 0.76, glass: 0.48 },
  13: { facade: 'row-street', courtyard: 0.2, balcony: 0.54, glass: 0.78 },
  14: { facade: 'courtyard', courtyard: 0.8, balcony: 0.52, glass: 0.38 },
};
const DEFAULT_CULTURE: CultureArchitecture = { facade: 'compound', courtyard: 0.45, balcony: 0.5, glass: 0.45 };

const TAG_DISTRICT: Record<CityMapTag, Partial<DistrictWeights>> = {
  Company: { commercial: 0.34, industrial: 0.08 },
  Educational: { civic: 0.32, residential: 0.08 },
  Industrial: { industrial: 0.38, commercial: 0.05 },
  Military: { military: 0.5, residential: -0.1 },
  Mining: { industrial: 0.3, military: 0.08 },
  Political: { civic: 0.34, military: 0.12 },
  Resort: { commercial: 0.28, residential: 0.18 },
  Seaport: { industrial: 0.24, commercial: 0.18 },
  Temple: { civic: 0.28, commercial: 0.08 },
};

function stringSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Convert source-sheet traits into map-making weights. These are biases,
 * never stereotypes or hard locks: the grammar remains capable of dealing
 * every archetype into every city. */
export function architectureProfile(cityId: string, seed: number): CityArchitectureProfile {
  const city = cityProfile(cityId);
  const country = countryByCode.get(city.countryCode);
  if (!country) throw new Error(`map city '${cityId}' has no country '${city.countryCode}'`);
  const culture = CULTURE_ARCHITECTURE[city.cultureCode ?? -1] ?? DEFAULT_CULTURE;
  const rng = new Rng((seed ^ stringSeed(city.id)) >>> 0);
  const jitter = () => rng.range(-0.035, 0.035);
  const wealth = mix(rating(country.lifestyle), rating(country.digital), 0.5);
  const enforcement = mix(rating(country.lawEnforcement), rating(country.lawEnforcementBudget), 0.45);
  const military = mix(rating(country.military), rating(country.militaryBudget), 0.45);
  const security = clamp01(enforcement * 0.42 + military * 0.28 + rating(city.safety) * 0.18 + rating(country.science) * 0.12 + jitter());

  const districtWeights: DistrictWeights = {
    residential: 0.42,
    commercial: 0.32,
    industrial: 0.22,
    civic: 0.2,
    military: 0.12,
  };
  for (const tag of city.tags) {
    for (const [kind, delta] of Object.entries(TAG_DISTRICT[tag]) as [keyof DistrictWeights, number][]) {
      districtWeights[kind] += delta;
    }
  }
  for (const kind of Object.keys(districtWeights) as (keyof DistrictWeights)[]) {
    districtWeights[kind] = clamp01(districtWeights[kind] + jitter());
  }

  return {
    cityId,
    facade: culture.facade,
    courtyardWeight: clamp01(culture.courtyard + jitter()),
    balconyWeight: clamp01(culture.balcony + wealth * 0.12 + jitter()),
    glassWeight: clamp01(culture.glass + wealth * 0.18 + rating(country.digital) * 0.08 + jitter()),
    security,
    guardDiscipline: clamp01(security * 0.62 + military * 0.3 + jitter()),
    dogWeight: clamp01(military * 0.34 + enforcement * 0.3 + rating(city.crime) * 0.2 + (city.tags.includes('Military') ? 0.18 : 0) + jitter()),
    districtWeights,
  };
}
