import { describe, expect, it } from 'vitest';
import {
  FRONTS,
  MOTOR_POOL_SEED,
  OPERATION_TREASURY_SEED,
  applyOperationEffect,
  cancelCampaignOperation,
  checkSeasonEnd,
  freshCampaign,
  settleCampaignOperation,
  stageCampaignOperation,
  type Campaign,
} from '../src/client/campaign';
import { OPERATION_EFFECTS, generateOperation, type OperationEffectId, type OperationManifest } from '../src/sim/operations';
import type { OperationResult } from '../src/sim/operation-runtime';

function beachhead(campaign: Campaign, effect: OperationEffectId = 'capture_airfield') {
  campaign.fronts.the_port.pass = 2;
  return {
    ...generateOperation({ seed: 7749, pass: 2, frontId: 'the_port', frontName: 'The Port', signatureId: 'beachhead' }),
    effect,
  };
}

function available(campaign: Campaign, kind: Campaign['motorPool'][number]['kind']) {
  return campaign.motorPool.find((hull) => hull.kind === kind && hull.status === 'available')!;
}

function manifestFor(campaign: Campaign): OperationManifest {
  return {
    hullIds: [available(campaign, 'tank').id, available(campaign, 'boat').id],
    ammunition: 1,
    support: 'none',
  };
}

function resultFor(operationId: string, lost: string[] = [], survived: string[] = []): OperationResult {
  return {
    operationId,
    won: true,
    completedPhaseIds: ['amphibious_assault:1', 'amphibious_assault:2'],
    destroyedHullIds: lost,
    survivingHullIds: survived,
    collateral: 0,
    elapsed: 95,
    cleanSheet: lost.length === 0,
  };
}

function strategicFingerprint(campaign: Campaign) {
  return JSON.stringify({
    treasury: campaign.treasury,
    fronts: campaign.fronts,
    facilities: campaign.facilities,
    modifiers: campaign.modifiers,
    doctrine: campaign.doctrine,
    intel: campaign.intel,
    pool: campaign.motorPool.map((hull) => ({ id: hull.id, kind: hull.kind, status: hull.status })),
    fiscal: campaign.fiscalEfficiency,
  });
}

