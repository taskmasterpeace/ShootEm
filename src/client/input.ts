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
  private oneShot = { reload: false, grenade: false, ability: false, use: false, weaponSlot: -1 };

  static readonly CAM_MIN = 16;
  static readonly CAM_MAX = 55;

  constructor(private canvas: HTMLCanvasElement) {
    // mouse wheel: see further (out) or fight closer (in)
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camDist = Math.max(Input.CAM_MIN, Math.min(Input.CAM_MAX, this.camDist + Math.sign(e.deltaY) * 3));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      // typing in chat (or any text field) must not move the soldier
      if ((e.target as HTMLElement)?.tagName === 'INPUT') { this.keys.clear(); return; }
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'r') this.oneShot.reload = true;
      if (k === 'g') this.grenadeAiming = true; // hold to aim — throw on release
      if (k === 'q') this.oneShot.ability = true;
      if (k === 'e') this.oneShot.use = true;
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
      use: this.oneShot.use,
      ability: this.oneShot.ability,
      reload: this.oneShot.reload,
      grenade: this.oneShot.grenade,
      weaponSlot: this.oneShot.weaponSlot,
    };
    this.oneShot = { reload: false, grenade: false, ability: false, use: false, weaponSlot: -1 };
    return cmd;
  }
}
