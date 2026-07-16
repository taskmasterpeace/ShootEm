/**
 * Network + sim performance probe — the audit's "measure first, measure
 * again" instrument. Builds a 24-soldier mid-battle world and reports:
 *   - snapshot bytes: full, culled, and quantized-for-the-wire
 *   - where the bytes live (per snapshot section)
 *   - estimated deflate sizes (what permessage-deflate approaches)
 *   - mean sim step ms against the 16.7ms frame budget
 *
 *   npx tsx tools/perf-probe.ts
 *
 * For the real thing — actual bytes on an actual socket — run
 * tools/wire-verify.ts instead.
 */
import zlib from 'node:zlib';
import { CLASSES } from '../src/sim/data';
import { cullSnapshotFor, takeSnapshot, wireRound } from '../src/sim/snapshot';
import type { ClassId, Soldier } from '../src/sim/types';
import { World } from '../src/sim/world';

const w = new World({ seed: 42, mode: 'conquest', matchMinutes: 8 });
const pool = Object.keys(CLASSES) as ClassId[];
const bots: Soldier[] = [];
for (const team of [0, 1] as const) {
  for (let i = 0; i < 12; i++) bots.push(w.addSoldier(`B${team}-${i}`, pool[i % pool.length], team, 'bot'));
}
// warm the war up so projectiles/gadgets/turrets exist
for (let i = 0; i < 60 * 45; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }

const snap = takeSnapshot(w, []);
const full = JSON.stringify(snap);
const culled = JSON.stringify(cullSnapshotFor(w, snap, bots[0].id));
const wire = JSON.stringify(cullSnapshotFor(w, snap, bots[0].id), wireRound);
const mbps = (bytes: number) => ((bytes * 15 * 8) / 1_000_000).toFixed(2);
console.log('=== NETWORK (24 soldiers, mid-battle, per client at 15Hz) ===');
console.log('full snapshot:     ', (full.length / 1024).toFixed(1), 'KB');
console.log('culled snapshot:   ', (culled.length / 1024).toFixed(1), 'KB =', mbps(culled.length), 'Mbps');
console.log('quantized wire:    ', (wire.length / 1024).toFixed(1), 'KB =', mbps(wire.length), 'Mbps');
for (const level of [1, 6]) {
  const c = zlib.deflateRawSync(wire, { level });
  console.log(`deflated (level ${level}):`, (c.length / 1024).toFixed(1), 'KB =', mbps(c.length), 'Mbps (one-shot; live wire does better)');
}
console.log('--- where the bytes live ---');
const parts: [string, unknown][] = Object.entries(snap);
for (const [k, v] of parts.sort((a, b) => JSON.stringify(b[1]).length - JSON.stringify(a[1]).length).slice(0, 6)) {
  console.log(`  ${k}: ${(JSON.stringify(v).length / 1024).toFixed(1)} KB`);
}
console.log('one soldier:', JSON.stringify(snap.soldiers[0], wireRound).length, 'bytes on the wire ·', snap.soldiers.length, 'soldiers');

console.log('\n=== SIM STEP ===');
const t0 = performance.now();
for (let i = 0; i < 60 * 10; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
console.log('mean step:', ((performance.now() - t0) / 600).toFixed(3), 'ms (24 bots, budget 16.7ms frame)');
