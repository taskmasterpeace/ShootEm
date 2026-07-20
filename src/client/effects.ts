import * as THREE from 'three';
import type { Vec3 } from '../sim/types';
import { settings } from './settings';

const MAX_PARTICLES = 3000;

/** Pooled additive particle system for muzzle flashes, explosions, sparks, jetpack flames. */
export class Particles {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private gravity: Float32Array;
  private cursor = 0;
  private geo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.size = new Float32Array(MAX_PARTICLES);
    this.gravity = new Float32Array(MAX_PARTICLES);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(opts: {
    pos: Vec3; count: number; color: number; speed?: number; life?: number;
    spread?: number; up?: number; gravity?: number; size?: number;
  }) {
    const c = new THREE.Color(opts.color);
    for (let i = 0; i < opts.count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 6) * (0.3 + Math.random() * 0.7);
      const spread = opts.spread ?? 1;
      this.pos[idx * 3] = opts.pos.x + (Math.random() - 0.5) * spread;
      this.pos[idx * 3 + 1] = (opts.pos.y ?? 1) + (Math.random() - 0.5) * spread * 0.5;
      this.pos[idx * 3 + 2] = opts.pos.z + (Math.random() - 0.5) * spread;
      this.vel[idx * 3] = Math.cos(a) * sp;
      this.vel[idx * 3 + 1] = (opts.up ?? 2) * (0.4 + Math.random() * 0.9);
      this.vel[idx * 3 + 2] = Math.sin(a) * sp;
      const shade = 0.6 + Math.random() * 0.4;
      this.col[idx * 3] = c.r * shade;
      this.col[idx * 3 + 1] = c.g * shade;
      this.col[idx * 3 + 2] = c.b * shade;
      this.life[idx] = this.maxLife[idx] = (opts.life ?? 0.5) * (0.5 + Math.random() * 0.5);
      this.gravity[idx] = opts.gravity ?? 6;
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -100; // hide below ground
        continue;
      }
      this.vel[i * 3 + 1] -= this.gravity[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) {
        this.pos[i * 3 + 1] = 0.05;
        this.vel[i * 3 + 1] *= -0.3;
      }
      const k = this.life[i] / this.maxLife[i];
      this.col[i * 3] *= 0.92 + k * 0.08;
      this.col[i * 3 + 1] *= 0.9 + k * 0.08;
      this.col[i * 3 + 2] *= 0.9 + k * 0.08;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/** Pooled point lights for explosion flashes. */
export class FlashLights {
  private lights: { light: THREE.PointLight; until: number }[] = [];

  constructor(scene: THREE.Scene, count = 5) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffaa44, 0, 26, 1.8);
      l.position.y = -100;
      scene.add(l);
      this.lights.push({ light: l, until: 0 });
    }
  }

  flash(pos: Vec3, color: number, intensity: number, now: number, dur = 0.18) {
    const slot = this.lights.find((s) => s.until <= now) ?? this.lights[0];
    slot.light.color.setHex(color);
    slot.light.intensity = intensity;
    slot.light.position.set(pos.x, (pos.y ?? 0) + 2, pos.z);
    slot.until = now + dur;
  }

  update(now: number, dt: number) {
    for (const s of this.lights) {
      if (s.until > now) s.light.intensity *= Math.max(0, 1 - dt * 9);
      else if (s.light.intensity > 0) { s.light.intensity = 0; s.light.position.y = -100; }
    }
  }
}

// ---------------------------------------------------------------------------
// THE FIREBALL (Robert: "we need an actual explosion that fits our art style").
// The ground rings state the sim's literal damage radii; this is the BLAST
// itself — a white-hot core pop, two faceted low-poly fire shells, a ground
// shockwave, rising smoke lumps, and a handful of ballistic debris chunks.
// Everything is pre-built and pooled: a boom re-poses meshes, never allocates.
// ---------------------------------------------------------------------------

const FIREBALL_SLOTS = 8;
const SMOKE_N = 6;
const DEBRIS_N = 10;

interface FireballSlot {
  t: number;           // seconds since boom; Infinity = idle
  dur: number;
  r: number;           // fireball reach (visual)
  ring: number;        // shockwave reach = the sim's splash radius, the honest one
  root: THREE.Group;
  core: THREE.Mesh;
  shellA: THREE.Mesh;
  shellB: THREE.Mesh;
  wave: THREE.Mesh;
  smoke: THREE.Mesh[];
  smokeDir: { x: number; z: number; s: number }[];
  debris: THREE.Mesh[];
  debrisVel: Float32Array; // xyz per chunk
}

export class Fireballs {
  private slots: FireballSlot[] = [];
  private next = 0;

