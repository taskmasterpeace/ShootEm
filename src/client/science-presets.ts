import type { ClassId } from '../sim/types';
import type { ScienceMissionOptions } from '../sim/science';
import { prepareScienceMission, type ScienceLaunchState } from './science-flow';

export type SciencePresetId =
  | 'k9-house-clear'
  | 'researcher-rescue'
  | 'clone-vault-raid'
  | 'quarantine-sweep'
  | 'airfield-ambush';

export interface SciencePreset {
  id: SciencePresetId;
  icon: string;
  title: string;
  description: string;
  classId: ClassId;
  classLabel: string;
  seed: number;
  tags: readonly string[];
  options: ScienceMissionOptions;
}

export const SCIENCE_PRESETS: readonly SciencePreset[] = [
  {
    id: 'k9-house-clear', icon: '◆', title: 'K9 House Clear',
    description: 'Send your dog through an officer villa, open its doors, and hunt the asset upstairs.',
    classId: 'infantry', classLabel: 'INFANTRY HANDLER', seed: 7331,
    tags: ['K9 COMMANDS', 'UPPER FLOOR', 'DOORS + GLASS'],
    options: { verb: 'hunt', site: 'officer-villa', complication: null, theme: 'titan', reward: 'roster-intel' },
  },
  {
    id: 'researcher-rescue', icon: '✚', title: 'Researcher Rescue',
    description: 'Breach a research annex, attach the captives, and walk every scientist back out.',
    classId: 'medic', classLabel: 'FIELD MEDIC', seed: 12017,
    tags: ['CAPTIVES', 'ESCORT', 'EXTRACTION'],
    options: { verb: 'rescue', site: 'research-annex', complication: null, theme: 'starship', reward: 'theater-reinforcement' },
  },
  {
    id: 'clone-vault-raid', icon: '▦', title: 'Clone Vault Raid',
    description: 'Crack every store in a fortified vault before the alarm response seals the site.',
    classId: 'engineer', classLabel: 'COMBAT ENGINEER', seed: 23011,
    tags: ['3 OBJECTIVES', 'ALARM NET', 'RESPONSE WAVE'],
    options: { verb: 'raid', site: 'clone-vault', complication: 'alarm-net', theme: 'triton', reward: 'clone-insurance' },
  },
  {
    id: 'quarantine-sweep', icon: '☣', title: 'Quarantine Sweep',
    description: 'Arm the denial points while security and the infected tear into each other around you.',
    classId: 'heavy', classLabel: 'HEAVY WEAPONS', seed: 41203,
    tags: ['ZOMBIES', 'DEMOLITION', 'CROSSFIRE'],
    options: { verb: 'deny', site: 'quarantine-zone', complication: 'third-party', theme: 'europa', reward: 'deny-reinforcements' },
  },
  {
    id: 'airfield-ambush', icon: '⌁', title: 'Airfield Ambush',
    description: 'Hit the moving convoy at an enemy airfield before the transport clears the kill box.',
    classId: 'heavy', classLabel: 'HEAVY WEAPONS', seed: 53017,
    tags: ['MOVING CONVOY', 'VEHICLES', 'OPEN GROUND'],
    options: { verb: 'ambush', site: 'enemy-airfield', complication: null, theme: 'savanna', reward: 'opening-materiel' },
  },
] as const;

export function prepareSciencePreset(preset: SciencePreset): ScienceLaunchState {
  return prepareScienceMission(preset.seed, null, 8, preset.options);
}

const escapeHTML = (value: string) => value.replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]!));

export function sciencePresetCardHTML(preset: SciencePreset): string {
  const tags = preset.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join('');
  return `<button class="science-preset-card" type="button" data-science-preset="${preset.id}">`
    + `<span class="science-preset-icon" aria-hidden="true">${escapeHTML(preset.icon)}</span>`
    + '<span class="science-preset-copy">'
    + `<strong>${escapeHTML(preset.title)}</strong>`
    + `<small>${escapeHTML(preset.description)}</small>`
    + `<em>${escapeHTML(preset.classLabel)}</em>`
    + `<span class="science-preset-tags">${tags}</span>`
    + '</span><span class="science-preset-go">DEPLOY <b>›</b></span></button>';
}
