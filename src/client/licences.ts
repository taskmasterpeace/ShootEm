// ---------------------------------------------------------------------------
// YOUR PAPERS — the licences this ACCOUNT holds.
//
// Canon (THREE-GAMES-ONE-WAR §Prints): the account owns certifications; a
// print owns its body. So licences live here, beside identity, and they
// survive every death you will ever have. Earned at the schools
// (sim/courses.ts) — never bought, never granted by a level.
// ---------------------------------------------------------------------------
import { LICENCES, licenceChain, type LicenceId } from '../sim/licenses';

const KEY = 'ww_licences';

export interface LicenceRecord {
  /** the papers you hold */
  held: LicenceId[];
  /** best course time per licence, seconds — the thing to beat on run two */
  best: Record<string, number>;
}

/** storage seam — the vitest env drops writes, so tests inject memory. */
export const licenceStorage = {
  get(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v: string): void { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
};

export function loadLicences(): LicenceRecord {
  try {
    const raw = JSON.parse(licenceStorage.get() ?? '{}') as Partial<LicenceRecord>;
    const held = Array.isArray(raw.held) ? raw.held.filter((h): h is LicenceId => !!LICENCES[h as LicenceId]) : [];
    return { held, best: raw.best ?? {} };
  } catch { return { held: [], best: {} }; }
}

function save(r: LicenceRecord): void {
  licenceStorage.set(JSON.stringify(r));
}

/** Sign the papers. Awards the whole chain — you cannot hold Bomber without
 *  Fixed Wing, and a school that passes you on the top course has, by
 *  definition, seen you fly the ones beneath it. */
export function awardLicence(id: LicenceId, seconds?: number): LicenceRecord {
  const r = loadLicences();
  for (const step of licenceChain(id)) if (!r.held.includes(step)) r.held.push(step);
  if (seconds !== undefined) {
    const prev = r.best[id];
    if (prev === undefined || seconds < prev) r.best[id] = seconds;
  }
  save(r);
  return r;
}

export function holdsLicence(id: LicenceId): boolean {
  if (id === 'none') return true;
  return loadLicences().held.includes(id);
}

/** Can this account ENROL on a course? You take them in order — the school
 *  will not put an unlicensed driver in a bomber. */
export function canEnrol(id: LicenceId): boolean {
  const chain = licenceChain(id);
  const held = loadLicences().held;
  // every step BEFORE this one must already be signed
  return chain.slice(0, -1).every((step) => held.includes(step));
}

/** Wipe the record — the re-enlistment door, and the tests'. */
export function clearLicences(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
