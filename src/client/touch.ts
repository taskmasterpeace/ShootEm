// ---------------------------------------------------------------------------
// TOUCH CONTROLS (Robert's tablet goal): the third hand on the wheel, beside
// keyboard/mouse and the gamepad. The design RIDES the gamepad's rails — a
// virtual LEFT stick writes the same analog move intent (analogDrive: gentle
// push crawls, full push sprints), a virtual RIGHT stick writes the same
// persistent aim (yaw + distance) and FIRES past a deflection threshold, and
// every button queues the same one-shots Input already drains. The sim never
// learns a finger exists.
//
// Sticks are DYNAMIC: they appear where the thumb lands (left 45% of the
// screen moves, right 45% aims), so there is no fixed target to miss in a
// firefight. Two-finger pinch anywhere on the layer is the camera wheel.
// Pointer Events only — mouse players never see this layer (mounted behind
// a coarse-pointer gate in main.ts).
// ---------------------------------------------------------------------------
import type { PlayerCmd, Soldier } from '../sim/types';
import { analogDrive } from './input';
import { settings } from './settings';

/** Normalized stick vector from origin→point, clamped to the unit disc.
 *  Pure — the feel contract lives in tests/touch.test.ts. */
export function stickFrom(ox: number, oy: number, x: number, y: number, radius: number): { x: number; y: number; mag: number } {
  const dx = (x - ox) / radius, dy = (y - oy) / radius;
  const mag = Math.hypot(dx, dy);
  if (mag <= 1 || mag === 0) return { x: dx, y: dy, mag };
  return { x: dx / mag, y: dy / mag, mag: 1 };
}

/** The right stick fires past this deflection — aim gently, press to shoot. */
export const FIRE_THRESHOLD = 0.5;

interface Latches {
  jump: boolean; reload: boolean; ability: boolean; use: boolean;
  grenade: boolean; melee: boolean; swap: boolean;
}
const freshLatches = (): Latches => ({ jump: false, reload: false, ability: false, use: false, grenade: false, melee: false, swap: false });

interface StickView { base: HTMLElement; knob: HTMLElement }

export class TouchControls {
  /** true once any touch drove input — main.ts may swap HUD prompts on it */
  active = false;

  private move = { x: 0, y: 0, mag: 0 };
  private aim = { x: 0, y: 0, mag: 0 };
  /** last real aim persists like the pad's (lifting the thumb keeps facing) */
  private aimYaw = 0; private aimDist = 12; private aimHas = false;
  private crouchHeld = false;
  private latch = freshLatches();
  /** pinch: accumulated camera-wheel units, drained by apply() */
  private pinchAccum = 0;

  private movePointer = -1; private aimPointer = -1;
  private moveOrigin = { x: 0, y: 0 }; private aimOrigin = { x: 0, y: 0 };
  private pinch: { a: number; b: number; dist: number } | null = null;
  private sticks: { move?: StickView; aim?: StickView } = {};
  private layer: HTMLElement | null = null;

  /** Stick radius in px — tuned for a thumb on a 10" tablet. */
  static readonly RADIUS = 64;

  // ── the pure heart: state → PlayerCmd (testable without a DOM) ───────────
  /** Write this frame's touch intent into the command. Returns true when
   *  touch is driving (so Input can yield the wheel, like the pad does). */
  apply(cmd: PlayerCmd, local: Soldier): boolean {
    let drove = false;
    if (this.move.mag > 0) {
      const { drive, sprint } = analogDrive(Math.min(1, this.move.mag), settings.padDeadzone);
      if (drive > 0) {
        cmd.moveX = this.move.x / (this.move.mag || 1) * drive;
        cmd.moveZ = this.move.y / (this.move.mag || 1) * drive;
        if (sprint) cmd.sprint = true;
        drove = true;
      }
    }
    if (this.aim.mag > 0.2) {
      this.aimYaw = Math.atan2(this.aim.y, this.aim.x);
      this.aimDist = 8 + Math.min(1, this.aim.mag) * 30;
      this.aimHas = true;
      drove = true;
    }
    if (this.aimHas) { cmd.aimYaw = this.aimYaw; cmd.aimDist = this.aimDist; }
    if (this.aim.mag >= FIRE_THRESHOLD) { cmd.fire = true; drove = true; }
    if (this.crouchHeld) { cmd.crouch = true; drove = true; }
    // one-shots — same drain contract as Input's own
    if (this.latch.jump) cmd.jump = true;
    if (this.latch.reload) cmd.reload = true;
    if (this.latch.ability) cmd.ability = true;
    if (this.latch.use) cmd.use = true;
    if (this.latch.grenade) cmd.grenade = true;
    if (this.latch.melee) cmd.melee = true;
    if (this.latch.swap) cmd.weaponSlot = (local.weaponIdx + 1) % Math.max(1, local.weapons.length);
    drove = drove || Object.values(this.latch).some(Boolean);
    this.latch = freshLatches();
    if (drove) this.active = true;
    return drove;
  }

  /** Camera-wheel units the pinch earned since last frame (drained). */
  drainPinch(): number { const v = this.pinchAccum; this.pinchAccum = 0; return v; }

  // ── the DOM half ──────────────────────────────────────────────────────────
  mount(layer: HTMLElement): void {
    this.layer = layer;
    layer.addEventListener('pointerdown', (e) => this.onDown(e));
    layer.addEventListener('pointermove', (e) => this.onMove(e));
    layer.addEventListener('pointerup', (e) => this.onUp(e));
    layer.addEventListener('pointercancel', (e) => this.onUp(e));
    this.buildButtons(layer);
  }

