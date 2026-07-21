import { describe, expect, it } from 'vitest';
import { BUILDING_ARCHETYPES, generateCityBuilding, type GeneratedBuilding } from '../src/sim/building-generator';
import { CITY_MAP_PROFILES } from '../src/sim/city-profile';
import { deriveBuildingNavigation, validateWholeBuilding, type BuildingLaw } from '../src/sim/building-navigation';
import { blankDoc, stamp, validateDoc } from '../src/sim/mapedit';
import { F2_FLOOR, GRID } from '../src/sim/map';

const city = CITY_MAP_PROFILES.find((entry) => entry.name === 'Belgrade')!;
const villa = () => generateCityBuilding({
  cityId: city.id,
  archetype: 'command-villa',
  seed: 4417,
  floors: 3,
  footprint: 'rectangle',
});
const clone = (building: GeneratedBuilding): GeneratedBuilding => structuredClone(building);
const mutable = (building: GeneratedBuilding, floor: number) => building.layers[floor].map((row) => row.split(''));
const assign = (building: GeneratedBuilding, floor: number, rows: string[][]) => {
  building.layers[floor] = rows.map((row) => row.join(''));
};
const laws = (building: GeneratedBuilding) => new Set(validateWholeBuilding(building).issues.map((issue) => issue.law));

describe('whole-building navigation and authoring laws', () => {
  it('derives rooms, facade portals, and aligned cross-floor links for a valid villa', () => {
    const building = villa();
    const nav = deriveBuildingNavigation(building);
    expect(nav.rooms.length).toBeGreaterThan(3);
    expect(nav.portals.some((portal) => portal.kind === 'door')).toBe(true);
    expect(nav.portals.some((portal) => portal.kind === 'window')).toBe(true);
    expect(nav.portals.filter((portal) => portal.kind === 'stairs')).toHaveLength(2);
    const report = validateWholeBuilding(building);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.navigation).toEqual(nav);
  });

  it.each<[BuildingLaw, (building: GeneratedBuilding) => void]>([
    ['STRUCTURE', (building) => { building.layers.push([...building.layers[2]]); building.floors = 3; }],
    ['ROOMS', (building) => {
      const rows = mutable(building, 0);
      for (let z = 2; z <= 4; z++) for (let x = 2; x <= 4; x++) rows[z][x] = '+';
      rows[3][3] = '.';
      assign(building, 0, rows);
    }],
    ['CIRCULATION', (building) => {
      const rows = mutable(building, 1);
      const i = building.layers[1].join('').indexOf('A');
      rows[Math.floor(i / building.width)][i % building.width] = '.';
      assign(building, 1, rows);
    }],
    ['FACADE', (building) => {
      const rows = mutable(building, 0);
      const x = rows[0].findIndex((char) => char !== ' ');
      rows[0][x] = '.';
      assign(building, 0, rows);
    }],
    ['GLASS', (building) => {
      const rows = mutable(building, 0);
      const socket = building.sockets.find((entry) => entry.kind === 'objective')!;
      rows[socket.z][socket.x] = '=';
      assign(building, 0, rows);
    }],
    ['SECTIONS', (building) => {
      building.sections[1].tiles.push({ ...building.sections[0].tiles[0] });
    }],
    ['ENCOUNTERS', (building) => {
      const base = building.sockets.find((socket) => socket.kind === 'guard')!;
      building.sockets = Array.from({ length: 49 }, (_, index) => ({ ...base, id: `guard-${index}` }));
    }],
    ['PERFORMANCE', (building) => {
      building.width = 27;
      building.height = 27;
      building.layers = [Array.from({ length: 27 }, () => '.'.repeat(27))];
      building.floors = 1;
      building.sockets = [];
      building.sections = [];
    }],
  ])('reports the %s law with a targeted invalid fixture', (law, mutate) => {
    const building = clone(villa());
    mutate(building);
    expect(laws(building)).toContain(law);
  });

  it('enforces exact content budgets', () => {
    const report = validateWholeBuilding(villa());
    expect(report.metrics.occupiedTiles).toBeLessThanOrEqual(650);
    expect(report.metrics.facadeSegments).toBeLessThanOrEqual(220);
    expect(report.metrics.encounterSockets).toBeLessThanOrEqual(48);
    expect(report.metrics.initialNpcs).toBeLessThanOrEqual(16);
  });

  it('keeps every generated archetype inside the whole-building laws', () => {
    for (const [index, archetype] of BUILDING_ARCHETYPES.entries()) {
      const building = generateCityBuilding({
        cityId: city.id,
        archetype,
        seed: 8100 + index,
        floors: ((index % 3) + 1) as 1 | 2 | 3,
      });
      const report = validateWholeBuilding(building);
      expect(report.issues, archetype).toEqual([]);
    }
  });

  it('merges floor-aware building laws into Map Maker validation only for authored buildings', () => {
    const building = villa();
    const doc = blankDoc('standard', 4417);
    const tx = 42, tz = 40;
    expect(stamp(doc, building.def, tx, tz)).toBe(true);
    doc.map.buildingMeta = {
      ...building.provenance,
      floors: building.floors,
      footprint: building.footprint,
      origin: { tx, tz },
      width: building.width,
      height: building.height,
      sockets: building.sockets,
      sections: building.sections,
    };
    expect(validateDoc(doc).issues.filter((issue) => (['STRUCTURE', 'ROOMS', 'CIRCULATION', 'FACADE', 'GLASS', 'SECTIONS', 'ENCOUNTERS', 'PERFORMANCE'] as string[]).includes(issue.law))).toEqual([]);

    const stair = building.layers[1].join('').indexOf('A');
    doc.map.grid2[(tz + Math.floor(stair / building.width)) * GRID + tx + stair % building.width] = F2_FLOOR;
    expect(validateDoc(doc).issues.some((issue) => issue.law === 'CIRCULATION')).toBe(true);
  });
});
