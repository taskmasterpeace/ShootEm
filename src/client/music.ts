// ---------------------------------------------------------------------------
// THE WAR'S SCORE — Robert's soundtrack, three tiers of dread.
//
//   soldier — ordinary combat: rifles, mud, and men.
//   lsw     — a Living Super Weapon is inbound or walking (threat 1–2).
//   l5      — the REAL monsters: SIEGE/EXTINCTION-class (threat 3+). Robert:
//             "the level five LSWs... a real, real threat. Completely
//             different music for them."
//
// The dread starts at the ANNOUNCEMENT: an inbound pod flips the score during
// the telegraph — the countdown IS the music cue. Tracks stream via
// HTMLAudio (never decoded into buffers — 29MB of score stays off the heap),
// crossfade on tier change, and shuffle within a tier so a long match doesn't
// loop one song. All DOM work lives in MusicDirector; musicTierFor is pure
// sim-reading logic the tests can pin.
// ---------------------------------------------------------------------------
import { LSWS } from '../sim/lsw';
import type { World } from '../sim/world';

export type MusicTier = 'soldier' | 'lsw' | 'l5';

/** The l5 line: threat 3 (SIEGE, 5000hp) and up is "a real, real threat". */
export const L5_THREAT = 3;

/** Read the field and say which score should be playing. Pure — no DOM. */
export function musicTierFor(world: World): MusicTier {
  let tier: MusicTier = 'soldier';
  // walking weapons
  for (const s of world.soldiers.values()) {
    if (!s.alive || !s.ascendant) continue;
    if (LSWS[s.ascendant].threat >= L5_THREAT) return 'l5';
    tier = 'lsw';
  }
  // inbound pods count — the telegraph is the overture
  for (const p of world.pendingLsw) {
    if (LSWS[p.id].threat >= L5_THREAT) return 'l5';
    tier = 'lsw';
  }
  return tier;
}

const TRACKS: Record<MusicTier, string[]> = {
  soldier: ['/audio/music/soldier_1.mp3', '/audio/music/soldier_2.mp3', '/audio/music/soldier_3.mp3'],
  lsw: ['/audio/music/lsw_1.mp3', '/audio/music/lsw_2.mp3', '/audio/music/lsw_3.mp3'],
  l5: ['/audio/music/l5_1.mp3', '/audio/music/l5_2.mp3', '/audio/music/l5_3.mp3'],
};

/** Music sits under the SFX so callouts and gunfire stay legible. */
const MUSIC_BED = 0.35;
const FADE_SECS = 1.6;

export class MusicDirector {
  private current: HTMLAudioElement | null = null;
  private tier: MusicTier | null = null;
  private nextCheckAt = 0;
  private masterVolume = 0.5;
  private lastPick: Record<MusicTier, number> = { soldier: -1, lsw: -1, l5: -1 };
  private fading: { el: HTMLAudioElement; from: number; startedAt: number } | null = null;

  setVolume(master: number) {
    this.masterVolume = master;
    if (this.current) this.current.volume = this.level();
  }

  private level() { return Math.max(0, Math.min(1, this.masterVolume * MUSIC_BED * 2)); }

  /** Call every frame with the live world; internally throttled. */
  update(world: World, nowMs: number) {
    // finish any running crossfade
    if (this.fading) {
      const t = (nowMs - this.fading.startedAt) / (FADE_SECS * 1000);
      if (t >= 1) { this.fading.el.pause(); this.fading = null; } else this.fading.el.volume = this.fading.from * (1 - t);
    }
    if (this.current && this.tier) {
      // fade the newcomer IN across the same window
      const target = this.level();
      if (this.current.volume < target) this.current.volume = Math.min(target, this.current.volume + target / (FADE_SECS * 60));
    }
    if (nowMs < this.nextCheckAt) return;
    this.nextCheckAt = nowMs + 500; // twice a second is plenty for a score
    const want = world.mode.over ? null : musicTierFor(world);
    if (want !== this.tier) this.switchTo(want, nowMs);
  }

  private switchTo(tier: MusicTier | null, nowMs: number) {
    if (this.current) {
      // the old score bows out
      if (this.fading) this.fading.el.pause();
      this.fading = { el: this.current, from: this.current.volume, startedAt: nowMs };
      this.current = null;
    }
    this.tier = tier;
    if (!tier) return; // match over — let the score die out
    this.current = this.play(tier);
  }

  private play(tier: MusicTier): HTMLAudioElement {
    const pool = TRACKS[tier];
    // shuffle without repeats: any index except the last one we played
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === this.lastPick[tier]) idx = (idx + 1) % pool.length;
    this.lastPick[tier] = idx;
    const el = new Audio(pool[idx]);
    el.volume = 0; // fades in via update()
    el.addEventListener('ended', () => {
      // same tier still wanted? roll the next track in the pool
      if (this.tier === tier && this.current === el) this.current = this.play(tier);
    });
    void el.play().catch(() => { /* autoplay refusal — the next user gesture will land */ });
    return el;
  }

  stop() {
    this.current?.pause(); this.current = null;
    this.fading?.el.pause(); this.fading = null;
    this.tier = null;
  }
}
