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
  // LSW signatures (§21.6, tools/gen-lsw-sounds.mjs): the stable has a voice
  'ice_freeze', 'ice_shatter', 'gas_hiss', 'rage_roar', 'fire_whoosh',
  // LSW SPOKEN LINES (tools/gen-lsw-vo.mjs — gemini-3.1-flash-tts, directed
  // per .claude/skills/expressive-tts): positional — only people around the
  // speaker hear them. Every slot is Sound-Lab replaceable like any other.
  'vo_firebrand_arrive', 'vo_firebrand_kill3', 'vo_firebrand_ability', 'vo_firebrand_low', 'vo_firebrand_death',
  'vo_plaguebearer_arrive', 'vo_plaguebearer_kill3', 'vo_plaguebearer_ability', 'vo_plaguebearer_low', 'vo_plaguebearer_death',
  'vo_frostbite_arrive', 'vo_frostbite_kill3', 'vo_frostbite_ability', 'vo_frostbite_low', 'vo_frostbite_death',
  'vo_ragebeast_arrive', 'vo_ragebeast_kill3', 'vo_ragebeast_ability', 'vo_ragebeast_low', 'vo_ragebeast_death',
  'vo_titan_arrive', 'vo_titan_kill3', 'vo_titan_ability', 'vo_titan_low', 'vo_titan_death',
  'vo_voltstriker_arrive', 'vo_voltstriker_kill3', 'vo_voltstriker_ability', 'vo_voltstriker_low', 'vo_voltstriker_death',
  'vo_sniperhawk_arrive', 'vo_sniperhawk_kill3', 'vo_sniperhawk_ability', 'vo_sniperhawk_low', 'vo_sniperhawk_death',
  'vo_barrier_arrive', 'vo_barrier_kill3', 'vo_barrier_ability', 'vo_barrier_low', 'vo_barrier_death',
  'vo_reactor_arrive', 'vo_reactor_kill3', 'vo_reactor_ability', 'vo_reactor_low', 'vo_reactor_death',
  'vo_oblivion_arrive', 'vo_oblivion_kill3', 'vo_oblivion_ability', 'vo_oblivion_low', 'vo_oblivion_death',
  'vo_tremor_arrive', 'vo_tremor_kill3', 'vo_tremor_ability', 'vo_tremor_low', 'vo_tremor_death',
  'vo_magnetar_arrive', 'vo_magnetar_kill3', 'vo_magnetar_ability', 'vo_magnetar_low', 'vo_magnetar_death',
  'vo_wraith_arrive', 'vo_wraith_kill3', 'vo_wraith_ability', 'vo_wraith_low', 'vo_wraith_death',
  // the announcer's radio net — map-wide, both teams, per-LSW calls
  'ann_firebrand_inbound', 'ann_firebrand_landed', 'ann_firebrand_down', 'ann_firebrand_rampage',
  'ann_plaguebearer_inbound', 'ann_plaguebearer_landed', 'ann_plaguebearer_down', 'ann_plaguebearer_rampage',
  'ann_frostbite_inbound', 'ann_frostbite_landed', 'ann_frostbite_down', 'ann_frostbite_rampage',
  'ann_ragebeast_inbound', 'ann_ragebeast_landed', 'ann_ragebeast_down', 'ann_ragebeast_rampage',
  'ann_titan_inbound', 'ann_titan_landed', 'ann_titan_down', 'ann_titan_rampage',
  'ann_voltstriker_inbound', 'ann_voltstriker_landed', 'ann_voltstriker_down', 'ann_voltstriker_rampage',
  'ann_sniperhawk_inbound', 'ann_sniperhawk_landed', 'ann_sniperhawk_down', 'ann_sniperhawk_rampage',
  'ann_barrier_inbound', 'ann_barrier_landed', 'ann_barrier_down', 'ann_barrier_rampage',
  'ann_reactor_inbound', 'ann_reactor_landed', 'ann_reactor_down', 'ann_reactor_rampage',
  'ann_oblivion_inbound', 'ann_oblivion_landed', 'ann_oblivion_down', 'ann_oblivion_rampage',
  'ann_tremor_inbound', 'ann_tremor_landed', 'ann_tremor_down', 'ann_tremor_rampage',
  'ann_magnetar_inbound', 'ann_magnetar_landed', 'ann_magnetar_down', 'ann_magnetar_rampage',
  'ann_wraith_inbound', 'ann_wraith_landed', 'ann_wraith_down', 'ann_wraith_rampage',
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
  /** humanization width: ±pitch (and ×1.5 ±volume) applied per WORLD play.
   *  Noise-born sounds wear wide jitter naturally (no two gunshots match);
   *  tonal/musical sounds keep it narrow. Non-positional plays (stingers,
   *  UI, the announcer) are NEVER humanized — they hit exact, every time. */
  jitter: number;
}
const EARSHOT_CLASSES: [RegExp, Earshot][] = [
  // the big booms: heard map-wide, walls barely dent them
  [/^(explosion|cannon|thump|emp_burst|orbital)/, { range: 140, muffle: 0.25, weather: 1, jitter: 0.05 }],
  // gunfire: carries a whole street, walls make it distant-thunder. Widest
  // jitter in the game — the same rifle sample must never read twice in a
  // burst (the machine-gun-loop tell is repetition, not the sample).
  [/^(rifle|smg|autocannon|shotgun|rail|rocket|plasma|pistol|impulse|acid)/, { range: 95, muffle: 0.5, weather: 1, jitter: 0.09 }],
  // the close hoses and beams
  [/^(flame|repair|heal)/, { range: 30, muffle: 0.7, weather: 0.5, jitter: 0.06 }],
  // movement and hands: intimate, and a wall is a wall
  [/^(footstep|claw|ladder|reload|door|growl|mine_plant|pickup)/, { range: 20, muffle: 0.9, weather: 0.3, jitter: 0.08 }],
  // fates and abilities: mid-range so the fight stays legible
  [/^(death|jetpack|cloak|warp|blink|gravlift|beacon|spawn|drone)/, { range: 55, muffle: 0.6, weather: 0.5, jitter: 0.05 }],
  // paintball: a marker is AIR — carries a yard, not a street; paint lands
  // wet and close; the referee's whistle owns the whole field by design
  [/^marker/, { range: 70, muffle: 0.55, weather: 1, jitter: 0.08 }],
  [/^splat/, { range: 26, muffle: 0.8, weather: 0.4, jitter: 0.1 }],
  [/^whistle/, { range: 130, muffle: 0.3, weather: 1, jitter: 0.015 }], // the ref's pea, not a synth
  // ballistic feedback: a whiz IS proximity (it only exists near your ear);
  // impacts read a room away — information, never a soundtrack
  [/^whiz/, { range: 18, muffle: 0.9, weather: 0.2, jitter: 0.12 }],
  [/^impact/, { range: 30, muffle: 0.7, weather: 0.5, jitter: 0.1 }],
  // LSW signatures: an Ascendant is an EVENT — its voice carries a street so
  // both sides know it's on the field (the shatter is closer, a local beat)
  [/^(rage_roar|ice_freeze|fire_whoosh|gas_hiss)/, { range: 90, muffle: 0.5, weather: 0.8, jitter: 0.06 }],
  [/^ice_shatter/, { range: 40, muffle: 0.6, weather: 0.4, jitter: 0.1 }],
  // SPOKEN LINES (Robert: "only the people around them would hear it"): a
  // voice carries a room and a half, walls nearly end it, and it never
  // warbles — a detuned actor is a different actor.
  [/^vo_/, { range: 34, muffle: 0.85, weather: 0.4, jitter: 0.012 }],
  // the announcer plays non-positionally (no pos = full volume, exact) —
  // this class only exists so the slot resolves sanely if someone mis-plays
  // it positionally in the future
  [/^ann_/, { range: 200, muffle: 0.1, weather: 0.1, jitter: 0.012 }],
];
export function earshotFor(name: string): Earshot {
  for (const [re, e] of EARSHOT_CLASSES) if (re.test(name)) return e;
  return { range: 60, muffle: 0.5, weather: 0.5, jitter: 0.06 };
}

