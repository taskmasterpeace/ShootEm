// Dump each GLB's world-space bounding box by reading the JSON chunk's
// POSITION accessor min/max. No parser, no three.js — just the container.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function bounds(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) return null; // 'glTF'
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const a = json.accessors?.[prim.attributes?.POSITION];
      if (!a?.min || !a?.max) continue;
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a.min[i]); hi[i] = Math.max(hi[i], a.max[i]); }
    }
  }
  if (!isFinite(lo[0])) return null;
  return { w: hi[0] - lo[0], h: hi[1] - lo[1], d: hi[2] - lo[2], minY: lo[1] };
}

for (const dir of process.argv.slice(2)) {
  console.log(`\n=== ${dir} ===`);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb')).sort()) {
    const p = join(dir, f);
    const b = bounds(p);
    const kb = (statSync(p).size / 1024).toFixed(0);
    console.log(b
      ? `${f.padEnd(22)} ${b.w.toFixed(2).padStart(7)}w ${b.h.toFixed(2).padStart(7)}h ${b.d.toFixed(2).padStart(7)}d  minY=${b.minY.toFixed(2).padStart(6)}  ${kb.padStart(5)}kB`
      : `${f.padEnd(22)} (no POSITION bounds)  ${kb.padStart(5)}kB`);
  }
}
