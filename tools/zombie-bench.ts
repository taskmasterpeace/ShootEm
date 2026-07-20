/**
 * ZOMBIE STRESS BENCH (one-shot CLI) — "a large number of shambler zombies on
 * screen in combat," measured so an optimization can be CONFIRMED.
 *
 *   npx tsx tools/zombie-bench.ts [N] [measureTicks]
 *
 * For the tracked sweep + graph across fixes, use tools/bench-track.ts.
 */
import { runBench } from './zombie-bench-core';

const N = Number(process.argv[2] ?? 100);
const MEASURE = Number(process.argv[3] ?? 600);
const r = runBench(N, MEASURE);

console.log(`=== ZOMBIE STRESS BENCH — ${N} shamblers vs ${r.defenders} defenders ===`);
console.log(`population held: ${r.zAlive} shamblers alive`);
console.log(`sim step over ${MEASURE} ticks:`);
console.log(`  mean   ${r.mean.toFixed(3)} ms   (${(r.mean / 16.7 * 100).toFixed(1)}% of a 16.7 ms frame)`);
console.log(`  median ${r.median.toFixed(3)} ms`);
console.log(`  p95    ${r.p95.toFixed(3)} ms`);
console.log(`  max    ${r.max.toFixed(3)} ms`);
