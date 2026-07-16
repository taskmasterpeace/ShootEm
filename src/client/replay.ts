import { applySnapshot, createPuppetWorld, takeSnapshot, type Snapshot } from '../sim/snapshot';
import type { ModeId, PlayerCmd, ThemeId } from '../sim/types';
import type { World } from '../sim/world';

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
/** Killcam footage length. Played in SLOW MOTION (KILLCAM_SPEED), so the
 *  realtime viewing window is KILLCAM_S / KILLCAM_SPEED — that must fit inside
 *  RESPAWN_DELAY (4s in world.ts) with room to spare, or the respawn cuts
 *  playback before the kill is ever shown. 1.8s / 0.5 = 3.6s of viewing. */
export const KILLCAM_S = 1.8;
export const KILLCAM_SPEED = 0.5;
/** Killcam camera: pulled in tight on the fight instead of the player's zoom. */
export const KILLCAM_CAM = 14;
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

  constructor(seed: number, mode: ModeId, theme: ThemeId | undefined) {
    this.world = createPuppetWorld(seed, mode, theme);
  }

  start(frames: ReplayFrame[], label: string, loop = false, speed = 1) {
    if (frames.length < 2) return; // nothing worth replaying
    this.frames = frames;
    this.label = label;
    this.loop = loop;
    this.speed = speed;
    this.idx = 0;
    this.clock = frames[0].t;
    this.active = true;
    this.apply(0);
  }

  stop() {
    this.active = false;
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
    const rdt = dt * this.speed; // slow motion scales the whole puppet world
    this.clock += rdt;
    while (this.idx + 1 < this.frames.length && this.frames[this.idx + 1].t <= this.clock) {
      this.apply(this.idx + 1);
    }
    if (this.idx >= this.frames.length - 1 && this.clock >= this.frames[this.frames.length - 1].t) {
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

  constructor(seed: number, mode: ModeId, theme: ThemeId | undefined) {
    this.player = new ReplayPlayer(seed, mode, theme);
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
      const label = killer ? `☠ Killed by ${killer.name} · ${range}u` : '☠ Killcam';
      this.player.start(this.recorder.clip(KILLCAM_S), label, false, KILLCAM_SPEED);
    }
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
