#!/usr/bin/env node
/**
 * Strip every node rotation from a GLB — the LAST step of the model
 * pipeline, always.
 *
 *   node tools/glb-strip-rotations.mjs <file.glb> [--swap-lr]
 *
 * WHY THIS EXISTS (learned twice, expensively): the Blender glTF exporter
 * ALWAYS parks an axis-conversion rotation on the nodes — with
 * export_yup=True it's the Y-up quat, with export_yup=False it's a +90°X
 * "keep it Z-up" quat. Either way the runtime composes it with animation
 * rotations and the model arrives exploded or lying down. The pipeline
 * bakes true three-space coordinates into the MESH DATA, so every node
 * rotation in the file is pure poison: delete them all and the translations
 * and vertices are exactly right as written.
 *
 * --swap-lr renames armL<->armR, legL<->legR, shinL<->shinR (for exports
 * made before the pipeline's classify() learned which side is which).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
const swapLR = process.argv.includes('--swap-lr');
const buf = readFileSync(path);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));

let stripped = 0, renamed = 0;
for (const n of gltf.nodes ?? []) {
  if (n.rotation) { delete n.rotation; stripped++; }
  if (n.matrix) { delete n.matrix; stripped++; }
  if (swapLR && n.name) {
    const m = n.name.match(/^(arm|leg|shin)([LR])$/);
    if (m) { n.name = m[1] + (m[2] === 'L' ? 'R' : 'L'); renamed++; }
  }
}

let jsonOut = Buffer.from(JSON.stringify(gltf), 'utf8');
const pad = (4 - (jsonOut.length % 4)) % 4;
if (pad) jsonOut = Buffer.concat([jsonOut, Buffer.alloc(pad, 0x20)]);
const binChunk = buf.subarray(20 + jsonLen);
const out = Buffer.alloc(12 + 8 + jsonOut.length + binChunk.length);
buf.copy(out, 0, 0, 12);
out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(jsonOut.length, 12);
out.writeUInt32LE(0x4e4f534a, 16);
jsonOut.copy(out, 20);
binChunk.copy(out, 20 + jsonOut.length);
writeFileSync(path, out);
console.log(`${path}: stripped ${stripped} rotations${swapLR ? `, renamed ${renamed} L/R nodes` : ''}`);
