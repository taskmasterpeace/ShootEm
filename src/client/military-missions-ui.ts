import { worldDepth, worldWidth } from '../sim/map-geometry';
import {
  MILITARY_MISSIONS,
  type MilitaryMissionId,
  type MilitaryMissionPreset,
} from '../sim/military-missions';

const escapeHtml = (value: unknown): string => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const domainName = (domain: MilitaryMissionPreset['domains'][number]): string => ({
  land: 'GROUND', air: 'AIR', sea: 'SEA',
})[domain];

export function renderMilitaryMissionModeCard(selected: boolean, selectedId: MilitaryMissionId | null = null): string {
  const mission = selectedId ? MILITARY_MISSIONS.find((entry) => entry.id === selectedId) : null;
  return `<button type="button" id="military-missions-card" class="select-card mission-launch-card${selected ? ' selected' : ''}" aria-haspopup="dialog">
    <span class="mission-kicker">${MILITARY_MISSIONS.length} THEATERS · LIVE OPERATIONS</span>
    <span class="icon" aria-hidden="true">⌖</span>
    <span class="name">MILITARY MISSIONS</span>
    <span class="desc">${mission
      ? `${escapeHtml(mission.missionName)} · ${escapeHtml(mission.theaterName)}`
      : 'City, real-city front, desert, countryside, mountain, coast, and open ocean.'}</span>
    <span class="mission-card-cta">${mission ? 'CHANGE MISSION' : 'SELECT MISSION'} →</span>
  </button>`;
}

function renderMissionCard(preset: MilitaryMissionPreset, selected: boolean): string {
  const width = worldWidth(preset.geometry);
  const depth = worldDepth(preset.geometry);
  const packageNames = preset.inventory.map((hull) => escapeHtml(hull.name)).join(' · ');
  return `<button type="button" class="mission-card${selected ? ' selected' : ''}" data-military-mission="${preset.id}" aria-pressed="${selected}">
    <span class="mission-card-top"><span class="mission-card-icon" aria-hidden="true">${escapeHtml(preset.icon)}</span><span class="mission-card-index">0${MILITARY_MISSIONS.indexOf(preset) + 1}</span></span>
    <span class="mission-card-title">${escapeHtml(preset.missionName)}</span>
    <span class="mission-card-theater">${escapeHtml(preset.theaterName)}</span>
    <span class="mission-card-tagline">${escapeHtml(preset.tagline)}</span>
    <span class="mission-card-specs">
      <span>${width}×${depth}u</span>
      <span>${preset.domains.map(domainName).join(' + ')}</span>
      <span>${preset.plan.phases.length} PHASES</span>
    </span>
    <span class="mission-card-package"><b>ISSUED PACKAGE</b>${packageNames}</span>
    <span class="mission-card-select">${selected ? 'MISSION SELECTED' : 'SELECT & RETURN TO DEPLOY'}</span>
  </button>`;
}

export function renderMilitaryMissionModal(
  selectedId: MilitaryMissionId | null,
  stagedCampaignOperation: boolean,
): string {
  return `<div id="military-missions-modal" class="op-modal-backdrop mission-modal-backdrop">
    <section class="op-modal mission-modal" role="dialog" aria-modal="true" aria-labelledby="military-missions-title" tabindex="-1">
      <header class="op-modal-head mission-modal-head">
        <div>
          <span class="mission-kicker">LOCAL FIELD EXERCISE · NO CAMPAIGN COST</span>
          <h2 id="military-missions-title">MILITARY MISSIONS</h2>
          <p>Choose a vehicle-scale battlefield. Every exercise uses the live Operation runtime, AI forces, objectives, radar, sonar, and the issued vehicle package.</p>
        </div>
        <button type="button" class="op-icon-btn" data-military-close aria-label="Close military missions">×</button>
      </header>
      <div class="mission-grid">${MILITARY_MISSIONS.map((preset) => renderMissionCard(preset, preset.id === selectedId)).join('')}</div>
      <footer class="mission-modal-foot">
        <span>${stagedCampaignOperation
          ? 'Your staged campaign Operation is protected: this field exercise does not cancel or consume it.'
          : 'Exercises are local and do not spend treasury, consume Operation windows, or alter campaign records.'}</span>
        <button type="button" class="op-secondary" data-military-close>RETURN TO DEPLOY</button>
      </footer>
    </section>
  </div>`;
}
