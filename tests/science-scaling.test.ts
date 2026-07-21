import { describe, expect, it } from 'vitest';
import { CITY_MAP_PROFILES } from '../src/sim/city-profile';
import {
  SCIENCE_VERBS,
  generateScienceMission,
  scienceEncounterBudget,
  type ScienceSite,
} from '../src/sim/science';
import { generateScienceMap, scienceMapReachable } from '../src/sim/science-map';
import { World } from '../src/sim/world';

describe('science print-reserve encounter scaling', () => {
  it.each([0.15, 0.9])('scales commitments 1–8 monotonically at security %s', (security) => {
    let priorThreat = -1;
    for (let prints = 1; prints <= 8; prints++) {
      const budget = scienceEncounterBudget({
        prints,
        security,
        verb: 'steal',
        floors: 3,
      });
      expect(budget.initialGuards).toBeGreaterThanOrEqual(2);
      expect(budget.initialGuards + budget.initialCivilians + budget.dogTeams).toBeLessThanOrEqual(16);
      expect(budget.reserveGuards).toBeGreaterThanOrEqual(1);
      expect(budget.dogTeams).toBeLessThanOrEqual(2);
      expect(budget.firstRoomGuards).toBeLessThanOrEqual(2);
      expect(budget.threat).toBeGreaterThanOrEqual(priorThreat);
      priorThreat = budget.threat;
    }
  });

  it('keeps low-print operations materially smaller than high-print operations', () => {
    const low = scienceEncounterBudget({ prints: 1, security: 0.5, verb: 'raid', floors: 2 });
    const high = scienceEncounterBudget({ prints: 8, security: 0.5, verb: 'raid', floors: 2 });
    expect(low.initialGuards).toBeLessThan(high.initialGuards);
    expect(low.reserveGuards).toBeLessThan(high.reserveGuards);
    expect(low.threat).toBeLessThan(high.threat);
  });

  it('deals the approved guard, dog, and reserve counts into the runtime', () => {
    const spec = generateScienceMission(9301, { site: 'clone-vault', squadSize: 8, complication: null });
    spec.security = 0.95;
    const world = new World({ seed: spec.seed, mode: 'science', scienceMission: spec });
    const runtime = world.science!;
    expect(runtime.guardIds).toHaveLength(runtime.encounterBudget.initialGuards);
    expect(runtime.dogIds).toHaveLength(2);
    const before = runtime.guardIds.length;
    runtime.alarm = true;
    runtime.reinforcementAt = world.time;
    world.step(1 / 60, new Map());
    expect(runtime.guardIds).toHaveLength(before + runtime.encounterBudget.reserveGuards);
  });
});

describe('whole-building science site integration', () => {
  const city = CITY_MAP_PROFILES.find((entry) => entry.name === 'Montevideo')!;
  const sites: ScienceSite[] = ['officer-villa', 'research-annex', 'clone-vault'];

  it.each(SCIENCE_VERBS)('%s is reachable in residential, commercial, and military buildings', (verb) => {
    for (const site of sites) {
      const spec = generateScienceMission(9200 + SCIENCE_VERBS.indexOf(verb), {
        verb,
        site,
        cityId: city.id,
        squadSize: 4,
        complication: null,
      });
      const layout = generateScienceMap(spec);
      expect(layout.map.buildingMeta?.cityId).toBe(city.id);
      expect(layout.map.houses).toHaveLength(1);
      expect(layout.map.houses[0].floors).toBeGreaterThanOrEqual(2);
      expect(layout.objectiveSockets.length).toBeGreaterThanOrEqual(4);
      expect(scienceMapReachable(layout), `${verb}/${site}`).toBe(true);
    }
  });
});
