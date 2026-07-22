import { describe, expect, it } from 'vitest';
import { renderIssueHTML, type PressIssue } from '../src/client/newspaper';
import { activeScienceWaypoints, scienceCampaignBankHTML, scienceDebriefHTML, scienceMissionHTML } from '../src/client/science';
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
      reward: 'front-reinforcement', squadSize: 5, briefing: 'Secure the program core.', armorPolicy: 'none',
    },
    phase: 'objective',
    objective: { kind: 'interact', label: 'Secure the program core', pos: [], required: 1, progress: 0, complete: false },
    entry: { x: 0, y: 0, z: 0 }, extraction: { x: 0, y: 0, z: 0 },
    guardPosts: [], civilianSpawns: [], dogPosts: [], reinforcementPosts: [], convoyRoute: [],
    encounterBudget: { initialGuards: 4, reserveGuards: 2, initialCivilians: 0, dogTeams: 0, patrolSectors: 2, firstRoomGuards: 2, threat: 54 },
    operationGraph: {
      seed: 7,
      nodes: [],
      roomEdges: [],
      criticalRoute: [],
      patrolRoutes: [],
      reportNodes: [],
      responseRoutes: [],
      metrics: { rooms: 0, edges: 0, loops: 0, criticalPoints: 0, patrols: 0, reports: 0 },
    },
    patrolRoutes: [], reportNodes: [], missionWaypoints: [],
    clonesRemaining: 5, clonesSpent: 0, detections: 0, alarm: false, awareness: 'ghost',
    civilianIds: [], targetIds: [], guardIds: [], dogIds: [], vehicleTargetIds: [], interacted: new Set(),
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

  it.each([
    ['ghost', 'GHOST'],
    ['searching', 'SEARCHING'],
    ['alarmed', 'ALARMED'],
  ] as const)('renders the %s awareness state in the mission card', (awareness, label) => {
    const runtime = runtimeFixture();
    runtime.awareness = awareness;
    runtime.alarm = awareness === 'alarmed';
    const html = scienceMissionHTML(runtime);
    expect(html).toContain('Secure the program core');
    expect(html).toContain('science-clone-pip');
    expect(html).toContain(`science-state-${awareness}`);
    expect(html).toContain(label);
  });

  it('turns burned clone pips into spent marks', () => {
    const runtime = runtimeFixture();
    runtime.clonesRemaining = 3;
    runtime.clonesSpent = 2;
    const html = scienceMissionHTML(runtime);
    expect(html.match(/is-live/g)).toHaveLength(3);
    expect(html.match(/is-spent/g)).toHaveLength(2);
  });

  it('presents permanent mission waypoints with floor direction and state colors', () => {
    const runtime = runtimeFixture();
    runtime.missionWaypoints = [
      { id: 'insertion', kind: 'insertion', label: 'INSERTION', pos: { x: 0, y: 0, z: 0 }, floor: 0, active: true },
      { id: 'objective', kind: 'objective', label: 'OBJECTIVE', pos: { x: 4, y: 4, z: 4 }, floor: 1, active: true },
      { id: 'report', kind: 'report', label: 'REPORT', pos: { x: 8, y: 0, z: 8 }, floor: 0, active: false },
      { id: 'extraction', kind: 'extraction', label: 'EXTRACTION', pos: { x: 12, y: 0, z: 12 }, floor: 0, active: false },
    ];

    const ground = activeScienceWaypoints(runtime, 0);
    expect(ground.map((waypoint) => waypoint.label)).toEqual(['INSERTION', 'OBJECTIVE ▲']);
    expect(ground.find((waypoint) => waypoint.kind === 'insertion')?.color).toBe(0x54dce8);
    expect(ground.find((waypoint) => waypoint.kind === 'objective')?.color).toBe(0xf1ba55);

    runtime.missionWaypoints[1].active = false;
    runtime.missionWaypoints[2].active = true;
    expect(activeScienceWaypoints(runtime, 0).map((waypoint) => waypoint.label)).toContain('REPORT');
    runtime.missionWaypoints[2].active = false;
    runtime.missionWaypoints[3].active = true;
    expect(activeScienceWaypoints(runtime, 0).map((waypoint) => waypoint.label)).toContain('EXTRACTION');
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