/**
 * AIR ABSORPTION — distance changes TONE, not just volume. A rifle at 5u is
 * bright and cracky; the same rifle at 90u is a dark thud, because air eats
 * treble first. Pure curve so the law suite can pin it: full brightness up
 * close, falling to a ~1.1kHz rumble floor at the edge of earshot.
 */
export function distanceCutoff(d: number, range: number): number {
  const k = Math.max(0, Math.min(1, d / Math.max(1, range)));
  return 1100 + 15000 * Math.pow(1 - k, 1.6);
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
    // THE MASTER BUS (sound-design pass): master → duck → compressor → out.
    // The compressor is the glue — a 12-source firefight used to hit the
    // DAC raw and clip into digital hash; now the bus leans instead of
    // shattering. The duck gain is the mix's elbow: big moments (a close
    // boom, the referee's whistle) push everything else down for a beat,
    // which is what makes them feel BIG (loudness is relative, not absolute).
    this.duck_ = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.master.connect(this.duck_).connect(comp).connect(this.ctx.destination);
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

  /** the mix's elbow — see init(); null until the context exists */
  private duck_: GainNode | null = null;

  /**
   * DUCK: drop the whole mix for a beat and let it breathe back. `amount`
   * is how far down (0.5 = -6dB-ish), `release` how long the recovery
   * takes. Re-triggers steal the envelope — a string of booms holds the
   * mix down instead of fluttering.
   */
  duck(amount = 0.5, release = 0.55) {
    if (!this.ctx || !this.duck_) return;
    const g = this.duck_.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.min(g.value, 1 - amount), now);
    g.linearRampToValueAtTime(1, now + release);
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
    let rate = (opts.rate ?? 1) * pref.rate;
    /** lowpass cutoff for this play; Infinity = no filter (bright, exact) */
    let cutoff = Infinity;
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
      // AIR ABSORPTION: distance darkens before it silences — a far rifle
      // is a dull thud, not a quiet crack. (The old mix only turned the
      // volume knob; every sound was studio-bright at any range.)
      cutoff = distanceCutoff(d, range);
      // walls between you and the sound: quieter AND darker (low-pass) —
      // a firefight through a wall should FEEL like it's through a wall
      if (ear.muffle > 0 && d > 6 && this.occlusionTest?.(opts.pos)) {
        vol *= 1 - ear.muffle * 0.65;
        cutoff = Math.min(cutoff, 750); // through-the-wall darkness
        if (vol < 0.02) return false; // a footstep behind a wall is a wall's secret
      }
      // HUMANIZATION, world sounds only: no two gunshots, footsteps, or
      // splats read identical — pitch wobbles by the class's jitter, volume
      // half again as much. Stingers/UI/announcer (no pos) stay EXACT: a
      // detuned victory sting is a wrong note, not variety.
      rate *= 1 - ear.jitter + Math.random() * ear.jitter * 2;
      const vj = ear.jitter * 1.5;
      vol *= 1 - vj + Math.random() * vj * 2;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    if (Number.isFinite(cutoff) && cutoff < 15500) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
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
