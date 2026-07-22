import { MODE_INFO } from '../sim/data';
import { applySnapshot, createPuppetWorld, type Snapshot } from '../sim/snapshot';
import type { ClassId, ModeId, PlayerCmd, Team, ThemeId } from '../sim/types';
import { StableConsole } from './stable';
import { World, type Loadout } from '../sim/world';
import { audio } from './audio';
import type { Chat } from './chat';
import { StaticOverlay } from './effects';
import type { Hud } from './hud';
import type { Input } from './input';
import { KILLCAM_CAM, MATCH_LINGER_NET_MS, ReplayDirector } from './replay';
import { onMatchEnd } from './onboarding';
import type { Renderer } from './renderer';
import type { DamageText } from './damagetext';
import type { TheaterId } from '../sim/theater-types';

interface WelcomeMsg { t: 'welcome'; id: number; seed: number; mode: ModeId; theme?: ThemeId; theaterId?: TheaterId; mapIdentity?: string; }
interface SnapMsg { t: 'snap'; snap: Snapshot; }
interface ChatMsgWire { t: 'chat'; channel: string; from: string; fromTeam: number; text: string; }
interface MailMsgWire { t: 'mail'; items: { from: string; text: string; at: number }[]; }
interface WpMsgWire { t: 'wp'; x: number; z: number; by: string; }

/** Multiplayer client: authoritative server snapshots + local dead-reckoning between them. */
export class NetGame {
  private ws!: WebSocket;
  private myId = -1;
  private world: World | null = null;
  private director: ReplayDirector | null = null;
  private pendingEvents: Snapshot['events'] = [];

  constructor(
    private url: string,
    private name: string,
    private classId: ClassId,
    private mode: ModeId,
    private loadout: Loadout,
    private chat: Chat,
    private hud: Hud,
    private commissioned = false,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      const timeout = setTimeout(() => { this.ws.close(); reject(new Error('timeout')); }, 5000);
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ t: 'join', name: this.name, classId: this.classId, mode: this.mode, loadout: this.loadout }));
      };
      this.ws.onerror = () => { clearTimeout(timeout); reject(new Error('ws error')); };
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as WelcomeMsg | SnapMsg | ChatMsgWire | MailMsgWire | WpMsgWire;
        if (msg.t === 'welcome') {
          clearTimeout(timeout);
          this.myId = msg.id;
          // puppet world: server state is the truth
          this.world = createPuppetWorld(msg.seed, msg.mode, msg.theme, msg.theaterId, msg.mapIdentity);
          this.director = new ReplayDirector(msg.seed, msg.mode, msg.theme, msg.theaterId, msg.mapIdentity);
          // comms flow through the server once online
          this.chat.onSend = (m) => {
            if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'chat', channel: m.channel, text: m.text }));
          };
          this.chat.onMail = (to, text) => {
            if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'mail', to, text }));
            this.chat.push({ channel: 'SYS', from: '', text: `Message stored for ${to} on the server.`, system: true });
          };
          this.hud.onWaypoint = (x, z) => {
            if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'wp', x, z }));
          };
          // THE STABLE over the wire (finish-list #5): the client asks, the
          // server's requestLsw judges — faction, slot, and purse alike.
          new StableConsole({
            mode: msg.mode,
            commissioned: this.commissioned,
            team: () => (this.world?.soldiers.get(this.myId)?.team ?? 0) as Team,
            call: (id) => {
              if (this.ws.readyState !== WebSocket.OPEN) return false;
              this.ws.send(JSON.stringify({ t: 'lsw', id }));
              return true; // the announcer is the receipt
            },
            stock: () => -1, // command holds the ledger
          });
          resolve();
        } else if (msg.t === 'snap' && this.world) {
          applySnapshot(this.world, msg.snap);
          this.pendingEvents.push(...msg.snap.events);
        } else if (msg.t === 'chat' && this.world) {
          // TEAM channel only reaches teammates; customs reach subscribers
          const me = this.world.soldiers.get(this.myId);
          if (msg.channel === 'TEAM' && me && msg.fromTeam !== me.team) return;
          if (this.chat.subscribed(msg.channel)) this.chat.push({ channel: msg.channel, from: msg.from, text: msg.text });
        } else if (msg.t === 'mail') {
          this.chat.deliverServerMail(msg.items);
        } else if (msg.t === 'wp') {
          this.hud.addWaypoint(msg.x, msg.z, msg.by);
        }
      };
    });
  }

  run(renderer: Renderer, dmgText: DamageText, hud: Hud, input: Input, endGame: () => void) {
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
    // FPV drone feed: static builds as the link degrades; bursts on disconnect
    const staticFx = new StaticOverlay();
    let hadDrone = false;
    let nextStaticAt = 0;
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
      hud.applyEvents(events, world, this.myId, world.time);

      // killcam + match highlights, same director as offline play
      const banner = document.getElementById('replay-banner');
      const cut = this.director
        ? this.director.update(world, this.myId, dt)
        : { renderWorld: world, banner: null };
      const replaying = cut.renderWorld !== world;
      if (banner) {
        banner.classList.toggle('hidden', !cut.banner);
        if (cut.banner) banner.textContent = cut.banner;
      }
      if (!replaying) renderer.applyEvents(events, world, this.myId);
      if (!replaying) dmgText.applyEvents(events, this.myId); // floating -HP (red) / -ARMOR (blue), YOURS only
      renderer.replayView = replaying;
      // killcam pulls in tight on the fight; otherwise the player's wheel zoom
      renderer.camDist = replaying && this.director?.killcamActive ? KILLCAM_CAM : input.camDist;
      // duel framing: show the killer, answer "where did that come from?"
      renderer.killcamFocusId = replaying && this.director?.killcamActive ? this.director.killerId : -1;
      // grenade throw preview: hold G → arc + landing ring at the cursor
      renderer.setGrenadePreview(world, me, !replaying && input.grenadeAiming ? input.aimPoint(renderer.camera) : null);
      // the cursor drives hover-to-read vitals (renderer.setHover)
      renderer.setHover(replaying ? null : input.aimPoint(renderer.camera));
      renderer.update(cut.renderWorld, this.myId, dt, hud.getWaypoints());
      dmgText.update(dt, renderer.camera); // project the floating numbers after the camera moves
      if (me) hud.update(world, this.myId, input.scoreboardHeld, world.time);

      // FPV drone feed: noise rises as the signal drops; disconnect = full burst
      const fpv = world.getPilotedDrone(this.myId);
      staticFx.set(fpv ? Math.pow(1 - (fpv.signal ?? 1), 1.15) : 0);
      if (fpv && (fpv.signal ?? 1) < 0.45 && world.time > nextStaticAt) {
        audio.play('drone_static', { volume: 0.25 + (1 - (fpv.signal ?? 1)) * 0.6 });
        nextStaticAt = world.time + 0.75;
      }
      if (hadDrone && !fpv) { staticFx.flash(0.6); audio.play('drone_static', { volume: 0.9 }); }
      hadDrone = !!fpv;
      staticFx.update();

      // exit before the SERVER restarts its room (12s after the whistle)
      if (world.mode.over) {
        if (!overAt) {
          overAt = now;
          // §14: online matches advance the onboarding machine too — a war
          // drop on a real server counts the same as one against bots
          onMatchEnd(world, this.myId, world.mode.id);
        }
        else if (now - overAt > MATCH_LINGER_NET_MS) { stopped = true; this.ws.close(); endGame(); return; }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
