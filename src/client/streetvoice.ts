// ═══════════════════════════════════════════════════════════════════════════
// THE STREET SPEAKS — the client half of street VO.
//
// Robert: *"create vigilante and pedestrian audio. think gta2."*
//
// The catalogue and picker are in streetvo.ts; the street's temper is in
// streetheat.ts; this is what watches the world and plays them. GTA2's city
// was never scenery — it reacted to you, and it kept score. So does this:
//
//   THE PEDESTRIAN reacts to the WORLD — mutters when the corner is calm
//     (idle), cries out at gunfire, runs (flee), gasps at a god — and reacts to
//     YOU: drive at them and you get cursed (reckless).
//
//   THE VIGILANTE is the pedestrian who stops running. Mayhem near civilians
//     stokes STREET HEAT (streetheat.ts); cross a line and the nearest
//     bystander CHALLENGES you, then WARNS you, then swears it will fight
//     (engage). Go down while the street is hostile and it stands over you
//     (triumph). A wanted level, in the local accent.
//
// Client-side and READ-ONLY: it never steps the sim, so it cannot perturb a
// replay. Throttled hard — a street is atmosphere, not a chorus.
// ═══════════════════════════════════════════════════════════════════════════
import { audio, type SoundName } from './audio';
import { pickStreetLine, type StreetEvent } from './streetvo';
import { StreetHeat } from './streetheat';
import type { World } from '../sim/world';
import type { SimEvent, Vec3 } from '../sim/types';

/** No more than one reactive street voice this often — atmosphere, not a mob. */
const COOLDOWN = 2.6;
/** Ambient chatter is rarer still: a murmur, not a conversation. */
const IDLE_EVERY = 11;
/** How close a thing has to be to the player to be worth hearing. */
const EARSHOT = 55;
/** Close enough that a passing hull is a fright, not traffic. */
const NEAR_MISS = 7;
/** Fast enough that missing them by that much is YOUR fault. */
const RECKLESS_SPEED = 11;
/** A fleeing civilian this close is running past your shoulder. */
const FLEE_CLOSE = 20;

export class StreetVoice {
  private nextAt = 0;
  private nextIdleAt = 0;
  private panicking = new Set<number>();
  private civAlive = new Set<number>();
  private scolded = new Map<number, number>(); // civ id → when it last cursed you
  private hushed = false;
  private heat = new StreetHeat();

  /** Silence the street (a menu, a cutscene). */
  setHushed(h: boolean): void { this.hushed = h; }

  /** The street's current temper — for a HUD tell, if one is ever wanted. */
  get temper(): number { return this.heat.heat; }

