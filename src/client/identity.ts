// ---------------------------------------------------------------------------
// THE ENLISTEE — who the player IS, persisted across sessions.
//
// Character creation is Pattern registration (META-LAYER §5 "the character is
// the root"): pick your COUNTRY → the sheet assigns your FACTION, name your
// soldier, say where you're from. The country gives identity; the faction it
// leans (derived in src/data/nations.ts) gives you a side. This is client-only
// biography — it never enters the deterministic sim, so wall-clock is fine.
// ---------------------------------------------------------------------------
import { NATIONS_BY_CODE, type Nation, type NationFaction } from '../data/nations';
import type { Team } from '../sim/types';

const KEY = 'ww_identity';

export interface PlayerIdentity {
  /** The soldier's name / callsign. */
  callsign: string;
  /** Canonical country code (src/data/nations.ts). */
  nationCode: number;
  /** Where they're from — free text, seeded from the nation's real cities. */
  hometown: string;
  /** The faction the nation leans, DERIVED at nation-load, frozen at enlistment. */
  faction: NationFaction;
  /** When they enlisted (client clock — biography, not sim). */
  created: number;
}

/** TEAM_NAMES order in src/sim/data.ts is [United Front, Collective]. */
export function factionTeam(faction: NationFaction): Team {
  return faction === 'collective' ? 1 : 0;
}

export function factionLabel(faction: NationFaction): string {
  return faction === 'collective' ? 'The Collective' : 'The United Front';
}

/** One line on WHY the nation fights where it does — the doctrine, in the
 *  faction's own voice. Surfaced on the enlistment reveal. */
export function factionDoctrine(faction: NationFaction): string {
  return faction === 'collective'
    ? 'Machine doctrine — unmanned, asymmetric, and it BUILT the living super weapons it fields.'
    : 'Combined arms — armor, infantry and K9s, and it keeps its weapons on a tight leash.';
}

export function loadIdentity(): PlayerIdentity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const id = JSON.parse(raw) as PlayerIdentity;
    // trust nothing a hand-edit could have broken (a bad record must not brick boot)
    if (id && typeof id === 'object'
      && typeof id.callsign === 'string' && id.callsign.trim()
      && NATIONS_BY_CODE[id.nationCode]
      && (id.faction === 'collective' || id.faction === 'united_front')) {
      return id;
    }
  } catch { /* fresh recruit / private mode */ }
  return null;
}

export function saveIdentity(id: PlayerIdentity): void {
  try { localStorage.setItem(KEY, JSON.stringify(id)); } catch { /* private mode */ }
}

export function clearIdentity(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export function hasIdentity(): boolean {
  return loadIdentity() !== null;
}

/** The Nation record behind an identity (or undefined if the data changed under it). */
export function nationOf(id: PlayerIdentity): Nation | undefined {
  return NATIONS_BY_CODE[id.nationCode];
}
