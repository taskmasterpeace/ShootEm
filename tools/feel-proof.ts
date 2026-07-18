/** dev-only: dump the feel-pass proof data — the turn flip (old snap vs new
 *  spring), the hold variants, and the flight silhouettes — for the Blender
 *  proof sheet (tools/feel-render.py).
 *
 *  npx tsx tools/feel-proof.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYawSpring, WEAPON_HOLDS, FLIGHT_POSES, RECOIL_SCALE } from '../src/client/animation';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'atlas', 'feel-proof.json');
mkdirSync(dirname(OUT), { recursive: true });

// ---- THE TURN: old snap vs new spring over a 180° flip --------------------
const FRAMES = [0, 3, 8, 20, 45];
const snap = FRAMES.map((f) => (f === 0 ? 0 : Math.PI)); // the old regime: instant
const st = { v: 0 };
const spring: number[] = [];
const diffs: number[] = [];
for (let f = 0; f <= 45; f++) {
  const d = stepYawSpring(st, Math.PI, 1 / 60, true);
  if (FRAMES.includes(f)) { spring.push(st.v); diffs.push(d); }
}

// ---- THE HOLDS: arm/gun deltas off the solved grip per family -------------
const holds = Object.fromEntries(
  ['rifle', 'pistol', 'shotgun', 'at_rocket', 'slugger'].map((f) => [f, WEAPON_HOLDS[f]]),
);

// ---- THE FLIGHTS -----------------------------------------------------------
const flights = {
  inferno: FLIGHT_POSES.inferno,
  stormcaller: FLIGHT_POSES.stormcaller,
  gargoyle: FLIGHT_POSES.gargoyle,
};

const recoil = RECOIL_SCALE;
writeFileSync(OUT, JSON.stringify({ frames: FRAMES, snap, spring, diffs, holds, flights, recoil }, null, 2));
console.log('proof →', OUT);
console.log('snap:', snap.map((v) => v.toFixed(2)).join(' '));
console.log('spring:', spring.map((v) => v.toFixed(2)).join(' '));
console.log('head-lead diff:', diffs.map((v) => v.toFixed(2)).join(' '));
