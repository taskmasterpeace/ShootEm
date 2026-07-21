import { scienceReward } from '../sim/science';
import { scienceObjectiveText, type ScienceMissionResult, type ScienceMissionRuntime } from '../sim/science-runtime';
import type { ScienceBonuses } from './campaign';
import { esc } from './newspaper';

export type ScienceDebrief = ScienceMissionResult & { briefing?: string };

const BONUS_LABELS: [keyof ScienceBonuses, string][] = [
  ['theaterClones', 'THEATER CLONES'],
  ['morale', 'MORALE'],
  ['openingMateriel', 'OPENING MATERIEL'],
  ['requisitionDiscounts', 'REQUISITION'],
  ['enemyReinforcementCuts', 'REINFORCEMENT CUTS'],
  ['weatherPicks', 'WEATHER PICKS'],
  ['rosterIntel', 'ROSTER INTEL'],
  ['lswAssignments', 'LSW ASSIGNMENTS'],
];

/** The Scar's visible ledger for rewards that live above an individual front. */
export function scienceCampaignBankHTML(bonuses: ScienceBonuses): string {
  return `<div class="science-bank"><h4>SCIENCE BANK</h4>${BONUS_LABELS.map(([key, label]) =>
    `<div class="bk-stat-row"><span>${label}</span><b>${bonuses[key]}</b></div>`).join('')}</div>`;
}

export function scienceMissionHTML(runtime: ScienceMissionRuntime): string {
  const alarm = runtime.alarm ? 'ALARM' : 'GHOST';
  const pips = Array.from({ length: runtime.spec.squadSize }, (_, index) =>
    `<i class="science-clone-pip${index < runtime.clonesRemaining ? ' is-live' : ' is-spent'}" aria-hidden="true"></i>`).join('');
  return `
    <div class="science-mission-kicker"><span>${esc(runtime.spec.id)}</span><b class="science-state science-state-${runtime.alarm ? 'alarm' : 'ghost'}">${alarm}</b></div>
    <h2>${esc(runtime.spec.verb.toUpperCase())} · ${esc(runtime.spec.site.replaceAll('-', ' ').toUpperCase())}</h2>
    <p class="science-objective">${esc(scienceObjectiveText(runtime))}</p>
    <div class="science-clones"><span>PRINT STOCK</span><div class="science-clone-pips">${pips}</div><b>${runtime.clonesRemaining}</b></div>
    <p class="science-reward"><span>PAYMENT</span>${esc(scienceReward(runtime.spec.reward).label)}</p>`;
}

export function scienceDebriefHTML(result: ScienceDebrief): string {
  const reward = scienceReward(result.reward);
  return `
    <section class="science-debrief ${result.won ? 'is-won' : 'is-lost'}">
      <span>OPERATION ${esc(result.id)}</span>
      <h2>${result.won ? (result.ghost ? 'GHOST RUN' : 'PACKAGE SECURED') : 'OPERATION FAILED'}</h2>
      ${result.briefing ? `<p>${esc(result.briefing)}</p>` : ''}
      <dl><div><dt>CLONES SPENT</dt><dd>${result.clonesSpent}</dd></div><div><dt>PRINTS RETURNED</dt><dd>${result.clonesRemaining}</dd></div></dl>
      <p class="science-debrief-reward"><b>${esc(reward.label.toUpperCase())}</b>${result.won ? ` — ${esc(reward.description)}` : ' — NOT RECOVERED'}</p>
    </section>`;
}

export function renderSciencePanel(root: HTMLElement, runtime?: ScienceMissionRuntime): void {
  if (!runtime) {
    root.hidden = true;
    root.classList.remove('is-alarm', 'is-ghost');
    return;
  }
  root.hidden = false;
  root.classList.toggle('is-alarm', runtime.alarm);
  root.classList.toggle('is-ghost', !runtime.alarm);
  root.innerHTML = scienceMissionHTML(runtime);
}
