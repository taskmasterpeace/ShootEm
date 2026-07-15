import * as THREE from 'three';
import type { Vec3 } from '../sim/types';

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
    this.target = Math.max(0, Math.min(1, target));
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
    this.canvas.style.opacity = String(Math.min(1, this.intensity));
    const d = this.buf.data;
    const density = 0.25 + this.intensity * 0.65;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.random() < density) {
        const v = 120 + ((Math.random() * 135) | 0); // bright snow pops over any scene
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
        d[i + 3] = 235;
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
