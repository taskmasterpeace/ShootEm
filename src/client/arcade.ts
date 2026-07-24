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
export function openArcade(cart: string, name: string, close?: () => void): boolean {
  if (host) return false;                       // already at a machine
  const id = cart as CartridgeId;
  const def = cartridgeById(id);
  if (!def || !isPlayable(id)) return false;

  onClose = close ?? null;
  const deck = loadDeck();
  const best = deck.best[id] ?? 0;

  host = document.createElement('div');
  host.id = 'arcade';
  host.innerHTML = `
    <div class="arc-cab">
      <div class="arc-marquee">${esc(name)}</div>
      <div class="arc-screen"><div class="gn-screen2"></div></div>
      <div class="arc-foot">
        <span class="arc-maker">${esc(def.maker)} · ${def.year}</span>
        <span class="arc-best">${best > 0 ? `BEST ${best} ${esc(def.scoreUnit)}` : 'NO SCORE ON THIS MACHINE'}</span>
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
    const b = host?.querySelector('.arc-best');
    if (b) b.textContent = `BEST ${save.best[id] ?? score} ${def.scoreUnit}`;
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
