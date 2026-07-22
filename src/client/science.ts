import { scienceReward } from '../sim/science';
import { scienceObjectiveText, type ScienceMissionResult, type ScienceMissionRuntime } from '../sim/science-runtime';
import type { ScienceBonuses } from './campaign';
import { esc } from './newspaper';

export interface ScienceWaypointPresentation {
  id: string;
  kind: 'insertion' | 'objective' | 'extraction' | 'report';
  label: string;
  x: number;
  y: number;
  z: number;
  floor: number;
  floorDelta: number;
  color: number;
}

const WAYPOINT_COLOR: Record<ScienceWaypointPresentation['kind'], number> = {
  insertion: 0x54dce8,
  objective: 0xf1ba55,
  report: 0xf06a43,
  extraction: 0x69d391,
};

/** Stable mission markers: every marker on this floor plus the next required
 * marker above or below it, so a stair transition never loses the objective. */
export function activeScienceWaypoints(runtime: ScienceMissionRuntime, actorFloor: number): ScienceWaypointPresentation[] {
  const active = runtime.missionWaypoints.filter((waypoint) => waypoint.active);
  const sameFloor = active.filter((waypoint) => waypoint.floor === actorFloor);
  const priority = { report: 0, objective: 1, extraction: 2, insertion: 3 } as const;
  const nextOtherFloor = active
    .filter((waypoint) => waypoint.floor !== actorFloor)
    .sort((a, b) => priority[a.kind] - priority[b.kind] || Math.abs(a.floor - actorFloor) - Math.abs(b.floor - actorFloor))[0];
  const visible = nextOtherFloor ? [...sameFloor, nextOtherFloor] : sameFloor;
  return visible.map((waypoint) => {
    const floorDelta = waypoint.floor - actorFloor;
    return {
      id: waypoint.id,
      kind: waypoint.kind,
      label: `${waypoint.label}${floorDelta > 0 ? ' ▲' : floorDelta < 0 ? ' ▼' : ''}`,
      x: waypoint.pos.x,
      y: waypoint.pos.y,
      z: waypoint.pos.z,
      floor: waypoint.floor,
      floorDelta,
      color: WAYPOINT_COLOR[waypoint.kind],
    };
  });
}

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
  const awareness = runtime.awareness === 'alarmed' ? 'ALARMED'
    : runtime.awareness === 'searching' ? 'SEARCHING' : 'GHOST';
  const pips = Array.from({ length: runtime.spec.squadSize }, (_, index) =>
    `<i class="science-clone-pip${index < runtime.clonesRemaining ? ' is-live' : ' is-spent'}" aria-hidden="true"></i>`).join('');
  return `
    <div class="science-mission-kicker"><span>${esc(runtime.spec.id)}</span><b class="science-state science-state-${runtime.awareness}">${awareness}</b></div>
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
    root.classList.remove('is-alarm', 'is-ghost', 'is-searching');
    return;
  }
  root.hidden = false;
  root.classList.toggle('is-alarm', runtime.alarm);
  root.classList.toggle('is-searching', runtime.awareness === 'searching');
  root.classList.toggle('is-ghost', runtime.awareness === 'ghost');
  root.innerHTML = scienceMissionHTML(runtime);
}
