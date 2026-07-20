// ---------------------------------------------------------------------------
// THE FX SHEET (/fx.html) — the explosion, on a bench. A frag-scale and a
// tank-scale boom fire on alternating timers over a ground grid with
// soldier-height posts standing in the blast, so "does the fireball fit the
// art style / read the radius" is something you LOOK at, not argue about.
// window.__fx.boom(big) triggers one on demand; a screenshot can call it and
// shoot the exact frame it wants.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Fireballs, FlashLights, Particles } from './effects';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11151a);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9fb2c8, 0x3a382f, 0.85));
const moon = new THREE.DirectionalLight(0xcfd8e6, 0.5);
moon.position.set(30, 50, 15);
scene.add(moon);

// deck: dark grid so the fire owns the frame
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 120),
  new THREE.MeshLambertMaterial({ color: 0x2c3328 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const grid = new THREE.GridHelper(160, 40, 0x3d4640, 0x39413b);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.5;
grid.position.y = 0.02;
scene.add(grid);

// two blast sites, each ringed by 1.8u posts at the sim's real radii —
// gl splash 6 / kill 2.4 on the left, tank splash 6.5 on the right
const SITES = [
  { x: -18, splash: 6, kill: 2.4, big: false },
  { x: 18, splash: 6.5, kill: 2.6, big: true },
];
for (const site of SITES) {
  for (const r of [site.kill, site.splash]) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 1.8, 8),
        new THREE.MeshLambertMaterial({ color: r === site.kill ? 0xd8483c : 0xc8b370 }),
      );
      post.position.set(site.x + Math.cos(a) * r, 0.9, Math.sin(a) * r);
      scene.add(post);
    }
  }
}

const particles = new Particles(scene);
const flashes = new FlashLights(scene);
const fireballs = new Fireballs(scene);

camera.position.set(0, 34, 40);
camera.lookAt(0, 1, -2);

let simTime = 0;
const boom = (big: boolean) => {
  const site = SITES[big ? 1 : 0];
  const pos = { x: site.x, y: 0, z: 0 };
  fireballs.boom(pos, site.splash, site.kill, big);
  flashes.flash(pos, 0xffaa44, big ? 90 : 45, simTime);
  particles.emit({ pos, count: big ? 60 : 35, color: 0xff9040, speed: big ? 14 : 9, life: 0.7, spread: 1, up: 7, gravity: 8 });
  particles.emit({ pos, count: 20, color: 0x555555, speed: 4, life: 1.2, spread: 1.5, up: 5, gravity: 2 });
};

// the metronome: left boom, beat, right boom, beat — 1.6s cycle each side
let auto = true;
let nextAt = 0.6;
let nextBig = false;

let frames = 0;
let frozen = false;
let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!frozen) {
    simTime += dt;
    if (auto && simTime >= nextAt) {
      boom(nextBig);
      nextBig = !nextBig;
      nextAt = simTime + 1.6;
    }
    particles.update(dt);
    flashes.update(simTime, dt);
    fireballs.update(dt);
  }
  frames++;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

interface FxHandle {
  frames: () => number;
  boom: (big: boolean) => void;
  setAuto: (v: boolean) => void;
  /** deterministic capture: kill the metronome, detonate BOTH sites, pump the
   *  clock by hand to exactly `t` seconds, and freeze. A screenshot can then
   *  take all the round-trip time it wants — the frame holds still. */
  freezeAt: (t: number) => void;
  thaw: () => void;
}
(window as unknown as { __fx: FxHandle }).__fx = {
  frames: () => frames,
  boom: (big) => boom(big),
  setAuto: (v) => { auto = v; },
  freezeAt: (t) => {
    auto = false;
    frozen = false;
    fireballs.reset(); // no ghosts of the previous freeze in this capture
    boom(false); boom(true);
    const step = 1 / 60;
    for (let k = 0; k < Math.round(t / step); k++) {
      simTime += step;
      particles.update(step);
      flashes.update(simTime, step);
      fireballs.update(step);
    }
    frozen = true;
  },
  thaw: () => { frozen = false; auto = true; },
};

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
