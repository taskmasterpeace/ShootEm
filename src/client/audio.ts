import type { Vec3 } from '../sim/types';

export const SOUND_NAMES = [
  'rifle', 'rifle2', 'smg', 'pistol', 'shotgun', 'autocannon', 'rail', 'rocket', 'thump',
  'cannon', 'plasma', 'flame', 'repair', 'heal', 'claw', 'acid',
  'hit', 'hitmarker', 'explosion', 'explosion_big', 'death',
  'jetpack', 'cloak', 'reload', 'pickup', 'engine', 'mine_plant', 'turret_built',
  'flag_taken', 'flag_captured', 'flag_returned', 'point_captured',
  'wave_start', 'victory', 'defeat', 'ui_click', 'spawn',
  'impulse', 'warp', 'blink', 'emp_burst', 'gravlift', 'beacon', 'orbital_charge',
  'drone_static', 'drone_crash',
  'footstep', 'growl', 'growl2', 'growl3', // extra growls → random zombie variety
  // per-class death cries (see tools/gen-sounds.mjs)
  'death_infantry', 'death_heavy', 'death_jump', 'death_engineer',
  'death_medic', 'death_infiltrator', 'death_pathfinder', 'death_ghost',
  // per-surface footsteps — biome designation lives in src/client/soundscape.ts;
  // plain 'footstep' is the universal fallback until an asset lands in a slot
  'footstep_grass', 'footstep_metal', 'footstep_rock', 'footstep_ice', 'footstep_grit',
  // three universal footstep CANDIDATES — the harness Sound Lab picks which
  // one the plain 'footstep' slot actually plays (persisted per machine)
  'footstep_a', 'footstep_b', 'footstep_c',
  // per-theme ambience beds (looped low under the match; ducked, never loud)
  'amb_savanna', 'amb_starship', 'amb_asteroid', 'amb_europa', 'amb_titan', 'amb_triton',
  'door', // door swing: creak + latch (E did it)
  'door_hit', // fist/claw pounding the wood — the siege heartbeat
  'door_break', // planks give way — the siege payoff
  // paintball (§14, tools/gen-paintball-sounds.mjs): air, paint, and a referee
  'marker', 'marker_pump', 'marker_lob', // pneumatic thoops — air, not gunpowder
  'splat', 'splat_big',                  // a ball breaking · a player painted out
  'whistle',                             // round start/end — the yard's metronome
  // ballistic feedback (tools/gen-impact-sounds.mjs): the round that missed
  // you tells you WHERE FROM, and the one that hit tells you WHAT it hit
  'whiz', 'impact_dirt', 'impact_stone', 'impact_metal',
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

// ---------------------------------------------------------------------------
// ACOUSTIC CLASSES — how far each kind of sound carries, how much a wall
// takes out of it, and how much the weather (§8.8) dulls it. This is the
// whole sound-design law: a cannon rolls across the map, a rifle carries a
// street, a footstep dies at the wall. Ranges are in world units; the map
// is 300 across, standard engagements happen inside ~60.
// ---------------------------------------------------------------------------
export interface Earshot {
  range: number;
  /** how much of it a wall eats (0 = booms ignore walls, 1 = walls kill it) */
  muffle: number;
  /** how much rain/snow dull it (1 = fully weather-exposed) */
  weather: number;
}
const EARSHOT_CLASSES: [RegExp, Earshot][] = [
  // the big booms: heard map-wide, walls barely dent them
  [/^(explosion|cannon|thump|emp_burst|orbital)/, { range: 140, muffle: 0.25, weather: 1 }],
  // gunfire: carries a whole street, walls make it distant-thunder
  [/^(rifle|smg|autocannon|shotgun|rail|rocket|plasma|pistol|impulse|acid)/, { range: 95, muffle: 0.5, weather: 1 }],
  // the close hoses and beams
  [/^(flame|repair|heal)/, { range: 30, muffle: 0.7, weather: 0.5 }],
  // movement and hands: intimate, and a wall is a wall
  [/^(footstep|claw|ladder|reload|door|growl|mine_plant|pickup)/, { range: 20, muffle: 0.9, weather: 0.3 }],
  // fates and abilities: mid-range so the fight stays legible
  [/^(death|jetpack|cloak|warp|blink|gravlift|beacon|spawn|drone)/, { range: 55, muffle: 0.6, weather: 0.5 }],
  // paintball: a marker is AIR — carries a yard, not a street; paint lands
  // wet and close; the referee's whistle owns the whole field by design
  [/^marker/, { range: 70, muffle: 0.55, weather: 1 }],
  [/^splat/, { range: 26, muffle: 0.8, weather: 0.4 }],
  [/^whistle/, { range: 130, muffle: 0.3, weather: 1 }],
  // ballistic feedback: a whiz IS proximity (it only exists near your ear);
  // impacts read a room away — information, never a soundtrack
  [/^whiz/, { range: 18, muffle: 0.9, weather: 0.2 }],
  [/^impact/, { range: 30, muffle: 0.7, weather: 0.5 }],
];
export function earshotFor(name: string): Earshot {
  for (const [re, e] of EARSHOT_CLASSES) if (re.test(name)) return e;
  return { range: 60, muffle: 0.5, weather: 0.5 };
}

// ---------------------------------------------------------------------------
// Sound Lab persistence: per-sound volume/pitch prefs live in localStorage;
// user-supplied replacement sounds live in IndexedDB (too big for LS).
// The harness edits these; the game honors them on every launch.
// ---------------------------------------------------------------------------

export interface SoundPref { vol?: number; rate?: number }

const PREF_KEY = 'ww_sound_prefs';
const IDB_NAME = 'ww_sounds';
const IDB_STORE = 'custom';

function loadPrefs(): Record<string, SoundPref> {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as Record<string, SoundPref>;
  } catch {
    return {};
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll(): Promise<Map<string, ArrayBuffer>> {
  const out = new Map<string, ArrayBuffer>();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      tx.oncomplete = () => {
        (keysReq.result as string[]).forEach((k, i) => out.set(k, valsReq.result[i] as ArrayBuffer));
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* no custom sounds — fine */ }
  return out;
}

async function idbPut(name: string, buf: ArrayBuffer): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(buf, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbDelete(name: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Positional audio: volume/pan derived from listener distance. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private stock = new Map<string, AudioBuffer>();   // untouched originals
  private custom = new Set<string>();               // names carrying user sounds
  private master: GainNode | null = null;
  private prefs: Record<string, SoundPref> = loadPrefs();
  listener: Vec3 = { x: 0, y: 0, z: 0 };
  private masterVolume = 0.5;

  /** Settings screen: master volume, applied live and at init. */
  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.masterVolume;
  }
  private lastPlayed = new Map<string, number>();

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVolume;
    this.master.connect(this.ctx.destination);
    await Promise.all(
      SOUND_NAMES.map(async (name) => {
        try {
          const res = await fetch(`/audio/${name}.wav`);
          const arr = await res.arrayBuffer();
          const buf = await this.ctx!.decodeAudioData(arr);
          this.stock.set(name, buf);
          this.buffers.set(name, buf);
        } catch {
          // missing sound is non-fatal
        }
      }),
    );
    // user-supplied sounds from the harness Sound Lab override stock
    const customs = await idbGetAll();
    for (const [name, raw] of customs) {
      try {
        this.buffers.set(name, await this.ctx.decodeAudioData(raw.slice(0)));
        this.custom.add(name);
      } catch { /* undecodable upload — stock stands */ }
    }
  }

  resume() {
    this.ctx?.resume();
  }

  // ---- Sound Lab API (driven from the harness) ----

  /** Per-sound user volume (0–2) and pitch (0.5–2), both default 1. Persisted. */
  getPref(name: SoundName): Required<SoundPref> {
    const p = this.prefs[name] ?? {};
    return { vol: p.vol ?? 1, rate: p.rate ?? 1 };
  }

  setPref(name: SoundName, pref: SoundPref) {
    this.prefs[name] = { ...this.prefs[name], ...pref };
    localStorage.setItem(PREF_KEY, JSON.stringify(this.prefs));
  }

  hasCustom(name: SoundName): boolean {
    return this.custom.has(name);
  }

  /** The decoded buffer currently bound to a sound (stock or user replacement).
   *  Lets tools draw its waveform and read its real length. */
  getBuffer(name: SoundName): AudioBuffer | undefined {
    return this.buffers.get(name);
  }

  /** Replace a sound with the user's own audio file. Persisted in IndexedDB. */
  async setCustom(name: SoundName, raw: ArrayBuffer): Promise<boolean> {
    if (!this.ctx) return false;
    try {
      const buf = await this.ctx.decodeAudioData(raw.slice(0));
      await idbPut(name, raw);
      this.buffers.set(name, buf);
      this.custom.add(name);
      return true;
    } catch {
      return false; // not decodable audio
    }
  }

  /** Back to the stock CC0 sound. */
  async clearCustom(name: SoundName) {
    await idbDelete(name);
    this.custom.delete(name);
    const stock = this.stock.get(name);
    if (stock) this.buffers.set(name, stock);
  }

  /** Returns false when the sound couldn't start (no buffer yet, throttled,
   *  out of range) so callers can fall back to another slot — e.g. a missing
   *  footstep_ice falls back to the universal footstep. */
  /** which candidate the universal 'footstep' slot resolves to */
  private footstepDefault: SoundName = (() => {
    try { return (localStorage.getItem('ww_footstep_default') as SoundName) || 'footstep'; }
    catch { return 'footstep' as SoundName; } // headless test env
  })();

  /** Harness Sound Lab: swap the universal footstep (a/b/c or the original). */
  setDefaultFootstep(name: SoundName) {
    this.footstepDefault = name;
    try { localStorage.setItem('ww_footstep_default', name); } catch { /* headless */ }
  }

  getDefaultFootstep(): SoundName { return this.footstepDefault; }

  /** SOUND DESIGN LAW: you hear what your CHARACTER would hear. Every sound
   *  belongs to an acoustic class with its own earshot and wall behavior —
   *  a tank cannon rolls across the whole map, a footstep dies at a wall.
   *  Set by the renderer each frame: occlusion test + the weather's damper. */
  occlusionTest: ((pos: Vec3) => boolean) | null = null;
  /** §8.8: rain dulls gunshots, snow smothers them (0 = dry air) */
  weatherDull = 0;

  play(name: SoundName, opts: { pos?: Vec3; volume?: number; rate?: number } = {}): boolean {
    if (!this.ctx || !this.master) return false;
    if (name === 'footstep') name = this.footstepDefault; // the swappable default
    const buf = this.buffers.get(name);
    if (!buf) return false;

    // throttle identical sounds within 30ms (bot firefights spam hard)
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.03) return true; // a copy is already ringing — that counts
    this.lastPlayed.set(name, now);

    const pref = this.getPref(name);
    let vol = (opts.volume ?? 1) * pref.vol;
    let pan = 0;
    let muffled = false;
    if (opts.pos) {
      const ear = earshotFor(name);
      const dx = opts.pos.x - this.listener.x;
      const dz = opts.pos.z - this.listener.z;
      const d = Math.hypot(dx, dz);
      // weather shortens the world's ears (rain dulls, snow smothers — §8.8)
      const range = ear.range * (1 - this.weatherDull * 0.3);
      if (d > range) return false;
      vol *= Math.pow(1 - d / range, 1.4);
      vol *= 1 - this.weatherDull * 0.35 * ear.weather;
      pan = Math.max(-0.8, Math.min(0.8, dx / 40));
      // walls between you and the sound: quieter AND darker (low-pass) —
      // a firefight through a wall should FEEL like it's through a wall
      if (ear.muffle > 0 && d > 6 && this.occlusionTest?.(opts.pos)) {
        vol *= 1 - ear.muffle * 0.65;
        muffled = true;
        if (vol < 0.02) return false; // a footstep behind a wall is a wall's secret
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (opts.rate ?? 1) * pref.rate * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    if (muffled) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 750; // through-the-wall darkness
      src.connect(lp).connect(g).connect(p).connect(this.master);
    } else {
      src.connect(g).connect(p).connect(this.master);
    }
    src.start();
    return true;
  }

  // ---- loop bus: ambience beds and other sustained sounds ----

  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();

  /** Start (or keep) a looping bed. Fades in over a second; returns false if
   *  the buffer isn't loaded yet so callers can retry when assets arrive. */
  loop(name: SoundName, volume = 0.25): boolean {
    if (!this.ctx || !this.master) return false;
    if (this.loops.has(name)) return true;
    const buf = this.buffers.get(name);
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(volume * this.getPref(name).vol, this.ctx.currentTime + 1);
    src.connect(g).connect(this.master);
    src.start();
    this.loops.set(name, { src, gain: g });
    return true;
  }

  /** Fade a loop out and stop it. */
  stopLoop(name: SoundName) {
    const l = this.loops.get(name);
    if (!l || !this.ctx) return;
    this.loops.delete(name);
    l.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
    const src = l.src;
    setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, 900);
  }

  looping(name: SoundName): boolean {
    return this.loops.has(name);
  }
}

export const audio = new AudioEngine();
