#!/usr/bin/env node
/**
 * Bake picked A/B/C candidates into the shipped pack.
 * The Sound Lab & Review "Export" gives you the command; run it here.
 *
 *   node tools/apply-picks.mjs rifle=2 pistol=1 shotgun=3
 *
 * Copies public/audio/variants/<name>-<i>.wav → public/audio/<name>.wav.
 * (The in-browser pick already plays in-game via IndexedDB; this makes it
 * permanent in the repo for everyone.)
 */
import { existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIO = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
const args = process.argv.slice(2).filter(Boolean);

if (!args.length) {
  console.error('usage: node tools/apply-picks.mjs <name>=<variant> [<name>=<variant> ...]');
  console.error('   e.g. node tools/apply-picks.mjs rifle=2 pistol=1');
  process.exit(1);
}

let ok = 0, fail = 0;
for (const a of args) {
  const m = a.match(/^([a-z_]+)=(\d+)$/);
  if (!m) { console.error(`  skip "${a}" — expected name=number`); fail++; continue; }
  const [, name, i] = m;
  const src = join(AUDIO, 'variants', `${name}-${i}.wav`);
  const dst = join(AUDIO, `${name}.wav`);
  if (!existsSync(src)) { console.error(`  ${name}: variant ${i} not found (${src})`); fail++; continue; }
  copyFileSync(src, dst);
  console.log(`  ${name} ← candidate ${i}`);
  ok++;
}
console.log(`\nApplied ${ok} pick(s)${fail ? `, ${fail} skipped` : ''}. Refresh the game to hear them.`);
