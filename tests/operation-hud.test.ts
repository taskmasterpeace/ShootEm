import { describe, expect, it } from 'vitest';
import {
  createOperationHudState,
  reduceOperationHud,
  renderOperationAfterAction,
  renderOperationHud,
} from '../src/client/hud';
import { freshCampaign, type SettlementReceipt } from '../src/client/campaign';
import { generateOperation, type OperationManifest } from '../src/sim/operations';
import type { OperationResult } from '../src/sim/operation-runtime';

function mission() {
  return generateOperation({ seed: 7749, frontId: 'the_port', frontName: 'The Port', pass: 2, signatureId: 'beachhead' });
}

describe('Operation HUD presentation', () => {
  it('shows current and next objectives, progress, elapsed time, and complication', () => {
    const plan = { ...mission(), complication: 'storm' as const };
    let state = createOperationHudState(plan, 10);
    state = reduceOperationHud(state, {
      type: 'operation_progress', operationId: plan.id, phaseId: plan.phases[0].id, progress: 0.42,
    }, 35);
    const html = renderOperationHud(state, 35);
    expect(html).toContain(plan.phases[0].label);
    expect(html).toContain(plan.phases[1].label);
    expect(html).toContain('42%');
    expect(html).toContain('0:25');
    expect(html).toContain('Night Storm');
  });

  it('advances only from typed Operation events and states the failure reason plainly', () => {
    const plan = { ...mission(), complication: 'reinforcement_clock' as const };
    let state = createOperationHudState(plan, 0);
    state = reduceOperationHud(state, {
      type: 'operation_phase', operationId: plan.id, phaseId: plan.phases[1].id, text: plan.phases[1].label,
    }, 40);
    state = reduceOperationHud(state, {
      type: 'operation_complete', operationId: plan.id, won: false, text: 'Enemy reinforcements reached the sector.',
    }, 121);
    const html = renderOperationHud(state, 121);
    expect(html).toContain(plan.phases[1].label);
    expect(html).toContain('OPERATION FAILED');
    expect(html).toContain('Enemy reinforcements reached the sector.');
  });
});

describe('Operation after-action presentation', () => {
  it('itemizes commitment, returned and lost named hulls, objectives, and payout', () => {
    const campaign = freshCampaign(1000);
    const plan = mission();
    const tank = campaign.motorPool.find((hull) => hull.kind === 'tank')!;
    const boat = campaign.motorPool.find((hull) => hull.kind === 'boat')!;
    const manifest: OperationManifest = { hullIds: [tank.id, boat.id], ammunition: 3, support: 'cas' };
    const result: OperationResult = {
      operationId: plan.id, won: true, completedPhaseIds: plan.phases.map((phase) => phase.id),
      destroyedHullIds: [boat.id], survivingHullIds: [tank.id], collateral: 0, elapsed: 95, cleanSheet: false,
    };
    const receipt: SettlementReceipt = {
      ok: true, duplicate: false, operationId: plan.id, won: true, effect: plan.effect,
      treasuryDelta: 7, hullsLost: [boat.id], hullsReturned: [tank.id], errors: [],
    };
    const html = renderOperationAfterAction({ plan, manifest, result, receipt, inventory: campaign.motorPool });
    expect(html).toContain('OPERATION AFTER-ACTION');
    expect(html).toContain(tank.name);
    expect(html).toContain(boat.name);
    expect(html).toContain('RETURNED');
    expect(html).toContain('LOST');
    expect(html).toContain('2 / 2');
    expect(html).toContain('+7');
  });
});
