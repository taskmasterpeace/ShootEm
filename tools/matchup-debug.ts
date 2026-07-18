/** dev-only: replay the FIXED matchup setup (ctf + sealed street + flags at
 *  the ends) and watch the gods actually close and fight. */
import { World } from '../src/sim/world';
import { GRID, TILE, WORLD, T_OPEN, T_WALL, T_COVER, T_GRASS } from '../src/sim/map';
import { objectiveFor } from '../src/sim/bots';

const AX0 = 26, AX1 = 74, AZ0 = 48, AZ1 = 53;

const w = new World({ seed: 4207, mode: 'tdm', botsPerTeam: 0, matchMinutes: 15 });
for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
  if (x <= AX0 || x >= AX1 || z <= AZ0 || z >= AZ1) w.map.grid[z * GRID + x] = T_WALL;
}
const g = w.map.grid;
for (let z = AZ0; z <= AZ1; z++) for (let x = AX0; x <= AX1; x++) g[z * GRID + x] = T_OPEN;
for (let x = AX0; x <= AX1; x++) {
  g[AZ0 * GRID + x] = (x - AX0) % 8 === 4 ? T_OPEN : T_WALL;
  g[AZ1 * GRID + x] = (x - AX0) % 8 === 2 ? T_OPEN : T_WALL;
}
for (const [cx, cz] of [[40, 50], [45, 48], [50, 51], [55, 49], [60, 50], [50, 47]] as const) g[cz * GRID + cx] = T_COVER;
for (const [gx, gz] of [[37, 52], [38, 52], [37, 53], [63, 47], [62, 47], [63, 48]] as const) g[gz * GRID + gx] = T_GRASS;

const west = { x: (AX0 + 2.5) * TILE - WORLD / 2, y: 0, z: 50.5 * TILE - WORLD / 2 };
const east = { x: (AX1 - 1.5) * TILE - WORLD / 2, y: 0, z: 50.5 * TILE - WORLD / 2 };
w.map.basePos = [{ x: -30, y: 0, z: west.z }, { x: 30, y: 0, z: west.z }];
w.map.hillPos = { x: 0, y: 0, z: west.z };

const uf = w.addLsw('firebrand', 0, west)!;
const coll = w.addLsw('plaguebearer', 1, east)!;
console.log('spawn dist:', Math.hypot(uf.pos.x - coll.pos.x, uf.pos.z - coll.pos.z).toFixed(1));

for (let t = 0; t < 60; t += 15) {
  for (let i = 0; i < 15 * 20; i++) w.step(0.05, new Map());
  const d = Math.hypot(uf.pos.x - coll.pos.x, uf.pos.z - coll.pos.z);
  const oUf = objectiveFor(w, uf), oColl = objectiveFor(w, coll);
  console.log(`t=${(t + 15).toFixed(0)}s  dist=${d.toFixed(1)}  uf=(${uf.pos.x.toFixed(0)},${uf.pos.z.toFixed(0)})→(${oUf.x.toFixed(0)},${oUf.z.toFixed(0)})  coll=(${coll.pos.x.toFixed(0)},${coll.pos.z.toFixed(0)})→(${oColl.x.toFixed(0)},${oColl.z.toFixed(0)})  hp=${uf.hp.toFixed(0)}/${coll.hp.toFixed(0)}`);
  if (!uf.alive || !coll.alive) { console.log('>>> VERDICT REACHED'); break; }
}
