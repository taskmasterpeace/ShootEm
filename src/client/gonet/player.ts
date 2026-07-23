// ---------------------------------------------------------------------------
// THE PLAYER — one deck, two faces.
//
// The corner player in the GONET and the headphones on the field are the SAME
// machine. That is deliberate: a song you queued at the laptop is the song
// still playing when you put your headphones on in the field, because there
// was never a second player to fall out of sync with the first.
//
// HTMLAudio, never decoded into buffers — the score is ~29MB and has no
// business on the heap. It streams, like a radio should.
// ---------------------------------------------------------------------------
import {
  fieldTracks, loadLibrary, nextIndex, prevIndex, saveLibrary, tracksOf,
  type LibraryState, type Track,
} from './library';

export type PlayerSource = 'library' | 'field';

export interface NowPlaying {
  track: Track | null;
  playing: boolean;
  /** 0..1 through the track */
  progress: number;
  seconds: number;
  duration: number;
  source: PlayerSource;
}

type Listener = (now: NowPlaying) => void;

export class MusicPlayer {
  lib: LibraryState;
  private el: HTMLAudioElement | null = null;
  private queue: Track[] = [];
  private idx = -1;
  private listeners = new Set<Listener>();
  private source: PlayerSource = 'library';
  /** headphones on the field push the world's own volume down, not ours */
  private fieldDuck = 1;

  constructor(lib: LibraryState = loadLibrary()) {
    this.lib = lib;
    this.queue = tracksOf(this.lib, this.lib.nowPlaylistId);
  }

  // ── subscription ──────────────────────────────────────────────────────────
  on(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.now());
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const now = this.now();
    for (const fn of this.listeners) fn(now);
  }

  now(): NowPlaying {
    const el = this.el;
    const duration = el && isFinite(el.duration) ? el.duration : (this.current()?.seconds ?? 0);
    const seconds = el ? el.currentTime : 0;
    return {
      track: this.current(),
      playing: !!el && !el.paused,
      progress: duration > 0 ? Math.min(1, seconds / duration) : 0,
      seconds, duration, source: this.source,
    };
  }

  current(): Track | null { return this.queue[this.idx] ?? null; }

  // ── the deck ──────────────────────────────────────────────────────────────

  /** Point the deck at a playlist. Does not start it. */
  setQueue(playlistId: string, source: PlayerSource = 'library'): void {
    this.source = source;
    this.queue = source === 'field' ? fieldTracks(this.lib) : tracksOf(this.lib, playlistId);
    if (source === 'library') { this.lib.nowPlaylistId = playlistId; saveLibrary(this.lib); }
    this.idx = -1;
  }

  /** Play a specific track out of the current queue (or start the queue). */
  play(trackId?: string): void {
    if (!this.queue.length) return;
    if (trackId) {
      const i = this.queue.findIndex((t) => t.id === trackId);
      if (i >= 0) this.idx = i;
    }
    if (this.idx < 0) {
      this.idx = nextIndex(this.queue.length, -1, this.lib.shuffle, this.lib.repeat);
      if (this.idx < 0) this.idx = 0;
    }
    this.spin();
  }

  toggle(): void {
    if (!this.el) { this.play(); return; }
    if (this.el.paused) void this.el.play().catch(() => { /* autoplay refusal */ });
    else this.el.pause();
    this.emit();
  }

  pause(): void { this.el?.pause(); this.emit(); }

  next(): void {
    const i = nextIndex(this.queue.length, this.idx, this.lib.shuffle, this.lib.repeat);
    if (i < 0) { this.stop(); return; }
    this.idx = i;
    this.spin();
  }

  prev(): void {
    // the universal law of skip-back: past three seconds, restart the song
    if (this.el && this.el.currentTime > 3) { this.el.currentTime = 0; this.emit(); return; }
    this.idx = prevIndex(this.queue.length, this.idx);
    this.spin();
  }

  seek(fraction01: number): void {
    if (!this.el || !isFinite(this.el.duration)) return;
    this.el.currentTime = Math.max(0, Math.min(1, fraction01)) * this.el.duration;
    this.emit();
  }

  stop(): void {
    this.el?.pause();
    this.el = null;
    this.idx = -1;
    this.emit();
  }

  setVolume(v: number): void {
    this.lib.volume = Math.max(0, Math.min(1, v));
    if (this.el) this.el.volume = this.lib.volume * this.fieldDuck;
    saveLibrary(this.lib);
    this.emit();
  }

  /** The field can pull the deck's own level down (a duck under a big moment). */
  setFieldDuck(d: number): void {
    this.fieldDuck = Math.max(0, Math.min(1, d));
    if (this.el) this.el.volume = this.lib.volume * this.fieldDuck;
  }

  /** Swap to the field kit — the headphones went on. */
  toField(): void {
    const wasPlaying = !!this.el && !this.el.paused;
    const keep = this.current();
    this.source = 'field';
    this.queue = fieldTracks(this.lib);
    // if the song already spinning is in the field kit, KEEP it playing — the
    // deck does not restart just because you put the headphones on
    const i = keep ? this.queue.findIndex((t) => t.id === keep.id) : -1;
    if (i >= 0 && wasPlaying) { this.idx = i; this.emit(); return; }
    this.idx = -1;
    this.play();
  }

  /** Back to the laptop's own queue. */
  toLibrary(): void {
    this.source = 'library';
    this.queue = tracksOf(this.lib, this.lib.nowPlaylistId);
    const keep = this.current();
    const i = keep ? this.queue.findIndex((t) => t.id === keep.id) : -1;
    this.idx = i;
    this.emit();
  }

  // ── the needle ────────────────────────────────────────────────────────────
  private spin(): void {
    const track = this.current();
    if (!track) return;
    this.el?.pause();
    const el = new Audio(track.src);
    el.volume = this.lib.volume * this.fieldDuck;
    el.addEventListener('loadedmetadata', () => {
      // learn the real duration once, then keep it — the library shows real
      // times from the second play onward
      if (isFinite(el.duration)) {
        track.seconds = el.duration;
        this.lib.durations[track.id] = el.duration;
        saveLibrary(this.lib);
      }
      this.emit();
    });
    el.addEventListener('timeupdate', () => this.emit());
    el.addEventListener('ended', () => this.next());
    el.addEventListener('play', () => this.emit());
    el.addEventListener('pause', () => this.emit());
    this.el = el;
    void el.play().catch(() => { /* autoplay refusal — the next gesture lands it */ });
    this.emit();
  }
}

/** The one deck the whole client shares. */
let deck: MusicPlayer | null = null;
export function musicDeck(): MusicPlayer {
  if (!deck) {
    const lib = loadLibrary();
    // restore durations learned in an earlier session
    for (const t of tracksOf(lib, 'all')) if (lib.durations[t.id]) t.seconds = lib.durations[t.id];
    deck = new MusicPlayer(lib);
  }
  return deck;
}
