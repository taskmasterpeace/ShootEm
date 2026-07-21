import { Rng } from './rng';
import type { ThemeId } from './types';

export const SCIENCE_VERBS = [
  'assassinate', 'steal', 'raid', 'deny', 'rescue',
  'infiltrate', 'ambush', 'hold', 'hunt', 'decapitate',
] as const;
export type ScienceVerb = typeof SCIENCE_VERBS[number];

export const SCIENCE_SITES = [
  'clone-vault', 'research-annex', 'rail-yard', 'comms-relay', 'field-hospital',
  'foundry', 'buried-archive', 'enemy-airfield', 'officer-villa', 'quarantine-zone',
] as const;
export type ScienceSite = typeof SCIENCE_SITES[number];

export const SCIENCE_COMPLICATIONS = [
  'alarm-net', 'god-on-guard', 'storm', 'third-party', 'no-kill', 'one-life',
] as const;
export type ScienceComplication = typeof SCIENCE_COMPLICATIONS[number];

export const SCIENCE_REWARDS = [
  { id: 'front-reinforcement', label: 'Front Reinforcement', description: 'Print 40 clones into this front.' },
  { id: 'theater-reinforcement', label: 'Theater Reinforcement', description: 'Bank 25 clones in the theater reserve.' },
  { id: 'enemy-clone-drain', label: 'Enemy Clone Drain', description: 'Drain 30 prints from the opposing reserve.' },
  { id: 'clone-insurance', label: 'Spawn-Death Insurance', description: 'The next early death does not burn a front clone.' },
  { id: 'front-breakthrough', label: 'Front Breakthrough', description: 'Move front control six points toward the United Front.' },
  { id: 'morale-cache', label: 'Morale Cache', description: 'Bank one point of campaign morale.' },
  { id: 'opening-materiel', label: 'Opening Materiel', description: 'Open the next battle with two extra materiel.' },
  { id: 'requisition-discount', label: 'Requisition Discount', description: 'Reduce the next vehicle requisition bill.' },
  { id: 'deny-reinforcements', label: 'Deny Reinforcements', description: 'Cut the next enemy reinforcement wave.' },
  { id: 'weather-pick', label: 'Weather Authority', description: 'Choose the next front weather.' },
  { id: 'roster-intel', label: 'Roster Preview', description: 'Reveal the next enemy roster before deployment.' },
  { id: 'lsw-assignment', label: 'LSW Assignment Rights', description: 'Choose which front receives the next friendly god.' },
] as const;

export type ScienceRewardId = typeof SCIENCE_REWARDS[number]['id'];
export type ScienceReward = typeof SCIENCE_REWARDS[number];

export interface ScienceMissionSpec {
  id: string;
  seed: number;
  verb: ScienceVerb;
  site: ScienceSite;
  theme: ThemeId;
  complication?: ScienceComplication;
  reward: ScienceRewardId;
  squadSize: number;
  briefing: string;
}

export interface ScienceMissionOptions {
  verb?: ScienceVerb;
  site?: ScienceSite;
  theme?: ThemeId;
  complication?: ScienceComplication | null;
  reward?: ScienceRewardId;
  squadSize?: number;
}

const SITE_LABEL: Record<ScienceSite, string> = {
  'clone-vault': 'clone vault',
  'research-annex': 'research annex',
  'rail-yard': 'rail yard',
  'comms-relay': 'comms relay',
  'field-hospital': 'field hospital',
  foundry: 'foundry',
  'buried-archive': 'buried archive',
  'enemy-airfield': 'enemy airfield',
  'officer-villa': "officer's villa",
  'quarantine-zone': 'quarantine zone',
};

const SITE_THEME: Record<ScienceSite, ThemeId> = {
  'clone-vault': 'triton',
  'research-annex': 'starship',
  'rail-yard': 'titan',
  'comms-relay': 'savanna',
  'field-hospital': 'europa',
  foundry: 'asteroid',
  'buried-archive': 'asteroid',
  'enemy-airfield': 'savanna',
  'officer-villa': 'titan',
  'quarantine-zone': 'europa',
};

