import { applySnapshot, createPuppetWorld, takeSnapshot, type Snapshot } from '../sim/snapshot';
import { WEAPONS } from '../sim/data';
import type { ModeId, PlayerCmd, ThemeId } from '../sim/types';
import type { World } from '../sim/world';
import type { TheaterId } from '../sim/theater-types';

const EMPTY_CMDS = new Map<number, PlayerCmd>();

// ---------------------------------------------------------------------------
// Replays. The sim is snapshot-serializable (that's how multiplayer works),
// so a replay is a ring buffer of recent timestamped snapshots played back
// into a puppet world. Two consumers, both run by the ReplayDirector:
//   • the KILLCAM — your final seconds, shown while you wait to respawn
//   • MATCH HIGHLIGHTS — the closing seconds looped after the final whistle
// ---------------------------------------------------------------------------

export const REPLAY_HZ = 10;       // snapshot cadence
export const REPLAY_KEEP_S = 14;   // ring depth in seconds
/**
 * THE DEATH CAM (Robert: "it cuts out too quick and the deaths aren't worth
 * seeing").
 *
 * The old cut fired `clip(KILLCAM_S)` at the instant the player died, and a
 * clip taken at that moment ENDS on the death frame. So the killcam showed
 * the seconds leading up to being killed and stopped exactly when the
 * interesting thing happened — you never saw your own death. That is not a
 * length problem, it is a WINDOW problem: the money shot was always off the
 * end of the tape.
 *
 * The fix rides a happy accident of the numbers. Playback runs in slow motion,
 * so it consumes footage at HALF the speed the recorder lays it down — the
 * recorder can never be caught. That means the cam can start the moment you
 * die and keep appending frames that haven't been filmed yet, streaming the
 * aftermath in as it happens. No waiting, no respawn changes, and the
 * viewing budget is exactly what it always was.
 *
 * KILLCAM_PRE is how much of the run-up we open on; the rest of the window
 * fills in live from beyond the grave.
 */
export const KILLCAM_PRE = 0.7;
/** Total footage a death cam will play — pre-roll plus the streamed aftermath. */
export const KILLCAM_S = 1.8;
export const KILLCAM_SPEED = 0.5;
/**
 * The impact deserves its own tempo. A flat 0.5× treats the shot that killed
 * you the same as the two seconds of walking before it, so nothing lands.
 * This ramps: brisk on the approach, a near-freeze THROUGH the hit, then a
 * middle speed for the fall so the body coming to rest is legible.
 */
export function killcamSpeedAt(sinceDeath: number): number {
  if (sinceDeath < -0.35) return 0.75;              // the run-up: keep it moving
  if (sinceDeath < 0.18) return 0.15;               // the hit: almost stopped
  return 0.45;                                       // the fall, and the stillness after
}
/** Killcam camera: pulled in tight on the fight instead of the player's zoom. */
export const KILLCAM_CAM = 14;

/** THE DIRECTOR'S SHOT TABLE (DEATH-DATA §5, Robert: "the death cam should vary
 *  by death"). One fixed presentation made every death read the same; the
 *  director now frames the death by HOW it happened — a spawn-cut that barely
 *  lived, a blast pulled WIDE to show it, the precision AUTOPSY of a rail from
 *  range, the long bullet you RIDE in on, or the straight duel. Each shot owns a
 *  banner, a camera pull, and a tempo. Pure + branch-ordered so a fresh-spawn
 *  death tells its own story first. */
export type KillcamKind = 'spawn' | 'wide' | 'autopsy' | 'ride' | 'duel';
export interface KillcamShot { kind: KillcamKind; label: string; cam: number; brisk: boolean }
export function pickKillcamShot(p: {
  killerName?: string; weaponName?: string; tracer?: string; splash?: number; range: number; timeAlive: number;
}): KillcamShot {
  const by = p.killerName
    ? `${p.killerName}${p.weaponName ? ` · ${p.weaponName}` : ''} · ${p.range}u`
    : 'the field';
  // cut down within moments of printing — you barely drew breath
  if (p.killerName && p.timeAlive < 4) return { kind: 'spawn', label: `▪ SPAWN CUT — ${by}`, cam: 16, brisk: true };
  // a blast: pull the camera back to show what took you
  if ((p.splash ?? 0) > 0) return { kind: 'wide', label: `◎ THE WIDE — ${by}`, cam: 22, brisk: false };
  // a precision beam/rail from range earns the terminal-UI autopsy
  if ((p.tracer === 'rail' || p.tracer === 'beam') && p.range >= 30) return { kind: 'autopsy', label: `⌖ AUTOPSY — ${by}`, cam: 12, brisk: false };
  // a long bullet/shell: ride the round in from the muzzle
  if ((p.tracer === 'bullet' || p.tracer === 'shell') && p.range >= 40) return { kind: 'ride', label: `▸ RIDE THE ROUND — ${by}`, cam: 15, brisk: false };
  // the straight duel — the default frame
  return { kind: 'duel', label: p.killerName ? `☠ Killed by ${by}` : '☠ Killcam', cam: KILLCAM_CAM, brisk: false };
}
export const HIGHLIGHTS_S = 10;

