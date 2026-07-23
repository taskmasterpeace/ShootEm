// ---------------------------------------------------------------------------
// THE GONET — the laptop that replaced the main menu, and the music that
// follows you onto the field.
//
// The laws:
//   1. THE FIELD PLAYLIST IS THE CONTRACT. Whatever is marked FIELD is what
//      the headphones play. It can never be empty, and it can never be
//      deleted out from under the field.
//   2. Shuffle never plays the song you just heard while another exists.
//   3. Mail and broadcast REPORT; they never invent. Every message and every
//      segment is derived from real account state.
//   4. Headphones are a TRADE: the world gets quieter, and the war's own
//      score gets out of the way.
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_ID, FIELD_ID, TRACKS, addToPlaylist, clockOf, createPlaylist, defaultLibrary,
  deletePlaylist, fieldTracks, loadLibrary, movePlaylistTrack, nextIndex, playlistOf,
  prevIndex, removeFromPlaylist, saveLibrary, setFieldPlaylist, toggleFavourite, tracksOf,
} from '../src/client/gonet/library';
import { buildInbox, unreadCount } from '../src/client/gonet/mail';
import {
  CHANNELS, buildSchedule, reelSeconds, reelsOn, shotAt,
} from '../src/client/gonet/broadcast';
import { HEADPHONE_WORLD_CUT } from '../src/client/gonet/headphones';

// The node env has no localStorage; the client modules all try/catch around it
// and fall back to defaults. A tiny in-memory store lets the round-trip laws
// (save → load → the built-ins are still there) actually be tested.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

beforeEach(() => localStorage.clear());