describe('Operation campaign state', () => {
  it('seeds a named national motor pool and one window for every front/pass', () => {
    const campaign = freshCampaign(1000);
    expect(campaign.v).toBe(2);
    expect(campaign.treasury).toBe(OPERATION_TREASURY_SEED);
    expect(campaign.motorPool).toHaveLength(Object.values(MOTOR_POOL_SEED).reduce((sum, count) => sum + count, 0));
    expect(new Set(campaign.motorPool.map((hull) => hull.id)).size).toBe(campaign.motorPool.length);
    expect(new Set(campaign.motorPool.map((hull) => hull.name)).size).toBe(campaign.motorPool.length);
    expect(campaign.motorPool.every((hull) => hull.name.length > 3 && hull.status === 'available')).toBe(true);
    expect(Object.keys(campaign.operationWindows)).toHaveLength(FRONTS.length * 3);
  });

  it('reserves hulls and charges the exact launch plus manifest cost', () => {
    const campaign = freshCampaign(1000);
    const plan = beachhead(campaign);
    const manifest = manifestFor(campaign);
    const before = campaign.treasury;
    const staged = stageCampaignOperation(campaign, plan, manifest, 2000);
    expect(staged).toMatchObject({ ok: true, charged: 11 });
    expect(campaign.treasury).toBe(before - 11);
    expect(campaign.activeOperation?.plan).toEqual(plan);
    expect(manifest.hullIds.map((id) => campaign.motorPool.find((hull) => hull.id === id)?.status)).toEqual(['reserved', 'reserved']);
    expect(stageCampaignOperation(campaign, plan, manifest, 2001).ok).toBe(false);
  });

  it('blocks unaffordable or exhausted launches before reserving anything', () => {
    const campaign = freshCampaign(1000);
    const plan = beachhead(campaign);
    const manifest = manifestFor(campaign);
    campaign.treasury = 0;
    expect(stageCampaignOperation(campaign, plan, manifest).errors).toContain('National treasury cannot fund this Operation.');
    expect(campaign.motorPool.every((hull) => hull.status !== 'reserved')).toBe(true);
    campaign.treasury = 999;
    campaign.operationWindows['the_port:p2'].consumed = true;
    expect(stageCampaignOperation(campaign, plan, manifest).errors).toContain('The Pass 2 Operation window at The Port is already spent.');
  });

  it('cancels safely, refunds treasury, and returns every reservation', () => {
    const campaign = freshCampaign(1000);
    const plan = beachhead(campaign);
    const manifest = manifestFor(campaign);
    stageCampaignOperation(campaign, plan, manifest, 2000);
    expect(cancelCampaignOperation(campaign, plan.id, 2100)).toBe(true);
    expect(campaign.treasury).toBe(OPERATION_TREASURY_SEED);
    expect(campaign.activeOperation).toBeNull();
    expect(manifest.hullIds.map((id) => campaign.motorPool.find((hull) => hull.id === id)?.status)).toEqual(['available', 'available']);
  });

  it('settles once: lost hull stays gone, survivor returns, facility persists, and window closes', () => {
    const campaign = freshCampaign(1000);
    const plan = beachhead(campaign);
    const manifest = manifestFor(campaign);
    stageCampaignOperation(campaign, plan, manifest, 2000);
    const [tankId, boatId] = manifest.hullIds;
    const result = resultFor(plan.id, [tankId], [boatId]);
    const receipt = settleCampaignOperation(campaign, result, 3000);
    expect(receipt).toMatchObject({ ok: true, duplicate: false, operationId: plan.id, effect: 'capture_airfield' });
    expect(campaign.motorPool.find((hull) => hull.id === tankId)?.status).toBe('lost');
    expect(campaign.motorPool.find((hull) => hull.id === boatId)?.status).toBe('available');
    expect(campaign.facilities).toContain('capture_airfield');
    expect(campaign.operationWindows['the_port:p2'].consumed).toBe(true);
    expect(campaign.activeOperation).toBeNull();
    const snapshot = JSON.stringify(campaign);
    expect(settleCampaignOperation(campaign, result, 4000)).toMatchObject({ ok: true, duplicate: true });
    expect(JSON.stringify(campaign)).toBe(snapshot);
  });

  it('adds target-kind kills to the named motor-pool hull during settlement', () => {
    const campaign = freshCampaign(1000);
    const plan = beachhead(campaign);
    const manifest = manifestFor(campaign);
    stageCampaignOperation(campaign, plan, manifest, 2000);
    const tankId = manifest.hullIds[0];
    const result = resultFor(plan.id, [], manifest.hullIds);
    result.hullKills = { [tankId]: { tank: 2, boat: 1, flyer: 1 } };
    settleCampaignOperation(campaign, result, 3000);
    expect(campaign.motorPool.find((hull) => hull.id === tankId)?.killsByKind).toEqual({ tank: 2, boat: 1, flyer: 1 });
  });

  it('charges collateral and pays a clean-sheet efficiency bonus', () => {
    const dirty = freshCampaign(1000);
    const dirtyPlan = beachhead(dirty, 'war_chest');
    const dirtyManifest = manifestFor(dirty);
    stageCampaignOperation(dirty, dirtyPlan, dirtyManifest);
    const dirtyResult = { ...resultFor(dirtyPlan.id, [dirtyManifest.hullIds[0]], [dirtyManifest.hullIds[1]]), collateral: 3, cleanSheet: false };
    settleCampaignOperation(dirty, dirtyResult);

    const clean = freshCampaign(1000);
    const cleanPlan = beachhead(clean, 'war_chest');
    const cleanManifest = manifestFor(clean);
    stageCampaignOperation(clean, cleanPlan, cleanManifest);
    settleCampaignOperation(clean, resultFor(cleanPlan.id, [], cleanManifest.hullIds));
    expect(clean.treasury).toBeGreaterThan(dirty.treasury);
    expect(clean.fiscalEfficiency.cleanSheets).toBe(1);
    expect(dirty.fiscalEfficiency.cleanSheets).toBe(0);
  });
});

describe('the fifty effects move strategic state', () => {
  it.each(OPERATION_EFFECTS)('$name is mechanical', (effect) => {
    const campaign = freshCampaign(1000);
    const plan = beachhead(campaign, effect.id);
    const before = strategicFingerprint(campaign);
    applyOperationEffect(campaign, plan, resultFor(plan.id), 2000);
    expect(strategicFingerprint(campaign), effect.id).not.toBe(before);
  });
});

describe('Operation armistice reset', () => {
  it('replenishes the strategic board while preserving career history', () => {
    const campaign = freshCampaign(1000);
    campaign.motorPool[0].status = 'lost';
    campaign.facilities.push('capture_airfield');
    campaign.modifiers.push({ id: 'cas_allotment', scope: 'season', uses: -1, value: 1 });
    campaign.operationHistory.push({ operationId: 'old-op', won: true, effect: 'war_chest', settledAt: 900, receipt: null });
    campaign.fiscalEfficiency.totalScore = 17;
    for (const front of FRONTS.slice(0, 6)) campaign.fronts[front.id].control = 100;
    expect(checkSeasonEnd(campaign, 2000)).not.toBeNull();
    expect(campaign.motorPool.every((hull) => hull.status === 'available')).toBe(true);
    expect(campaign.facilities).toEqual([]);
    expect(campaign.modifiers).toEqual([]);
    expect(campaign.operationHistory).toHaveLength(1);
    expect(campaign.fiscalEfficiency.totalScore).toBe(17);
    expect(Object.values(campaign.operationWindows).every((window) => !window.consumed)).toBe(true);
  });
});
