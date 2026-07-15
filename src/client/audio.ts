import type { Vec3 } from '../sim/types';

export const SOUND_NAMES = [
  'rifle', 'smg', 'pistol', 'shotgun', 'autocannon', 'rail', 'rocket', 'thump',
  'cannon', 'plasma', 'flame', 'repair', 'heal', 'claw', 'acid',
  'hit', 'hitmarker', 'explosion', 'explosion_big', 'death',
  'jetpack', 'cloak', 'reload', 'pickup', 'engine', 'mine_plant', 'turret_built',
  'flag_taken', 'flag_captured', 'flag_returned', 'point_captured',
  'wave_start', 'victory', 'defeat', 'ui_click', 'spawn',
  'impulse', 'warp', 'blink', 'emp_burst', 'gravlift', 'beacon', 'orbital_charge',
  'footstep', 'growl',
  // per-class death cries (see tools/gen-sounds.mjs)
  'death_infantry', 'death_heavy', 'death_jump', 'death_engineer',
  'death_medic', 'death_infiltrator', 'death_pathfinder', 'death_ghost',
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

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
  private lastPlayed = new Map<string, number>();

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
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

  play(name: SoundName, opts: { pos?: Vec3; volume?: number; rate?: number } = {}) {
    if (!this.ctx || !this.master) return;
    const buf = this.buffers.get(name);
    if (!buf) return;

    // throttle identical sounds within 30ms (bot firefights spam hard)
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.03) return;
    this.lastPlayed.set(name, now);

    const pref = this.getPref(name);
    let vol = (opts.volume ?? 1) * pref.vol;
    let pan = 0;
    if (opts.pos) {
      const dx = opts.pos.x - this.listener.x;
      const dz = opts.pos.z - this.listener.z;
      const d = Math.hypot(dx, dz);
      const maxD = 85;
      if (d > maxD) return;
      vol *= Math.pow(1 - d / maxD, 1.4);
      pan = Math.max(-0.8, Math.min(0.8, dx / 40));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (opts.rate ?? 1) * pref.rate * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(this.master);
    src.start();
  }
}

export const audio = new AudioEngine();
