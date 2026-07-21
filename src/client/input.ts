import * as THREE from 'three';
import type { PlayerCmd, Soldier } from '../sim/types';

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
  private oneShot = { reload: false, grenade: false, ability: false, use: false, weaponSlot: -1, nadeCycle: false, dash: 0, melee: false, cycleAmmo: false };
  /** M2 double-tap tracker for dash/roll */
  private lastTap = { key: '', at: 0 };

  static readonly CAM_MIN = 16;
  static readonly CAM_MAX = 80; // command height — semantic zoom keeps it readable
  /** §8.8: heavy weather closes the long view — set from the sim each frame */
  weatherZoomCap = Infinity;
  /** true when a gamepad drove the last command — HUD may swap its prompts */
  gamepadActive = false;
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
      this.keys.add(k);
      if (k === 'r') this.oneShot.reload = true;
      if (k === 'g') this.grenadeAiming = true; // hold to aim — throw on release
      if (k === 'q') this.oneShot.ability = true;
      if (k === 'e') this.oneShot.use = true;
      if (k === 'x') this.oneShot.nadeCycle = true; // rotate the grenade bag
      if (k === 'b') this.oneShot.cycleAmmo = true; // ammo TYPE: ball → AP → INC
      if (k === 'f') this.oneShot.melee = true;     // M5: throw the axe / call it home
      if (k >= '1' && k <= '3') this.oneShot.weaponSlot = parseInt(k) - 1;
      if (k === 'tab') { this.scoreboardHeld = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === 'g' && this.grenadeAiming) { this.grenadeAiming = false; this.oneShot.grenade = true; }
      if (k === 'tab') this.scoreboardHeld = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.grenadeAiming = false; });
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

  /** Poll the first connected gamepad (PS/Xbox share the STANDARD mapping):
   *  left stick moves, right stick aims (twin-stick), RT fires, LT alt-fires,
   *  A/✕ jumps, X/□ uses, Y/△ ability, B/○ reloads, RB/R1 holds a grenade
   *  (release throws), LB/L1 cycles weapons, d-pad ◄► picks slots, d-pad ▲▼
   *  zooms, Back/Share holds the scoreboard. */
  private pollGamepad(local: Soldier, cmd: PlayerCmd) {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && [...pads].find((p) => p && p.mapping === 'standard') || (pads && pads[0]);
    if (!pad) { this.gamepadActive = false; return; }
    const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    const btn = (i: number) => !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.35;
    const rose = (i: number) => btn(i) && !this.prevPadButtons[i];

    // left stick: movement
    const mx = dead(pad.axes[0] ?? 0), mz = dead(pad.axes[1] ?? 0);
    if (mx !== 0 || mz !== 0) { cmd.moveX = mx; cmd.moveZ = mz; this.gamepadActive = true; }

    // right stick: twin-stick aim — the last real deflection persists, so
    // letting the stick spring back doesn't snap your aim to zero
    const ax = dead(pad.axes[2] ?? 0), az = dead(pad.axes[3] ?? 0);
    const mag = Math.hypot(ax, az);
    if (mag > 0.25) {
      this.padAim = { yaw: Math.atan2(az, ax), dist: 8 + mag * 30, has: true };
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

    const cmd: PlayerCmd = {
      moveX, moveZ, aimYaw, aimDist,
      fire: this.mouse.down,
      altFire: this.mouse.rightDown,
      jump: this.keys.has(' '),
      crouch: this.keys.has('c'), // DUCK: held stance (finish-list 18)
      use: this.oneShot.use,
      ability: this.oneShot.ability,
      reload: this.oneShot.reload,
      grenade: this.oneShot.grenade,
      weaponSlot: this.oneShot.weaponSlot,
      lob: this.grenadeLob,
      nadeCycle: this.oneShot.nadeCycle,
      sprint: this.keys.has('shift'), // M2: hold to run — the tank pays
      dash: this.oneShot.dash,
      melee: this.oneShot.melee,   // M5: F — the axe
      cycleAmmo: this.oneShot.cycleAmmo, // B — ball/AP/incendiary
    };
    this.oneShot = { reload: false, grenade: false, ability: false, use: false, weaponSlot: -1, nadeCycle: false, dash: 0, melee: false, cycleAmmo: false };
    // any mouse/keyboard input hands the wheel back to the desk
    if (cmd.moveX || cmd.moveZ || cmd.fire || this.mouse.down) this.gamepadActive = false;
    this.pollGamepad(local, cmd);
    // §8.8: a closing sky can shrink an already-wide view
    this.clampZoom();
    return cmd;
  }
}