/** Post-match linger before returning to the menu. The multiplayer client
 *  exits earlier because the SERVER restarts its room 12s after the whistle
 *  (src/server/server.ts) — the client must leave before the world resets. */
export const MATCH_LINGER_LOCAL_MS = 22000;
export const MATCH_LINGER_NET_MS = 9000;

export interface ReplayFrame { t: number; snap: Snapshot }

/** Rolling recorder — call record() every client frame; it self-throttles. */
export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private nextAt = 0;

  record(world: World) {
    if (world.time < this.nextAt) return;
    this.nextAt = world.time + 1 / REPLAY_HZ;
    // deep-freeze the snapshot so later sim mutation can't corrupt history
    this.frames.push({ t: world.time, snap: structuredClone(takeSnapshot(world, [])) });
    const cutoff = world.time - REPLAY_KEEP_S;
    while (this.frames.length && this.frames[0].t < cutoff) this.frames.shift();
  }

  /** The last `seconds` of footage (up to the ring depth), timestamps included. */
  clip(seconds: number): ReplayFrame[] {
    if (!this.frames.length) return [];
    const endT = this.frames[this.frames.length - 1].t;
    return this.frames.filter((f) => f.t >= endT - seconds);
  }

  /** Everything filmed strictly after `t` — how the death cam gets its future. */
  since(t: number): ReplayFrame[] {
    return this.frames.filter((f) => f.t > t);
  }

  get depth(): number {
    return this.frames.length ? this.frames[this.frames.length - 1].t - this.frames[0].t : 0;
  }
}

/**
 * Plays a clip into a puppet world at recorded-time speed. Rendering a replay
 * is just pointing the renderer at `player.world` while `player.active`.
 */
export class ReplayPlayer {
  world: World;
  active = false;
  label = '';
  loop = false;
  /** playback rate — 1 realtime, <1 slow motion (the killcam runs at 0.5×) */
  speed = 1;
  private frames: ReplayFrame[] = [];
  private idx = 0;
  private clock = 0; // playback time, in recorded-world seconds

  constructor(seed: number, mode: ModeId, theme: ThemeId | undefined, theaterId?: TheaterId, mapIdentity?: string) {
    this.world = createPuppetWorld(seed, mode, theme, theaterId, mapIdentity);
  }

  /** Recorded time to stop at. Set for a STREAMING clip whose tail has not
   *  been filmed yet — without it, running dry would end the cam early. */
  endT: number | undefined;
  /** Optional speed curve keyed on recorded time; overrides `speed`. */
  speedFn: ((recordedT: number) => number) | undefined;

  start(frames: ReplayFrame[], label: string, loop = false, speed = 1,
        opts: { endT?: number; speedFn?: (t: number) => number } = {}) {
    if (frames.length < 2) return; // nothing worth replaying
    this.frames = frames;
    this.label = label;
    this.loop = loop;
    this.speed = speed;
    this.endT = opts.endT;
    this.speedFn = opts.speedFn;
    this.idx = 0;
    this.clock = frames[0].t;
    this.active = true;
    this.apply(0);
  }

  stop() {
    this.active = false;
  }

  /** Newest recorded timestamp this player is holding. */
  get lastT(): number {
    return this.frames.length ? this.frames[this.frames.length - 1].t : 0;
  }

  /**
   * Feed footage filmed AFTER playback began. Slow motion consumes frames at
   * half the rate the recorder produces them, so the tape can be written
   * ahead of the playhead forever — this is what lets a death cam show the
   * aftermath of a death that had not happened when the cam started.
   */
  append(frames: ReplayFrame[]) {
    if (!this.active || !frames.length) return;
    const last = this.lastT;
    for (const f of frames) if (f.t > last) this.frames.push(f);
  }

  /** Apply frame `i` — CLONED, because applySnapshot aliases nested objects
   *  into the puppet world, and the puppet's dead-reckoning step would
   *  otherwise write straight into the recorded ring (clips drift a little
   *  more on every loop — empirically ~0.35u per pass before this guard). */
  private apply(i: number) {
    this.idx = i;
    applySnapshot(this.world, structuredClone(this.frames[i].snap));
    this.world.takeEvents(); // replay is silent — discard event pings
  }

