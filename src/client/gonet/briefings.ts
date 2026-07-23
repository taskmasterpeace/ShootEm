// ---------------------------------------------------------------------------
// BRIEFINGS — the room the GONET list promised and never had.
//
// THREE-GAMES-ONE-WAR §"The GONET laptop": *"world status, BRIEFINGS, messages,
// friends, certifications…"*
//
// The missions were always real — seven military operations and five science
// missions, each with a theatre, an objective chain, and a manifest of hulls
// issued to you. They were reachable only through a modal on the deploy screen,
// and nothing ever told you what you were walking into.
//
// A brief here does three things a mission card cannot:
//   1. names the ground, the phases and the machines you are issued
//   2. CHECKS YOUR PAPERS against those machines — the one thing that turns a
//      brief from a poster into preparation
//   3. deploys you straight into it
//
// Pure: briefs in, no DOM. The laptop renders; the host launches.
// ---------------------------------------------------------------------------
import { MILITARY_MISSIONS, type MilitaryMissionId } from '../../sim/military-missions';
import { SCIENCE_PRESETS, type SciencePresetId } from '../science-presets';
import { LICENCES, licenceFor, licenceHeld, type LicenceId } from '../../sim/licenses';
import { VEHICLES } from '../../sim/data';
import type { VehicleKind } from '../../sim/types';

export type BriefKind = 'military' | 'science';

/** One machine the mission hands you, and whether you may actually drive it. */
export interface IssuedHull {
  kind: VehicleKind;
  name: string;
  licence: LicenceId;
  licenceName: string;
  school: string;
  cleared: boolean;
}

export interface Brief {
  id: string;
  kind: BriefKind;
  icon: string;
  title: string;
  /** where it happens */
  theatre: string;
  /** the one-line pitch */
  tagline: string;
  /** the objective chain, in order */
  phases: string[];
  /** what you are issued */
  hulls: IssuedHull[];
  /** short all-caps tags — domains for an operation, the preset's own tags */
  tags: string[];
  /** the class the mission expects you in, when it says */
  role?: string;
}

const hullFor = (kind: VehicleKind, name: string, held: readonly LicenceId[]): IssuedHull => {
  const need = licenceFor(kind);
  return {
    kind, name,
    licence: need,
    licenceName: LICENCES[need].name,
    school: LICENCES[need].school,
    cleared: licenceHeld(held, kind),
  };
};

/**
 * Every brief on the board, papers checked against `held`.
 *
 * Pass the account's licences and the board tells you, before you deploy,
 * which of the machines you are being issued you cannot legally drive.
 */
export function allBriefs(held: readonly LicenceId[] = []): Brief[] {
  const out: Brief[] = [];

  for (const m of MILITARY_MISSIONS) {
    out.push({
      id: m.id,
      kind: 'military',
      icon: m.icon,
      title: m.missionName,
      theatre: m.theaterName,
      tagline: m.tagline,
      phases: m.plan.phases.map((p) => p.label),
      hulls: m.inventory.map((h) => hullFor(h.kind, h.name, held)),
      tags: m.domains.map((d) => String(d).toUpperCase()),
    });
  }

  for (const s of SCIENCE_PRESETS) {
    out.push({
      id: s.id,
      kind: 'science',
      icon: s.icon,
      title: s.title,
      theatre: 'SCIENCE SITE',
      tagline: s.description,
      // a science mission's chain is its verb and its site, which is the whole
      // shape of it: go there, do that, walk back out
      phases: [
        `${String(s.options.verb ?? 'reach').toUpperCase()} the objective`,
        'Extract',
      ],
      hulls: [],
      tags: [...s.tags],
      role: s.classLabel,
    });
  }

  return out;
}

export const briefsOfKind = (all: Brief[], kind: BriefKind): Brief[] => all.filter((b) => b.kind === kind);

/** The hulls on this brief your papers do NOT clear. */
export const uncleared = (b: Brief): IssuedHull[] => b.hulls.filter((h) => !h.cleared);

/**
 * The board's one-line readiness verdict. Says the true thing: you can still
 * take the mission — the gate is on the WHEEL, not the door — but somebody
 * else will have to drive.
 */
export function readiness(b: Brief): { ok: boolean; line: string } {
  const bad = uncleared(b);
  if (!b.hulls.length) return { ok: true, line: 'No hulls issued — you walk in.' };
  if (!bad.length) return { ok: true, line: `Cleared for all ${b.hulls.length} issued.` };
  const schools = [...new Set(bad.map((h) => h.school))].join(' · ');
  return {
    ok: false,
    line: `${bad.length} of ${b.hulls.length} issued need paper you do not hold — ${schools}. You may ride; somebody else drives.`,
  };
}

export const briefById = (all: Brief[], id: string): Brief | undefined => all.find((b) => b.id === id);

/** Counts for the desk's status board — real numbers, not a mock's guess. */
export function missionCounts(): { military: number; science: number } {
  return { military: MILITARY_MISSIONS.length, science: SCIENCE_PRESETS.length };
}

export type { MilitaryMissionId, SciencePresetId };
export const vehicleName = (kind: VehicleKind): string => VEHICLES[kind]?.name ?? String(kind);
