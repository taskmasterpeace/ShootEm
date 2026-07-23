// ═══════════════════════════════════════════════════════════════════════════
// THE PAD DRIVES THE WHOLE GAME — menu navigation for a controller.
//
// Robert: *"I feel like we created a lot of stuff that we might not be able to
// get to. And I need to be able to get to it."*
//
// He is right, and it is the single thing standing between this game and a
// Steam Deck. In-match controller support has been good for a long time
// (input.ts drives the soldier with two sticks and every face button). But
// everything OUTSIDE a match — enlistment, the GONET's nine apps, the deploy
// screen, the codex, the armory, options — is DOM, and DOM is a mouse.
//
// This is the layer that fixes that, once, for every screen that exists and
// every screen we ever add:
//
//   LEFT STICK / D-PAD   move the focus, spatially — up goes to the thing that
//                        is actually above, not the next one in the DOM
//   A                    activate
//   B                    back / close
//   LB · RB              previous / next tab (the GONET's apps, any tab strip)
//   LT · RT              page the scroll
//   START                deploy / primary action, where a screen names one
//
// THE LAW: it stands down completely while a match is running. input.ts owns
// the pad on the battlefield, and two systems reading the same stick is how
// you get a menu that opens every time somebody strafes.
//
// Nothing here is Steam Deck-specific — it is plain Gamepad API, so the same
// code serves a browser with an Xbox pad plugged in.
// ═══════════════════════════════════════════════════════════════════════════

/** Buttons, in the standard mapping every modern pad reports. */
const A = 0, B = 1, LB = 4, RB = 5, LT = 6, RT = 7, START = 9;
const DPAD_UP = 12, DPAD_DOWN = 13, DPAD_LEFT = 14, DPAD_RIGHT = 15;

/** How far the stick must travel before it counts as a direction. */
const STICK = 0.55;
/** First repeat, then the held repeat — the feel of a menu that is not sticky. */
const REPEAT_FIRST = 0.42;
const REPEAT_NEXT = 0.13;

type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * What the pad can land on. Deliberately broad — anything a mouse could click
 * should be reachable, and new screens get support for free by using ordinary
 * elements.
 */
const FOCUSABLE = [
  'button:not([disabled])',
  '[data-app]', '[data-tile]', '[data-brief]', '[data-sport]', '[data-cart]',
  '[data-preset]', '[data-summon]', '[data-plist]', '[data-play]',
  'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])',
  'a[href]', '[tabindex]:not([tabindex="-1"])',
].join(',');

function visible(el: Element): boolean {
  const e = el as HTMLElement;
  if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return false;
  const r = e.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  // off screen entirely — a scrolled-away control is not a candidate
  return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

/**
 * THE TOP LAYER, and only the top layer.
 *
 * A mouse can only click what it can see; a spatial navigator cannot tell that
 * an element is COVERED. Without this the pad happily focuses the deploy
 * screen's button sitting behind the GONET overlay — which is how it started a
 * match with the laptop still full-screen over the top of it, found on the
 * first controller run. If a modal layer is up, it is the whole world.
 */
function layerRoot(): ParentNode {
  const layers = ['pause-overlay', 'options-panel', 'onboarding'];
  for (const id of layers) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden') && el.children.length > 0) {
      const cs = getComputedStyle(el);
      if (cs.display !== 'none' && cs.visibility !== 'hidden') return el;
    }
  }
  return document;
}

