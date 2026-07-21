import { VEHICLES } from '../sim/data';
import {
  AIR_KINDS,
  LAND_KINDS,
  OPERATION_COMPLICATIONS,
  OPERATION_EFFECTS,
  SEA_KINDS,
  generateOperation,
  validateManifest,
  type OperationDomain,
  type OperationHull,
  type OperationManifest,
  type OperationPlan,
  type OperationSupport,
} from '../sim/operations';
import { FRONTS, operationWindowKey, type Campaign } from './campaign';

export type OperationBoardStatus = 'available' | 'staged' | 'spent' | 'blocked';

export interface OperationBoardModel {
  plan: OperationPlan;
  frontName: string;
  treasury: number;
  status: OperationBoardStatus;
  statusDetail: string;
  complicationName: string;
  effectName: string;
}

export interface ManifestDialogModel {
  campaign: Campaign;
  plan: OperationPlan;
  manifest: OperationManifest;
}

const DOMAIN_KINDS: Record<OperationDomain, ReadonlySet<OperationHull['kind']>> = {
  land: LAND_KINDS,
  air: AIR_KINDS,
  sea: SEA_KINDS,
};

const escapeHtml = (value: unknown): string => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

/** Stable across reloads, but rolls when the campaign advances to a new season. */
function operationSeed(campaign: Campaign, frontId: string, pass: 1 | 2 | 3): number {
  let hash = (0x811c9dc5 ^ campaign.season ^ (pass << 24)) >>> 0;
  for (const char of frontId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function operationForFront(campaign: Campaign, frontId: string): OperationPlan {
  const front = FRONTS.find((entry) => entry.id === frontId);
  const state = campaign.fronts[frontId];
  if (!front || !state) throw new Error(`Unknown campaign front '${frontId}'.`);
  return generateOperation({
    seed: operationSeed(campaign, frontId, state.pass),
    frontId,
    frontName: front.name,
    pass: state.pass,
  });
}

export function buildOperationBoardModel(campaign: Campaign, frontId: string): OperationBoardModel {
  const plan = operationForFront(campaign, frontId);
  const frontName = FRONTS.find((entry) => entry.id === frontId)!.name;
  const window = campaign.operationWindows[operationWindowKey(frontId, plan.pass)];
  const active = campaign.activeOperation;
  let status: OperationBoardStatus = 'available';
  let statusDetail = `Pass ${plan.pass} window open`;
  if (window?.consumed) {
    status = 'spent';
    statusDetail = `Pass ${plan.pass} window spent`;
  } else if (active?.plan.id === plan.id) {
    status = 'staged';
    statusDetail = `${active.manifest.hullIds.length} hulls committed · ${active.charged} materiel charged`;
  } else if (active) {
    status = 'blocked';
    statusDetail = `Operation ${active.plan.codename} is already staged at ${FRONTS.find((entry) => entry.id === active.plan.frontId)?.name ?? active.plan.frontId}`;
  }
  return {
    plan,
    frontName,
    treasury: campaign.treasury,
    status,
    statusDetail,
    complicationName: OPERATION_COMPLICATIONS.find((entry) => entry.id === plan.complication)!.name,
    effectName: OPERATION_EFFECTS.find((entry) => entry.id === plan.effect)!.name,
  };
}

export function createSuggestedManifest(plan: OperationPlan, inventory: readonly OperationHull[]): OperationManifest {
  const hullIds: string[] = [];
  for (const domain of plan.domains) {
    const required = plan.requirements[domain] ?? 0;
    const candidates = inventory
      .filter((hull) => hull.status === 'available' && DOMAIN_KINDS[domain].has(hull.kind) && !hullIds.includes(hull.id))
      .sort((a, b) => ((VEHICLES[a.kind]?.cost ?? 1) - (VEHICLES[b.kind]?.cost ?? 1)) || a.name.localeCompare(b.name));
    hullIds.push(...candidates.slice(0, required).map((hull) => hull.id));
  }
  return { hullIds, ammunition: 1, support: plan.authorizedSupport[0] ?? 'none' };
}

function domainLabel(kind: OperationHull['kind']): string {
  if (AIR_KINDS.has(kind)) return 'AIR';
  if (SEA_KINDS.has(kind)) return 'SEA';
  return 'LAND';
}

function statusAction(model: OperationBoardModel): string {
  switch (model.status) {
    case 'available': return '<button class="op-primary" id="operation-plan">PLAN MANIFEST</button>';
    case 'staged': return '<button class="op-primary" id="operation-deploy">DEPLOY OPERATION</button><button class="op-secondary" id="operation-cancel">CANCEL &amp; REFUND</button>';
    case 'spent': return '<button class="op-primary" disabled>WINDOW SPENT</button>';
    case 'blocked': return '<button class="op-primary" disabled>ANOTHER OPERATION STAGED</button>';
  }
}

export function renderOperationsBoard(model: OperationBoardModel): string {
  const { plan } = model;
  const phases = plan.phases.map((phase, index) =>
    `<li><span class="op-phase-index mono">${String(index + 1).padStart(2, '0')}</span><span><b>${escapeHtml(phase.label)}</b><small>${escapeHtml(phase.kind.toUpperCase())} · ${escapeHtml(phase.domain.toUpperCase())}</small></span></li>`).join('');
  const domains = plan.domains.map((domain) => `<span class="op-domain op-domain-${domain}">${escapeHtml(domain.toUpperCase())}</span>`).join('');
  return `<section class="op-card brk ${model.status === 'staged' ? 'sel' : ''}" data-operation="${escapeHtml(plan.id)}">
    <header class="op-head">
      <div><span class="op-eyebrow">MILITARY OPERATION · PASS ${plan.pass}</span><h3>OPERATION ${escapeHtml(plan.codename)}</h3></div>
      <div class="op-scale">${escapeHtml(plan.scale.toUpperCase())}</div>
    </header>
    <div class="op-domains">${domains}</div>
    <p class="op-brief">${escapeHtml(plan.briefing)}</p>
    <ol class="op-phases">${phases}</ol>
    <dl class="op-intel">
      <div><dt>RISK</dt><dd>${escapeHtml(model.complicationName)}</dd></div>
      <div><dt>REWARD</dt><dd>${escapeHtml(model.effectName)}</dd></div>
      <div><dt>COMMAND COST</dt><dd class="mono">LAUNCH ${plan.launchCost} · TREASURY ${model.treasury}</dd></div>
    </dl>
    <p class="op-status op-status-${model.status}">${escapeHtml(model.statusDetail)}</p>
    <div class="op-actions">${statusAction(model)}</div>
  </section>`;
}

function supportLabel(support: OperationSupport): string {
  return support === 'none' ? 'No external support' : support === 'cas' ? 'Close Air Support' : 'Artillery support';
}

export function renderManifestDialog({ campaign, plan, manifest }: ManifestDialogModel): string {
  const validation = validateManifest(plan, manifest, campaign.motorPool);
  const total = plan.launchCost + validation.cost;
  const affordable = campaign.treasury >= total;
  const errors = [...validation.errors, ...(!affordable ? ['National treasury cannot fund this Operation.'] : [])];
  const selected = new Set(manifest.hullIds);
  const hulls = campaign.motorPool.map((hull) => {
    const checked = selected.has(hull.id);
    const unavailable = hull.status !== 'available' && !checked;
    return `<label class="op-hull ${unavailable ? 'unavailable' : ''}">
      <input type="checkbox" data-operation-hull="${escapeHtml(hull.id)}" ${checked ? 'checked' : ''} ${unavailable ? 'disabled' : ''}>
      <span class="op-hull-call">${escapeHtml(hull.name)}</span>
      <span class="op-hull-type">${domainLabel(hull.kind)} · ${escapeHtml(VEHICLES[hull.kind].name)}</span>
      <span class="op-hull-cost mono">${VEHICLES[hull.kind].cost}</span>
    </label>`;
  }).join('');
  const supports = plan.authorizedSupport.map((support) =>
    `<option value="${support}" ${manifest.support === support ? 'selected' : ''}>${escapeHtml(supportLabel(support))}</option>`).join('');
  const errorHtml = errors.length
    ? `<ul class="op-errors">${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`
    : '<p class="op-ready">MANIFEST VALIDATED · COMMAND AUTHORIZED</p>';
  return `<div class="op-modal-backdrop" id="operation-modal" role="dialog" aria-modal="true" aria-labelledby="operation-modal-title">
    <section class="op-modal brk">
      <header class="op-modal-head">
        <div><span class="op-eyebrow">NATIONAL MOTOR POOL · ${escapeHtml(plan.scale.toUpperCase())}</span><h2 id="operation-modal-title">MANIFEST · ${escapeHtml(plan.codename)}</h2></div>
        <button id="operation-close" class="op-icon-btn" aria-label="Close manifest planner">×</button>
      </header>
      <p class="op-requirement">Required: ${plan.domains.map((domain) => `${plan.requirements[domain] ?? 0} ${domain.toUpperCase()}`).join(' · ')}</p>
      <div class="op-hulls" aria-label="National motor pool">${hulls}</div>
      <div class="op-logistics">
        <label>AMMUNITION ALLOTMENT<input id="operation-ammo" class="mono" type="number" min="1" max="20" step="1" value="${manifest.ammunition}"></label>
        <label>AUTHORIZED SUPPORT<select id="operation-support">${supports}</select></label>
      </div>
      <div class="op-cost-grid">
        <span>Launch <b class="mono">${plan.launchCost}</b></span>
        <span>Manifest <b class="mono">${validation.cost}</b></span>
        <span>COMMITMENT <b>${validation.commitment.toUpperCase()}</b></span>
        <span>TOTAL COMMITMENT <b class="mono">${total} / ${campaign.treasury}</b></span>
      </div>
      ${errorHtml}
      <footer class="op-modal-actions">
        <button id="operation-abort" class="op-secondary">RETURN TO THE SCAR</button>
        <button id="operation-stage" class="op-primary" ${errors.length ? 'disabled' : ''}>STAGE OPERATION · ${total}</button>
      </footer>
    </section>
  </div>`;
}
