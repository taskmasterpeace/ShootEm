/** GLB inspector — parses the container + JSON chunk, reports what's inside:
 *  meshes, materials, textures, node tree, skins (joints), animations.
 *  Usage: npx tsx tools/glb-inspect.ts <file.glb> [--tree] [--anims] [--full]
 */
import { readFileSync } from 'node:fs';

interface GlbJson {
  asset?: { version?: string; generator?: string };
  meshes?: { name?: string; primitives?: { attributes?: Record<string, number>; material?: number }[] }[];
  accessors?: { count?: number; type?: string; componentType?: number }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorTexture?: unknown; baseColorFactor?: number[] } }[];
  textures?: { name?: string; source?: number }[];
  images?: { name?: string; mimeType?: string }[];
  nodes?: { name?: string; mesh?: number; skin?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  skins?: { name?: string; joints?: number[]; skeleton?: number }[];
  animations?: {
    name?: string;
    channels?: { target?: { node?: number; path?: string } }[];
    samplers?: { input?: number; output?: number }[];
  }[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
}

const path = process.argv[2];
const flags = new Set(process.argv.slice(3));
if (!path) { console.error('usage: glb-inspect <file> [--tree] [--anims]'); process.exit(1); }

const buf = readFileSync(path);
if (buf.readUInt32LE(0) !== 0x46546c67) { console.error('not a GLB (bad magic)'); process.exit(1); }
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as GlbJson;

const names = (arr?: { name?: string }[]) => (arr ?? []).map((x, i) => x.name ?? `#${i}`);
console.log(`file: ${path} (${(buf.length / 1e6).toFixed(1)} MB)`);
console.log(`generator: ${json.asset?.generator ?? '?'} · glTF ${json.asset?.version ?? '?'}`);
console.log(`meshes: ${json.meshes?.length ?? 0} · materials: ${json.materials?.length ?? 0} · textures: ${json.textures?.length ?? 0} · images: ${json.images?.length ?? 0}`);

for (const [i, m] of (json.meshes ?? []).entries()) {
  const prims = m.primitives ?? [];
  const verts = prims.reduce((n, p) => n + (json.accessors?.[p.attributes?.POSITION ?? -1]?.count ?? 0), 0);
  const attrs = prims[0]?.attributes ? Object.keys(prims[0].attributes).join(',') : '';
  console.log(`  mesh[${i}] '${m.name ?? ''}' prims:${prims.length} verts:${verts} attrs:${attrs}`);
}
for (const [i, m] of (json.materials ?? []).entries()) {
  const pbr = m.pbrMetallicRoughness ?? {};
  console.log(`  mat[${i}] '${m.name ?? ''}' tex:${pbr.baseColorTexture ? 'yes' : 'no'} color:${pbr.baseColorFactor?.map((v) => v.toFixed(2)).join(',') ?? '-'}`);
}
for (const [i, img] of (json.images ?? []).entries()) {
  console.log(`  img[${i}] '${img.name ?? ''}' ${img.mimeType ?? ''}`);
}

console.log(`nodes: ${json.nodes?.length ?? 0} · skins: ${json.skins?.length ?? 0} · animations: ${json.animations?.length ?? 0}`);
for (const [si, s] of (json.skins ?? []).entries()) {
  const joints = (s.joints ?? []).map((j) => json.nodes?.[j]?.name ?? `#${j}`);
  console.log(`  skin[${si}] '${s.name ?? ''}' ${joints.length} joints:`);
  console.log(`    ${joints.join(' ')}`);
}
for (const [ai, a] of (json.animations ?? []).entries()) {
  const paths: Record<string, number> = {};
  let maxT = 0;
  for (const ch of a.channels ?? []) {
    const p = ch.target?.path ?? '?';
    paths[p] = (paths[p] ?? 0) + 1;
  }
  for (const s of a.samplers ?? []) {
    const acc = json.accessors?.[s.input ?? -1];
    if (acc?.count) maxT = Math.max(maxT, acc.count);
  }
  const nodes = new Set((a.channels ?? []).map((c) => json.nodes?.[c.target?.node ?? -1]?.name ?? '?'));
  console.log(`  anim[${ai}] '${a.name ?? ''}' channels:${(a.channels ?? []).length} (${Object.entries(paths).map(([k, v]) => `${k}:${v}`).join(' ')}) ~frames:${maxT} targets:${[...nodes].slice(0, 8).join(',')}${nodes.size > 8 ? '…' : ''}`);
}

if (flags.has('--tree')) {
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  const walk = (n: number, d: number) => {
    const node = json.nodes?.[n];
    if (!node) return;
    console.log(`${'  '.repeat(d)}${node.name ?? `#${n}`}${node.mesh !== undefined ? ' [mesh]' : ''}${node.skin !== undefined ? ' [skin]' : ''}`);
    for (const c of node.children ?? []) walk(c, d + 1);
  };
  for (const r of roots) walk(r, 0);
}
