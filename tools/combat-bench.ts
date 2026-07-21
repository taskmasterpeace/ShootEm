/**
 * COMBAT STRESS BENCH — the audit's own scenario (12v12 bot-vs-bot conquest,
 * with the map's ~34 vehicles/turrets), for the sim tickets the zombie horde
 * bench can't reach: isolatedFriendly (S1), team perception (S5), parked hulls
 * (S6). Two bot teams fight on a fixed seed; deaths respawn so the population —
 * and the per-tick load — stays constant. We time ONLY world.step + takeEvents
 * after a warm-up long enough for hulls to park and projectiles to fly. Same
 * seed, same setup, every run: the only thing that moves between a before and
 * an after is the code under test.
 *
 *   npx tsx tools/combat-bench.ts [perTeam] [measureTicks]
 */
import { CLASSES } from '../src/sim/data';
import type { ClassId } from '../src/sim/types';
import { World } from '../src/sim/world';

const SEED = 4207;

export interface CombatBenchResult { perTeam: number; mean: number; median: number; p95: number; max: number; }

export function runCombatBench(perTeam = 12, measureTicks = 400, warmup = 60 * 25): CombatBenchResult {
  const w = new World({ seed: SEED, mode: 'conquest', matchMinutes: 40 });
  const pool = Object.keys(CLASSES) as ClassId[];
  for (const team of [0, 1] as const) {
    for (let i = 0; i < perTeam; i++) w.addSoldier(`B${team}-${i}`, pool[i % pool.length], team, 'bot');
  }
  const cmds = new Map<number, never>();
  for (let i = 0; i < warmup; i++) { w.step(1 / 60, cmds); w.takeEvents(); }

  const samples: number[] = [];
  for (let i = 0; i < measureTicks; i++) {
    const t = performance.now();
    w.step(1 / 60, cmds);
    w.takeEvents();
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((x, y) => x + y, 0) / samples.length;
  const q = (p: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
  return {
    perTeam,
    mean: +mean.toFixed(3),
    median: +q(0.5).toFixed(3),
    p95: +q(0.95).toFixed(3),
    max: +samples[samples.length - 1].toFixed(3),
  };
}

// CLI
const perTeam = Number(process.argv[2] ?? 12);
const measure = Number(process.argv[3] ?? 400);
const r = runCombatBench(perTeam, measure);
console.log(`=== COMBAT BENCH — ${perTeam}v${perTeam} bots, conquest (with vehicles) ===`);
console.log(`sim step over ${measure} ticks:`);
console.log(`  mean   ${r.mean.toFixed(3)} ms   (${(r.mean / 16.7 * 100).toFixed(1)}% of a 16.7 ms frame)`);
console.log(`  median ${r.median.toFixed(3)} ms`);
console.log(`  p95    ${r.p95.toFixed(3)} ms`);
console.log(`  max    ${r.max.toFixed(3)} ms`);
