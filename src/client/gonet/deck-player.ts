// ═══════════════════════════════════════════════════════════════════════════
// THE DECK, SWITCHED ON — the host that runs a cartridge in the console screen.
//
// The Deck's face already exists in the GONET (`.gn-console` / `.gn-screen2` in
// styles.css): a bezel, a tinted screen, and a scanline overlay. This mounts a
// real playfield INSIDE that screen, so switching a cartridge on happens where
// you are looking — not in a browser `alert()`, which is what used to happen.
//
// The screen is the period constraint. The canvas is 160×96 hardware pixels
// scaled up with smoothing OFF, drawn in the cartridge's own ink on its own
// base. `.gn-screen2::after` lays the scanlines over the top for free.
//
// Runs a plain RAF loop while the game is live and tears everything down on
// stop — no listeners, no timers, no audio nodes left behind. Never touches the
// sim, so a cartridge can never perturb a match or a replay.
// ═══════════════════════════════════════════════════════════════════════════
import { settings } from '../settings';
import type { Cartridge } from './cartridges';
import { GAMES, SCREEN_H, SCREEN_W, type GameInput } from './cartridge-games';

/** A live session. Call stop() to tear it down (leaving the app, ESC, etc). */
export interface DeckSession { stop(): void }

const WARMUP = 0.9; // seconds of "the Deck warms up" before the belt moves

/** A cheap square-wave blip — a 2196 handheld had one voice and no samples.
 *  (audio.ts is sample-based; a cabinet bleep does not belong in SOUND_NAMES.) */
function blip(freq: number, ms: number, vol = 0.05): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = Math.max(0, Math.min(0.2, vol * (settings.masterVolume ?? 0.5)));
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
    osc.onended = () => { void ctx.close(); };
  } catch { /* a silent cabinet is still a cabinet */ }
}

/**
 * Switch a cartridge on inside `screen`. Calls `onEnd(score)` once the run is
 * over and the player has acknowledged it. Returns a handle to tear it down.
 */
export function playInScreen(
  screen: HTMLElement,
  cart: Cartridge,
  prevBest: number,
  onEnd: (score: number) => void,
): DeckSession {
  const factory = GAMES[cart.id];
  const prevHTML = screen.innerHTML;

  const cv = document.createElement('canvas');
  cv.width = SCREEN_W;
  cv.height = SCREEN_H;
  cv.className = 'gn-playfield';
  cv.tabIndex = 0; // so the screen itself takes the keys
  screen.innerHTML = '';
  screen.appendChild(cv);

  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const game = factory ? factory() : null;
  const input: GameInput = { up: false, down: false, left: false, right: false, fire: false };

  // ── input: the D-pad, from a keyboard or a real pad ──────────────────────
  const setKey = (e: KeyboardEvent, down: boolean): void => {
    const k = e.key;
    let hit = true;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') input.up = down;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') input.down = down;
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = down;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = down;
    else if (k === ' ' || k === 'Enter') input.fire = down;
    else hit = false;
    // the Deck eats its own keys so the laptop's 1-8 app switching and the
    // page's scroll do not fire while you are playing
    if (hit) { e.preventDefault(); e.stopPropagation(); }
  };
  const onDown = (e: KeyboardEvent): void => setKey(e, true);
  const onUp = (e: KeyboardEvent): void => setKey(e, false);
  window.addEventListener('keydown', onDown, true);
  window.addEventListener('keyup', onUp, true);

  const readPad = (): void => {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[1] ?? 0, axx = p.axes[0] ?? 0;
      if (Math.abs(ax) > 0.35) { input.up = ax < 0; input.down = ax > 0; }
      if (Math.abs(axx) > 0.35) { input.left = axx < 0; input.right = axx > 0; }
      if (p.buttons[12]?.pressed) input.up = true;
      if (p.buttons[13]?.pressed) input.down = true;
      if (p.buttons[14]?.pressed) input.left = true;
      if (p.buttons[15]?.pressed) input.right = true;
      if (p.buttons[0]?.pressed) input.fire = true;
      break;
    }
  };

  // ── the loop ──────────────────────────────────────────────────────────────
  let raf = 0;
  let last = performance.now();
  let t = 0;
  let ended = false;
  let ackAt = 0;
  let stopped = false;

  const text = (s: string, x: number, y: number, size = 8): void => {
    ctx.font = `${size}px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(s, x, y);
  };

  const frame = (now: number): void => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    ctx.fillStyle = cart.label.base;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = cart.label.ink;

    if (!game) {
      // an honest empty cabinet: this cartridge has no runtime yet
      text('NO RUNTIME', 40, 34, 10);
      text('ON THIS CARTRIDGE', 22, 48, 7);
      raf = requestAnimationFrame(frame);
      return;
    }

    if (t < WARMUP) {
      // the warm-up: what a handheld does before it shows you anything
      const bars = Math.floor(t / WARMUP * 10);
      text(cart.title, 6, 20, 11);
      text(`${cart.maker} · ${cart.year}`, 6, 36, 7);
      for (let i = 0; i < bars; i++) ctx.fillRect(6 + i * 12, 60, 8, 4);
      raf = requestAnimationFrame(frame);
      return;
    }

    if (!ended) {
      readPad();
      game.step(dt, input);
      game.draw(ctx);
      // the score, top-right, in the cartridge's own unit
      const s = `${Math.round(game.score)}`;
      ctx.fillRect(0, 0, SCREEN_W, 9);
      ctx.fillStyle = cart.label.base;
      text(s, SCREEN_W - 6 - s.length * 6, 1, 8);
      text(game.hint, 3, 1, 7);
      ctx.fillStyle = cart.label.ink;
      if (game.over) {
        ended = true;
        ackAt = t + 0.6; // a beat before it will take a keypress
        blip(140, 220, 0.07);
      }
    } else {
      game.draw(ctx);
      const beat = game.score > prevBest;
      ctx.fillRect(18, 28, SCREEN_W - 36, beat ? 44 : 34);
      ctx.fillStyle = cart.label.base;
      text('GAME OVER', 44, 32, 10);
      text(`${Math.round(game.score)} ${cart.scoreUnit}`, 44, 46, 8);
      // the record is announced on the SCREEN, where you are already looking
      if (beat) text('NEW BEST', 48, 58, 9);
      if (t > ackAt) {
        // the belt is still drawn behind this, and a rock in the same ink would
        // swallow the prompt — punch a hole for it first
        ctx.fillStyle = cart.label.base;
        ctx.fillRect(46, 76, 68, 10);
        ctx.fillStyle = cart.label.ink;
        text('PRESS FIRE', 52, 78, 7);
      }
      ctx.fillStyle = cart.label.ink;
      if (t > ackAt && input.fire) { const sc = game.score; stop(); onEnd(sc); return; }
    }
    raf = requestAnimationFrame(frame);
  };

  function stop(): void {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onDown, true);
    window.removeEventListener('keyup', onUp, true);
    screen.innerHTML = prevHTML;
  }

  blip(660, 70);
  cv.focus();
  raf = requestAnimationFrame(frame);
  return { stop };
}
