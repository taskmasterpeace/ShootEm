import * as THREE from 'three';
import { CLASSES } from '../sim/data';
import type { K9Command, PlayerCmd, Soldier } from '../sim/types';
import { settings } from './settings';
import type { TouchControls } from './touch';

/** STATUS §1 / W1.3 — SPACE is a tap/hold: a quick TAP jumps, a HOLD ducks.
 *  The window a press must beat to count as a tap (else it's a duck). */
export const SPACE_TAP_MS = 180;
/** Resolve SPACE into jump/crouch. Jetpack (and ascended) classes keep space as
 *  a HELD action — thrust/flight — so their duck stays on C and nothing here
 *  changes for them. A ground class taps to jump and holds to duck. Pure so the
 *  tap/hold contract is pinned in a test, away from the DOM + wall clock. */
export function resolveSpace(
  spaceHeldMode: boolean, spaceHeld: boolean, heldMs: number, tapJumpFired: boolean,
): { jump: boolean; crouch: boolean } {
  if (spaceHeldMode) return { jump: spaceHeld, crouch: false };
  return { jump: tapJumpFired, crouch: spaceHeld && heldMs >= SPACE_TAP_MS };
}

/** STATUS §1 — the third face of SPACE: hold past the tap window WITH a
 *  direction and the duck is a COIL; releasing springs the CHARGED LEAP.
 *  Time past the window ramps the charge to full over this many ms. */
export const LEAP_CHARGE_MS = 900;
/** Charge (0..1) a SPACE release carries. 0 = not a leap: a tap (that's the
 *  jump), no direction held (that was just a duck), or a held-thrust class.
 *  Pure, like resolveSpace — the contract lives in a test, not the DOM. */
/** ANALOG MOVEMENT (Robert: "slow when barely moved, full when it's all the
 *  way"). Maps a raw left-stick magnitude to a drive in [0,1] — a RADIAL
 *  deadzone, then the usable travel rescaled so a gentle push crawls and a firm
 *  push runs — and reports whether the stick is pushed far enough to SPRINT (the
 *  keyboard-SHIFT equivalent). Pure, so the feel is locked in a test. */
export function analogDrive(mag: number, deadzone: number): { drive: number; sprint: boolean } {
  if (mag <= deadzone) return { drive: 0, sprint: false };
  const drive = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return { drive, sprint: drive >= 0.9 };
}

export function leapChargeOnRelease(
  spaceHeldMode: boolean, heldMs: number, hasDir: boolean,
): number {
  if (spaceHeldMode || !hasDir || heldMs < SPACE_TAP_MS) return 0;
  return Math.min(1, (heldMs - SPACE_TAP_MS) / LEAP_CHARGE_MS);
}

