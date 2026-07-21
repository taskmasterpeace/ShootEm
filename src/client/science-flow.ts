import {
  FRONTS,
  applyScienceResult,
  spendScienceWindow,
  type Campaign,
  type FrontDef,
} from './campaign';
import type { PressIssue } from './newspaper';
import { generateScienceMission, type ScienceMissionOptions, type ScienceMissionSpec } from '../sim/science';
import { scienceResult, type ScienceMissionRuntime, type ScienceMissionResult } from '../sim/science-runtime';

export interface ScienceLaunchState {
  spec: ScienceMissionSpec;
  frontId?: string;
  frontName?: string;
  finalized: boolean;
}

export interface ScienceFinalization {
  result: ScienceMissionResult;
  issue: PressIssue;
  campaignApplied: boolean;
}

export function prepareScienceMission(
  seed: number,
  front: FrontDef | null,
  squadSize: number,
  options: ScienceMissionOptions = {},
): ScienceLaunchState {
  const spec = generateScienceMission(seed, {
    ...(front ? { theme: front.theme } : {}),
    ...options,
    squadSize,
  });
  return {
    spec,
    ...(front ? { frontId: front.id, frontName: front.name } : {}),
    finalized: false,
  };
}

export function prepareScarScienceMission(
  campaign: Campaign,
  frontId: string,
  seed: number,
  squadSize: number,
  options: ScienceMissionOptions = {},
): ScienceLaunchState | null {
  const front = FRONTS.find((candidate) => candidate.id === frontId);
  const state = campaign.fronts[frontId];
  if (!front || !state || !spendScienceWindow(campaign, frontId, state.pass)) return null;
  return prepareScienceMission(seed, front, squadSize, options);
}

/** One-shot closeout. The caller persists/renders the returned issue. */
export function finalizeScienceLaunch(
  launch: ScienceLaunchState,
  runtime: ScienceMissionRuntime,
  campaign?: Campaign,
  now = Date.now(),
): ScienceFinalization | null {
  if (launch.finalized || (runtime.phase !== 'won' && runtime.phase !== 'failed')) return null;
  launch.finalized = true;
  const result = scienceResult(runtime);
  const campaignApplied = Boolean(launch.frontId && campaign
    ? applyScienceResult(campaign, launch.frontId, result, now)
    : false);
  const controlAfter = launch.frontId && campaign ? campaign.fronts[launch.frontId]?.control : undefined;
  const issue: PressIssue = {
    at: now,
    season: campaign?.season ?? 0,
    ...(launch.frontName ? { frontName: launch.frontName } : {}),
    ...(controlAfter !== undefined ? { controlAfter, controlDelta: 0 } : {}),
    won: result.won,
    modeName: 'Science Mission',
    aceName: 'Operator',
    aceKills: 0,
    longestShot: 0,
    myCost: result.clonesSpent,
    theirCost: 0,
    underdog: false,
    myKills: 0,
    theirKills: 0,
    medals: result.ghost ? ['GHOST RUN'] : [],
    science: {
      id: result.id,
      briefing: runtime.spec.briefing,
      clonesSpent: result.clonesSpent,
      clonesRemaining: result.clonesRemaining,
      ghost: result.ghost,
      reward: result.reward,
    },
  };
  return { result, issue, campaignApplied };
}