  /** Advance playback by dt seconds, pacing on the RECORDED timestamps
   *  (frames aren't guaranteed to be exactly 1/REPLAY_HZ apart — at 30fps
   *  they land ~0.13s apart, and assuming 0.1 played footage fast). */
  tick(dt: number): boolean {
    if (!this.active) return false;
    const rate = this.speedFn ? this.speedFn(this.clock) : this.speed;
    const rdt = dt * rate; // slow motion scales the whole puppet world
    this.clock += rdt;
    while (this.idx + 1 < this.frames.length && this.frames[this.idx + 1].t <= this.clock) {
      this.apply(this.idx + 1);
    }
    if (this.endT !== undefined) {
      // STREAMING: the tail is still being filmed. Only the deadline ends
      // this cam — running out of frames just means dead-reckoning for a beat
      // until the recorder catches up (at half speed, it always does).
      if (this.clock >= this.endT) { this.active = false; return false; }
    } else if (this.idx >= this.frames.length - 1 && this.clock >= this.frames[this.frames.length - 1].t) {
      if (!this.loop) {
        this.active = false;
        return false;
      }
      this.clock = this.frames[0].t;
      this.apply(0);
    }
    // dead-reckon between snapshots so motion stays smooth
    this.world.step(rdt, EMPTY_CMDS);
    return true;
  }
}

/**
 * The director owns the whole killcam/highlights state machine so the local
 * and multiplayer frame loops share one implementation instead of two
 * hand-rolled flag sets.
 */
export class ReplayDirector {
  readonly recorder = new ReplayRecorder();
  readonly player: ReplayPlayer;
  private wasAlive = true;
  /** who killed the local player this killcam (-1 = self/environment) — the
   *  renderer frames the DUEL between the corpse and this soldier */
  killerId = -1;
  /** World time the local player died — the anchor the speed ramp bends around. */
  deathT = 0;
  /** The camera pull for the current killcam shot — the director varies it by
   *  death (tight autopsy → wide blast). The caller reads it while killcamActive. */
  killcamCam = KILLCAM_CAM;

  constructor(seed: number, mode: ModeId, theme: ThemeId | undefined, theaterId?: TheaterId, mapIdentity?: string) {
    this.player = new ReplayPlayer(seed, mode, theme, theaterId, mapIdentity);
  }

  /** True once the post-match highlight loop has taken over. */
  get highlightsRolling(): boolean {
    return this.player.active && this.player.loop;
  }

  /** True while the slow-mo killcam plays — the caller pulls the camera in tight. */
  get killcamActive(): boolean {
    return this.player.active && !this.player.loop;
  }

  /**
   * Call once per frame after the live world has stepped. Returns the world
   * to render and the banner text (null = hide). While highlights roll, the
   * caller should stop stepping/recording the live world entirely.
   */
  update(world: World, meId: number, dt: number): { renderWorld: World; banner: string | null } {
    const me = world.soldiers.get(meId);
    if (!this.highlightsRolling) this.recorder.record(world);

    // killcam: your final seconds in slow motion while the respawn timer runs.
    // It answers the question every death asks — WHERE did that come from? —
    // by framing you and your killer together and naming them on the banner.
    if (me && !me.alive && this.wasAlive && !world.mode.over && this.recorder.depth > 2) {
      this.killerId = me.lastKillerId;
      const killer = this.killerId >= 0 ? world.soldiers.get(this.killerId) : undefined;
      const range = killer ? Math.round(Math.hypot(killer.pos.x - me.pos.x, killer.pos.z - me.pos.z)) : 0;
      // DEATH-DATA §5: the DIRECTOR frames the death by how it happened — a
      // spawn-cut, a blast pulled wide, a precision autopsy, a ridden round, or
      // the straight duel. Each shot owns its banner, camera pull, and tempo.
      const wdef = me.lastKillWeapon ? WEAPONS[me.lastKillWeapon] : undefined;
      const timeAlive = me.spawnedAt !== undefined ? world.time - me.spawnedAt : 99;
      const shot = pickKillcamShot({
        killerName: killer?.name, weaponName: wdef?.name, tracer: wdef?.tracer,
        splash: wdef?.splash, range, timeAlive,
      });
      this.killcamCam = shot.cam;
      // open on the run-up, and run PAST the death into footage that does not
      // exist yet — the recorder fills it in while we watch (see KILLCAM_PRE)
      this.deathT = world.time;
      const dT = world.time;
      this.player.start(this.recorder.clip(KILLCAM_PRE), shot.label, false, KILLCAM_SPEED, {
        endT: world.time + (KILLCAM_S - KILLCAM_PRE),
        // a spawn-cut is brisk — you barely lived, so don't dwell; the rest ramp
        speedFn: shot.brisk ? () => 0.72 : (t) => killcamSpeedAt(t - dT),
      });
    }
    // keep the tape ahead of the playhead for as long as the death cam runs
    if (this.killcamActive) this.player.append(this.recorder.since(this.player.lastT));
    if (me && me.alive && !this.wasAlive && !this.player.loop) {
      this.player.stop();
    }
    if (me) this.wasAlive = me.alive;

    // match highlights: the closing seconds, looped until the menu returns
    if (world.mode.over && !this.highlightsRolling && this.recorder.depth > 3) {
      this.player.start(this.recorder.clip(HIGHLIGHTS_S), '★ Match Highlights', true);
    }

    if (this.player.active && this.player.tick(dt)) {
      return { renderWorld: this.player.world, banner: this.player.label };
    }
    return { renderWorld: world, banner: null };
  }
}
