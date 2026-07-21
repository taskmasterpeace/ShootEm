import { describe, expect, it } from 'vitest';
import { renderIssueHTML, type PressIssue } from '../src/client/newspaper';
import { scienceCampaignBankHTML, scienceDebriefHTML, scienceMissionHTML } from '../src/client/science';
import type { ScienceMissionRuntime, ScienceMissionResult } from '../src/sim/science-runtime';

const issueFixture = (): PressIssue => ({
  at: 1_750_000_000_000,
  season: 3,
  frontName: 'Bridge Delta',
  controlAfter: 12,
  controlDelta: 0,
  won: true,
  modeName: 'Science Mission',
  aceName: 'Operator',
  aceKills: 4,
  longestShot: 0,
  myCost: 2,
  theirCost: 0,
  underdog: false,
  myKills: 4,
  theirKills: 0,
  medals: [],
  science: {
    id: 'SM-TEST',
    briefing: 'Secure the program core.',
    clonesSpent: 2,
    clonesRemaining: 3,
    ghost: true,
    reward: 'front-reinforcement',
  },
});

const resultFixture = (overrides: Partial<ScienceMissionResult & { briefing: string }> = {}) => ({
  id: 'SM-TEST',
  won: true,
  ghost: true,
  clonesSpent: 2,
  clonesRemaining: 3,
  reward: 'front-reinforcement' as const,
  briefing: 'Secure the program core.',
  ...overrides,
});

function runtimeFixture(): ScienceMissionRuntime {
  return {
    spec: {
      id: 'SM-TEST', seed: 7, verb: 'steal', site: 'research-annex', theme: 'starship',
      reward: 'front-reinforcement', squadSize: 5, briefing: 'Secure the program core.',
    },
    phase: 'objective',
    objective: { kind: 'interact', label: 'Secure the program core', pos: [], required: 1, progress: 0, complete: false },
    entry: { x: 0, y: 0, z: 0 }, extraction: { x: 0, y: 0, z: 0 },
    guardPosts: [], civilianSpawns: [], convoyRoute: [],
    clonesRemaining: 5, clonesSpent: 0, detections: 0, alarm: false,
    civilianIds: [], targetIds: [], guardIds: [], vehicleTargetIds: [], interacted: new Set(),
    reinforcementAt: Infinity, reinforcementsDeployed: false, convoyWaypoint: 2, applied: false,
  };
}

describe('science mission presentation', () => {
  it('prints the operation, clone bill, ghost status, and reward in the Courier', () => {
    const html = renderIssueHTML(issueFixture());
    expect(html).toContain('OPERATION SM-TEST');
    expect(html).toContain('GHOST RUN');
    expect(html).toContain('CLONES SPENT');
    expect(html).toContain('FRONT REINFORCEMENT');
  });

  it('renders objective, clone pips, and alarm state in the mission card', () => {
    const runtime = runtimeFixture();
    runtime.alarm = true;
    const html = scienceMissionHTML(runtime);
    expect(html).toContain('Secure the program core');
    expect(html).toContain('science-clone-pip');
    expect(html).toContain('ALARM');
  });

  it('escapes generated operation copy', () => {
    const html = scienceDebriefHTML(resultFixture({ briefing: '<script>x</script>' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows every banked campaign reward on the Scar', () => {
    const html = scienceCampaignBankHTML({
      theaterClones: 25,
      morale: 1,
      openingMateriel: 2,
      requisitionDiscounts: 1,
      enemyReinforcementCuts: 1,
      weatherPicks: 1,
      rosterIntel: 1,
      lswAssignments: 1,
    });

    for (const label of ['THEATER CLONES', 'MORALE', 'OPENING MATERIEL', 'REQUISITION', 'REINFORCEMENT CUTS', 'WEATHER PICKS', 'ROSTER INTEL', 'LSW ASSIGNMENTS']) {
      expect(html).toContain(label);
    }
  });
});
