// ═══════════════════════════════════════════════════════════════════════════
// THE STREET SPEAKS — the client half of street VO.
//
// The catalogue and picker are in streetvo.ts; this is what plays them. It
// watches the two things the sim already models and gives them a voice in the
// local culture:
//
//   PEDESTRIANS — the civilian traffic (traffic.ts). When a civilian hull
//     first panics (gunfire near it), the street cries out. When a god walks,
//     it gasps. The line is drawn from the world's culture code, so the same
//     panic sounds West African in Lagos and Slavic in Kyiv.
//
//   THE VIGILANTE — voiced by the same catalogue's challenge/warn lines, played
//     when the vigilante system fires (not yet wired to an entity — the barks
//     exist and are reachable; see docs/STREET-VO.md).
//
// Client-side and read-only: it never touches the sim, so it cannot perturb a
// replay. Throttled hard — a street is atmosphere, not a chorus.
// ═══════════════════════════════════════════════════════════════════════════
import { audio, type SoundName } from './audio';
import { pickStreetLine, type StreetEvent } from './streetvo';
import type { World } from '../sim/world';

/** No more than one street voice this often — atmosphere, not a mob. */
const COOLDOWN = 2.6;
/** How close a panic has to be to the player to be worth hearing. */
const EARSHOT = 55;

export class StreetVoice {
  private nextAt = 0;
  private panicking = new Set<number>();
  private hushed = false;

  /** Silence the street (a menu, a cutscene). */
  setHushed(h: boolean): void { this.hushed = h; }

  /**
   * Called each frame with the live world. Cheap: it only scans the civilian
   * hulls the traffic layer put in play, and only speaks on a fresh panic.
   */
  update(world: World, now: number): void {
    if (this.hushed) return;
    const code = world.opts.cultureCode;
    const me = world.soldiers.get(0);

    for (const v of world.vehicles.values()) {
      const d = v.civilianDrive;
      if (!d || !v.alive) continue;
      const isPanicking = now < d.panicUntil;
      const was = this.panicking.has(v.id);

      if (isPanicking && !was) {
        this.panicking.add(v.id);
        // only the panics you could actually hear, and not too often
        if (now < this.nextAt) continue;
        if (me) {
          const dist = Math.hypot(v.pos.x - me.pos.x, v.pos.z - me.pos.z);
          if (dist > EARSHOT) continue;
        }
        this.speak(code, 'gunfire', v.id, v.pos, world, now);
      } else if (!isPanicking && was) {
        this.panicking.delete(v.id);
      }
    }
  }

  /** A god walked — the street reacts with awe. Called on the lsw_active cue. */
  onGod(world: World, pos: { x: number; y: number; z: number }, now: number): void {
    if (this.hushed || now < this.nextAt) return;
    // only if there is a civilian near enough to be the one speaking
    let near = false;
    for (const v of world.vehicles.values()) {
      if (!v.civilianDrive || !v.alive) continue;
      if (Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) < EARSHOT) { near = true; break; }
    }
    if (!near) return;
    this.speak(world.opts.cultureCode, 'god', Math.floor(now * 10), pos, world, now);
  }

  /** THE VIGILANTE — a challenge line, wherever the caller places it. */
  vigilante(world: World, event: 'challenge' | 'warn' | 'engage' | 'triumph',
            pos: { x: number; y: number; z: number }, now: number): void {
    if (this.hushed) return;
    this.speak(world.opts.cultureCode, event, Math.floor(pos.x * 7 + pos.z), pos, world, now, true);
  }

  private speak(code: number | null | undefined, event: StreetEvent, seed: number,
                pos: { x: number; y: number; z: number }, world: World, now: number, force = false): void {
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
