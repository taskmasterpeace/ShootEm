import { describe, expect, it } from 'vitest';
import {
  freshCampaign,
  migrateCampaign,
  operationBattleBonuses,
  settleCampaignOperation,
  stageCampaignOperation,
} from '../src/client/campaign';
import { createSuggestedManifest } from '../src/client/operations-ui';
import { createOperationRuntime, emptyOperationObservation, stepOperation, type OperationObservation, type OperationResult } from '../src/sim/operation-runtime';
import { generateOperation, type OperationManifest, type OperationPlan } from '../src/sim/operations';
import { World } from '../src/sim/world';

function complete(plan: OperationPlan, manifest: OperationManifest): OperationResult {
  const state = createOperationRuntime(plan);
  const observation: OperationObservation = emptyOperationObservation();
  observation.hulls = manifest.hullIds.map((hullId) => ({ hullId, alive: true }));
  observation.criticalAirframesAlive = 1;
  for (const phase of plan.phases) {
    observation.phase = { friendly: 2, enemy: 0, friendlyDomain: phase.targetCount ?? 1, targetDestroyed: true };
    observation.enemyAliveByDomain[phase.domain] = 0;
    let guard = 0;
    while (!state.result && state.currentPhase < plan.phases.length && guard++ < 1000) stepOperation(state, observation, 1);
  }
  expect(state.result?.won).toBe(true);
  return state.result!;
}

function landSkirmish(): OperationPlan {
  for (let seed = 1; seed < 500; seed++) {
    const plan = generateOperation({ seed, frontId: 'eastern_plains', frontName: 'Eastern Plains', pass: 1 });
    if (plan.domains.length === 1 && plan.domains[0] === 'land') return { ...plan, effect: 'claim_midfield' };
  }
  throw new Error('No deterministic land-skirmish seed found.');
}

describe('Military Operations end-to-end', () => {
  it('runs a Pass-1 land skirmish from generation through one persisted next-battle reward', () => {
    const campaign = freshCampaign(1000);
    const plan = landSkirmish();
    const manifest = createSuggestedManifest(plan, campaign.motorPool);
    const treasuryBefore = campaign.treasury;
    const staged = stageCampaignOperation(campaign, plan, manifest, 1100);
    expect(staged.ok).toBe(true);

    const world = new World({
      seed: plan.seed, mode: 'conquest', operation: plan, operationManifest: manifest,
      operationInventory: campaign.motorPool,
    });
    expect(world.map.operation?.operationId).toBe(plan.id);
    expect([...world.vehicles.values()].some((vehicle) => vehicle.operationHullId === manifest.hullIds[0])).toBe(true);

    const result = complete(plan, manifest);
    const receipt = settleCampaignOperation(campaign, result, 1200);
    expect(receipt.ok).toBe(true);
    expect(campaign.treasury).not.toBe(treasuryBefore);
    expect(operationBattleBonuses(campaign, plan.frontId).forwardSpawn).toBe(true);

    const reloaded = migrateCampaign(JSON.parse(JSON.stringify(campaign)), 1300);
    const fingerprint = JSON.stringify(reloaded);
    expect(settleCampaignOperation(reloaded, result, 1400).duplicate).toBe(true);
    expect(JSON.stringify(reloaded)).toBe(fingerprint);
  });

  it('runs a Pass-2 Beachhead with real reserved land/sea hulls and captures one seasonal facility', () => {
    const campaign = freshCampaign(1000);
    campaign.fronts.the_port.pass = 2;
    const plan = {
      ...generateOperation({ seed: 7749, frontId: 'the_port', frontName: 'The Port', pass: 2, signatureId: 'beachhead' }),
      effect: 'capture_airfield' as const,
      complication: 'storm' as const,
    };
    const manifest = createSuggestedManifest(plan, campaign.motorPool);
    expect(stageCampaignOperation(campaign, plan, manifest, 1100).ok).toBe(true);

    const world = new World({
      seed: plan.seed, mode: 'conquest', operation: plan, operationManifest: manifest,
      operationInventory: campaign.motorPool,
    });
    expect(world.weather.kind).toBe('storm');
    expect(new Set([...world.vehicles.values()].flatMap((vehicle) => vehicle.operationHullId ? [vehicle.operationHullId] : [])))
      .toEqual(new Set(manifest.hullIds));

    const result = complete(plan, manifest);
    expect(settleCampaignOperation(campaign, result, 1200).ok).toBe(true);
    expect(campaign.facilities.filter((effect) => effect === 'capture_airfield')).toHaveLength(1);
    const once = JSON.stringify(campaign);
    expect(settleCampaignOperation(campaign, result, 1300).duplicate).toBe(true);
    expect(JSON.stringify(campaign)).toBe(once);
  });
});
