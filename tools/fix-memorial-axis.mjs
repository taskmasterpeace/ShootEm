#!/usr/bin/env node
/**
 * Normalize public/models/memorial.glb IN PLACE so the game never guesses:
 * feet at the origin, height up +Y, statue centered on X/Z. Verified by
 * printing the before/after spans — run until Y is the tall axis.
 *
 *   node tools/fix-memorial-axis.mjs          # rotate Z90: (x,y,z)→(−y,x,z)
 *   node tools/fix-memorial-axis.mjs flip     # …then 180° about Z if he
 *                                             # lands on his head
 *
 * Works on the raw GLB buffer: POSITION + NORMAL accessors rewritten,
 * min/max refreshed. The node/scene transforms are left untouched — the
 * MESH is the truth the game consumes.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = new URL('../public/models/memorial.glb', import.meta.url);
const flip = process.argv[2] === 'flip';
const buf = readFileSync(PATH);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;

const prim = gltf.meshes[0].primitives[0];

// strip every node TRS — mesh space becomes world space, no middleman
for (const n of gltf.nodes ?? []) {
  console.log('node', n.name, 'rotation', n.rotation ?? '-', 'scale', n.scale ?? '-');
  delete n.rotation; delete n.translation; delete n.scale; delete n.matrix;
}

// auto-detect the tall (height) axis from the POSITION accessor
const pAcc = gltf.accessors[prim.attributes.POSITION];
const spans = pAcc.max.map((m, i) => m - pAcc.min[i]);
const tall = spans.indexOf(Math.max(...spans));
console.log('mesh spans', spans.map((s) => s.toFixed(2)).join(' / '), '— tall axis:', 'XYZ'[tall]);

const rot = ([x, y, z]) => {
  let v;
  if (tall === 1) v = [x, y, z];        // already Y-up
  else if (tall === 0) v = [-y, x, z];  // Z+90: X → Y
  else v = [x, -z, y];                  // X+90: Z → Y
  if (flip) v = [-v[0], -v[1], v[2]];   // 180 about Z if he lands on his head
  return v;
};

function rewrite(accIdx, renormalize) {
  const acc = gltf.accessors[accIdx];
  const bv = gltf.bufferViews[acc.bufferView];
  const off = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const f = new Float32Array(buf.buffer, buf.byteOffset + off, acc.count * 3);
  for (let i = 0; i < acc.count; i++) {
    const [x, y, z] = rot([f[i * 3], f[i * 3 + 1], f[i * 3 + 2]]);
    f[i * 3] = x; f[i * 3 + 1] = y; f[i * 3 + 2] = z;
  }
  return { acc, f };
}

// normals: same rotation, no recentering
rewrite(prim.attributes.NORMAL, true);
// positions: rotate, then plant feet at y=0 and center x/z
const { acc, f } = rewrite(prim.attributes.POSITION, false);
let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < acc.count; i++)
  for (let a = 0; a < 3; a++) {
    mn[a] = Math.min(mn[a], f[i * 3 + a]);
    mx[a] = Math.max(mx[a], f[i * 3 + a]);
  }
const shift = [-(mn[0] + mx[0]) / 2, -mn[1], -(mn[2] + mx[2]) / 2];
for (let i = 0; i < acc.count; i++)
  for (let a = 0; a < 3; a++) f[i * 3 + a] += shift[a];
acc.min = [mn[0] + shift[0], 0, mn[2] + shift[2]];
acc.max = [mx[0] + shift[0], mx[1] + shift[1], mx[2] + shift[2]];

// splice the updated JSON chunk back (padded to 4 bytes with spaces)
let jsonOut = Buffer.from(JSON.stringify(gltf), 'utf8');
const pad = (4 - (jsonOut.length % 4)) % 4;
if (pad) jsonOut = Buffer.concat([jsonOut, Buffer.alloc(pad, 0x20)]);
const binChunk = buf.subarray(20 + jsonLen, buf.length);
const total = 12 + 8 + jsonOut.length + binChunk.length;
const out = Buffer.alloc(total);
buf.copy(out, 0, 0, 12);
out.writeUInt32LE(total, 8);
out.writeUInt32LE(jsonOut.length, 12);
out.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
jsonOut.copy(out, 20);
binChunk.copy(out, 20 + jsonOut.length);
writeFileSync(PATH, out);
const span = [0, 1, 2].map((a) => (acc.max[a] - acc.min[a]).toFixed(2));
console.log(`spans now X ${span[0]}  Y ${span[1]}  Z ${span[2]}  — want Y tallest`);
console.log(acc.max[1] > +span[0] && acc.max[1] > +span[2] ? 'STANDING ✓' : 'still not standing — run with/without "flip"');
