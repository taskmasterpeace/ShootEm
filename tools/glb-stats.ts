/** dev-only: triangle/vertex counts for GLBs. */
import { readFileSync } from 'node:fs';

for (const f of process.argv.slice(2)) {
  const buf = readFileSync(f);
  const jsonLen = buf.readUInt32LE(12);
  const j = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as {
    meshes?: { primitives?: { indices?: number; attributes: Record<string, number> }[] }[];
    accessors?: { count?: number }[];
  };
  let tris = 0, verts = 0;
  for (const m of j.meshes ?? []) for (const p of m.primitives ?? []) {
    tris += p.indices !== undefined ? Math.floor((j.accessors?.[p.indices]?.count ?? 0) / 3) : 0;
    verts += j.accessors?.[p.attributes.POSITION]?.count ?? 0;
  }
  console.log(`${f.split('/').pop()}: ${verts} verts, ${tris} tris`);
}