function candidates(): HTMLElement[] {
  return [...layerRoot().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

const centre = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/**
 * SPATIAL NAVIGATION. From where you are, find the best thing in that
 * direction — the one that is most directly that way and nearest, not the next
 * one in document order. A grid of tiles has to behave like a grid.
 */
function nextInDirection(from: HTMLElement, dir: Dir, pool: HTMLElement[]): HTMLElement | null {
  const a = centre(from);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of pool) {
    if (el === from) continue;
    const b = centre(el);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // must actually BE in that direction, with a little tolerance
    const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    if (along <= 6) continue;
    const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    // straight ahead beats near-but-sideways: weight the off-axis distance hard
    const score = along + across * 2.4;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

export class GamepadUI {
  private prev: boolean[] = [];
  private holdDir: Dir | null = null;
  private holdUntil = 0;
  private focused: HTMLElement | null = null;
  private raf = 0;
  private lastPoolSize = -1;

  /**
   * True while a match owns the pad — everything here stands down.
   *
   * ORDER MATTERS AND IT BIT ONCE. The pause overlay must be checked BEFORE
   * the HUD: during a pause the HUD is still visible, so a HUD-first test
   * returns early and the navigator never wakes — you could open the pause
   * screen with START and then not reach RESUME or ABANDON, which on a Deck
   * means trapped in a match with no keyboard to escape with.
   */
  private suspended(): boolean {
    const pause = document.getElementById('pause-overlay');
    if (pause && !pause.classList.contains('hidden')) return false; // paused: we drive
    const hud = document.getElementById('hud');
    return !!hud && !hud.classList.contains('hidden');              // fighting: input.ts drives
  }

  start(): void {
    if (this.raf) return;
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      this.tick(t / 1000);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void { cancelAnimationFrame(this.raf); this.raf = 0; }

  private pad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = [...navigator.getGamepads()];
    return pads.find((p) => p && p.mapping === 'standard') ?? pads.find((p) => !!p) ?? null;
  }

  private tick(now: number): void {
    const pad = this.pad();
    if (!pad) return;
    const off = this.suspended();
    document.body.classList.toggle('pad-inmatch', off);
    if (off) { this.blur(); return; }

    const down = (i: number) => !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.4;
    const rose = (i: number) => down(i) && !this.prev[i];

    const pool = candidates();
    if (!pool.length) { this.prev = pad.buttons.map((b) => b.pressed); return; }

    // a screen just changed under us — take focus so the pad is never lost
    if (!this.focused || !pool.includes(this.focused) || pool.length !== this.lastPoolSize) {
      if (!this.focused || !pool.includes(this.focused)) this.focus(pool[0]);
      this.lastPoolSize = pool.length;
    }

    // ── direction, from stick or d-pad, with a repeat ─────────────────────
    const lx = pad.axes[0] ?? 0, ly = pad.axes[1] ?? 0;
    let dir: Dir | null = null;
    if (down(DPAD_UP) || ly < -STICK) dir = 'up';
    else if (down(DPAD_DOWN) || ly > STICK) dir = 'down';
    else if (down(DPAD_LEFT) || lx < -STICK) dir = 'left';
    else if (down(DPAD_RIGHT) || lx > STICK) dir = 'right';

    if (dir) {
      if (dir !== this.holdDir) { this.holdDir = dir; this.holdUntil = now + REPEAT_FIRST; this.move(dir, pool); }
      else if (now >= this.holdUntil) { this.holdUntil = now + REPEAT_NEXT; this.move(dir, pool); }
    } else {
      this.holdDir = null;
    }

    // ── the buttons ───────────────────────────────────────────────────────
    if (rose(A)) this.activate();
    if (rose(B)) this.back();
    if (rose(LB)) this.tab(-1);
    if (rose(RB)) this.tab(+1);
    if (rose(START)) this.primary();
    if (down(LT)) this.scroll(-24);
    if (down(RT)) this.scroll(+24);

    this.prev = pad.buttons.map((b) => b.pressed || b.value > 0.4);
  }

  private focus(el: HTMLElement | null): void {
    if (this.focused === el) return;
    this.focused?.classList.remove('pad-focus');
    this.focused = el;
    if (!el) return;
    el.classList.add('pad-focus');
    // keep it on screen — a focus you cannot see is a focus you have lost
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    try { el.focus({ preventScroll: true }); } catch { /* not focusable, fine */ }
  }

  private blur(): void {
    this.focused?.classList.remove('pad-focus');
    this.focused = null;
  }

  private move(dir: Dir, pool: HTMLElement[]): void {
    if (!this.focused) { this.focus(pool[0]); return; }
    const next = nextInDirection(this.focused, dir, pool);
    if (next) this.focus(next);
  }

  private activate(): void {
    const el = this.focused;
    if (!el) return;
    // a text field opens the on-screen keyboard on a Deck; everything else clicks
    if (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'search')) {
      el.focus();
      return;
    }
    el.click();
  }

  /** B is always "the way back" — the same key ESC is on a keyboard. */
  private back(): void {
    // a named back control beats a synthetic key event every time
    const named = [...document.querySelectorAll<HTMLElement>('.ob-alt, #to-frontmenu, [data-act="close"]')]
      .filter(visible)[0];
    if (named) { named.click(); return; }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  }

  /** Shoulder buttons walk any tab strip — the GONET's apps, the codex's tabs. */
  private tab(delta: number): void {
    const strips = ['.gn-tab', '.mtab', '[data-app]'];
    for (const sel of strips) {
      const tabs = [...document.querySelectorAll<HTMLElement>(sel)].filter(visible);
      if (tabs.length < 2) continue;
      const cur = tabs.findIndex((t) => t.classList.contains('on') || t.classList.contains('active'));
      const next = tabs[((cur < 0 ? 0 : cur) + delta + tabs.length) % tabs.length];
      next?.click();
      return;
    }
  }

  /** START goes for the screen's primary action, where one is named. */
  private primary(): void {
    const primary = [...document.querySelectorAll<HTMLElement>(
      '#deploy-btn, .ob-go, .gn-cta, .gn-tile.primary, [data-act="deploy"]',
    )].filter(visible)[0];
    primary?.click();
  }

  private scroll(by: number): void {
    const el = this.focused?.closest('.gn-body, .ob-wrap, #menu') as HTMLElement | null;
    (el ?? document.scrollingElement ?? document.body).scrollBy({ top: by, behavior: 'auto' });
  }
}

/** Mount once. Safe to call before any UI exists — it polls. */
export function mountGamepadUI(): GamepadUI {
  const ui = new GamepadUI();
  ui.start();
  // the body wears a class the moment a pad appears, so CSS can grow targets
  const mark = () => document.body.classList.toggle(
    'has-pad',
    typeof navigator !== 'undefined' && !!navigator.getGamepads
      && [...navigator.getGamepads()].some((p) => !!p),
  );
  window.addEventListener('gamepadconnected', mark);
  window.addEventListener('gamepaddisconnected', mark);
  mark();
  return ui;
}
