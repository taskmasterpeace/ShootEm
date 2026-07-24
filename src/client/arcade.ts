// ═══════════════════════════════════════════════════════════════════════════
// THE ARCADE — the walk-up cabinet, and the screen that opens on it.
//
// Robert: *"ARCADE GAMES = walk-up consoles in the world: you approach one, a
// UI pops up, and you're actually playing a video game. Reference feel:
// Drive-N-Shoot / Divided States of America."*
//
// The difference from THE DECK is WHERE, not what. The Deck is the handheld in
// your pack — you play it on your bunk, in the laptop, between deploys. A
// cabinet is a machine bolted to somebody's floor: you have to walk to it, and
// the walking is the entire point. Same five games, same runtime, same scores.
//
// So this file is deliberately thin. It does not own a game — `cartridge-games`
// owns those and `deck-player` owns running one. It owns the CABINET: the
// marquee, the coin slot, the fact that you are standing in a room playing a
// machine while a war goes on outside the door.
//
// THE LAW STANDS (cartridges.ts): a sport makes you better at the war, a
// cartridge does not. Nothing here grants a skill, a stat, a licence or a rank.
// It is the one thing in the game with no instrumental value, which is exactly
// what makes it rest.
// ═══════════════════════════════════════════════════════════════════════════
import { cartridgeById, fileScore, loadDeck, saveDeck, type CartridgeId } from './gonet/cartridges';
import { isPlayable } from './gonet/cartridge-games';
import { playInScreen, type DeckSession } from './gonet/deck-player';

let host: HTMLElement | null = null;
let session: DeckSession | null = null;
let onClose: (() => void) | null = null;

export const arcadeIsOpen = (): boolean => !!host;

/**
 * Switch the machine on. Returns false if there is nothing to run — a cabinet
 * with a cartridge the build does not have is a dead machine, and it says so by
 * simply not opening rather than by lying with an empty screen.
 */
export function openArcade(cart: string, name: string, close?: () => void, key?: string): boolean {
  if (host) return false;                       // already at a machine
  const id = cart as CartridgeId;
  const def = cartridgeById(id);
  if (!def || !isPlayable(id)) return false;

  onClose = close ?? null;
  const deck = loadDeck();
  const best = deck.best[id] ?? 0;
  // THE NAME ON THE GLASS. A machine you have never played still has a mark on
  // it, and beating that mark is the reason to stand there.
  const house = key ? houseRecord(key, id) : null;
  // BE HONEST ABOUT WHAT YOU HOLD. The Deck keeps ONE best per cartridge, not
  // one per machine — so a big score set on some other ORBIT RUN beats this
  // machine's mark too. Saying "you hold this machine" would be a small lie
  // about a cabinet you never touched; the mark is the machine's, the best is
  // yours, and the honest line shows both.
  const beaten = !!house && best > house.score;
  const markLine = !house
    ? (best > 0 ? `BEST ${best} ${esc(def.scoreUnit)}` : 'NO SCORE ON THIS MACHINE')
    : beaten
      ? `MARK BEATEN — ${esc(house.name)} ${house.score} · YOU ${best} ${esc(def.scoreUnit)}`
      : `HOUSE RECORD — ${esc(house.name)} ${house.score} ${esc(def.scoreUnit)}`;

  host = document.createElement('div');
  host.id = 'arcade';
  host.innerHTML = `
    <div class="arc-cab">
      <div class="arc-marquee">${esc(name)}</div>
      <div class="arc-screen"><div class="gn-screen2"></div></div>
      <div class="arc-foot">
        <span class="arc-maker">${esc(def.maker)} · ${def.year}</span>
        <span class="arc-best${beaten ? ' held' : ''}">${markLine}</span>
      </div>
      <div class="arc-hint">MOVE · FIRE to play &nbsp;·&nbsp; <b>ESC</b> to walk away</div>
    </div>`;
  document.body.appendChild(host);

  const screen = host.querySelector<HTMLElement>('.gn-screen2')!;
  session = playInScreen(screen, def, best, (score) => {
    session = null;
    // THE CABINET REMEMBERS, and it is the SAME book the Deck keeps. A score is
    // a score: the machine in the shop and the handheld in your pack are two
    // doors onto one high-score table, which is the only version of this that
    // would not feel like a cheat.
    const save = loadDeck();
    fileScore(save, id, score);
    saveDeck(save);
    const mine = save.best[id] ?? score;
    const b = host?.querySelector('.arc-best');
    if (b) {
      // TAKING THE MACHINE is the moment worth printing. It is said plainly
      // and once: you either hold this cabinet now or you are still chasing.
      const took = house && mine > house.score;
      b.textContent = took
        ? `MARK BEATEN — ${house!.name} ${house!.score} · YOU ${mine} ${def.scoreUnit}`
        : house
          ? `HOUSE RECORD — ${house.name} ${house.score} ${def.scoreUnit} · YOU ${mine}`
          : `BEST ${mine} ${def.scoreUnit}`;
      b.classList.toggle('held', !!took);
    }
  });

  window.addEventListener('keydown', escKey, true);
  return true;
}