const VERB_JOB: Record<ScienceVerb, string> = {
  assassinate: 'assassinate the named officer',
  steal: 'steal the program core',
  raid: 'raid every clone crate you can reach',
  deny: 'deny the program by arming its demolition points',
  rescue: 'rescue the captive researchers',
  infiltrate: 'infiltrate the terminal without being seen',
  ambush: 'ambush the convoy before it clears the site',
  hold: 'hold the uplink until extraction locks',
  hunt: 'hunt the loose asset',
  decapitate: 'eliminate three officers before they can scatter',
};

const COMPLICATION_COPY: Record<ScienceComplication, string> = {
  'alarm-net': 'an alarm net covers the approaches',
  'god-on-guard': 'a god walks the perimeter',
  storm: 'a storm is closing over the site',
  'third-party': 'a third party is already fighting inside',
  'no-kill': 'command has imposed a no-kill clause',
  'one-life': 'the printer has one viable sleeve',
};

export function scienceSiteLabel(site: ScienceSite): string {
  return SITE_LABEL[site];
}

export function scienceReward(id: ScienceRewardId): ScienceReward {
  return SCIENCE_REWARDS.find((reward) => reward.id === id)!;
}

function briefingFor(verb: ScienceVerb, site: ScienceSite, complication?: ScienceComplication): string {
  const base = `${VERB_JOB[verb]} at the ${SITE_LABEL[site]}`;
  return `${base}${complication ? ` — ${COMPLICATION_COPY[complication]}` : ''}.`;
}

export function generateScienceMission(seed: number, options: ScienceMissionOptions = {}): ScienceMissionSpec {
  const stableSeed = seed >>> 0;
  const rng = new Rng(stableSeed ^ 0x51c1e);
  const verb = options.verb ?? SCIENCE_VERBS[rng.int(0, SCIENCE_VERBS.length - 1)];
  const site = options.site ?? SCIENCE_SITES[rng.int(0, SCIENCE_SITES.length - 1)];
  const rolledComplication = rng.next() < 0.55
    ? SCIENCE_COMPLICATIONS[rng.int(0, SCIENCE_COMPLICATIONS.length - 1)]
    : undefined;
  const complication = options.complication === null
    ? undefined
    : (options.complication ?? rolledComplication);
  const requestedSquad = Number.isFinite(options.squadSize) ? Math.round(options.squadSize!) : 4;
  const squadSize = complication === 'one-life' ? 1 : Math.max(1, Math.min(8, requestedSquad));
  const reward = options.reward ?? SCIENCE_REWARDS[rng.int(0, SCIENCE_REWARDS.length - 1)].id;
  const id = `SM-${stableSeed.toString(36).toUpperCase().padStart(4, '0').slice(-4)}`;

  return {
    id,
    seed: stableSeed,
    verb,
    site,
    theme: options.theme ?? SITE_THEME[site],
    ...(complication ? { complication } : {}),
    reward,
    squadSize,
    briefing: briefingFor(verb, site, complication),
  };
}

export function validateScienceMission(spec: ScienceMissionSpec): string[] {
  const issues: string[] = [];
  if (!spec.id?.trim()) issues.push('mission id is required');
  if (!SCIENCE_VERBS.includes(spec.verb)) issues.push(`unknown verb: ${String(spec.verb)}`);
  if (!SCIENCE_SITES.includes(spec.site)) issues.push(`unknown site: ${String(spec.site)}`);
  if (spec.complication !== undefined && !SCIENCE_COMPLICATIONS.includes(spec.complication)) {
    issues.push(`unknown complication: ${String(spec.complication)}`);
  }
  if (!SCIENCE_REWARDS.some((reward) => reward.id === spec.reward)) {
    issues.push(`unknown reward: ${String(spec.reward)}`);
  }
  if (!Number.isInteger(spec.squadSize) || spec.squadSize < 1 || spec.squadSize > 8) {
    issues.push('squad size must be an integer from 1 to 8');
  }
  if (!spec.briefing?.trim()) issues.push('briefing is required');
  return issues;
}