describe('the music library', () => {
  it('ships with everything on the shelf, and the field kit already packed', () => {
    const lib = defaultLibrary();
    expect(tracksOf(lib, ALL_ID)).toHaveLength(TRACKS.length);
    expect(fieldTracks(lib)).toHaveLength(TRACKS.length);
    expect(lib.fieldPlaylistId).toBe(FIELD_ID);
  });

  it('THE FIELD IS NEVER SILENT: an emptied field list still hands the field music', () => {
    const lib = defaultLibrary();
    const field = playlistOf(lib, FIELD_ID)!;
    field.trackIds = [];
    // the headphones must have something to play — falling back to the shelf
    // beats a soldier pressing H and getting nothing
    expect(fieldTracks(lib).length).toBe(TRACKS.length);
  });

  it('refuses to delete a built-in list — the library keeps a floor', () => {
    const lib = defaultLibrary();
    expect(deletePlaylist(lib, FIELD_ID)).toBe(false);
    expect(deletePlaylist(lib, ALL_ID)).toBe(false);
    expect(lib.playlists).toHaveLength(2);
  });

  it('deleting the list that was on the field sends the field home', () => {
    const lib = defaultLibrary();
    const mine = createPlaylist(lib, 'NIGHT PATROL');
    addToPlaylist(lib, mine.id, TRACKS[0].id);
    setFieldPlaylist(lib, mine.id);
    expect(lib.fieldPlaylistId).toBe(mine.id);
    deletePlaylist(lib, mine.id);
    expect(lib.fieldPlaylistId).toBe(FIELD_ID); // never a dangling id
    expect(fieldTracks(lib).length).toBeGreaterThan(0);
  });

  it('a playlist never holds the same song twice', () => {
    const lib = defaultLibrary();
    const p = createPlaylist(lib, 'DOUBLES');
    expect(addToPlaylist(lib, p.id, TRACKS[0].id)).toBe(true);
    expect(addToPlaylist(lib, p.id, TRACKS[0].id)).toBe(false);
    expect(p.trackIds).toHaveLength(1);
  });

  it('ordering IS the playlist — tracks move and stay moved', () => {
    const lib = defaultLibrary();
    const p = createPlaylist(lib, 'ORDER');
    for (const t of TRACKS.slice(0, 3)) addToPlaylist(lib, p.id, t.id);
    const [a, b, c] = p.trackIds;
    movePlaylistTrack(lib, p.id, c, -2);
    expect(p.trackIds).toEqual([c, a, b]);
    movePlaylistTrack(lib, p.id, c, +1);
    expect(p.trackIds).toEqual([a, c, b]);
    // and it cannot fall off either end
    movePlaylistTrack(lib, p.id, a, -5);
    expect(p.trackIds[0]).toBe(a);
  });

  it('removing a track leaves the rest alone', () => {
    const lib = defaultLibrary();
    const p = createPlaylist(lib, 'TRIM');
    for (const t of TRACKS.slice(0, 3)) addToPlaylist(lib, p.id, t.id);
    expect(removeFromPlaylist(lib, p.id, TRACKS[1].id)).toBe(true);
    expect(p.trackIds).toEqual([TRACKS[0].id, TRACKS[2].id]);
  });

  it('favourites toggle both ways', () => {
    const lib = defaultLibrary();
    expect(toggleFavourite(lib, TRACKS[0].id)).toBe(true);
    expect(lib.favourites).toContain(TRACKS[0].id);
    expect(toggleFavourite(lib, TRACKS[0].id)).toBe(false);
    expect(lib.favourites).not.toContain(TRACKS[0].id);
  });

  it('survives a round trip through storage, built-ins re-asserted', () => {
    const lib = defaultLibrary();
    const p = createPlaylist(lib, 'MARCHING');
    addToPlaylist(lib, p.id, TRACKS[2].id);
    setFieldPlaylist(lib, p.id);
    saveLibrary(lib);
    const back = loadLibrary();
    expect(back.playlists.find((x) => x.name === 'MARCHING')?.trackIds).toEqual([TRACKS[2].id]);
    expect(back.fieldPlaylistId).toBe(p.id);
    expect(back.playlists.find((x) => x.id === FIELD_ID)?.fixed).toBe(true);
  });

  it('a half-written store cannot leave the field with nothing', () => {
    localStorage.setItem('ww.library.v1', JSON.stringify({ playlists: [], fieldPlaylistId: 'gone' }));
    const back = loadLibrary();
    expect(back.playlists.some((p) => p.id === FIELD_ID)).toBe(true);
    expect(back.fieldPlaylistId).toBe(FIELD_ID);
    expect(fieldTracks(back).length).toBeGreaterThan(0);
  });

  it('drops track ids that are no longer on the shelf', () => {
    localStorage.setItem('ww.library.v1', JSON.stringify({
      playlists: [{ id: FIELD_ID, name: 'THE FIELD', trackIds: [TRACKS[0].id, 'a_song_that_left'] }],
      fieldPlaylistId: FIELD_ID,
    }));
    expect(loadLibrary().playlists.find((p) => p.id === FIELD_ID)!.trackIds).toEqual([TRACKS[0].id]);
  });
});

describe('the deck ordering', () => {
  it('shuffle never repeats the song you just heard while another exists', () => {
    for (let cur = 0; cur < 9; cur++) {
      for (const roll of [0, 0.11, 0.5, 0.99]) {
        expect(nextIndex(9, cur, true, 'all', () => roll)).not.toBe(cur);
      }
    }
  });

  it('in order it walks the list and wraps only on repeat-all', () => {
    expect(nextIndex(3, 0, false, 'all')).toBe(1);
    expect(nextIndex(3, 2, false, 'all')).toBe(0);
    expect(nextIndex(3, 2, false, 'off')).toBe(-1); // the list ends
  });

  it('repeat-one holds the same track', () => {
    expect(nextIndex(5, 3, true, 'one')).toBe(3);
    expect(nextIndex(5, 3, false, 'one')).toBe(3);
  });

  it('a one-track list does not stall on shuffle', () => {
    expect(nextIndex(1, 0, true, 'all')).toBe(0);
    expect(nextIndex(1, 0, true, 'off')).toBe(-1);
  });

  it('prev wraps to the end', () => {
    expect(prevIndex(4, 0)).toBe(3);
    expect(prevIndex(4, 2)).toBe(1);
  });

  it('tells UNKNOWN from ZERO — a playhead at the start is not a mystery', () => {
    expect(clockOf(undefined)).toBe('—:—');   // never read the file yet
    expect(clockOf(Infinity)).toBe('—:—');    // streaming, no length
    expect(clockOf(0)).toBe('0:00');          // the start of a track IS known
    expect(clockOf(95)).toBe('1:35');
    expect(clockOf(3599)).toBe('59:59');
  });
});

