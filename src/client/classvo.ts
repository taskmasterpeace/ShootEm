// ─────────────────────────────────────────────────────────────────────────
// CLASS VOICE — the mortal-class barks find their moments.
//
// The seven mortal-class packs (Gabe/Omar/Keisha/Naveen/Amina/… + the ghost)
// ship as ~186 lines catalogued in audio.ts and mapped event→slot in
// public/audio/casting/mortal-classes-manifest.json, but until now only the
// death cry was wired. This dispatcher hangs the rest off EXISTING SimEvents
// and the local player's live state — so intros, kills, the CTF run, going
// down, getting up, and the class abilities all speak in the operator's own
// voice. It is PURELY client-side (no sim contact, no RNG, no determinism
// risk): it reads events the sim already emits and plays your own class's
// line for your own moments.
//
// Anti-spam is layered: the voice bus already caps concurrency + ducks the
// mix (audio.ts §voBus), and on top of that every slot has a repeat cooldown
// and there's a global minimum gap so your trooper never machine-guns lines.
// A line only plays if that exact `vo_<class>_<slot>` is a registered sound
// (VALID) — so a class that lacks a given bark simply stays quiet.
// ─────────────────────────────────────────────────────────────────────────
import type { World } from '../sim/world';
import type { SimEvent, Vec3 } from '../sim/types';
import { audio, SOUND_NAMES, type SoundName } from './audio';

const VALID = new Set<string>(SOUND_NAMES as readonly string[]);

/** repeat cooldowns per slot (seconds, wall-clock) — how long before the same
 *  kind of line may fire again. High-frequency events (reload, taking fire)
 *  get long guards so they punctuate rather than narrate. */
const CD: Record<string, number> = {
  intro: 9999, deploy: 8, kill: 3.5, kill_multi: 6, downed: 3, ally_downed: 8,
  revived: 4, taking_fire: 7, low_health: 12, reload: 10, self_stim: 6,
  turret_built: 5, mine_planted: 5, jet_ignite: 7, warp_enter: 5, shield_up: 6,
  flag_pickup: 4, flag_capture: 4, flag_dropped: 4,
};
/** lines urgent enough to bypass the global min-gap (they still respect their
 *  own per-slot cooldown). A downed cry or a flag capture must never be eaten
 *  by an idle reload line that happened a half-second earlier. */
const URGENT = new Set(['downed', 'ally_downed', 'low_health', 'kill_multi', 'revived', 'taking_fire',
  'flag_pickup', 'flag_capture', 'flag_dropped']);
const GLOBAL_GAP = 1.4; // seconds between any two class lines (non-urgent)
const ALLY_EARSHOT = 22; // an ally's "man down!" only if you're near enough to matter

