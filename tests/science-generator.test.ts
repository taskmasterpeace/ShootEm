import { describe, expect, it } from 'vitest';
import {
  SCIENCE_REWARDS,
  SCIENCE_SITES,
  SCIENCE_VERBS,
  generateScienceMission,
  validateScienceMission,
  type ScienceMissionSpec,
} from '../src/sim/science';

describe('science mission generator', () => {
  it('is deterministic and commits the requested 1-8 clones', () => {
    const a = generateScienceMission(7749, { squadSize: 6 });
    const b = generateScienceMission(7749, { squadSize: 6 });

    expect(a).toEqual(b);
    expect(a.squadSize).toBe(6);
    expect(a.armorPolicy).toBe('none');
    expect(validateScienceMission(a)).toEqual([]);
  });

  it('keeps an explicit armor exception deterministic', () => {
    const a = generateScienceMission(7750, { armorPolicy: 'rare-specialist' });
    const b = generateScienceMission(7750, { armorPolicy: 'rare-specialist' });

    expect(a).toEqual(b);
    expect(a.armorPolicy).toBe('rare-specialist');
  });

  it('compiles every verb and every site through the same contract', () => {
    expect(SCIENCE_VERBS).toHaveLength(10);
    expect(SCIENCE_SITES).toHaveLength(10);

    for (const verb of SCIENCE_VERBS) {
      const mission = generateScienceMission(12, { verb });
      expect(mission.verb).toBe(verb);
      expect(mission.briefing.toLowerCase()).toContain(verb === 'decapitate' ? 'officers' : verb);
    }
    for (const site of SCIENCE_SITES) {
      expect(generateScienceMission(13, { site }).site).toBe(site);
    }
  });

  it('one-life clamps the squad to one clone', () => {
    const mission = generateScienceMission(14, { squadSize: 8, complication: 'one-life' });

    expect(mission.squadSize).toBe(1);
    expect(mission.complication).toBe('one-life');
  });

  it('draws only rewards that have campaign-facing adapters', () => {
    expect(SCIENCE_REWARDS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(SCIENCE_REWARDS.map((reward) => reward.id)).size).toBe(SCIENCE_REWARDS.length);

    for (let seed = 1; seed <= 100; seed++) {
      const mission = generateScienceMission(seed);
      expect(SCIENCE_REWARDS.some((reward) => reward.id === mission.reward)).toBe(true);
    }
  });

  it('reports malformed externally supplied specs instead of accepting them', () => {
    const valid = generateScienceMission(15);
    const malformed = {
      ...valid,
      id: '',
      squadSize: 9,
      briefing: '',
      verb: 'dance',
    } as unknown as ScienceMissionSpec;

    expect(validateScienceMission(malformed)).toEqual(expect.arrayContaining([
      'mission id is required',
      'unknown verb: dance',
      'squad size must be an integer from 1 to 8',
      'briefing is required',
    ]));
  });
});