  constructor(scene: THREE.Scene) {
    const coreGeo = new THREE.IcosahedronGeometry(1, 1);
    const shellGeo = new THREE.IcosahedronGeometry(1, 0);   // hard facets — the style
    const waveGeo = new THREE.RingGeometry(0.86, 1, 28);
    const chunkGeo = new THREE.TetrahedronGeometry(1);
    for (let i = 0; i < FIREBALL_SLOTS; i++) {
      const root = new THREE.Group();
      root.visible = false;
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      // every material here skips the depth buffer, so PAINT ORDER decides —
      // and the core must burn THROUGH the shells, not under them
      core.renderOrder = 3;
      const shellA = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: 0xffb32e, transparent: true, depthWrite: false }));
      const shellB = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, depthWrite: false }));
      shellB.rotation.set(0.9, 0.4, 1.7); // offset facets so the two reads as one boiling mass
      const wave = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: 0xffe2a6, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      wave.rotation.x = -Math.PI / 2;
      wave.position.y = 0.16;
      const smoke: THREE.Mesh[] = [];
      const smokeDir: FireballSlot['smokeDir'] = [];
      for (let k = 0; k < SMOKE_N; k++) {
        const m = new THREE.Mesh(shellGeo, new THREE.MeshLambertMaterial({ color: 0x4a443c, transparent: true, depthWrite: false }));
        smoke.push(m); smokeDir.push({ x: 0, z: 0, s: 1 });
        root.add(m);
      }
      const debris: THREE.Mesh[] = [];
      for (let k = 0; k < DEBRIS_N; k++) {
        const m = new THREE.Mesh(chunkGeo, new THREE.MeshLambertMaterial({ color: 0x26221e }));
        debris.push(m);
        root.add(m);
      }
      root.add(core, shellA, shellB, wave);
      scene.add(root);
      this.slots.push({
        t: Infinity, dur: 1.25, r: 3, ring: 5, root, core, shellA, shellB, wave,
        smoke, smokeDir, debris, debrisVel: new Float32Array(DEBRIS_N * 3),
      });
    }
  }

  /** Hide every live fireball — the FX bench resets between freeze-frames so
   *  a capture never shows the ghost of the previous one. */
  reset() {
    for (const s of this.slots) { s.t = Infinity; s.root.visible = false; }
  }

  /** Detonate at `pos`. `splash` is the sim's outer radius (the shockwave runs
   *  to it — the same truth the rings tell); the fireball itself fills the
   *  kill-circle scale so "inside the fire" reads as "you were dead". */
  boom(pos: Vec3, splash: number, killR: number, big = false) {
    const s = this.slots[this.next];
    this.next = (this.next + 1) % FIREBALL_SLOTS;
    s.t = 0;
    s.r = Math.max(1.6, killR * (big ? 2.6 : 2.2));
    s.ring = Math.max(splash, s.r + 0.5);
    s.dur = settings.reducedMotion ? 0.8 : big ? 1.45 : 1.2;
    s.root.position.set(pos.x, pos.y ?? 0, pos.z);
    s.root.visible = true;
    for (let k = 0; k < SMOKE_N; k++) {
      const a = (k / SMOKE_N) * Math.PI * 2 + Math.random() * 0.8;
      const d = s.r * (0.25 + Math.random() * 0.45);
      s.smokeDir[k] = { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.55 + Math.random() * 0.5 };
    }
    for (let k = 0; k < DEBRIS_N; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 6 + Math.random() * 9 * (big ? 1.35 : 1);
      s.debrisVel[k * 3] = Math.cos(a) * sp;
      s.debrisVel[k * 3 + 1] = 5 + Math.random() * 7;
      s.debrisVel[k * 3 + 2] = Math.sin(a) * sp;
      const m = s.debris[k];
      m.position.set(0, 0.4, 0);
      m.scale.setScalar(0.09 + Math.random() * 0.12);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.visible = !settings.reducedMotion; // §18: the comfort valve skips shrapnel
    }
  }

  update(dt: number) {
    for (const s of this.slots) {
      if (s.t === Infinity) continue;
      s.t += dt;
      if (s.t >= s.dur) { s.t = Infinity; s.root.visible = false; continue; }
      const t = s.t;

      // core: a white-hot pop — in by 40ms, gone by 150
      const coreK = Math.max(0, 1 - t / 0.15);
      s.core.visible = coreK > 0;
      s.core.scale.setScalar(s.r * 0.55 * Math.min(1, t / 0.04 + 0.2));
      (s.core.material as THREE.MeshBasicMaterial).opacity = coreK;

      // fire shells: grow fast with a back-ease, squash to the ground, rise a
      // touch, and burn out by ~0.42s — the fire is BRIEF; the smoke lingers
      const grow = Math.min(1, t / 0.3);
      const ease = 1 - (1 - grow) * (1 - grow) * (1 - grow);
      const fade = Math.max(0, 1 - t / 0.42);
      for (const [m, mul, spin] of [[s.shellA, 1, 1.6], [s.shellB, 0.78, -2.3]] as const) {
        m.visible = fade > 0;
        m.scale.set(s.r * ease * mul, s.r * ease * mul * 0.78, s.r * ease * mul);
        m.position.y = s.r * ease * 0.34;
        m.rotation.y += spin * dt;
        (m.material as THREE.MeshBasicMaterial).opacity = 0.28 + fade * 0.72;
      }

      // shockwave: races to the SIM'S splash rim in 0.24s and dies — the fast
      // outer edge is what says "that big, that far"
      const wk = Math.min(1, t / 0.24);
      s.wave.visible = wk < 1;
      s.wave.scale.setScalar(Math.max(0.01, s.ring * (0.25 + 0.75 * wk)));
      (s.wave.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - wk);

      // smoke: takes over as the fire dies, rises and thins. It waits out
      // the flash — black lumps inside a white-hot core read as debris, not
      // smoke, so nothing dark shows before ~0.15s
      const sk = Math.max(0, Math.min(1, (t - 0.15) / (s.dur - 0.15)));
      for (let k = 0; k < SMOKE_N; k++) {
        const m = s.smoke[k];
        const d = s.smokeDir[k];
        m.visible = sk > 0 && sk < 1;
        m.position.set(d.x * (1 + sk * 0.7), 0.5 + sk * (2.6 + d.s), d.z * (1 + sk * 0.7));
        m.scale.setScalar(s.r * d.s * (0.42 + sk * 0.75));
        m.rotation.y += dt * 0.7;
        // ramp IN over a quarter second (smoke builds, it doesn't teleport),
        // then thin as it rises — never at full strength inside the fireball
        const smokeIn = Math.min(1, (t - 0.15) / 0.25);
        (m.material as THREE.MeshLambertMaterial).opacity = 0.62 * smokeIn * (1 - sk);
      }

      // debris: honest ballistics, dead where it lands
      for (let k = 0; k < DEBRIS_N; k++) {
        const m = s.debris[k];
        if (!m.visible) continue;
        s.debrisVel[k * 3 + 1] -= 22 * dt;
        m.position.x += s.debrisVel[k * 3] * dt;
        m.position.y += s.debrisVel[k * 3 + 1] * dt;
        m.position.z += s.debrisVel[k * 3 + 2] * dt;
        m.rotation.x += dt * 9;
        m.rotation.z += dt * 7;
        if (m.position.y <= 0.06) m.visible = false;
      }
    }
  }
}

