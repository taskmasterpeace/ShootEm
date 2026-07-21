import { describe, expect, it } from 'vitest';
import { FRONTS, freshCampaign } from '../src/client/campaign';
import {
  finalizeScienceLaunch,
  prepareScarScienceMission,
  prepareScienceMission,
} from '../src/client/science-flow';
import { createScienceRuntime } from '../src/sim/science-runtime';
import { generateScienceMap } from '../src/sim/science-map';

describe('science mission launch state', () => {
  it('prepares free play without mutating campaign state', () => {
    const campaign = freshCampaign(1);
    const before = structuredClone(campaign);
    const launch = prepareScienceMission(99, null, 4, { theme: 'europa' });
    expect(launch.spec.theme).toBe('europa');
    expect(launch.frontId).toBeUndefined();
    expect(campaign).toEqual(before);
  });

  it('refuses a Scar launch with no science windows', () => {
    const campaign = freshCampaign(1);
    campaign.fronts.bridge_delta.scienceWindows = 0;
    campaign.fronts.bridge_delta.scienceWindowPass = campaign.fronts.bridge_delta.pass;
    expect(prepareScarScienceMission(campaign, 'bridge_delta', 100, 4)).toBeNull();
  });

  it('spends a Scar window before launch', () => {
    const campaign = freshCampaign(1);
    const launch = prepareScarScienceMission(campaign, 'bridge_delta', 100, 4);
    expect(launch?.frontId).toBe('bridge_delta');
    expect(campaign.fronts.bridge_delta.scienceWindows).toBe(1);
  });

  it('one-life complications lock the print stock to one', () => {
    const launch = prepareScienceMission(22, null, 8, { complication: 'one-life' });
    expect(launch.spec.squadSize).toBe(1);
  });

  it('finalizes campaign and Courier aftermath once across repeated end frames', () => {
    const campaign = freshCampaign(1);
    campaign.fronts.bridge_delta.clones -= 40;
    const front = FRONTS.find((candidate) => candidate.id === 'bridge_delta')!;
    const launch = prepareScienceMission(71, front, 4, { reward: 'front-reinforcement' });
    const runtime = createScienceRuntime(launch.spec, generateScienceMap(launch.spec));
    runtime.phase = 'won';
    runtime.clonesSpent = 2;
    runtime.clonesRemaining = 2;

    const first = finalizeScienceLaunch(launch, runtime, campaign, 20);
    const second = finalizeScienceLaunch(launch, runtime, campaign, 21);
    expect(first?.issue.science?.id).toBe(launch.spec.id);
    expect(first?.campaignApplied).toBe(true);
    expect(second).toBeNull();
    expect(campaign.appliedScienceMissionIds).toEqual([launch.spec.id]);
  });
});