  /**
   * Called each frame with the live world and the frame's events. Cheap: one
   * pass over the civilian hulls the traffic layer put in play, plus a scan of
   * the events that could have angered anyone.
   */
  update(world: World, now: number, dt = 0, events: readonly SimEvent[] = [], meId = 0): void {
    if (this.hushed) return;
    const code = world.opts.cultureCode;
    const me = world.soldiers.get(meId);

    // ── who is on the street, and which of them is nearest to you ───────────
    let nearest: { id: number; pos: Vec3; dist: number } | null = null;
    let anyPanic = false;
    const alive = new Set<number>();
    for (const v of world.vehicles.values()) {
      const d = v.civilianDrive;
      if (!d || !v.alive) continue;
      alive.add(v.id);
      if (now < d.panicUntil) anyPanic = true;
      if (me) {
        const dist = Math.hypot(v.pos.x - me.pos.x, v.pos.z - me.pos.z);
        if (!nearest || dist < nearest.dist) nearest = { id: v.id, pos: v.pos, dist };
      }
    }

    // ── A CASUALTY: someone who was on this street a moment ago is gone, and
    //    you were standing right there. The street does not forgive that. ────
    for (const id of this.civAlive) {
      if (alive.has(id)) continue;
      const wreck = world.vehicles.get(id);
      const where = wreck?.pos;
      if (!me || !where || Math.hypot(where.x - me.pos.x, where.z - me.pos.z) < EARSHOT) {
        this.heat.provokeCasualty();
      }
    }
    this.civAlive = alive;

    // ── what happened this frame that anyone could hold against you ─────────
    for (const e of events) {
      if (e.type === 'lsw_active' && e.pos) { this.onGod(world, e.pos, now); continue; }
      // YOUR gun, on THEIR corner
      if (e.type === 'shot' && e.soldierId === meId && e.pos) {
        for (const v of world.vehicles.values()) {
          if (!v.civilianDrive || !v.alive) continue;
          if (Math.hypot(v.pos.x - e.pos.x, v.pos.z - e.pos.z) < EARSHOT) { this.heat.provokeShot(); break; }
        }
        continue;
      }
      // you went down — if the street was already hostile, it stands over you
      if ((e.type === 'downed' || e.type === 'death') && e.soldierId === meId) {
        if (this.heat.hostile && nearest) this.speak(code, 'triumph', nearest.id, nearest.pos, world, now, true);
      }
    }

    // ── THE TEMPER: cool it, and shout if a new line was crossed ────────────
    const cry = this.heat.tick(dt);
    if (cry && nearest) this.speak(code, cry, nearest.id, nearest.pos, world, now, true);

    // ── RECKLESS: you are driving at people ────────────────────────────────
    const ride = me && me.vehicleId >= 0 ? world.vehicles.get(me.vehicleId) : undefined;
    if (ride && me) {
      const speed = Math.hypot(ride.vel.x, ride.vel.z);
      if (speed > RECKLESS_SPEED) {
        for (const v of world.vehicles.values()) {
          if (!v.civilianDrive || !v.alive || v.id === ride.id) continue;
          const d = Math.hypot(v.pos.x - ride.pos.x, v.pos.z - ride.pos.z);
          if (d > NEAR_MISS) continue;
          // one curse per bystander per stretch, or a single pass is a riot
          if (now - (this.scolded.get(v.id) ?? -99) < 6) continue;
          this.scolded.set(v.id, now);
          this.heat.provokeNearMiss();
          this.speak(code, 'reckless', v.id, v.pos, world, now);
          break;
        }
      }
    }

    // ── PANIC and FLIGHT ───────────────────────────────────────────────────
    for (const v of world.vehicles.values()) {
      const d = v.civilianDrive;
      if (!d || !v.alive) continue;
      const isPanicking = now < d.panicUntil;
      const was = this.panicking.has(v.id);
      if (isPanicking && !was) {
        this.panicking.add(v.id);
        if (me && Math.hypot(v.pos.x - me.pos.x, v.pos.z - me.pos.z) > EARSHOT) continue;
        this.speak(code, 'gunfire', v.id, v.pos, world, now);       // the cry at the shot
      } else if (isPanicking && was && me) {
        // still running, and running right past you
        const dist = Math.hypot(v.pos.x - me.pos.x, v.pos.z - me.pos.z);
        if (dist < FLEE_CLOSE) this.speak(code, 'flee', v.id + 7, v.pos, world, now);
      } else if (!isPanicking && was) {
        this.panicking.delete(v.id);
      }
    }

    // ── IDLE: the corner is calm, so the corner talks ──────────────────────
    if (!anyPanic && nearest && nearest.dist < EARSHOT * 0.6 && now >= this.nextIdleAt) {
      this.nextIdleAt = now + IDLE_EVERY + (nearest.id % 5);
      this.speak(code, 'idle', nearest.id + Math.floor(now / 10), nearest.pos, world, now);
    }
  }

  /** A god walked — the street reacts with awe. */
  onGod(world: World, pos: Vec3, now: number): void {
    if (this.hushed || now < this.nextAt) return;
    let near = false;
    for (const v of world.vehicles.values()) {
      if (!v.civilianDrive || !v.alive) continue;
      if (Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) < EARSHOT) { near = true; break; }
    }
    if (!near) return;
    this.speak(world.opts.cultureCode, 'god', Math.floor(now * 10), pos, world, now);
  }

  /** THE VIGILANTE, on demand — kept for callers that stage their own scene. */
  vigilante(world: World, event: 'challenge' | 'warn' | 'engage' | 'triumph',
            pos: Vec3, now: number): void {
    if (this.hushed) return;
    this.speak(world.opts.cultureCode, event, Math.floor(pos.x * 7 + pos.z), pos, world, now, true);
  }

  private speak(code: number | null | undefined, event: StreetEvent, seed: number,
                pos: Vec3, world: World, now: number, force = false): void {
    if (!force && now < this.nextAt) return;
    const { slot, text } = pickStreetLine(code, event, seed + world.map.seed);
    // the audio slot may not be generated for every culture yet; play() returns
    // false and boots silently, so the world never breaks over a missing take
    audio.play(slot as SoundName, { pos, volume: 0.9 });
    // the text still surfaces over the speaker's head as a bark, voice or not
    world.emit?.({ type: 'bark', pos: { ...pos }, text });
    this.nextAt = now + COOLDOWN;
  }
}