/**
 * Fullscreen analog-static overlay for the FPV drone feed. Intensity 0 = off;
 * as the control link degrades the noise builds, and a lost link slams it to
 * full for a beat (the "disconnected" moment) before it fades.
 */
export class StaticOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buf: ImageData;
  private intensity = 0;
  private target = 0;
  private flashUntil = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 192;
    this.canvas.height = 108;
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', width: '100vw', height: '100vh',
      pointerEvents: 'none', zIndex: '40', display: 'none',
      imageRendering: 'pixelated', mixBlendMode: 'screen',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.buf = this.ctx.createImageData(192, 108);
  }

  /** Ambient noise level for this frame (0..1) — from the drone's signal. */
  set(target: number) {
    // §18 comfort valve: reduced motion keeps the static readable, never blinding
    const cap = settings.reducedMotion ? 0.45 : 1;
    this.target = Math.max(0, Math.min(cap, target));
  }

  /** Link lost: full-screen static burst that decays over `seconds`. */
  flash(seconds = 0.55) {
    this.flashUntil = performance.now() + seconds * 1000;
  }

  update() {
    const flashing = performance.now() < this.flashUntil;
    const want = flashing ? 1 : this.target;
    this.intensity += (want - this.intensity) * (flashing ? 0.6 : 0.18);
    if (this.intensity < 0.02) {
      if (this.canvas.style.display !== 'none') this.canvas.style.display = 'none';
      return;
    }
    this.canvas.style.display = 'block';
    this.canvas.style.opacity = String(Math.min(1, this.intensity * 1.15));
    const d = this.buf.data;
    // density climbs to a near-total whiteout — at the edge of control range
    // you genuinely CANNOT see the battlefield anymore. Turn back or lose it.
    const density = 0.2 + this.intensity * 0.8;
    const blind = this.intensity > 0.72; // final stretch: snow crushes the feed
    // screen-blend twinkles over the scene; the blind zone goes opaque
    this.canvas.style.mixBlendMode = blind ? 'normal' : 'screen';
    for (let i = 0; i < d.length; i += 4) {
      if (Math.random() < density) {
        const v = 120 + ((Math.random() * 135) | 0); // bright snow pops over any scene
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
        d[i + 3] = blind ? 255 : 235;
      } else if (blind) {
        // in the blind zone even the "gaps" are grey mush, not game
        const v = 40 + ((Math.random() * 70) | 0);
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
        d[i + 3] = 210;
      } else {
        d[i + 3] = 0;
      }
    }
    // rolling horizontal dropout bands sell the analog feel
    const t = performance.now();
    for (let b = 0; b < 3; b++) {
      const band = (((t * (0.09 + b * 0.05)) | 0) + b * 37) % 108;
      for (let x = 0; x < 192; x++) {
        const i = (band * 192 + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 210;
      }
    }
    this.ctx.putImageData(this.buf, 0, 0);
  }
}
