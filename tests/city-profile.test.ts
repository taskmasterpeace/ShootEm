import { describe, expect, it } from 'vitest';
import {
  CITY_MAP_PROFILES,
  COUNTRY_MAP_PROFILES,
  architectureProfile,
  citiesForCountry,
  cityProfile,
} from '../src/sim/city-profile';

describe('map culture data', () => {
  it('ships every named city with a valid normalized country join', () => {
    expect(COUNTRY_MAP_PROFILES).toHaveLength(168);
    expect(CITY_MAP_PROFILES).toHaveLength(1050);
    const countries = new Set(COUNTRY_MAP_PROFILES.map((country) => country.code));
    for (const city of CITY_MAP_PROFILES) {
      expect(countries.has(city.countryCode), `${city.id} has no country`).toBe(true);
      expect(city.name.trim(), city.id).toBe(city.name);
      expect(city.tags.length, city.id).toBeLessThanOrEqual(4);
    }
  });

  it('repairs missing and stale city country codes from the country name', () => {
    const sofia = CITY_MAP_PROFILES.find((city) => city.name === 'Sofia')!;
    const belgrade = CITY_MAP_PROFILES.find((city) => city.name === 'Belgrade')!;
    const kinshasa = CITY_MAP_PROFILES.find((city) => city.name === 'Kinshasa')!;
    expect(sofia.country).toBe('Bulgaria');
    expect(sofia.countryCode).not.toBe('');
    expect(belgrade.country).toBe('Serbia');
    expect(belgrade.countryCode).toBe('135');
    expect(kinshasa.country).toBe('Congo');
  });

  it('uses stable unique city ids and deterministic country filtering', () => {
    expect(new Set(CITY_MAP_PROFILES.map((city) => city.id)).size).toBe(1050);
    const serbia = COUNTRY_MAP_PROFILES.find((country) => country.name === 'Serbia')!;
    const cities = citiesForCountry(serbia.code);
    expect(cities.some((city) => city.name === 'Belgrade')).toBe(true);
    expect(cities).toEqual([...cities].sort((a, b) => a.name.localeCompare(b.name)));
    expect(cityProfile(cities[0].id)).toEqual(cities[0]);
  });

  it('derives deterministic bounded architecture and security weights', () => {
    const kabul = CITY_MAP_PROFILES.find((city) => city.name === 'Kabul')!;
    const first = architectureProfile(kabul.id, 42);
    expect(first).toEqual(architectureProfile(kabul.id, 42));
    expect(first.cityId).toBe(kabul.id);
    expect(first.districtWeights.military).toBeGreaterThan(first.districtWeights.residential);
    const weights = [
      first.courtyardWeight,
      first.balconyWeight,
      first.glassWeight,
      first.security,
      first.guardDiscipline,
      first.dogWeight,
      ...Object.values(first.districtWeights),
    ];
    for (const value of weights) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the nine spreadsheet city tags as a typed content vocabulary', () => {
    const tags = new Set(CITY_MAP_PROFILES.flatMap((city) => city.tags));
    expect(CITY_MAP_PROFILES.filter((city) => city.tags.length > 0).length).toBeGreaterThan(700);
    expect([...tags].sort()).toEqual([
      'Company',
      'Educational',
      'Industrial',
      'Military',
      'Mining',
      'Political',
      'Resort',
      'Seaport',
      'Temple',
    ]);
  });
});
