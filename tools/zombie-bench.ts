/**
 * ZOMBIE STRESS BENCH — the instrument Robert asked for: "a large number of
 * shambler zombies on screen in combat," measured so an optimization can be
 * CONFIRMED, not hoped about.
 *
 *   npx tsx tools/zombie-bench.ts [N] [measureTicks]
 *
 * A defending team of bots (team 0) holds against N plain 'zombie' shamblers
 * (team 1). The horde is TOPPED UP to N alive every tick, so the population —
 * and therefore the per-tick load — stays constant instead of bleeding out as
 * the defenders mow them down. We time ONLY world.step + takeEvents, over
 * `measureTicks` ticks after a warm-up, and report the mean/median/p95 step ms
 * against the 16.7 ms frame budget. Same seed, same top-up, every run — so the
 * only thing that moves between a before and an after is the code under test.
 *
 * Determinism note: the top-up forces the population, so rng-order shifts from
 * a caching change (e.g. S4) can't change WHAT we measure — N shamblers, 12
 * defenders, in combat, every run.
 */
import { CLASSES } from '../src/sim/data';
import type { ClassId, Soldier, Vec3 } from '../src/sim/types';
import { World } from '../src/sim/world';

const N = Number(process.argv[2] ?? 100); // shamblers held alive
const MEASURE = Number(process.argv[3] ?? 600); // timed ticks
const WARMUP = 600; // 10 s at 60 Hz to reach a hot fight
const DEFENDERS = 12;
const SEED = 1337;

const w = new World({ seed: SEED, mode: 'tdm', matchMinutes: 30 });

// map bounds — spawn the horde in a ring around the defenders' muster point
const WORLD = 300; // TILE 3 × GRID 100 (map.ts)
const muster: Vec3 = { x: 0, y: 0, z: 0 };

// the line that holds: a dozen bots at the muster point
const pool = Object.keys(CLASSES) as ClassId[];
for (let i = 0; i < DEFENDERS; i++) {
  const d = w.addSoldier(`D${i}`, pool[i % pool.length], 0, 'bot');
  d.pos = { x: muster.x + (i - DEFENDERS / 2) * 1.6, y: 0, z: muster.z - 6 };
}

// a deterministic scatter for the horde — not the sim rng (keep that for the fight)
let s = 0x1234567;
const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
function hordePos(): Vec3 {
  const a = rand() * Math.PI * 2;
  const r = 14 + rand() * 26; // a shell 14–40u out, closing on the line
  return { x: Math.max(-WORLD / 2 + 4, Math.min(WORLD / 2 - 4, muster.x + Math.cos(a) * r)),
           y: 0, z: Math.max(-WORLD / 2 + 4, Math.min(WORLD / 2 - 4, muster.z + Math.sin(a) * r)) };
}

/** Force the live shambler count to N — spawn replacements for the fallen. */
function topUp() {
  let alive = 0;
  for (const sol of w.soldiers.values()) if (sol.kind === 'zombie' && sol.alive) alive++;
  for (; alive < N; alive++) w.addZombie('zombie', hordePos());
}

const cmds = new Map<number, never>();
topUp();
for (let i = 0; i < WARMUP; i++) { topUp(); w.step(1 / 60, cmds); w.takeEvents(); }

// ---- timed section: step() only ----
const samples: number[] = [];
for (let i = 0; i < MEASURE; i++) {
  topUp();
  const t = performance.now();
  w.step(1 / 60, cmds);
  w.takeEvents();
  samples.push(performance.now() - t);
}
samples.sort((a, b) => a - b);
const mean = samples.reduce((x, y) => x + y, 0) / samples.length;
const p = (q: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))];

let zAlive = 0, dAlive = 0, projectiles = w.projectiles.size;
for (const sol of w.soldiers.values()) {
  if (sol.kind === 'zombie' && sol.alive) zAlive++;
  else if (sol.kind === 'bot' && sol.alive) dAlive++;
}

console.log(`=== ZOMBIE STRESS BENCH — ${N} shamblers vs ${DEFENDERS} defenders, seed ${SEED} ===`);
console.log(`population held: ${zAlive} shamblers alive · ${dAlive} defenders alive · ${projectiles} projectiles in flight`);
console.log(`sim step over ${MEASURE} ticks:`);
console.log(`  mean   ${mean.toFixed(3)} ms   (${(mean / 16.7 * 100).toFixed(1)}% of a 16.7 ms frame)`);
console.log(`  median ${p(0.5).toFixed(3)} ms`);
console.log(`  p95    ${p(0.95).toFixed(3)} ms`);
console.log(`  max    ${samples[samples.length - 1].toFixed(3)} ms`);
