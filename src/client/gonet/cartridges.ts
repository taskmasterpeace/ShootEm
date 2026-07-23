// ═══════════════════════════════════════════════════════════════════════════
// THE DECK — and the cartridges.
//
// Robert: *"I wanna add games that's not a sport game. A game that don't
// increase your skill — you get good at it, it won't make you better at this.
// Imagine little Atari-type video game systems, a mock video game system
// inside of this, with different cartridges. I don't wanna call it video
// games. Propose a way we can fit it into this world."*
//
// ── THE PROPOSAL ──────────────────────────────────────────────────────────
//
// WHAT IT IS. Every soldier is issued a **DECK** — a scuffed, indestructible
// handheld about the size of a paperback, in ministry olive with a serial
// stencilled on the back. It plays **CARTRIDGES**. It is the only thing in a
// soldier's kit that is not for the war.
//
// WHY IT EXISTS IN-WORLD. A print deploys for months at a time and the
// ministry worked out, expensively, that a body that never stops being a
// soldier stops being a good one. The Deck is a morale device with a
// requisition number. That is the joke and it is also true: **the army issues
// you a toy because the army did the maths.**
//
// WHERE IT LIVES. Your footlocker — so on the laptop it lives beside MUSIC and
// BROADCAST, in the part of the GONET that is not the war. Same place a
// soldier keeps their things.
//
// THE LAW, and it is the whole point:
//
//     A SPORT MAKES YOU BETTER AT THE WAR. A CARTRIDGE DOES NOT.
//
// No cartridge grants a skill, a stat, a licence or a rank. Getting good at
// one is worth exactly nothing on a battlefield — which is precisely why it
// works: it is the only activity in the game with no instrumental value, and
// that is what makes it REST. What it does give is MORALE (a real system now),
// a high-score table, and the cartridges themselves as objects worth having.
//
// HOW YOU GET THEM. Never a shop-first economy:
//   · ISSUED — two come with the Deck.
//   · FOUND — in wrecks, footlockers, abandoned buildings. A cartridge in a
//     dead man's kit is a small story.
//   · TRADED — the most social object in the game; you have doubles.
//   · AWARDED — a decoration nobody at the ministry thinks is a decoration.
//
// The games themselves are Robert's — this file is the SHELF they sit on: the
// registry, the save data, the high scores, and the contract a cartridge
// implements to be playable inside the Deck.
// ═══════════════════════════════════════════════════════════════════════════

export type CartridgeId = string;

/** How a cartridge came into your hands — half the pleasure is the story. */
export type Provenance = 'issued' | 'found' | 'traded' | 'awarded';

export interface Cartridge {
  id: CartridgeId;
  /** the title on the label */
  title: string;
  /** the fictional studio — the world had a games industry before the war */
  maker: string;
  /** the year it shipped, in this timeline */
  year: number;
  /** the back-of-the-box line */
  blurb: string;
  /** what a session is scored in — points, depth, time survived… */
  scoreUnit: string;
  /** how the label looks: a two-colour scheme, no art assets needed */
  label: { ink: string; base: string };
  /** rarity drives how often it turns up in a wreck */
  rarity: 'common' | 'uncommon' | 'rare';
}

/**
 * THE SHELF. Five cartridges to prove the shape — a launch line-up in the
 * voice of a world that had an arcade industry and then had a war.
 *
 * The titles are deliberately period-cheap: this is not prestige software, it
 * is what was in the shops.
 */
export const CARTRIDGES: Cartridge[] = [
  {
    id: 'orbit_run', title: 'ORBIT RUN', maker: 'Maklov Amusements', year: 2196,
    blurb: 'Thread the belt. Do not touch the rocks. The rocks are everywhere.',
    scoreUnit: 'POINTS', label: { ink: '#e8a33d', base: '#1a1712' }, rarity: 'common',
  },
  {
    id: 'deep_shaft', title: 'DEEP SHAFT', maker: 'Kuchler Home', year: 2201,
    blurb: 'Dig down. Something down there is digging up.',
    scoreUnit: 'METRES', label: { ink: '#6fbf73', base: '#101512' }, rarity: 'common',
  },
  {
    id: 'harvest_88', title: 'HARVEST 88', maker: 'Green March Software', year: 2188,
    blurb: 'Four seasons a year. Bring the crop in before the frost.',
    scoreUnit: 'TONNES', label: { ink: '#d6c37a', base: '#171509' }, rarity: 'uncommon',
  },
  {
    id: 'siege_tower', title: 'SIEGE TOWER', maker: 'Maklov Amusements', year: 2199,
    blurb: 'Stack it higher. It is going to fall. Stack it higher.',
    scoreUnit: 'FLOORS', label: { ink: '#8fb8d8', base: '#0f1318' }, rarity: 'common',
  },
  {
    id: 'nightwatch', title: 'NIGHTWATCH', maker: 'Odessa Grey Interactive', year: 2207,
    blurb: 'You have one torch and eight hours. Do not look behind you twice.',
    scoreUnit: 'HOURS', label: { ink: '#c98b8b', base: '#150f0f' }, rarity: 'rare',
  },
];

