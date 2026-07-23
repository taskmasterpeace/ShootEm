// ---------------------------------------------------------------------------
// THE MUSIC LIBRARY — what a soldier carries in their ears.
//
// Robert: *"a music player in the corner, where you manage your music library
// ... songs from the music library are played in the game on the field when
// you put on headphones."*
//
// So the library is not a menu decoration: it is the SOURCE the field reads.
// One list of tracks, playlists over them, and exactly one playlist marked as
// THE FIELD — the one that plays through your headphones while you fight.
//
// Pure state + pure operations. No DOM, no Audio elements, no localStorage
// side effects except through save()/load(). That is what lets the tests pin
// the shuffle, the ordering and the field wiring without a browser.
// ---------------------------------------------------------------------------

/** One song. `src` is a real file under /audio/music. */
export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  src: string;
  /** Seconds — discovered from the file's metadata on first play, then kept. */
  seconds?: number;
}

/** A named, ordered list of track ids. */
export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  /** The built-ins cannot be deleted — every library keeps a floor. */
  fixed?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface LibraryState {
  playlists: Playlist[];
  /** which playlist plays through the headphones on the field */
  fieldPlaylistId: string;
  /** which playlist the corner player is working through */
  nowPlaylistId: string;
  favourites: string[];
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  /** durations learned from the files themselves */
  durations: Record<string, number>;
}

// ── THE SHELF ───────────────────────────────────────────────────────────────
// The war's own music. These are the nine real files already on disk (the
// score's three tiers), given the identities they would have in a world where
// soldiers trade music: two faction labels and one voice everybody knows.
export const TRACKS: Track[] = [
  { id: 'mud_season', title: 'Mud Season', artist: 'The Ninth Column', album: 'Field Recordings', src: '/audio/music/soldier_1.mp3' },
  { id: 'rifles_dawn', title: 'Rifles at Dawn', artist: 'The Ninth Column', album: 'Field Recordings', src: '/audio/music/soldier_2.mp3' },
  { id: 'nobody_writes', title: 'Nobody Writes Back', artist: 'Odessa Grey', album: 'Letters Home', src: '/audio/music/soldier_3.mp3' },
  { id: 'something_walking', title: 'Something Is Walking', artist: 'Black Ceramic', album: 'Threat Level', src: '/audio/music/lsw_1.mp3' },
  { id: 'pod_inbound', title: 'Pod Inbound', artist: 'Black Ceramic', album: 'Threat Level', src: '/audio/music/lsw_2.mp3' },
  { id: 'long_shadow', title: 'The Long Shadow', artist: 'Odessa Grey', album: 'Letters Home', src: '/audio/music/lsw_3.mp3' },
  { id: 'extinction_class', title: 'Extinction Class', artist: 'Maklov Choir', album: 'The Last Broadcast', src: '/audio/music/l5_1.mp3' },
  { id: 'siege_engine', title: 'Siege Engine', artist: 'Maklov Choir', album: 'The Last Broadcast', src: '/audio/music/l5_2.mp3' },
  { id: 'last_broadcast', title: 'The Last Broadcast', artist: 'Maklov Choir', album: 'The Last Broadcast', src: '/audio/music/l5_3.mp3' },
];

export const trackById = (id: string): Track | undefined => TRACKS.find((t) => t.id === id);

const KEY = 'ww.library.v1';
export const FIELD_ID = 'field';
export const ALL_ID = 'all';

/** A fresh library: everything on the shelf, and the field kit already packed. */
export function defaultLibrary(): LibraryState {
  return {
    playlists: [
      { id: ALL_ID, name: 'EVERYTHING', trackIds: TRACKS.map((t) => t.id), fixed: true },
      // THE FIELD is the whole point: this is what your headphones play.
      { id: FIELD_ID, name: 'THE FIELD', trackIds: TRACKS.map((t) => t.id), fixed: true },
    ],
    fieldPlaylistId: FIELD_ID,
    nowPlaylistId: ALL_ID,
    favourites: [],
    shuffle: true,
    repeat: 'all',
    volume: 0.7,
    durations: {},
  };
}

export function loadLibrary(): LibraryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultLibrary();
    const parsed = JSON.parse(raw) as Partial<LibraryState>;
    const base = defaultLibrary();
    const lib: LibraryState = { ...base, ...parsed };
    // the built-ins are re-asserted every load, so a corrupted or half-written
    // store can never leave the field with nothing to play
    lib.playlists = Array.isArray(parsed.playlists) ? parsed.playlists.filter((p) => p && p.id) : base.playlists;
    for (const fixed of base.playlists) {
      const found = lib.playlists.find((p) => p.id === fixed.id);
      if (!found) lib.playlists.push(fixed);
      else found.fixed = true;
    }
    // a track that left the shelf must leave every playlist with it
    for (const p of lib.playlists) {
      p.trackIds = (p.trackIds ?? []).filter((id) => trackById(id));
    }
    if (!lib.playlists.some((p) => p.id === lib.fieldPlaylistId)) lib.fieldPlaylistId = FIELD_ID;
    if (!lib.playlists.some((p) => p.id === lib.nowPlaylistId)) lib.nowPlaylistId = ALL_ID;
    lib.volume = Math.max(0, Math.min(1, lib.volume ?? 0.7));
    return lib;
  } catch {
    return defaultLibrary();
  }
}

