// ---------------------------------------------------------------------------
// HEADPHONES — your library, on the field.
//
// Robert: *"songs from the music library are played in the game on the field
// when you put on headphones."*
//
// H puts them on. The deck that was sitting in the GONET's corner keeps
// playing — same machine, same song — but now it draws from THE FIELD
// playlist, the war's own score steps aside, and the world gets quieter.
//
// THE TRADE IS THE POINT. Headphones are not a free jukebox: the master bus
// drops while they are on, so gunfire, footsteps and callouts all sit further
// away. You get your music and you give up your ears. Everything in this game
// is a sidegrade; this is no different.
// ---------------------------------------------------------------------------
import type { AudioEngine } from '../audio';
import type { MusicDirector } from '../music';
import { musicDeck } from './player';

/** How far the world is pushed back while the cans are on. */
export const HEADPHONE_WORLD_CUT = 0.55;

export interface HeadphoneState {
  on: boolean;
  /** the track title to show on the HUD chip, or '' */
  nowPlaying: string;
}

export class Headphones {
  on = false;
  private audio: AudioEngine;
  private score: MusicDirector;

  constructor(audio: AudioEngine, score: MusicDirector) {
    this.audio = audio;
    this.score = score;
  }

  /** H. Returns the new state so the caller can announce it. */
  toggle(): boolean {
    this.on ? this.off() : this.wear();
    return this.on;
  }

  wear(): void {
    if (this.on) return;
    this.on = true;
    // the war's score steps aside for yours — two soundtracks at once is noise
    this.score.stop();
    this.audio.setHeadphoneCut(HEADPHONE_WORLD_CUT);
    const deck = musicDeck();
    deck.toField();
    if (!deck.now().playing) deck.play();
  }

  off(): void {
    if (!this.on) return;
    this.on = false;
    this.audio.setHeadphoneCut(0);
    musicDeck().pause();
    musicDeck().toLibrary();
    // the score picks itself back up on the next update() — it reads the field
  }

  /** A big moment can duck YOUR music too (an explosion still lands). */
  duck(amount: number): void {
    if (this.on) musicDeck().setFieldDuck(1 - Math.max(0, Math.min(0.85, amount)));
  }

  state(): HeadphoneState {
    const n = musicDeck().now();
    return { on: this.on, nowPlaying: this.on && n.track ? `${n.track.title} — ${n.track.artist}` : '' };
  }
}
