import { MODE_INFO } from '../sim/data';
import { applySnapshot, type Snapshot } from '../sim/snapshot';
import type { ClassId, ModeId, PlayerCmd } from '../sim/types';
import { World } from '../sim/world';
import type { Hud } from './hud';
import type { Input } from './input';
import type { Renderer } from './renderer';

interface WelcomeMsg { t: 'welcome'; id: number; seed: number; mode: ModeId; }
interface SnapMsg { t: 'snap'; snap: Snapshot; }

/** Multiplayer client: authoritative server snapshots + local dead-reckoning between them. */
export class NetGame {
  private ws!: WebSocket;
  private myId = -1;
  private world: World | null = null;
  private pendingEvents: Snapshot['events'] = [];

  constructor(
    private url: string,
    private name: string,
    private classId: ClassId,
    private mode: ModeId,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      const timeout = setTimeout(() => { this.ws.close(); reject(new Error('timeout')); }, 5000);
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ t: 'join', name: this.name, classId: this.classId, mode: this.mode }));
      };
      this.ws.onerror = () => { clearTimeout(timeout); reject(new Error('ws error')); };
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as WelcomeMsg | SnapMsg;
        if (msg.t === 'welcome') {
          clearTimeout(timeout);
          this.myId = msg.id;
          this.world = new World({ seed: msg.seed, mode: msg.mode });
          this.world.puppet = true;
          // clear locally-generated entities — server state is the truth
          this.world.soldiers.clear();
          this.world.vehicles.clear();
          this.world.pickups.clear();
          this.world.takeEvents();
          resolve();
        } else if (msg.t === 'snap' && this.world) {
          applySnapshot(this.world, msg.snap);
          this.pendingEvents.push(...msg.snap.events);
        }
      };
    });
  }

  run(renderer: Renderer, hud: Hud, input: Input, endGame: () => void) {
    const world = this.world!;
    renderer.buildStaticWorld(world);
    hud.announce(`${MODE_INFO[world.mode.id].name.toUpperCase()} — ONLINE`, true, 0);

    let last = performance.now();
    let lastCmdAt = 0;
    let overAt = 0;
    let stopped = false;
    this.ws.onclose = () => {
      if (!stopped) hud.announce('Disconnected from server', true, world.time);
      setTimeout(endGame, 2500);
      stopped = true;
    };

    const cmds = new Map<number, PlayerCmd>();
    const frame = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const me = world.soldiers.get(this.myId);
      if (me && this.ws.readyState === WebSocket.OPEN && now - lastCmdAt > 33) {
        lastCmdAt = now;
        const cmd = input.buildCmd(me, renderer.camera);
        this.ws.send(JSON.stringify({ t: 'cmd', cmd }));
        // apply own movement immediately for responsiveness
        if (me.alive && me.vehicleId < 0) {
          me.yaw = cmd.aimYaw;
          const len = Math.hypot(cmd.moveX, cmd.moveZ) || 1;
          me.vel.x = (cmd.moveX / len) * 10;
          me.vel.z = (cmd.moveZ / len) * 10;
        }
      }
      world.step(dt, cmds); // puppet: extrapolate only

      const events = this.pendingEvents;
      this.pendingEvents = [];
      renderer.applyEvents(events, world, this.myId);
      hud.applyEvents(events, world, this.myId, world.time);
      renderer.update(world, this.myId, dt);
      if (me) hud.update(world, this.myId, input.scoreboardHeld, world.time);

      if (world.mode.over) {
        if (!overAt) overAt = now;
        else if (now - overAt > 9000) { stopped = true; this.ws.close(); endGame(); return; }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
