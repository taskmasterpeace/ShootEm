#!/usr/bin/env node
/**
 * ONE COMMAND from an AI-generated GLB to a soldier on the field:
 *
 *   node tools/add-soldier.mjs <input.glb> <class> [pipeline args…]
 *   node tools/add-soldier.mjs "C:/Downloads/my-soldier.glb" heavy
 *
 * Classes: infantry heavy jump engineer medic infiltrator pathfinder ghost
 *
 * Runs the Blender pipeline (orient, bake colors, pose, segment into the
 * animator's eight joints), strips the exporter's node rotations (an
 * unstripped model arrives EXPLODED), and drops the file where the game
 * auto-discovers it — no code edits, the class just wears it on the next
 * reload. Verify on /harness.html ▸ Stage ▸ class ▸ Show Trooper.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLENDER = 'D:/Program Files/Blender Foundation/Blender 5.1/blender.exe';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLASSES = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];

const [input, cls, ...extra] = process.argv.slice(2);
if (!input || !CLASSES.includes(cls)) {
  console.error(`usage: node tools/add-soldier.mjs <input.glb> <${CLASSES.join('|')}> [--flip …]`);
  process.exit(1);
}
if (!existsSync(input)) { console.error(`no such file: ${input}`); process.exit(1); }
if (!existsSync(BLENDER)) { console.error(`Blender not found at ${BLENDER}`); process.exit(1); }

const out = join(ROOT, 'public', 'models', `soldier_${cls}.glb`);
console.log(`→ pipeline: ${input}  →  ${out}  (this takes ~10-15 min; the color bake dominates)`);
execFileSync(BLENDER, [
  '--background', '--python', join(ROOT, 'tools', 'soldier-pipeline.py'), '--',
  input, out, '--mode', 'soldier', ...extra,
], { stdio: 'inherit' });
console.log('→ stripping exporter node rotations (mandatory)');
execFileSync(process.execPath, [join(ROOT, 'tools', 'glb-strip-rotations.mjs'), out], { stdio: 'inherit' });
console.log(`✔ ${cls} now wears this model — reload the game, verify on /harness.html ▸ Stage`);