export class Input {
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, rightDown: false };
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1); // y = 1 aim plane
  scoreboardHeld = false;
  /** camera distance — mouse wheel zooms between CAM_MIN and CAM_MAX */
  camDist = 30;
  /** G held: aiming a throw — the HUD draws the arc; release throws to cursor */
  grenadeAiming = false;
  /** grenade arc (0 flat rope … 1 mortar lob) — wheel adjusts while aiming */
  grenadeLob = 1;
  /** F held: charging an Impact Charge (§13). Release commits the strike. */
  private meleeDown = false;
  private oneShot: { reload: boolean; grenade: boolean; ability: boolean; use: boolean; weaponSlot: number; nadeCycle: boolean; dash: number; melee: boolean; cycleAmmo: boolean; grapple: boolean; spaceJump: boolean; leap: number; torch: boolean; k9?: K9Command } = { reload: false, grenade: false, ability: false, use: false, weaponSlot: -1, nadeCycle: false, dash: 0, melee: false, cycleAmmo: false, grapple: false, spaceJump: false, leap: 0, torch: false };
  /** M2 double-tap tracker for dash/roll */
  private lastTap = { key: '', at: 0 };
  /** W1.3: when SPACE went down — a quick release jumps, a long hold ducks. */
  private spaceDownAt = 0;

  static readonly CAM_MIN = 16;
  static readonly CAM_MAX = 80; // command height — semantic zoom keeps it readable
  /** §8.8: heavy weather closes the long view — set from the sim each frame */
  weatherZoomCap = Infinity;
  /** true when a gamepad drove the last command — HUD may swap its prompts */
  gamepadActive = false;
  /** the tablet's hand on the wheel — mounted by main.ts on coarse-pointer
   *  machines; feeds the same PlayerCmd seams the gamepad does */
  touch: TouchControls | null = null;
  /** gamepad aim direction persists between frames (stick returns to center) */
  private padAim = { yaw: 0, dist: 12, has: false };
  private prevPadButtons: boolean[] = [];
  private padGrenadeAiming = false;

  private clampZoom() {
    this.camDist = Math.max(Input.CAM_MIN, Math.min(Math.min(Input.CAM_MAX, this.weatherZoomCap), this.camDist));
  }

  constructor(private canvas: HTMLCanvasElement) {
    // mouse wheel: see further (out) or fight closer (in)
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // while lining up a grenade the wheel is the ARC dial (Robert:
      // "allow us to control the arc"): down = flatter rope, up = higher
      // lob. The cursor still owns the landing spot. Sticky per session —
      // your throwing style is yours.
      if (this.grenadeAiming) {
        this.grenadeLob = Math.max(0, Math.min(1, this.grenadeLob - Math.sign(e.deltaY) * 0.2));
        return;
      }
      this.camDist += Math.sign(e.deltaY) * 3;
      this.clampZoom();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      // typing in chat (or any text field) must not move the soldier
      if ((e.target as HTMLElement)?.tagName === 'INPUT') { this.keys.clear(); return; }
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      // M2 DOUBLE-TAP VERBS (Robert: "dashing forward, rolling to the sides"):
      // two taps of W inside 260ms = dash; A/D = side roll. The sim only
      // sees the verb — timing taste lives here where it belongs.
      if (k === 'w' || k === 'a' || k === 'd') {
        const now = performance.now();
        if (this.lastTap.key === k && now - this.lastTap.at < 260) {
          this.oneShot.dash = k === 'w' ? 1 : k === 'a' ? 2 : 3;
          this.lastTap.at = 0; // a triple-tap is two taps, not two dashes
        } else {
          this.lastTap = { key: k, at: now };
        }
      }
      // M1 SLIDE-OFF-SPRINT: C while SPRINTING and moving = drop to a skid
      // (dash channel verb 4). Checked before C joins the key set, so shift +
      // a movement key must already be held. A standing crouch stays a duck.
      if (k === 'c' && this.keys.has('shift')
          && (this.keys.has('w') || this.keys.has('a') || this.keys.has('s') || this.keys.has('d'))) {
        this.oneShot.dash = 4;
      }
      this.keys.add(k);
      if (k === ' ') this.spaceDownAt = performance.now(); // W1.3: start the tap/hold clock
      if (k === 'r') this.oneShot.reload = true;
      if (k === 'g') this.grenadeAiming = true; // hold to aim — throw on release
      if (k === 'q') this.oneShot.ability = true;
      if (k === 'e') this.oneShot.use = true;
      if (k === 'x') this.oneShot.nadeCycle = true; // rotate the grenade bag
      if (k === 'b') this.oneShot.cycleAmmo = true; // ammo TYPE: ball → AP → INC
      if (k === 'z') this.oneShot.grapple = true;   // GRAPPLE: grab (beats GUARD) §12
      if (k === 't') this.oneShot.torch = true;     // FLASHLIGHT toggle (§10)
      if (k === 'k') this.oneShot.k9 = 'sic';       // K9: clear aimed building
      if (k === 'l') this.oneShot.k9 = 'stay';      // K9: stay / return to heel
      if (k === 'f') this.meleeDown = true;         // hold to charge (§13); release commits
      if (k >= '1' && k <= '3') this.oneShot.weaponSlot = parseInt(k) - 1;
      if (k === 'tab') { this.scoreboardHeld = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      // W1.3: a quick tap of SPACE is a JUMP; a long hold was a duck — and if
      // a direction is still held at release, the duck was a COIL: leap.
      if (k === ' ') {
        const held = performance.now() - this.spaceDownAt;
        if (held < SPACE_TAP_MS) this.oneShot.spaceJump = true;
        else {
          const hasDir = this.keys.has('w') || this.keys.has('a') || this.keys.has('s') || this.keys.has('d');
          this.oneShot.leap = leapChargeOnRelease(false, held, hasDir);
        }
      }
      if (k === 'g' && this.grenadeAiming) { this.grenadeAiming = false; this.oneShot.grenade = true; }
      if (k === 'f' && this.meleeDown) { this.meleeDown = false; this.oneShot.melee = true; } // release = commit (§13)
      if (k === 'tab') this.scoreboardHeld = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.grenadeAiming = false; this.meleeDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.rightDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** World-space point under the cursor on the aim plane. */
  aimPoint(camera: THREE.Camera): THREE.Vector3 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(this.mouse.x, this.mouse.y), camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, out) ? out : null;
  }

  /** HUD buttons share the exact same one-shot path as keyboard/gamepad. */
  queueK9(command: K9Command) { this.oneShot.k9 = command; }

  /** Poll the first connected gamepad (PS/Xbox share the STANDARD mapping):
   *  left stick moves, right stick aims (twin-stick), RT fires, LT alt-fires,
   *  A/✕ jumps, X/□ uses, Y/△ ability, B/○ reloads, RB/R1 holds a grenade
   *  (release throws), LB/L1 cycles weapons, d-pad ◄► picks slots, d-pad ▲▼
   *  zooms, Back/Share holds the scoreboard. */
  private pollGamepad(local: Soldier, cmd: PlayerCmd) {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && [...pads].find((p) => p && p.mapping === 'standard') || (pads && pads[0]);
    if (!pad || !settings.padEnabled) { this.gamepadActive = false; return; }
    const dead = (v: number) => (Math.abs(v) < settings.padDeadzone ? 0 : v);
    const btn = (i: number) => !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.35;
    const rose = (i: number) => btn(i) && !this.prevPadButtons[i];

    // left stick: ANALOG movement (Robert: "slow when barely moved, full when
    // it's all the way"). A RADIAL deadzone, then the usable travel is rescaled
    // to span 0→1 so a gentle push crawls and a firm push runs — the sim already
    // honours sub-unit intent as sub-full speed (world.ts "normalize DOWN only").
    // The last of the travel spends into a SPRINT, so the stick reaches the
    // character's true top speed the way a keyboard player's SHIFT does.
    const lx = pad.axes[0] ?? 0, lz = pad.axes[1] ?? 0;
    const lmag = Math.hypot(lx, lz);
    if (lmag > settings.padDeadzone) {
      const { drive, sprint } = analogDrive(lmag, settings.padDeadzone);
      cmd.moveX = (lx / lmag) * drive;
      cmd.moveZ = (lz / lmag) * drive;
      if (sprint) cmd.sprint = true; // pushed all the way — the full-speed run
      this.gamepadActive = true;
    }

    // right stick: twin-stick aim — the last real deflection persists, so
    // letting the stick spring back doesn't snap your aim to zero
    const ax = dead(pad.axes[2] ?? 0), az = dead(settings.padInvertY ? -(pad.axes[3] ?? 0) : (pad.axes[3] ?? 0));
    const mag = Math.hypot(ax, az);
    if (mag > 0.25) {
      this.padAim = { yaw: Math.atan2(az, ax), dist: 8 + mag * 30 * settings.padSensitivity, has: true };
      this.gamepadActive = true;
    }
    if (this.gamepadActive && this.padAim.has) {
      cmd.aimYaw = this.padAim.yaw;
      cmd.aimDist = this.padAim.dist;
    }

    if (btn(7)) { cmd.fire = true; this.gamepadActive = true; }         // RT / R2
    if (btn(6)) { cmd.altFire = true; this.gamepadActive = true; }      // LT / L2
    if (btn(0)) cmd.jump = true;                                        // A / ✕
    if (rose(1)) cmd.reload = true;                                     // B / ○
    if (rose(2)) cmd.use = true;                                        // X / □
    if (rose(3)) cmd.ability = true;                                    // Y / △
    // RB/R1: hold aims the grenade (HUD arc), release lets it fly
    if (btn(5) && !this.padGrenadeAiming) { this.padGrenadeAiming = true; this.grenadeAiming = true; }
    if (!btn(5) && this.padGrenadeAiming) { this.padGrenadeAiming = false; this.grenadeAiming = false; cmd.grenade = true; }
    if (rose(4)) cmd.weaponSlot = (local.weaponIdx + 1) % Math.max(1, local.weapons.length); // LB cycles
    if (rose(14)) cmd.weaponSlot = 0;                                   // d-pad ◄ primary
    if (rose(15)) cmd.weaponSlot = 1;                                   // d-pad ► secondary
    if (rose(10)) { cmd.k9 = 'sic'; this.gamepadActive = true; }         // L3: clear aimed building
    if (rose(11)) { cmd.k9 = 'stay'; this.gamepadActive = true; }        // R3: stay / heel
    if (btn(12)) { this.camDist -= 24 * (1 / 60); this.clampZoom(); }   // d-pad ▲ zoom in
    if (btn(13)) { this.camDist += 24 * (1 / 60); this.clampZoom(); }   // d-pad ▼ zoom out
    this.scoreboardHeld = this.scoreboardHeld || btn(8);                // Back / Share

    this.prevPadButtons = pad.buttons.map((b, i) => btn(i));
  }

  buildCmd(local: Soldier, camera: THREE.Camera): PlayerCmd {
    let moveX = 0, moveZ = 0;
    if (this.keys.has('w')) moveZ -= 1;
    if (this.keys.has('s')) moveZ += 1;
    if (this.keys.has('a')) moveX -= 1;
    if (this.keys.has('d')) moveX += 1;

    let aimYaw = local.yaw;
    let aimDist = 12;
    const aim = this.aimPoint(camera);
    if (aim) {
      aimYaw = Math.atan2(aim.z - local.pos.z, aim.x - local.pos.x);
      aimDist = Math.hypot(aim.x - local.pos.x, aim.z - local.pos.z);
    }

    // W1.3: SPACE is tap-jump / hold-duck for ground classes; jetpack + ascended
    // bodies keep it as held thrust/flight (their duck stays on C).
    const klass = CLASSES[local.classId];
    const spaceHeldMode = local.ascendant !== undefined || klass?.ability === 'jetpack';
    const sp = resolveSpace(spaceHeldMode, this.keys.has(' '), performance.now() - this.spaceDownAt, this.oneShot.spaceJump);
    const cmd: PlayerCmd = {
      moveX, moveZ, aimYaw, aimDist,
      fire: this.mouse.down,
      altFire: this.mouse.rightDown,
      jump: sp.jump,
      crouch: this.keys.has('c') || sp.crouch, // DUCK: C, or HOLD space (§W1.3)
      guard: this.keys.has('v'),  // GUARD: held brace — blocks/parries melee (§12)
      use: this.oneShot.use,
      ability: this.oneShot.ability,
      reload: this.oneShot.reload,
      grenade: this.oneShot.grenade,
      weaponSlot: this.oneShot.weaponSlot,
      lob: this.grenadeLob,
      nadeCycle: this.oneShot.nadeCycle,
      sprint: this.keys.has('shift'), // M2: hold to run — the tank pays
      dash: this.oneShot.dash,
      leap: spaceHeldMode ? 0 : this.oneShot.leap, // §1: the coil released
      melee: this.oneShot.melee,   // M5: F released — throw/recall/commit
      meleeHold: this.meleeDown,   // §13: F held — charging the Power Strike
      cycleAmmo: this.oneShot.cycleAmmo, // B — ball/AP/incendiary
      grapple: this.oneShot.grapple,     // Z — the grab
      torch: this.oneShot.torch,         // T — the flashlight (§10)
      k9: this.oneShot.k9,
    };
    this.oneShot = { reload: false, grenade: false, ability: false, use: false, weaponSlot: -1, nadeCycle: false, dash: 0, melee: false, cycleAmmo: false, grapple: false, spaceJump: false, leap: 0, torch: false };
    // any mouse/keyboard input hands the wheel back to the desk
    if (cmd.moveX || cmd.moveZ || cmd.fire || this.mouse.down) this.gamepadActive = false;
    this.pollGamepad(local, cmd);
    // touch rides last — on a tablet the thumbs are the final word; the pinch
    // is the camera wheel
    if (this.touch) {
      if (this.touch.apply(cmd, local)) this.gamepadActive = false;
      const pinch = this.touch.drainPinch();
      if (pinch) { this.camDist += pinch; this.clampZoom(); }
    }
    // §8.8: a closing sky can shrink an already-wide view
    this.clampZoom();
    return cmd;
  }
}
