// ---------------------------------------------------------------------------
// W3.6 — CLASS CHANGE BY REQUEST: the leader AI rules on it. A class is not
// a lobby pick, it's a POSTING — you request it, and the officer weighs the
// line's actual composition before signing. Infantry is always approved
// (the line always needs rifles); specialists are capped by headcount so a
// five-man team never fields three medics. Pure and deterministic: same
// composition, same ruling, every time.
// ---------------------------------------------------------------------------
import type { ClassId } from './types';

export interface ClassRuling { approved: boolean; reason: string }

/** per-class cap as a function of team size (the officer's doctrine) */
function capFor(classId: ClassId, teamSize: number): number {
  switch (classId) {
    case 'infantry': return Infinity;                        // the line always needs rifles
    case 'medic': return Math.max(1, Math.floor(teamSize / 5));
    case 'engineer': return Math.max(1, Math.floor(teamSize / 6));
    case 'ghost': return Math.max(1, Math.floor(teamSize / 6));
    case 'infiltrator': return Math.max(1, Math.floor(teamSize / 6));
    case 'heavy': return Math.max(2, Math.floor(teamSize / 4));
    default: return Math.max(2, Math.floor(teamSize / 3));   // jump, pathfinder — runners
  }
}

const APPROVED: Partial<Record<ClassId, string>> = {
  infantry: 'REQUEST APPROVED — the line always needs rifles.',
  medic: 'REQUEST APPROVED — MEDIC. Keep them standing.',
  engineer: 'REQUEST APPROVED — ENGINEER. Build me something ugly.',
  heavy: 'REQUEST APPROVED — HEAVY. Bring the iron.',
  ghost: 'REQUEST APPROVED — GHOST. See everything.',
  infiltrator: 'REQUEST APPROVED — INFILTRATOR. Be nowhere.',
};

const DENIED: Partial<Record<ClassId, string>> = {
  medic: 'DENIED — the line has medics enough. Hold your post.',
  engineer: 'DENIED — one wrench per trench.',
  heavy: 'DENIED — the line cannot carry more iron.',
  ghost: 'DENIED — the shadows are crowded.',
  infiltrator: 'DENIED — the shadows are crowded.',
};

/** The ruling. `counts` is the LIVE roster by class (the requester excluded);
 *  `teamSize` includes the requester. */
export function ruleOnClassRequest(
  counts: Partial<Record<ClassId, number>>, requested: ClassId, teamSize: number,
): ClassRuling {
  const cap = capFor(requested, teamSize);
  const have = counts[requested] ?? 0;
  if (have < cap) {
    return { approved: true, reason: APPROVED[requested] ?? `REQUEST APPROVED — ${requested.toUpperCase()}.` };
  }
  return { approved: false, reason: DENIED[requested] ?? `DENIED — enough ${requested.toUpperCase()}S on the line.` };
}
