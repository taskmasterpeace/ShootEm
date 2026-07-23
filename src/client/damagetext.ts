// ---------------------------------------------------------------------------
// FLOATING DAMAGE NUMBERS — the little "-23" that leaps off a body when it's
// hit. Red for flesh (HP), blue for plate (ARMOR). A pure client overlay: it
// reads 'damage' events (emitted by world.damageSoldier) and paints DOM spans
// over the 3D canvas, projected from the victim's head each frame. Nothing here
// touches the sim or the renderer's scene — it's wired from main.ts alone.
//
// Tunables live at the top on purpose: this is meant to be dialed in fast.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import type { SimEvent } from '../sim/types';

const LIFE = 0.85;        // seconds a number lives
const RISE = 52;          // px it floats up the screen over its life
const POP = 0.09;         // seconds of the birth "pop" (scales 1.3 → 1.0)
const FADE_FROM = 0.55;   // start fading at this fraction of life
const MERGE = 0.09;       // s: hits this close fold into ONE number (shotgun pellets, a beam's burst)
const MAX_ACTIVE = 48;    // hard cap so a firefight can't flood the DOM
const HP_COLOR = '#ff4736';    // flesh — blood red (never purple)
const ARMOR_COLOR = '#4cc2ff'; // plate — the armor blue, matches the HUD's AR readout
const BASE_PX = 26;
const BIG_AT = 45;        // amount at/above which the number renders larger
const BIG_PX = 40;

interface Floater {
  el: HTMLDivElement;
  wx: number; wy: number; wz: number; // world anchor (victim's head)
  born: number;                       // this.clock at spawn/last merge
  driftX: number;                     // px of horizontal fan so stacks don't overlap
  amount: number;
  armor: boolean;
  key: string;                        // soldierId:armor — the merge bucket
}

/** THE LAW — a damage number is YOURS or it doesn't show. Only damage the local
 *  player dealt (their fire, their piloted LSW) floats a number; every other
 *  exchange on the field stays silent, so a busy fight never blizzards with
 *  numbers. Damage you TAKE is told by the health ring + the red vignette, not
 *  here. Enforced in tests/damage-numbers.test.ts. */
export function shouldShowDamage(ev: SimEvent, localId: number): boolean {
  return ev.type === 'damage' && ev.amount !== undefined && ev.ownerId === localId;
}

export class DamageText {
  private layer: HTMLDivElement;
  private floaters: Floater[] = [];
  private lastByKey = new Map<string, Floater>();
  private clock = 0;
  private jitter = 0; // deterministic-free spread counter (Math.random is fine here — pure visual)
  private readonly v = new THREE.Vector3();

  constructor() {
    const layer = document.createElement('div');
    layer.id = 'dmg-layer';
    // stops at the top of THE BOARD — numbers float over the PICTURE, never
    // over the desk (and the projection below measures this layer, so the two
    // can never disagree about where the picture ends)
    layer.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:var(--board-h,0px);z-index:9;pointer-events:none;overflow:hidden;';
    (document.getElementById('app') ?? document.body).appendChild(layer);
    this.layer = layer;
  }

  /** Pull YOUR 'damage' events out of this tick's stream and spawn/merge numbers.
   *  `localId` is the player (or their piloted LSW) — the law filters to it. */
  applyEvents(events: SimEvent[], localId: number): void {
    for (const e of events) {
      if (!shouldShowDamage(e, localId) || !e.pos) continue; // only YOUR damage
      const n = Math.round(e.amount!);
      if (n < 1) continue; // sub-1 DoT ticks aren't worth a number
      const armor = !!e.armorHit;
      const key = `${e.soldierId ?? -1}:${armor}`;

      // FOLD: hits landing within one MERGE window on the same body become a
      // single number (a shotgun's pellets, one tick-burst of a beam) so the
      // screen isn't a spray of dupes. `born` is NOT refreshed — the window is
      // measured from the FIRST hit, so a held beam releases a readable stream
      // of numbers instead of one that climbs forever.
      const prev = this.lastByKey.get(key);
      if (prev && this.clock - prev.born < MERGE && this.floaters.includes(prev)) {
        prev.amount += n;
        this.paint(prev);
        continue;
      }

      if (this.floaters.length >= MAX_ACTIVE) this.remove(this.floaters[0]);

      const el = document.createElement('div');
      el.style.cssText =
        'position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;' +
        'font-family:Oswald,system-ui,sans-serif;font-weight:700;letter-spacing:.01em;' +
        // a crisp 1px LIGHT (white) outline — no black. Keeps the colored number
        // readable over any ground without a dark smudge/box behind it.
        'text-shadow:-1px -1px 0 rgba(255,255,255,.9),1px -1px 0 rgba(255,255,255,.9),-1px 1px 0 rgba(255,255,255,.9),1px 1px 0 rgba(255,255,255,.9);';
      this.layer.appendChild(el);

      const f: Floater = {
        el, wx: e.pos.x, wy: e.pos.y, wz: e.pos.z,
        born: this.clock,
        driftX: (this.jitter++ % 2 ? 1 : -1) * (8 + (this.jitter % 5) * 4),
        amount: n, armor, key,
      };
      this.paint(f);
      this.floaters.push(f);
      this.lastByKey.set(key, f);
    }
  }

  /** Advance + reproject every live number. Call once per frame with the camera. */
  update(dt: number, camera: THREE.Camera): void {
    this.clock += dt;
    // measure the LAYER, not the window — the picture is shorter than the
    // screen whenever the desk is up
    const w = this.layer.clientWidth || window.innerWidth;
    const h = this.layer.clientHeight || window.innerHeight;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      const age = this.clock - f.born;
      const t = age / LIFE;
      if (t >= 1) { this.remove(f); continue; }

      this.v.set(f.wx, f.wy, f.wz).project(camera);
      if (this.v.z > 1) { f.el.style.opacity = '0'; continue; } // behind the camera
      const sx = (this.v.x * 0.5 + 0.5) * w + f.driftX;
      const sy = (-this.v.y * 0.5 + 0.5) * h - t * RISE;
      const pop = age < POP ? 1.3 - 0.3 * (age / POP) : 1;
      const fade = t < FADE_FROM ? 1 : 1 - (t - FADE_FROM) / (1 - FADE_FROM);
      f.el.style.transform = `translate(-50%,-50%) translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) scale(${pop.toFixed(3)})`;
      f.el.style.opacity = fade.toFixed(3);
    }
  }

  /** Wipe everything (match teardown). */
  clear(): void {
    for (const f of this.floaters) f.el.remove();
    this.floaters.length = 0;
    this.lastByKey.clear();
  }

  private paint(f: Floater): void {
    f.el.textContent = `-${f.amount}`;
    f.el.style.color = f.armor ? ARMOR_COLOR : HP_COLOR;
    f.el.style.fontSize = `${f.amount >= BIG_AT ? BIG_PX : BASE_PX}px`;
  }

  private remove(f: Floater): void {
    f.el.remove();
    const idx = this.floaters.indexOf(f);
    if (idx >= 0) this.floaters.splice(idx, 1);
    if (this.lastByKey.get(f.key) === f) this.lastByKey.delete(f.key);
  }
}