export function closeArcade(): void {
  if (!host) return;
  session?.stop();
  session = null;
  window.removeEventListener('keydown', escKey, true);
  host.remove();
  host = null;
  const cb = onClose;
  onClose = null;
  cb?.();
}

function escKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  // swallow it: ESC at a cabinet means "walk away", never "open the pause menu"
  e.preventDefault();
  e.stopPropagation();
  closeArcade();
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// ═══ THE HOUSE RECORD — somebody else's name, already on the machine ═══════
//
// A cabinet showed YOUR best and nothing else, so walking up to a machine you
// had never played said "NO SCORE ON THIS MACHINE" and gave you nothing to
// chase. That is the one thing a real arcade always has: a name on the glass
// you did not put there.
//
// The record is DERIVED from the machine — its cartridge and where it stands —
// so it is stable (the same cabinet always shows the same target), needs no
// store, and differs between machines: the ORBIT RUN in one city is a harder
// board than the one in the next. The par comes off the cartridge itself, so
// the mark is always in that game's own currency and always reachable.

/** the names already on the machines — regulars, not licensed anybody */
const HOUSE_NAMES = [
  'V. KOSTA', 'REYNA-9', 'OLD MAKO', 'T. BRANNIGAN', 'SIX', 'DUSTY HALE',
  'M. OKONKWO', 'THE CLERK', 'L. VASSER', 'PIP', 'GREY TOMA', 'A. SOLIS',
] as const;

/** a small stable hash — the same cabinet always yields the same mark */
function cabHash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface HouseRecord { name: string; score: number }

/**
 * The mark standing on one machine. `key` identifies the cabinet — its
 * cartridge and its position — so two ORBIT RUNs in different cities carry
 * different names and different targets.
 */
export function houseRecord(key: string, cart: CartridgeId): HouseRecord | null {
  const def = cartridgeById(cart);
  if (!def) return null;
  const h = cabHash(key);
  const name = HOUSE_NAMES[h % HOUSE_NAMES.length];
  // ±18% around the cartridge's own par, so machines differ but every mark
  // stays inside what that game can actually produce
  const swing = ((h >>> 8) % 37) / 100 - 0.18;
  const score = Math.max(1, Math.round(def.housePar * (1 + swing)));
  return { name, score };
}

/** The stable key for a cabinet standing at a place. */
export const cabinetKey = (cart: string, x: number, z: number): string =>
  `${cart}@${Math.round(x)},${Math.round(z)}`;

/**
 * THE DEPLOY INTEL LINE — "there is a machine in this city, go find it".
 *
 * The map marks each cabinet, but you had to open the map to know one was
 * there, and a walk-up console you only find through a menu is not really
 * walk-up. This is the one line the HUD announces at deploy so a player goes
 * LOOKING. Pure — a list of cabinets in, one string (or null) out — so the
 * formatting is testable and main.ts stays a caller.
 *
 * Distinct titles only (a city can have two ORBIT RUNs and it is still "an
 * ORBIT RUN in the sector"), and it caps the list so a big arcade row reads
 * "A, B +3" instead of running off the banner.
 */
export function arcadeIntelLine(cabs: ReadonlyArray<{ name: string }>): string | null {
  if (!cabs.length) return null;
  const titles = [...new Set(cabs.map((c) => c.name))];
  const list = titles.length <= 2 ? titles.join(' & ')
    : `${titles.slice(0, 2).join(', ')} +${titles.length - 2}`;
  return `ARCADE IN THIS SECTOR — ${list} · walk up, press E`;
}