export function saveLibrary(lib: LibraryState): void {
  try { localStorage.setItem(KEY, JSON.stringify(lib)); } catch { /* private mode */ }
}

// ── OPERATIONS (pure — they mutate the state you hand them, nothing else) ────

export function playlistOf(lib: LibraryState, id: string): Playlist | undefined {
  return lib.playlists.find((p) => p.id === id);
}

/** The tracks of a playlist, in order, skipping anything no longer on the shelf. */
export function tracksOf(lib: LibraryState, id: string): Track[] {
  const p = playlistOf(lib, id);
  if (!p) return [];
  return p.trackIds.map(trackById).filter((t): t is Track => !!t);
}

/** What the headphones will play. Never empty if anything is on the shelf. */
export function fieldTracks(lib: LibraryState): Track[] {
  const picked = tracksOf(lib, lib.fieldPlaylistId);
  return picked.length ? picked : TRACKS;
}

let seq = 0;
export function createPlaylist(lib: LibraryState, name: string): Playlist {
  const p: Playlist = { id: `pl_${Date.now().toString(36)}_${seq++}`, name: name.trim() || 'NEW LIST', trackIds: [] };
  lib.playlists.push(p);
  return p;
}

export function deletePlaylist(lib: LibraryState, id: string): boolean {
  const p = playlistOf(lib, id);
  if (!p || p.fixed) return false; // the built-ins hold the floor
  lib.playlists = lib.playlists.filter((x) => x.id !== id);
  if (lib.fieldPlaylistId === id) lib.fieldPlaylistId = FIELD_ID;
  if (lib.nowPlaylistId === id) lib.nowPlaylistId = ALL_ID;
  return true;
}

export function renamePlaylist(lib: LibraryState, id: string, name: string): boolean {
  const p = playlistOf(lib, id);
  if (!p) return false;
  p.name = name.trim() || p.name;
  return true;
}

/** Add a track. A playlist never holds the same song twice. */
export function addToPlaylist(lib: LibraryState, playlistId: string, trackId: string): boolean {
  const p = playlistOf(lib, playlistId);
  if (!p || !trackById(trackId) || p.trackIds.includes(trackId)) return false;
  p.trackIds.push(trackId);
  return true;
}

export function removeFromPlaylist(lib: LibraryState, playlistId: string, trackId: string): boolean {
  const p = playlistOf(lib, playlistId);
  if (!p) return false;
  const before = p.trackIds.length;
  p.trackIds = p.trackIds.filter((id) => id !== trackId);
  return p.trackIds.length !== before;
}

/** Move a track within its list — the ordering IS the playlist. */
export function movePlaylistTrack(lib: LibraryState, playlistId: string, trackId: string, delta: number): boolean {
  const p = playlistOf(lib, playlistId);
  if (!p) return false;
  const i = p.trackIds.indexOf(trackId);
  if (i < 0) return false;
  const j = Math.max(0, Math.min(p.trackIds.length - 1, i + delta));
  if (i === j) return false;
  p.trackIds.splice(i, 1);
  p.trackIds.splice(j, 0, trackId);
  return true;
}

export function toggleFavourite(lib: LibraryState, trackId: string): boolean {
  const i = lib.favourites.indexOf(trackId);
  if (i >= 0) { lib.favourites.splice(i, 1); return false; }
  lib.favourites.push(trackId);
  return true;
}

/** Mark which playlist the headphones draw from. */
export function setFieldPlaylist(lib: LibraryState, id: string): boolean {
  if (!playlistOf(lib, id)) return false;
  lib.fieldPlaylistId = id;
  return true;
}

/**
 * The next track in a queue. `rng` is injected so a test can pin the shuffle
 * and so the field can stay off Math.random when it matters.
 *
 * Shuffle never repeats the track you just heard while anything else is
 * available — the one thing that makes a short playlist feel broken.
 */
export function nextIndex(
  count: number, current: number, shuffle: boolean, repeat: RepeatMode, rng: () => number = Math.random,
): number {
  if (count <= 0) return -1;
  if (repeat === 'one') return current < 0 ? 0 : current;
  if (count === 1) return repeat === 'off' && current === 0 ? -1 : 0;
  if (shuffle) {
    let i = Math.floor(rng() * count) % count;
    if (i === current) i = (i + 1) % count;
    return i;
  }
  const next = current + 1;
  if (next >= count) return repeat === 'all' ? 0 : -1;
  return next;
}

export function prevIndex(count: number, current: number): number {
  if (count <= 0) return -1;
  return current <= 0 ? count - 1 : current - 1;
}

/**
 * mm:ss, or a dash while the file has not told us its length yet.
 *
 * UNKNOWN and ZERO are different facts: a track whose duration we have never
 * read is `—:—`, but a playhead sitting at the very start is `0:00`. Folding
 * them together made every transport open on a dash.
 */
export function clockOf(seconds?: number): string {
  if (seconds === undefined || !isFinite(seconds) || seconds < 0) return '—:—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