export const cartridgeById = (id: CartridgeId): Cartridge | undefined =>
  CARTRIDGES.find((c) => c.id === id);

/** What the Deck ships with. Everything else has to be found. */
export const ISSUED: CartridgeId[] = ['orbit_run', 'siege_tower'];

// ── THE FOOTLOCKER (save data) ─────────────────────────────────────────────

export interface DeckSave {
  /** cartridges you hold, and how each arrived */
  owned: Record<CartridgeId, Provenance>;
  /** your best, per cartridge */
  best: Record<CartridgeId, number>;
  /** total sessions played — the morale system reads this */
  sessions: number;
  /** the last one in the slot */
  inSlot?: CartridgeId;
}

const KEY = 'ww.deck.v1';

export function defaultDeck(): DeckSave {
  const owned: Record<CartridgeId, Provenance> = {};
  for (const id of ISSUED) owned[id] = 'issued';
  return { owned, best: {}, sessions: 0, inSlot: ISSUED[0] };
}

export function loadDeck(): DeckSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultDeck();
    const p = JSON.parse(raw) as Partial<DeckSave>;
    const base = defaultDeck();
    const owned = { ...base.owned, ...(p.owned ?? {}) };
    // a cartridge that left the shelf leaves your locker with it
    for (const id of Object.keys(owned)) if (!cartridgeById(id)) delete owned[id];
    return {
      owned,
      best: p.best ?? {},
      sessions: Math.max(0, p.sessions ?? 0),
      inSlot: p.inSlot && owned[p.inSlot] ? p.inSlot : Object.keys(owned)[0],
    };
  } catch { return defaultDeck(); }
}

export function saveDeck(d: DeckSave): void {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode */ }
}

export const owns = (d: DeckSave, id: CartridgeId): boolean => !!d.owned[id];
export const ownedCartridges = (d: DeckSave): Cartridge[] =>
  CARTRIDGES.filter((c) => owns(d, c.id));

/**
 * File a session. Returns true if it was a personal best.
 *
 * Guards the score: a NaN sails past `<=` and would enshrine itself as an
 * unbeatable best, and an Infinity would print as garbage on the shelf.
 */
export function fileScore(d: DeckSave, id: CartridgeId, score: number): boolean {
  if (!cartridgeById(id)) return false;
  d.sessions++;
  if (!Number.isFinite(score) || score < 0) return false;
  const prev = d.best[id] ?? 0;
  if (score <= prev) return false;
  d.best[id] = Math.floor(score);
  return true;
}

/** A cartridge turns up. Returns false if you already had it (a double). */
export function acquire(d: DeckSave, id: CartridgeId, how: Provenance): boolean {
  if (!cartridgeById(id) || d.owned[id]) return false;
  d.owned[id] = how;
  return true;
}

/**
 * THE ONLY THING IT GIVES YOU. Playing the Deck steadies a soldier — not
 * because the game taught them anything, but because for twenty minutes they
 * were not in a war. Small, capped, and deliberately not a skill.
 */
export const DECK_MORALE = 6;

/** What the locker is worth saying out loud on the desk. */
export function deckLine(d: DeckSave): string {
  const held = ownedCartridges(d).length;
  if (!d.sessions) return `${held} cartridges. Never switched on.`;
  const best = Object.entries(d.best).sort((a, b) => b[1] - a[1])[0];
  if (!best) return `${held} cartridges · ${d.sessions} sessions`;
  const c = cartridgeById(best[0]);
  return `${held} cartridges · best ${Math.round(best[1])} ${c?.scoreUnit ?? ''} on ${c?.title ?? '—'}`;
}