  private button(label: string, sub: string, cls: string, down: () => void, up?: () => void): HTMLElement {
    const b = document.createElement('button');
    b.className = `tc-btn ${cls}`;
    b.innerHTML = `<b>${label}</b><small>${sub}</small>`;
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.classList.add('held'); down(); this.active = true; });
    const release = (e: Event) => { e.stopPropagation(); b.classList.remove('held'); up?.(); };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }

  private buildButtons(layer: HTMLElement): void {
    const cluster = document.createElement('div');
    cluster.id = 'tc-cluster';
    cluster.append(
      this.button('▲', 'JUMP', 'tc-jump', () => { this.latch.jump = true; }),
      this.button('▼', 'DUCK', 'tc-duck', () => { this.crouchHeld = true; }, () => { this.crouchHeld = false; }),
      this.button('E', 'USE', 'tc-use', () => { this.latch.use = true; }),
      this.button('R', 'RELOAD', 'tc-reload', () => { this.latch.reload = true; }),
      this.button('Q', 'ABILITY', 'tc-ability', () => { this.latch.ability = true; }),
      this.button('G', 'BOMB', 'tc-nade', () => { this.latch.grenade = true; }),
      this.button('F', 'STRIKE', 'tc-melee', () => { this.latch.melee = true; }),
      this.button('⇄', 'SWAP', 'tc-swap', () => { this.latch.swap = true; }),
    );
    layer.appendChild(cluster);
    // tablets have no ESC — the pause chip speaks the keyboard's language
    const pause = this.button('▮▮', 'PAUSE', 'tc-pause', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    pause.id = 'tc-pause';
    layer.appendChild(pause);
  }

  private stickView(kind: 'move' | 'aim', x: number, y: number): StickView {
    const base = document.createElement('div');
    base.className = `tc-stick tc-${kind}`;
    const knob = document.createElement('div');
    knob.className = 'tc-knob';
    base.appendChild(knob);
    base.style.left = `${x}px`; base.style.top = `${y}px`;
    this.layer!.appendChild(base);
    return { base, knob };
  }

  private onDown(e: PointerEvent): void {
    this.active = true;
    // second finger while a stick is down → pinch zoom takes the new finger
    const liveSticks = (this.movePointer >= 0 ? 1 : 0) + (this.aimPointer >= 0 ? 1 : 0);
    const w = innerWidth;
    if (e.clientX < w * 0.45 && this.movePointer < 0) {
      this.movePointer = e.pointerId;
      this.moveOrigin = { x: e.clientX, y: e.clientY };
      this.sticks.move = this.stickView('move', e.clientX, e.clientY);
      try { this.layer!.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    } else if (e.clientX > w * 0.5 && this.aimPointer < 0) {
      this.aimPointer = e.pointerId;
      this.aimOrigin = { x: e.clientX, y: e.clientY };
      this.sticks.aim = this.stickView('aim', e.clientX, e.clientY);
      try { this.layer!.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    } else if (liveSticks > 0 && !this.pinch) {
      // free finger + a stick finger = pinch pair
      const anchor = this.movePointer >= 0 ? this.moveOrigin : this.aimOrigin;
      this.pinch = { a: e.pointerId, b: -1, dist: Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) };
    }
  }

  private onMove(e: PointerEvent): void {
    const R = TouchControls.RADIUS;
    if (e.pointerId === this.movePointer) {
      this.move = stickFrom(this.moveOrigin.x, this.moveOrigin.y, e.clientX, e.clientY, R);
      this.knobTo(this.sticks.move, this.move);
    } else if (e.pointerId === this.aimPointer) {
      this.aim = stickFrom(this.aimOrigin.x, this.aimOrigin.y, e.clientX, e.clientY, R);
      this.knobTo(this.sticks.aim, this.aim);
      this.sticks.aim?.base.classList.toggle('firing', this.aim.mag >= FIRE_THRESHOLD);
    } else if (this.pinch && e.pointerId === this.pinch.a) {
      const anchor = this.movePointer >= 0 ? this.moveOrigin : this.aimOrigin;
      const d = Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y);
      this.pinchAccum += (this.pinch.dist - d) * 0.06; // spread = closer, pinch = wider
      this.pinch.dist = d;
    }
  }

  private knobTo(view: StickView | undefined, v: { x: number; y: number; mag: number }): void {
    if (!view) return;
    const R = TouchControls.RADIUS * 0.6;
    view.knob.style.transform = `translate(${v.x * Math.min(1, v.mag) * R}px, ${v.y * Math.min(1, v.mag) * R}px)`;
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId === this.movePointer) {
      this.movePointer = -1; this.move = { x: 0, y: 0, mag: 0 };
      this.sticks.move?.base.remove(); this.sticks.move = undefined;
    } else if (e.pointerId === this.aimPointer) {
      this.aimPointer = -1; this.aim = { x: 0, y: 0, mag: 0 }; // aimYaw persists — the pad law
      this.sticks.aim?.base.remove(); this.sticks.aim = undefined;
    } else if (this.pinch && e.pointerId === this.pinch.a) {
      this.pinch = null;
    }
  }
}

/** One question, asked once: is this a touch-first machine? `?touch=1` is
 *  the dev door — audition the tablet controls on any desk. */
export function isTouchDevice(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  if (new URLSearchParams(location.search).has('touch')) return true;
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}
