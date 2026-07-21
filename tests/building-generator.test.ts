import { describe, expect, it } from 'vitest';
import {
  BUILDING_ARCHETYPES,
  FOOTPRINT_FAMILIES,
  buildingLayerConnected,
  generateCityBuilding,
  type BuildingArchetype,
} from '../src/sim/building-generator';
import { CITY_MAP_PROFILES } from '../src/sim/city-profile';
import { isLegalStencilChar, stencilConnected } from '../src/sim/buildings';

const kabul = CITY_MAP_PROFILES.find((city) => city.name === 'Kabul')!;
const montevideo = CITY_MAP_PROFILES.find((city) => city.name === 'Montevideo')!;
const WALKABLE = new Set(['.', 'h', 'v', 'A', 'L', 'B', 'P']);

describe('whole city building grammar', () => {
  it('ships the complete 19-archetype vocabulary', () => {
    expect(BUILDING_ARCHETYPES).toEqual([
      'cottage', 'row-house', 'apartment', 'command-villa',
      'storefront', 'office', 'mall-section', 'hotel',
      'workshop', 'factory', 'depot', 'processing-hall',
      'clinic', 'research-annex', 'government-office',
      'barracks', 'armory', 'command-post', 'secure-archive',
    ]);
  });

  it('generates every archetype deterministically as a complete legal building', () => {
    for (const [index, archetype] of BUILDING_ARCHETYPES.entries()) {
      const floors = ((index % 3) + 1) as 1 | 2 | 3;
      const options = { cityId: kabul.id, archetype, seed: 900 + index, floors };
      const building = generateCityBuilding(options);
      expect(building).toEqual(generateCityBuilding(options));
      expect(building.layers).toHaveLength(floors);
      expect(building.def.floors).toBe(floors);
      expect(building.def.rows).toEqual(building.layers[0]);
      expect(stencilConnected(building.def), archetype).toBe(true);
      const width = building.width;
      for (const [floor, rows] of building.layers.entries()) {
        expect(rows).toHaveLength(building.height);
        for (const row of rows) {
          expect(row).toHaveLength(width);
          for (const char of row) expect(isLegalStencilChar(char), `${archetype} '${char}'`).toBe(true);
        }
        expect(buildingLayerConnected(rows), `${archetype} floor ${floor}`).toBe(true);
      }
      const exteriorSockets = building.sockets.filter((socket) => socket.kind === 'entry' || socket.kind === 'exit');
      expect(exteriorSockets, `${archetype} exits`).toHaveLength(2);
      expect(new Set(exteriorSockets.map((socket) => `${socket.x},${socket.z}`)).size).toBe(2);
      for (const socket of exteriorSockets) expect(['h', 'v']).toContain(building.layers[0][socket.z][socket.x]);
      for (let floor = 1; floor < floors; floor++) {
        const lower = building.layers[floor - 1].join('').indexOf('A');
        const upper = building.layers[floor].join('').indexOf('A');
        expect(lower, `${archetype} lower circulation`).toBeGreaterThanOrEqual(0);
        expect(upper, `${archetype} upper circulation`).toBe(lower);
      }
      for (const socket of building.sockets) {
        const char = building.layers[socket.floor][socket.z][socket.x];
        expect(WALKABLE.has(char), `${archetype} ${socket.kind} on '${char}'`).toBe(true);
      }
    }
  });

  it('supports all five bounded footprint families', () => {
    for (const [index, footprint] of FOOTPRINT_FAMILIES.entries()) {
      const building = generateCityBuilding({
        cityId: montevideo.id,
        archetype: 'command-villa',
        seed: 1200 + index,
        floors: 3,
        footprint,
      });
      expect(building.footprint).toBe(footprint);
      expect(building.width).toBeGreaterThanOrEqual(10);
      expect(building.width).toBeLessThanOrEqual(25);
      expect(building.height).toBeGreaterThanOrEqual(8);
      expect(building.height).toBeLessThanOrEqual(19);
      expect(building.layers.every(buildingLayerConnected), footprint).toBe(true);
    }
  });

  it('aligns three-storey stairs and a separate optional service ladder', () => {
    const building = generateCityBuilding({ cityId: kabul.id, archetype: 'secure-archive', seed: 77, floors: 3 });
    const stairs = building.layers.map((rows) => rows.join('').indexOf('A'));
    expect(new Set(stairs).size).toBe(1);
    expect(stairs[0]).toBeGreaterThanOrEqual(0);
    const ladders = building.layers.map((rows) => rows.join('').indexOf('L'));
    expect(ladders.every((index) => index >= 0)).toBe(true);
    expect(new Set(ladders).size).toBe(1);
    expect(ladders[0]).not.toBe(stairs[0]);
  });

  it('sections a complete building instead of deleting inactive wings', () => {
    const full = generateCityBuilding({ cityId: kabul.id, archetype: 'mall-section', seed: 83, floors: 2 });
    const sectioned = generateCityBuilding({ cityId: kabul.id, archetype: 'mall-section', seed: 83, floors: 2, missionSection: 'west' });
    expect(sectioned.width).toBe(full.width);
    expect(sectioned.height).toBe(full.height);
    expect(sectioned.sections.find((section) => section.id === 'west')?.active).toBe(true);
    expect(sectioned.sections.find((section) => section.id === 'east')?.active).toBe(false);
    expect(sectioned.layers.some((rows) => rows.some((row) => row.includes('X')))).toBe(true);
    expect(sectioned.sockets.filter((socket) => socket.required).every((socket) => socket.sectionId === 'west')).toBe(true);
  });

  it('rejects unknown archetypes and impossible floor counts before generation', () => {
    expect(() => generateCityBuilding({ cityId: kabul.id, archetype: 'castle' as BuildingArchetype, seed: 1, floors: 2 })).toThrow('archetype');
    expect(() => generateCityBuilding({ cityId: kabul.id, archetype: 'office', seed: 1, floors: 4 as 3 })).toThrow('floors');
  });
});
