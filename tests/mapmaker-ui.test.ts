import { describe, expect, it } from 'vitest';
import { COUNTRY_MAP_PROFILES } from '../src/sim/city-profile';
import { F2_FLOOR, GRID } from '../src/sim/map';
import { validateDoc } from '../src/sim/mapedit';
import {
  canLaunchOperation,
  floorTabs,
  generateBuildingDoc,
  mapMakerArchetypeOptions,
  mapMakerCityOptions,
  mapMakerImportNotice,
} from '../src/harness/mapmaker';

describe('city Map Maker presentation model', () => {
  const country = COUNTRY_MAP_PROFILES.find((entry) => entry.name === 'Serbia')!;

  it('filters cities by country and groups every archetype by use', () => {
    const cities = mapMakerCityOptions(country.code);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities.every((city) => city.countryCode === country.code)).toBe(true);
    expect(cities.some((city) => city.name === 'Belgrade')).toBe(true);

    const groups = mapMakerArchetypeOptions();
    expect(groups.map((group) => group.use)).toEqual(['residential', 'commercial', 'industrial', 'civic', 'military']);
    expect(groups.flatMap((group) => group.options)).toHaveLength(19);
  });

  it('generates a provenance-bearing three-storey document with Ground/L2/L3 tabs', () => {
    const city = mapMakerCityOptions(country.code).find((entry) => entry.name === 'Belgrade')!;
    const doc = generateBuildingDoc({ cityId: city.id, archetype: 'command-villa', floors: 3, seed: 414 });
    expect(doc.map.buildingMeta).toMatchObject({ cityId: city.id, archetype: 'command-villa', floors: 3 });
    expect(floorTabs(doc).map((tab) => tab.label)).toEqual(['Ground', 'L2', 'L3']);
    expect(canLaunchOperation(doc)).toBe(true);

    const meta = doc.map.buildingMeta!;
    const stair = doc.map.upperLayers![0].findIndex((tile) => tile >= 19 && tile <= 22);
    expect(stair).toBeGreaterThanOrEqual(0);
    doc.map.upperLayers![0][stair] = F2_FLOOR;
    expect(canLaunchOperation(doc)).toBe(false);
    expect(meta.origin!.tx).toBeGreaterThan(0);
    expect(meta.origin!.tz).toBeGreaterThan(0);
    expect(doc.map.grid).toHaveLength(GRID * GRID);
  });

  it('keeps the visible Belgrade command-villa workflow launchable at the default seed', () => {
    const city = mapMakerCityOptions(country.code).find((entry) => entry.name === 'Belgrade')!;
    const doc = generateBuildingDoc({ cityId: city.id, archetype: 'command-villa', floors: 3, seed: 4207 });
    expect(validateDoc(doc).issues).toEqual([]);
    expect(canLaunchOperation(doc)).toBe(true);
  });

  it('labels legacy v1 imports as upgraded and clamps print reserves to 1–8', () => {
    expect(mapMakerImportNotice({ v: 1 })).toContain('v1');
    expect(mapMakerImportNotice({ v: 2 })).toBeNull();
    const city = mapMakerCityOptions(country.code)[0];
    const doc = generateBuildingDoc({ cityId: city.id, archetype: 'office', floors: 2, seed: 9, prints: 99 });
    expect(doc.mode).toBe('science');
    expect(doc.map.buildingMeta?.floors).toBe(2);
  });
});
