// ---------------------------------------------------------------------------
// PER-CLIENT INPUT QUEUE (opt #3 / N3) — the server stored one latest-wins cmd
// and re-applied it every 30 Hz tick, which had two failure modes:
//   1. LOST PRESSES — when jitter bunches two ~30 Hz cmds into one server tick,
//      the first was silently overwritten, eating one-shot flags (use/E,
//      reload, grenade, ability, dash, melee, weaponSlot, nadeCycle — the
//      client clears them after one send and never re-sends).
//   2. STUCK CMDS — never aged: a background-tab stall (the client's RAF send
//      loop stops) left held fire firing and moveZ walking forever.
//
// The fix: a small per-client queue. tick() drains one per tick, so no bunched
// press is lost; when the queue is empty we reuse the last cmd with ONE-SHOT
// flags zeroed (held move/fire/sprint/crouch continue, a press never repeats);
// and when the newest cmd is older than STALE_MS we zero movement + fire, so a
// dead tab stands still instead of walking into the sea.
//
// Pure and side-effect-free so it can be unit-tested without a live socket —
// tests/input-queue.test.ts is the law.
// ---------------------------------------------------------------------------
import type { PlayerCmd } from '../sim/types';

export const CMD_QUEUE_CAP = 8;
export const STALE_MS = 250;

export interface CmdQueueState {
  queue: PlayerCmd[];
  /** the last drained cmd with one-shots zeroed — what a starved tick repeats */
  lastLive: PlayerCmd | null;
  /** wall-clock of the newest received cmd (server time; not the sim) */
  lastRecvAt: number;
}

export function newCmdQueue(): CmdQueueState {
  return { queue: [], lastLive: null, lastRecvAt: 0 };
}

export function resetCmdQueue(s: CmdQueueState): void {
  s.queue.length = 0;
  s.lastLive = null;
  s.lastRecvAt = 0;
}

/** A cmd's one-shot intents fire exactly once; strip them for a repeat. */
export function zeroOneShots(c: PlayerCmd): PlayerCmd {
  return { ...c, use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, dash: 0, melee: false, nadeCycle: false };
}

/** A stale client stands still — kill movement, fire, and jetpack. */
function stall(c: PlayerCmd): PlayerCmd {
  return { ...c, moveX: 0, moveZ: 0, fire: false, altFire: false, jump: false, sprint: false };
}

/** Enqueue an inbound cmd; drop the OLDEST if the cap is hit (keep the newest). */
export function pushCmd(s: CmdQueueState, cmd: PlayerCmd, now: number): void {
  if (s.queue.length >= CMD_QUEUE_CAP) s.queue.shift();
  s.queue.push(cmd);
  s.lastRecvAt = now;
}

/** The cmd to apply this tick: one drained press, else the held-only repeat,
 *  aged to a standstill if the client has gone quiet past STALE_MS. */
export function drainCmd(s: CmdQueueState, now: number): PlayerCmd | null {
  let cmd: PlayerCmd | null;
  if (s.queue.length) {
    cmd = s.queue.shift()!;
    s.lastLive = zeroOneShots(cmd); // the next starved tick repeats HELD inputs only
  } else {
    cmd = s.lastLive;
  }
  if (cmd && now - s.lastRecvAt > STALE_MS) cmd = stall(cmd);
  return cmd;
}
