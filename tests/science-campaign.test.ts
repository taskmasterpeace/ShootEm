import { describe, expect, it } from 'vitest';
import {
  SCIENCE_WINDOWS_PER_PASS,
  applyScienceResult,
  freshCampaign,
  scienceWindowsFor,
  spendScienceWindow,
} from '../src/client/campaign';
import { SCIENCE_REWARDS, type ScienceRewardId } from '../src/sim/science';
import type { ScienceMissionResult } from '../src/sim/science-runtime';

function resultFixture(overrides: Partial<ScienceMissionResult> = {}): ScienceMissionResult {
  return {
    id: 'SM-TEST',
    won: true,
    clonesSpent: 2,
    clonesRemaining: 2,
    ghost: false,
    reward: 'front-reinforcement',
    ...overrides,
  };
}

describe('science campaign windows', () => {
  it('spends one of two windows and replenishes on a new pass', () => {
    const campaign = freshCampaign(1);
    expect(scienceWindowsFor(campaign, 'bridge_delta', 1)).toBe(SCIENCE_WINDOWS_PER_PASS);
    expect(spendScienceWindow(campaign, 'bridge_delta', 1)).toBe(true);
    expect(campaign.fronts.bridge_delta.scienceWindows).toBe(1);
    expect(spendScienceWindow(campaign, 'bridge_delta', 2)).toBe(true);
    expect(campaign.fronts.bridge_delta.scienceWindows).toBe(1);
  });

  it('refuses a launch after both windows in the same pass are spent', () => {
    const campaign = freshCampaign(1);
    expect(spendScienceWindow(campaign, 'bridge_delta', 1)).toBe(true);
    expect(spendScienceWindow(campaign, 'bridge_delta', 1)).toBe(true);
    expect(spendScienceWindow(campaign, 'bridge_delta', 1)).toBe(false);
  });
});

describe('science campaign transactions', () => {
  it('applies a successful result exactly once', () => {
    const campaign = freshCampaign(1);
    campaign.fronts.bridge_delta.clones -= 50;
    const result = resultFixture();
    const before = campaign.fronts.bridge_delta.clones;

    expect(applyScienceResult(campaign, 'bridge_delta', result, 2)).toBe(true);
    expect(applyScienceResult(campaign, 'bridge_delta', result, 3)).toBe(false);
    expect(campaign.fronts.bridge_delta.clones).toBeGreaterThan(before - 2);
    expect(campaign.appliedScienceMissionIds).toEqual(['SM-TEST']);
  });

  it('a failed operation spends clones but grants no reward', () => {
    const campaign = freshCampaign(1);
    const state = campaign.fronts.bridge_delta;
    const before = state.clones;
    const bonuses = structuredClone(campaign.scienceBonuses);

    expect(applyScienceResult(campaign, 'bridge_delta', resultFixture({ won: false, clonesSpent: 3 }), 4)).toBe(true);
    expect(state.clones).toBe(before - 3);
    expect(campaign.scienceBonuses).toEqual(bonuses);
  });

  it('supports retry-next-window failure policy without burning the failed squad', () => {
    const campaign = freshCampaign(1);
    const state = campaign.fronts.bridge_delta;
    const before = state.clones;

    expect(applyScienceResult(
      campaign,
      'bridge_delta',
      resultFixture({ id: 'SM-RETRY', won: false, clonesSpent: 3 }),
      4,
      'retry-next-window',
    )).toBe(true);
    expect(state.clones).toBe(before);
  });

  it('ghost extraction grants a clone-efficiency bonus', () => {
    const campaign = freshCampaign(1);
    const state = campaign.fronts.bridge_delta;
    state.clones -= 30;
    const before = state.clones;
    applyScienceResult(campaign, 'bridge_delta', resultFixture({ ghost: true, clonesSpent: 2 }), 5);
    expect(state.clones).toBeGreaterThan(before - 2);
  });

  it.each(SCIENCE_REWARDS.map((reward) => reward.id))('%s moves a persisted campaign number', (reward) => {
    const campaign = freshCampaign(1);
    const state = campaign.fronts.bridge_delta;
    state.clones -= 80;
    const watched = () => {
      switch (reward) {
        case 'front-reinforcement': return state.clones;
        case 'theater-reinforcement': return campaign.scienceBonuses.theaterClones;
        case 'enemy-clone-drain': return state.enemyClonePressure;
        case 'clone-insurance': return state.cloneInsurance;
        case 'front-breakthrough': return state.control;
        case 'morale-cache': return campaign.scienceBonuses.morale;
        case 'opening-materiel': return campaign.scienceBonuses.openingMateriel;
        case 'requisition-discount': return campaign.scienceBonuses.requisitionDiscounts;
        case 'deny-reinforcements': return campaign.scienceBonuses.enemyReinforcementCuts;
        case 'weather-pick': return campaign.scienceBonuses.weatherPicks;
        case 'roster-intel': return campaign.scienceBonuses.rosterIntel;
        case 'lsw-assignment': return campaign.scienceBonuses.lswAssignments;
      }
    };
    const before = watched();
    const result = resultFixture({ id: `SM-${reward}`, reward: reward as ScienceRewardId, clonesSpent: 0 });

    expect(applyScienceResult(campaign, 'bridge_delta', result, 7)).toBe(true);
    expect(watched()).toBeGreaterThan(before);
  });
});
