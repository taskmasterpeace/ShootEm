// ---------------------------------------------------------------------------
// ZOMBIE BENCH CORE — the reusable stress measurement, shared by the one-shot
// CLI (tools/zombie-bench.ts) and the tracker (tools/bench-track.ts).
//
// A defending team of bots (team 0) holds against N plain 'zombie' shamblers
// (team 1). The horde is TOPPED UP to N alive every tick, so the population —
// and therefore the per-tick load — stays constant. We time ONLY world.step +
// takeEvents over `measureTicks` ticks after a warm-up. Same seed, same top-up,
// every run: the only thing that moves between a before and an after is the
// code under test.
// ---------------------------------------------------------------------------
import { CLASSES } from '../src/sim/data';
import type { ClassId, Vec3 } from '../src/sim/types';
import { World } from '../src/sim/world';

export interface BenchResult {
  n: number;          // shamblers held alive
  mean: number;       // ms
  median: number;
  p95: number;
  max: number;
  defenders: number;
  zAlive: number;     // actually alive at the end (should equal n)
}

const WORLD = 300; // TILE 3 × GRID 100
const DEFENDERS = 12;
const SEED = 1337;

export function runBench(n: number, measureTicks = 400, warmup = 600): BenchResult {
  const w = new World({ seed: SEED, mode: 'tdm', matchMinutes: 30 });
  const muster: Vec3 = { x: 0, y: 0, z: 0 };
  const pool = Object.keys(CLASSES) as ClassId[];
  for (let i = 0; i < DEFENDERS; i++) {
    const d = w.addSoldier(`D${i}`, pool[i % pool.length], 0, 'bot');
    d.pos = { x: muster.x + (i - DEFENDERS / 2) * 1.6, y: 0, z: muster.z - 6 };
  }

  // deterministic scatter for the horde (not the sim rng — that stays for the fight)
  let s = 0x1234567;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const hordePos = (): Vec3 => {
    const a = rand() * Math.PI * 2;
    const r = 14 + rand() * 26;
    return {
      x: Math.max(-WORLD / 2 + 4, Math.min(WORLD / 2 - 4, muster.x + Math.cos(a) * r)),
      y: 0,
      z: Math.max(-WORLD / 2 + 4, Math.min(WORLD / 2 - 4, muster.z + Math.sin(a) * r)),
    };
  };
  const topUp = () => {
    let alive = 0;
    for (const sol of w.soldiers.values()) if (sol.kind === 'zombie' && sol.alive) alive++;
    for (; alive < n; alive++) w.addZombie('zombie', hordePos());
  };

  const cmds = new Map<number, never>();
  topUp();
  for (let i = 0; i < warmup; i++) { topUp(); w.step(1 / 60, cmds); w.takeEvents(); }

  const samples: number[] = [];
  for (let i = 0; i < measureTicks; i++) {
    topUp();
    const t = performance.now();
    w.step(1 / 60, cmds);
    w.takeEvents();
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((x, y) => x + y, 0) / samples.length;
  const q = (p: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
  let zAlive = 0;
  for (const sol of w.soldiers.values()) if (sol.kind === 'zombie' && sol.alive) zAlive++;

  return {
    n,
    mean: +mean.toFixed(3),
    median: +q(0.5).toFixed(3),
    p95: +q(0.95).toFixed(3),
    max: +samples[samples.length - 1].toFixed(3),
    defenders: DEFENDERS,
    zAlive,
  };
}
