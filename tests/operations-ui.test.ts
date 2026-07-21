import { describe, expect, it } from 'vitest';
import { freshCampaign, operationWindowKey, stageCampaignOperation } from '../src/client/campaign';
import {
  buildOperationBoardModel,
  createSuggestedManifest,
  operationForFront,
  renderManifestDialog,
  renderOperationsBoard,
} from '../src/client/operations-ui';
import { validateManifest } from '../src/sim/operations';

describe('Operations board', () => {
  it('generates one stable mission from the campaign season and current front pass', () => {
    const campaign = freshCampaign(1000);
    campaign.fronts.the_port.pass = 2;
    const first = operationForFront(campaign, 'the_port');
    const second = operationForFront(campaign, 'the_port');
    expect(first).toEqual(second);
    expect(first).toMatchObject({ frontId: 'the_port', pass: 2, scale: 'standard' });
    campaign.season++;
    expect(operationForFront(campaign, 'the_port').id).not.toBe(first.id);
  });

  it('suggests a legal manifest with one available hull for every required domain', () => {
    const campaign = freshCampaign(1000);
    campaign.fronts.the_port.pass = 2;
    const plan = operationForFront(campaign, 'the_port');
    const manifest = createSuggestedManifest(plan, campaign.motorPool);
    expect(validateManifest(plan, manifest, campaign.motorPool)).toMatchObject({ ok: true });
    expect(manifest.ammunition).toBeGreaterThanOrEqual(1);
    expect(plan.authorizedSupport).toContain(manifest.support);
  });

  it('renders the operational truth: objective, domains, risk, reward, and exact cost', () => {
    const campaign = freshCampaign(1000);
    campaign.fronts.the_port.pass = 2;
    const model = buildOperationBoardModel(campaign, 'the_port');
    const html = renderOperationsBoard(model);
    expect(html).toContain(`OPERATION ${model.plan.codename}`);
    expect(html).toContain(model.plan.briefing);
    expect(html).toContain(model.complicationName);
    expect(html).toContain(model.effectName);
    for (const domain of model.plan.domains) expect(html).toContain(domain.toUpperCase());
    expect(html).toContain(`LAUNCH ${model.plan.launchCost}`);
    expect(html).toContain('PLAN MANIFEST');
  });

  it('locks a spent window and identifies an Operation already staged elsewhere', () => {
    const campaign = freshCampaign(1000);
    campaign.operationWindows[operationWindowKey('the_port', 1)].consumed = true;
    const spent = buildOperationBoardModel(campaign, 'the_port');
    expect(spent.status).toBe('spent');
    expect(renderOperationsBoard(spent)).toContain('WINDOW SPENT');

    const anotherCampaign = freshCampaign(1000);
    const otherPlan = operationForFront(anotherCampaign, 'fort_raven');
    const otherManifest = createSuggestedManifest(otherPlan, anotherCampaign.motorPool);
    expect(stageCampaignOperation(anotherCampaign, otherPlan, otherManifest, 2000).ok).toBe(true);
    const blocked = buildOperationBoardModel(anotherCampaign, 'the_port');
    expect(blocked.status).toBe('blocked');
    expect(renderOperationsBoard(blocked)).toContain(otherPlan.codename);
  });
});

describe('Manifest planner', () => {
  it('renders named hulls, support authorization, treasury math, commitment, and validation', () => {
    const campaign = freshCampaign(1000);
    campaign.fronts.the_port.pass = 2;
    const plan = operationForFront(campaign, 'the_port');
    const manifest = createSuggestedManifest(plan, campaign.motorPool);
    const html = renderManifestDialog({ campaign, plan, manifest });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('NATIONAL MOTOR POOL');
    expect(html).toContain(campaign.motorPool[0].name);
    expect(html).toContain('AMMUNITION ALLOTMENT');
    expect(html).toContain('COMMITMENT');
    expect(html).toContain('TOTAL COMMITMENT');
    expect(html).toContain('STAGE OPERATION');
    for (const support of plan.authorizedSupport) expect(html).toContain(`value="${support}"`);
  });

  it('shows exact validation failures and prevents an invalid stage action', () => {
    const campaign = freshCampaign(1000);
    const plan = operationForFront(campaign, 'the_port');
    const html = renderManifestDialog({
      campaign,
      plan,
      manifest: { hullIds: [], ammunition: 0, support: 'none' },
    });
    for (const domain of plan.domains) expect(html).toContain(`${domain.toUpperCase()} commitment requires at least 1 hull.`);
    expect(html).toContain('Commit at least 1 ammunition allotment.');
    expect(html).toMatch(/id="operation-stage"[^>]*disabled/);
  });

  it('escapes campaign-owned names before placing them in markup', () => {
    const campaign = freshCampaign(1000);
    campaign.motorPool[0].name = '<img src=x onerror=alert(1)>';
    const plan = operationForFront(campaign, 'bridge_delta');
    const manifest = createSuggestedManifest(plan, campaign.motorPool);
    const html = renderManifestDialog({ campaign, plan, manifest });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
