import type { Vec3 } from '../sim/types';

const SOUND_NAMES = [
  'rifle', 'smg', 'pistol', 'shotgun', 'autocannon', 'rail', 'rocket', 'thump',
  'cannon', 'plasma', 'flame', 'repair', 'heal', 'claw', 'acid',
  'hit', 'hitmarker', 'explosion', 'explosion_big', 'death',
  'jetpack', 'cloak', 'reload', 'pickup', 'engine', 'mine_plant', 'turret_built',
  'flag_taken', 'flag_captured', 'flag_returned', 'point_captured',
  'wave_start', 'victory', 'defeat', 'ui_click', 'spawn',
  'impulse', 'warp', 'blink', 'emp_burst', 'gravlift', 'beacon', 'orbital_charge',
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

/** Positional audio: volume/pan derived from listener distance. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private master: GainNode | null = null;
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
          this.buffers.set(name, await this.ctx!.decodeAudioData(arr));
        } catch {
          // missing sound is non-fatal
        }
      }),
    );
  }

  resume() {
    this.ctx?.resume();
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

    let vol = opts.volume ?? 1;
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
    src.playbackRate.value = (opts.rate ?? 1) * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(this.master);
    src.start();
  }
}

export const audio = new AudioEngine();