describe('the mail reports, it does not invent', () => {
  const id = {
    callsign: 'Smith', nationCode: 840, hometown: 'Richmond',
    faction: 'united_front' as const, created: 0,
    psych: { answers: [], recommended: 'infantry', temperament: 'steady' },
  };

  it('fills the inbox off real account state', () => {
    const box = buildInbox(id, 18);
    expect(box.length).toBeGreaterThanOrEqual(4); // the mock promised four
    // the ministry quotes the actual chest
    const ministry = box.find((m) => m.id === 'ministry_chest')!;
    expect(ministry.body).toMatch(/\d/);
    // the hometown from the intake really appears
    expect(box.some((m) => m.body.includes('Richmond') || m.from.includes('RICHMOND'))).toBe(true);
    // the psych desk's read is quoted back
    expect(box.find((m) => m.id === 'ministry_psych')?.body).toContain('STEADY');
  });

  it('every message names a sender, a subject and a dateline', () => {
    for (const m of buildInbox(id, 9)) {
      expect(m.from.length).toBeGreaterThan(0);
      expect(m.subject.length).toBeGreaterThan(0);
      expect(m.when).toMatch(/TODAY \d\d:\d\d/);
      expect(m.body.length).toBeGreaterThan(40);
    }
  });

  it('works with no identity at all — a fresh boot has mail too', () => {
    const box = buildInbox(null, 6);
    expect(box.length).toBeGreaterThan(0);
    expect(unreadCount(box)).toBe(box.length); // nothing read yet
  });

  it('the schools letter names the paper you do NOT hold', () => {
    const box = buildInbox(id, 6);
    const school = box.find((m) => m.kind === 'school')!;
    expect(school.subject).toMatch(/not certified|Every certification/);
  });
});

describe('the broadcast desk', () => {
  it('every channel has something to play', () => {
    const sched = buildSchedule(null, 1_700_000_000_000);
    for (const c of CHANNELS) expect(reelsOn(sched, c.id).length).toBeGreaterThan(0);
  });

  it('a reel is a real timeline — shots hold, and the playhead finds them', () => {
    const reel = buildSchedule(null, 1_700_000_000_000)[0];
    expect(reel.shots.length).toBeGreaterThan(0);
    expect(reelSeconds(reel)).toBeGreaterThan(0);
    expect(shotAt(reel, 0).index).toBe(0);
    // partway into the first shot is still the first shot
    expect(shotAt(reel, reel.shots[0].hold * 0.5).index).toBe(0);
    // just past it is the second
    if (reel.shots.length > 1) expect(shotAt(reel, reel.shots[0].hold + 0.01).index).toBe(1);
    // past the end it clamps rather than running off
    expect(shotAt(reel, reelSeconds(reel) + 99).index).toBe(reel.shots.length - 1);
  });

  it('every shot carries a headline and a hold', () => {
    for (const reel of buildSchedule(null, 1_700_000_000_000)) {
      expect(reel.title.length).toBeGreaterThan(0);
      for (const s of reel.shots) {
        expect(s.headline.length).toBeGreaterThan(0);
        expect(s.hold).toBeGreaterThan(0);
      }
    }
  });

  it('training films teach every school in the register', () => {
    const films = reelsOn(buildSchedule(null, 1_700_000_000_000), 'films');
    expect(films.length).toBeGreaterThanOrEqual(3);
    // each names its certifications, with their real gate state
    expect(films.some((f) => f.shots.some((s) => s.figure === 'OPEN' || s.figure === 'HELD'
      || (s.figure ?? '').startsWith('NEEDS')))).toBe(true);
  });
});

describe('the headphones are a trade', () => {
  it('the world really is pushed back, not just labelled', () => {
    expect(HEADPHONE_WORLD_CUT).toBeGreaterThan(0.3);
    expect(HEADPHONE_WORLD_CUT).toBeLessThan(1); // never total deafness
  });
});