function clockNow(): number {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

export class ClassVo {
  private last: Record<string, number> = {};
  private lastAny = -Infinity;
  private introDone = false;
  private wasAlive = false;
  private wasCarrying = false;
  private lastWorldTime = 0;
  private killStamps: number[] = [];

  /** EVENT-DRIVEN barks — call once per SimEvent from the renderer's applyEvents. */
  consider(e: SimEvent, world: World, localId: number): void {
    if (localId < 0 || world.mode.id === 'paintball') return; // boot camp stays quiet
    const me = world.soldiers.get(localId);
    if (!me) return;
    const mine = e.soldierId === localId;

    switch (e.type) {
      case 'kill_confirm':
        if (mine) {
          const t = clockNow();
          this.killStamps = this.killStamps.filter((s) => t - s < 4);
          this.killStamps.push(t);
          this.say(me.classId, this.killStamps.length >= 2 ? 'kill_multi' : 'kill', me.pos);
        }
        break;
      case 'downed':
        if (mine) this.say(me.classId, 'downed', me.pos);
        else if (this.allyNear(e, me)) this.say(me.classId, 'ally_downed', me.pos);
        break;
      case 'revived':
        if (mine) this.say(me.classId, 'revived', me.pos);
        break;
      case 'hurt':
        if (mine) {
          this.say(me.classId, 'taking_fire', me.pos);
          if (me.hp > 0 && me.hp < 32) this.say(me.classId, 'low_health', me.pos);
        }
        break;
      case 'reload':
        if (mine) this.say(me.classId, 'reload', me.pos);
        break;
      case 'turret_built':
        if (mine) this.say(me.classId, 'turret_built', me.pos);
        break;
      case 'mine_planted':
        if (mine) this.say(me.classId, 'mine_planted', me.pos);
        break;
      case 'warp':
        if (mine) this.say(me.classId, 'warp_enter', me.pos);
        break;
      case 'jetpack':
        if (mine) this.say(me.classId, 'jet_ignite', me.pos);
        break;
      case 'heal':
        if (mine && me.classId === 'medic') this.say(me.classId, 'self_stim', me.pos);
        break;
      case 'beacon_planted':
        if (mine && e.text === 'Shield dome raised') this.say(me.classId, 'shield_up', me.pos);
        break;
    }
  }

  /** STATE-POLL barks — call once per frame from the renderer's update. Covers
   *  the moments the sim doesn't hand us a clean event for: the match-open
   *  intro, each redeploy, and the flag run (the CTF events carry only the
   *  flag's team, not the taker's id, so we watch the carrier bit directly). */
  tick(world: World, localId: number): void {
    // a fresh match rewinds world.time — re-arm the once-per-life beats
    if (world.time < this.lastWorldTime - 1) {
      this.introDone = false; this.wasAlive = false; this.wasCarrying = false;
    }
    this.lastWorldTime = world.time;
    if (localId < 0 || world.mode.id === 'paintball') return;
    const me = world.soldiers.get(localId);
    if (!me) return;

    // intro on the first breath of the match; deploy on every respawn after
    if (me.alive) {
      if (!this.introDone) { this.introDone = true; this.say(me.classId, 'intro', me.pos); }
      else if (!this.wasAlive) this.say(me.classId, 'deploy', me.pos);
      this.wasAlive = true;
    } else {
      this.wasAlive = false;
    }

    // the flag run — pickup, then either a capture (still standing) or a drop
    const carrying = me.carryingFlag >= 0;
    if (carrying && !this.wasCarrying) this.say(me.classId, 'flag_pickup', me.pos);
    else if (!carrying && this.wasCarrying) {
      this.say(me.classId, me.alive && !me.downed ? 'flag_capture' : 'flag_dropped', me.pos);
    }
    this.wasCarrying = carrying;
  }

  private allyNear(e: SimEvent, me: { pos: Vec3 }): boolean {
    if (!e.pos) return false;
    return Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z) <= ALLY_EARSHOT;
  }

  /** per-slot rotation cursor for numbered variant packs (Odessa's kill_1/2/3) */
  private variant: Record<string, number> = {};

  /** Play the class line for this moment, honoring the per-slot cooldown, the
   *  global gap, and the registered-sound guard. Slot resolution handles BOTH
   *  catalog shapes: the mortal packs' flat `vo_<class>_<slot>` and the
   *  Odessa/infiltrator pack's NUMBERED variants (`vo_infiltrator_kill_1..3`)
   *  — variants rotate so the same moment never reads twice in a row.
   *  Positional at the speaker, but it's YOUR voice — it lands close. */
  private say(classId: string, slot: string, pos: Vec3): void {
    const t = clockNow();
    if (t - (this.last[slot] ?? -Infinity) < (CD[slot] ?? 5)) return;
    if (!URGENT.has(slot) && t - this.lastAny < GLOBAL_GAP) return;
    const base = `vo_${classId}_${slot}`;
    let name = VALID.has(base) ? base : '';
    if (!name) {
      // the numbered shape: count the variants, rotate through them
      let count = 0;
      while (VALID.has(`${base}_${count + 1}`)) count++;
      if (!count) return; // this class has no line for this moment
      const i = (this.variant[base] = ((this.variant[base] ?? 0) % count) + 1);
      name = `${base}_${i}`;
    }
    this.last[slot] = t;
    this.lastAny = t;
    audio.play(name as SoundName, { pos, volume: 0.95 });
  }
}
